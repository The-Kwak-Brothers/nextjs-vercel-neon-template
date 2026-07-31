# DEPLOY_TARGET

| Value | DB | Deploy | deploymentId |
|-------|----|--------|--------------|
| `cloud` | Neon branch `preview/pr-{N}` check-before-create | `vercel deploy --prebuilt` | Vercel deployment id |
| `selfhosted` | Postgres `pr_{N}` with `pg_database` existence check | Docker build + compose up | Compose project `preview-pr-{N}` |

```bash
export DEPLOY_TARGET=cloud      # or selfhosted
npm run ci:ephemeral-db-setup
npm run ci:preview-deploy
npm run ci:ephemeral-cleanup
```

There is no default deploy target. Scripts fail unless `DEPLOY_TARGET` is set
explicitly to `cloud` or `selfhosted`.

For selfhosted previews, `POSTGRES_ADMIN_URL` is used only by the adapter. It
creates an unprivileged `pr_{N}_app` owner role, rotates that role's random
password on setup, revokes public database access, and returns those scoped
credentials to the app. Cleanup drops both the database and managed role.

## Non-goals

- Neon OSS / page-server stack
- Dual Vercel Git + CI deploy in cloud mode
- Fake CoW via prod `pg_dump` into every PR DB

## Env-var contract (`ci-outputs.env`)

```
DEPLOY_TARGET=
DATABASE_URL=
DATABASE_URL_UNPOOLED=
EPHEMERAL_DB_ID=
PREVIEW_URL=
DEPLOYMENT_ID=
PR_NUMBER=
```
