#!/usr/bin/env bash
# Ship demo secrets.enc.yaml + passphrase-wrapped age identity for the template.
# Uses example passphrase Example123! — rotate for any real project.
set -euo pipefail
umask 077

force=0
if [[ "${1:-}" == "--force" ]]; then
  force=1
elif [[ $# -ne 0 ]]; then
  echo "Usage: $0 [--force]" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

for command_name in age age-keygen sops python3 realpath; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name is required (use: nix develop)" >&2
    exit 1
  fi
done

: "${SOPS_AGE_PASSPHRASE:=Example123!}"
export SOPS_AGE_PASSPHRASE

identity_path="$repo_root/secrets/template-age-identity.age"
encrypted_path="$repo_root/secrets/secrets.enc.yaml"
config_path="$repo_root/secrets/.sops.yaml"

if [[ "$force" -ne 1 ]] && {
  [[ -e "$identity_path" ]] || [[ -e "$encrypted_path" ]] || [[ -e "$config_path" ]]
}; then
  echo "Template secrets already present; review or rerun with --force." >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Plaintext stays outside the repo tree (bootstrap-sops refuses in-repo sources).
plain="$work/app-secrets.yaml"
cat >"$plain" <<'YAML'
# Demo/example values only — not real cloud credentials.
common:
  APP_ENVIRONMENT: preview
cloud:
  EXAMPLE_APP_SECRET: example-cloud-app-secret-not-real
selfhosted:
  EXAMPLE_APP_SECRET: example-selfhosted-app-secret-not-real
YAML

age-keygen -o "$work/key.txt" >/dev/null
recipient="$(age-keygen -y "$work/key.txt")"

AGE_RECIPIENT="$recipient" \
  SOPS_PLAINTEXT_FILE="$plain" \
  "$repo_root/scripts/ci/bootstrap-sops.sh" ${force:+--force}

python3 "$repo_root/scripts/ci/age-passphrase.py" encrypt \
  "$work/key.txt" "$work/identity.age"
install -m 0644 "$work/identity.age" "$identity_path"

if grep -Eq 'AGE-SECRET-KEY-' "$identity_path"; then
  echo "Refusing to leave a plaintext age private key in $identity_path." >&2
  rm -f "$identity_path"
  exit 1
fi
if ! grep -q 'BEGIN AGE ENCRYPTED FILE' "$identity_path"; then
  echo "Passphrase wrap did not produce an age armor file." >&2
  exit 1
fi

echo "Wrote $encrypted_path, $config_path, and passphrase-wrapped $identity_path."
echo "Template example passphrase is Example123! — rotate before any real use."
echo "Private key material was not written into the repository."
