#!/usr/bin/env bash
# Schemathesis against PREVIEW_URL when available; otherwise validate OpenAPI locally.
set -euo pipefail

npm run ci:export-openapi

if [[ -z "${PREVIEW_URL:-}" && -f ci-outputs.env ]]; then
  while IFS='=' read -r key value; do
    if [[ "$key" == "PREVIEW_URL" ]]; then
      PREVIEW_URL="$value"
      break
    fi
  done <ci-outputs.env
fi

if [[ -z "${PREVIEW_URL:-}" ]]; then
  echo "PREVIEW_URL unset — skipping live Schemathesis; openapi.json generated."
  exit 0
fi

if [[ "$PREVIEW_URL" != http://* && "$PREVIEW_URL" != https://* ]]; then
  echo "PREVIEW_URL must be an HTTP(S) URL." >&2
  exit 1
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required for the locked Schemathesis environment (use: nix develop)." >&2
  exit 1
fi

# Next standalone handles TRACE before route handlers and returns 500, so the
# coverage phase's unsupported-method sweep cannot be made route-conformant.
# Fuzzing still exercises every documented operation with all response checks.
uv run --project tools/schemathesis --locked \
  schemathesis run openapi.json \
  --url "$PREVIEW_URL" \
  --phases fuzzing \
  --checks all \
  --max-examples 25 \
  --request-timeout 10
