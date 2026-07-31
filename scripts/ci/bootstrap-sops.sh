#!/usr/bin/env bash
# Create a real SOPS+age file from plaintext kept outside the repository.
set -euo pipefail
umask 077

force=0
if [[ "${1:-}" == "--force" ]]; then
  force=1
elif [[ $# -ne 0 ]]; then
  echo "Usage: AGE_RECIPIENT=age1... SOPS_PLAINTEXT_FILE=/secure/path $0 [--force]" >&2
  exit 2
fi

: "${AGE_RECIPIENT:?Set AGE_RECIPIENT to an age public recipient (age1...), never a private key}"
: "${SOPS_PLAINTEXT_FILE:?Set SOPS_PLAINTEXT_FILE to a completed YAML file outside this repository}"

for command_name in age sops yq realpath; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name is required (use: nix develop)" >&2
    exit 1
  fi
done

if [[ "$AGE_RECIPIENT" == AGE-SECRET-KEY-* ]] || [[ "$AGE_RECIPIENT" == *$'\n'* ]]; then
  echo "AGE_RECIPIENT must be a single-line public recipient, not an age private key." >&2
  exit 1
fi

if ! printf 'recipient validation\n' | age --encrypt --recipient "$AGE_RECIPIENT" >/dev/null; then
  echo "AGE_RECIPIENT is not accepted by age." >&2
  exit 1
fi

if [[ ! -f "$SOPS_PLAINTEXT_FILE" ]] || [[ -L "$SOPS_PLAINTEXT_FILE" ]]; then
  echo "SOPS_PLAINTEXT_FILE must be a regular, non-symlink file." >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
source_path="$(realpath "$SOPS_PLAINTEXT_FILE")"
case "$source_path" in
  "$repo_root"|"$repo_root"/*)
    echo "Refusing plaintext inside the repository: $source_path" >&2
    exit 1
    ;;
esac

if grep -Eq 'replace-in-encrypted-file|AGE-SECRET-KEY-' "$source_path"; then
  echo "Plaintext still contains a placeholder or private age key; refusing to encrypt it." >&2
  exit 1
fi

config_path="$repo_root/secrets/.sops.yaml"
encrypted_path="$repo_root/secrets/secrets.enc.yaml"
if [[ "$force" -ne 1 ]] && { [[ -e "$config_path" ]] || [[ -e "$encrypted_path" ]]; }; then
  echo "SOPS config or encrypted file already exists; review it or rerun with --force." >&2
  exit 1
fi

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

cat >"$temp_dir/sops.yaml" <<EOF
creation_rules:
  - path_regex: secrets\\.enc\\.yaml$
    age: $AGE_RECIPIENT
EOF

sops \
  --encrypt \
  --age "$AGE_RECIPIENT" \
  --input-type yaml \
  --output-type yaml \
  "$source_path" >"$temp_dir/secrets.enc.yaml"

if ! grep -q 'ENC\[AES256_GCM' "$temp_dir/secrets.enc.yaml" ||
  ! grep -q '^sops:' "$temp_dir/secrets.enc.yaml"; then
  echo "SOPS did not produce an encrypted document." >&2
  exit 1
fi
if ! yq eval -e \
  '((del(.sops) | [.. | select(kind == "scalar")] | length) > 0) and (del(.sops) | [.. | select(kind == "scalar")] | all_c(tag == "!!str" and test("^ENC\\[AES256_GCM,")))' \
  "$temp_dir/secrets.enc.yaml" >/dev/null 2>&1; then
  echo "SOPS left plaintext or unsupported values in the encrypted document." >&2
  exit 1
fi

install -m 0644 "$temp_dir/sops.yaml" "$config_path"
install -m 0644 "$temp_dir/secrets.enc.yaml" "$encrypted_path"

echo "Created secrets/.sops.yaml and a SOPS-encrypted secrets/secrets.enc.yaml."
echo "Commit only those encrypted/public-recipient files; remove the external plaintext source."
