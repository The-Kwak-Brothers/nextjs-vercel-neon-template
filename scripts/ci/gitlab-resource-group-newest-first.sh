#!/usr/bin/env bash
# Ensure the GitLab preview resource_group uses process_mode=newest_first.
# resource_group serializes only; without newest_first, stale MR pushes win.
# Requires GITLAB_TOKEN + CI_API_V4_URL + CI_PROJECT_ID (or GITLAB_* overrides).
set -euo pipefail

IID="${1:-${CI_MERGE_REQUEST_IID:-}}"
if [[ ! "$IID" =~ ^[1-9][0-9]*$ ]]; then
  echo "Usage: $0 <merge_request_iid>" >&2
  exit 1
fi

API="${CI_API_V4_URL:-${GITLAB_API_URL:-}}"
PROJECT="${CI_PROJECT_ID:-${GITLAB_PROJECT_ID:-}}"
TOKEN="${GITLAB_TOKEN:-}"

case "${DEPLOY_TARGET:-}" in
  cloud) KEY="preview-${IID}" ;;
  selfhosted)
    case "${SELFHOSTED_PREVIEW_MODE:-dynamic}" in
      dynamic) KEY="preview-${IID}" ;;
      fixed) KEY="preview-selfhosted-fixed" ;;
      *)
        echo "SELFHOSTED_PREVIEW_MODE must be dynamic or fixed." >&2
        exit 1
        ;;
    esac
    ;;
  *)
    echo "DEPLOY_TARGET must be cloud or selfhosted." >&2
    exit 1
    ;;
esac

if [[ -z "$API" || -z "$PROJECT" || -z "$TOKEN" ]]; then
  echo "Set CI_API_V4_URL, CI_PROJECT_ID, and GITLAB_TOKEN to configure process_mode." >&2
  exit 1
fi
if [[ "$API" != https://* ]] || [[ ! "$PROJECT" =~ ^[0-9]+$ ]]; then
  echo "CI_API_V4_URL must use HTTPS and CI_PROJECT_ID must be numeric." >&2
  exit 1
fi

curl --fail --silent --show-error \
  --retry 3 \
  --retry-all-errors \
  --request PUT \
  --header "PRIVATE-TOKEN: $TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"process_mode":"newest_first"}' \
  "$API/projects/$PROJECT/resource_groups/$KEY"

echo
echo "resource_group=$KEY process_mode=newest_first"
