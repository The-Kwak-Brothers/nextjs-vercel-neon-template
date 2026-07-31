#!/usr/bin/env bash
# Hard gate: high+ npm advisories and OSV findings fail CI.
set -euo pipefail

echo "== npm audit (high+) =="
npm audit --audit-level=high
echo "npm audit clean at high+"

if ! command -v osv-scanner >/dev/null 2>&1; then
  echo "osv-scanner is required for ci:audit (use: nix develop)." >&2
  exit 1
fi

echo "== osv-scanner =="
osv-scanner scan source \
  --lockfile package-lock.json \
  --lockfile tools/schemathesis/uv.lock
echo "osv-scanner clean"
