#!/usr/bin/env bash
# Run SEO/AEO smoke checks against the deployed preview.
set -euo pipefail

if [[ -z "${PREVIEW_URL:-}" && -f ci-outputs.env ]]; then
  while IFS='=' read -r key value; do
    if [[ "$key" == "PREVIEW_URL" ]]; then
      PREVIEW_URL="$value"
      break
    fi
  done <ci-outputs.env
fi

if [[ -z "${PREVIEW_URL:-}" ]]; then
  echo "PREVIEW_URL is required for live SEO/AEO checks." >&2
  exit 1
fi

PREVIEW_URL="$PREVIEW_URL" node <<'NODE'
const parsed = new URL(process.env.PREVIEW_URL);
if (
  !["http:", "https:"].includes(parsed.protocol) ||
  parsed.username ||
  parsed.password ||
  parsed.pathname !== "/" ||
  parsed.search ||
  parsed.hash
) {
  throw new Error("PREVIEW_URL must be an HTTP(S) origin.");
}
NODE

SEO_BASE_URL="$PREVIEW_URL" npm run test:seo
