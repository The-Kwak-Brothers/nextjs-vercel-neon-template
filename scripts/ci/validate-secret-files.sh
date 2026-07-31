#!/usr/bin/env bash
# A filename that claims encryption must contain a real SOPS encrypted document.
set -euo pipefail

failed=0
checked=0
while IFS= read -r file; do
  if [[ -f "$file" ]] &&
    grep -Eaq 'AGE-SECRET-KEY-1[0-9A-Z]{40,}' "$file"; then
    echo "ERROR: $file contains an age private key and must never be committed." >&2
    failed=1
  fi

  case "$(basename "$file")" in
    template-age-identity.age)
      checked=$((checked + 1))
      if [[ -L "$file" ]] ||
        [[ ! -f "$file" ]] ||
        ! grep -q 'BEGIN AGE ENCRYPTED FILE' "$file"; then
        echo "ERROR: $file must be an age --passphrase armored identity (demo wrap)." >&2
        failed=1
      fi
      ;;
    *.enc.*)
      checked=$((checked + 1))
      if [[ -L "$file" ]] ||
        [[ ! -f "$file" ]] ||
        ! grep -q 'ENC\[AES256_GCM' "$file" ||
        ! grep -q '^sops:' "$file"; then
        echo "ERROR: $file is named as encrypted but is not a SOPS encrypted document." >&2
        failed=1
      elif ! command -v yq >/dev/null 2>&1; then
        echo "ERROR: yq is required to prove every value in $file is encrypted." >&2
        failed=1
      elif ! command -v sops >/dev/null 2>&1 ||
        ! command -v jq >/dev/null 2>&1; then
        echo "ERROR: sops and jq are required to validate $file metadata." >&2
        failed=1
      elif ! sops filestatus "$file" |
        jq -e '.encrypted == true' >/dev/null; then
        echo "ERROR: $file does not have valid SOPS encrypted-file metadata." >&2
        failed=1
      elif ! yq eval -e \
        '((del(.sops) | [.. | select(kind == "scalar")] | length) > 0) and (del(.sops) | [.. | select(kind == "scalar")] | all_c(tag == "!!str" and test("^ENC\\[AES256_GCM,")))' \
        "$file" >/dev/null 2>&1; then
        echo "ERROR: $file contains plaintext or unsupported values outside SOPS metadata." >&2
        failed=1
      fi
      ;;
  esac
done < <(git ls-files --cached --others --exclude-standard)

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

if [[ "$checked" -eq 0 ]]; then
  echo "No encrypted secrets file is committed; preview deploys will fail until SOPS is bootstrapped."
else
  echo "Validated $checked encrypted secret artifact(s)."
fi
