# GitLab `resource_group` + `newest_first`

`resource_group` **serializes** jobs only — it does **not** cancel superseded pipelines.

GitLab defaults to **oldest_first**. For preview pipelines you must set:

```text
process_mode: newest_first
```

This is **pipeline-level**, required for **both** `DEPLOY_TARGET=cloud` and `selfhosted` (see `ci/gitlab-ci.example.yml`).

Dynamic previews use `preview-{IID}`. The fixed-URL selfhosted fallback uses
the global `preview-selfhosted-fixed` group so different MRs cannot race for
the same host port.

Configure via API (idempotent):

```bash
./scripts/ci/gitlab-resource-group-newest-first.sh "$CI_MERGE_REQUEST_IID"
```

The job requires an explicit masked `GITLAB_TOKEN` with API scope; it does not
fall back to the less predictable `CI_JOB_TOKEN` permission model.

Or Project → Settings → CI/CD → Resource groups.
