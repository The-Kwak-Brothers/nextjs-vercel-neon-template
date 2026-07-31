#!/usr/bin/env bash
# Exit 0 = should deploy; exit 1 = skip (docs/ci-only changes).
set -euo pipefail

BASE_REF="${SHOULD_DEPLOY_BASE:-origin/main}"

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "Base ref $BASE_REF missing — deploying."
  exit 0
fi

mapfile -t files < <(git diff --name-only "$BASE_REF"...HEAD 2>/dev/null || true)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No diff vs $BASE_REF — deploying."
  exit 0
fi

skip_only=1
for f in "${files[@]}"; do
  case "$f" in
    *.md|LICENSE|public/llms.txt)
      ;;
    *)
      skip_only=0
      break
      ;;
  esac
done

if [[ "$skip_only" -eq 1 ]]; then
  echo "Only docs/metadata changed — skipping deploy."
  exit 1
fi

echo "App-relevant changes detected — deploying."
exit 0
