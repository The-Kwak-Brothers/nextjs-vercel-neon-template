# Next Neon CI Template

Dual-mode Next.js CI template:

| `DEPLOY_TARGET` | Database | Deploy |
|-----------------|----------|--------|
| `cloud` | Neon ephemeral branches | CI-owned `vercel deploy --prebuilt` |
| `selfhosted` | Postgres 16 `pr_{N}` DBs | Docker Compose (`preview-pr-{N}`) |

Local stack is always offline-capable via `docker-compose.local.yml`.

## Quick start

```bash
npm ci
# or: nix develop -c npm ci
export DEPLOY_TARGET=selfhosted
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/dev
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
docker compose -f docker-compose.local.yml up -d postgres
npm run db:migrate && npm run db:seed
npm run dev
# full stack (app on host port 3123 by default; override with APP_HOST_PORT):
# docker compose -f docker-compose.local.yml up --build
```

## Secrets

The repository ships only a plaintext **schema example**, never a fake
`*.enc.*` file or private age identity. Use `scripts/ci/bootstrap-sops.sh` with
an age public recipient and plaintext kept outside the repository, then store
the private identity in the CI secret `SOPS_AGE_KEY`. See
`secrets/README.md`; preview jobs fail until this bootstrap is complete.

## Verify

```bash
DEPLOY_TARGET=selfhosted nix develop -c npm run ci:check
```

The Nix shell supplies required quality tools such as `osv-scanner`,
`actionlint`, `shellcheck`, `yq`, and `uv`.

## Key paths

- Adapters: `src/lib/infra/`
- CI scripts: `scripts/ci/`
- Secrets: `secrets/` (`secrets/README.md`)
- GitHub Actions: `.github/workflows/ci.yml`
- GitLab example: `ci/gitlab-ci.example.yml` (`process_mode: newest_first` both modes)
- Docs: `docs/`, agent rules: `AGENTS.md`

## Non-goals

- Neon OSS / page-server stack
- Dual Vercel Git + CI deploy
- Nix `dockerTools` as default image builder

See `docs/deploy-targets.md`, `docs/nix-ci.md`, and `docs/cost-controls.md`.
