#!/usr/bin/env bash
# Decrypt and flatten common + DEPLOY_TARGET app secrets into a mode-0600 JSON file.
#
# Auth (first match wins):
#   1. SOPS_AGE_KEY / SOPS_AGE_KEY_FILE — plaintext X25519 identity (CI / production)
#   2. SOPS_AGE_PASSPHRASE + passphrase-wrapped identity (template demo path)
#      Default wrap file: secrets/template-age-identity.age
#      Demo passphrase Example123! is for templates only — rotate before real use.
set -euo pipefail
umask 077

ENC_FILE="${SOPS_FILE:-secrets/secrets.enc.yaml}"
OUT_FILE="${SOPS_OUT:-secrets/secrets.dec.json}"
IDENTITY_AGE_FILE="${SOPS_AGE_IDENTITY_FILE:-secrets/template-age-identity.age}"
TARGET="${DEPLOY_TARGET:?Set DEPLOY_TARGET explicitly to cloud or selfhosted}"

case "$TARGET" in
  cloud|selfhosted) ;;
  *)
    echo "DEPLOY_TARGET must be cloud or selfhosted." >&2
    exit 1
    ;;
esac

for command_name in sops yq; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name is required (use: nix develop)." >&2
    exit 1
  fi
done

if [[ ! -f "$ENC_FILE" ]]; then
  echo "Missing $ENC_FILE. Bootstrap with scripts/ci/bootstrap-template-secrets.sh (demo) or bootstrap-sops.sh." >&2
  exit 1
fi
if ! grep -q 'ENC\[AES256_GCM' "$ENC_FILE" || ! grep -q '^sops:' "$ENC_FILE"; then
  echo "$ENC_FILE is not a SOPS-encrypted document; refusing plaintext fallback." >&2
  exit 1
fi
if ! yq eval -e \
  '((del(.sops) | [.. | select(kind == "scalar")] | length) > 0) and (del(.sops) | [.. | select(kind == "scalar")] | all_c(tag == "!!str" and test("^ENC\\[AES256_GCM,")))' \
  "$ENC_FILE" >/dev/null 2>&1; then
  echo "$ENC_FILE contains plaintext or unsupported values outside SOPS metadata." >&2
  exit 1
fi
if [[ -L "$OUT_FILE" ]] || [[ ! -d "$(dirname "$OUT_FILE")" ]]; then
  echo "SOPS_OUT must target a non-symlink file in an existing directory." >&2
  exit 1
fi

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

# Prefer an explicit X25519 identity (CI secret). Else unlock the template
# passphrase-wrapped identity with SOPS_AGE_PASSPHRASE (demo: Example123!).
if [[ -n "${SOPS_AGE_KEY_FILE:-}" ]]; then
  if [[ ! -f "$SOPS_AGE_KEY_FILE" ]] || [[ -L "$SOPS_AGE_KEY_FILE" ]]; then
    echo "SOPS_AGE_KEY_FILE must be a regular, non-symlink file." >&2
    exit 1
  fi
  export SOPS_AGE_KEY_FILE
elif [[ -n "${SOPS_AGE_KEY:-}" ]]; then
  printf '%s\n' "$SOPS_AGE_KEY" >"$temp_dir/age-key.txt"
  export SOPS_AGE_KEY_FILE="$temp_dir/age-key.txt"
elif [[ -n "${SOPS_AGE_PASSPHRASE:-}" ]]; then
  if [[ ! -f "$IDENTITY_AGE_FILE" ]] || [[ -L "$IDENTITY_AGE_FILE" ]]; then
    echo "SOPS_AGE_IDENTITY_FILE ($IDENTITY_AGE_FILE) must be a regular age armor file." >&2
    exit 1
  fi
  if ! grep -q 'BEGIN AGE ENCRYPTED FILE' "$IDENTITY_AGE_FILE"; then
    echo "$IDENTITY_AGE_FILE must be age --passphrase armor, not a plaintext key." >&2
    exit 1
  fi
  if grep -Eq 'AGE-SECRET-KEY-' "$IDENTITY_AGE_FILE"; then
    echo "$IDENTITY_AGE_FILE still contains a plaintext age private key; refusing." >&2
    exit 1
  fi
  if ! command -v python3 >/dev/null 2>&1 || ! command -v age >/dev/null 2>&1; then
    echo "python3 and age are required to unlock the passphrase-wrapped identity." >&2
    exit 1
  fi
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if ! python3 "$script_dir/age-passphrase.py" decrypt \
    "$IDENTITY_AGE_FILE" "$temp_dir/age-key.txt"; then
    echo "Failed to unlock $IDENTITY_AGE_FILE with SOPS_AGE_PASSPHRASE." >&2
    exit 1
  fi
  if ! grep -q '^AGE-SECRET-KEY-' "$temp_dir/age-key.txt"; then
    echo "Unlocked identity did not contain an age private key." >&2
    exit 1
  fi
  chmod 600 "$temp_dir/age-key.txt"
  export SOPS_AGE_KEY_FILE="$temp_dir/age-key.txt"
else
  echo "Set SOPS_AGE_KEY, SOPS_AGE_KEY_FILE, or SOPS_AGE_PASSPHRASE to decrypt $ENC_FILE." >&2
  exit 1
fi

sops --decrypt --output-type json "$ENC_FILE" >"$temp_dir/decrypted.json"

DECRYPTED_JSON="$temp_dir/decrypted.json" \
  FLAT_JSON="$temp_dir/flat.json" \
  DEPLOY_TARGET="$TARGET" \
  node <<'NODE'
const { readFileSync, writeFileSync } = require("node:fs");

const sourcePath = process.env.DECRYPTED_JSON;
const destinationPath = process.env.FLAT_JSON;
const target = process.env.DEPLOY_TARGET;
if (!sourcePath || !destinationPath || !target) {
  throw new Error("Internal SOPS flattening configuration is incomplete.");
}

const document = JSON.parse(readFileSync(sourcePath, "utf8"));
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
if (!isRecord(document) || !isRecord(document.common) || !isRecord(document[target])) {
  throw new Error(`Encrypted document must contain flat common and ${target} maps.`);
}

const bootstrapKeys = new Set([
  "CI_JOB_TOKEN",
  "GITHUB_TOKEN",
  "GITLAB_TOKEN",
  "NEON_API_KEY",
  "NEON_PROJECT_ID",
  "NEON_DB_PASSWORD",
  "NEON_CONNECTION_TEMPLATE",
  "POSTGRES_ADMIN_URL",
  "SOPS_AGE_KEY",
  "SOPS_AGE_KEY_FILE",
  "SOPS_AGE_PASSPHRASE",
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
]);
const flattened = { ...document.common, ...document[target] };
const output = {};
for (const [key, value] of Object.entries(flattened)) {
  if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
    throw new Error(`Invalid application environment key: ${key}`);
  }
  if (bootstrapKeys.has(key)) {
    throw new Error(`${key} is bootstrap infrastructure state and must stay in the CI secret store.`);
  }
  if (!["string", "number", "boolean"].includes(typeof value)) {
    throw new Error(`${key} must be a scalar string, number, or boolean.`);
  }
  const serialized = String(value);
  if (serialized.includes("\0")) {
    throw new Error(`${key} contains a NUL byte.`);
  }
  output[key] = serialized;
}

writeFileSync(destinationPath, `${JSON.stringify(output, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
NODE

install -m 0600 "$temp_dir/flat.json" "$OUT_FILE"
echo "Prepared layered app secrets for DEPLOY_TARGET=$TARGET at $OUT_FILE."
