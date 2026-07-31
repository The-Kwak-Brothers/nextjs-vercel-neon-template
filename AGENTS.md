# AGENTS.md — Next Neon CI Template

Agent instructions for this finished dual-mode Next.js CI template.

| `DEPLOY_TARGET` | Database | Deploy |
|-----------------|----------|--------|
| `cloud` | Neon ephemeral branches | CI-owned `vercel deploy --prebuilt` only |
| `selfhosted` | Postgres 16 `pr_{N}` DBs | Docker Compose project `preview-pr-{N}` |

Demo surface: `items` table + `/api/health` + `/api/items`. Local offline stack: `docker-compose.local.yml`.

Treat this file plus `README.md` / `secrets/README.md` as the operating instructions for agents working in this repo.

## Commands

```bash
nix develop -c npm ci
DEPLOY_TARGET=selfhosted nix develop -c npm run ci:check
nix develop -c npm run test
nix develop -c npm run db:migrate
nix develop -c npm run db:seed
docker compose -f docker-compose.local.yml up --build
```

## Hard rules

1. Set `DEPLOY_TARGET` explicitly (`cloud` or `selfhosted`). Do not mix cloud Neon URLs with a selfhosted deploy (or the reverse).
2. Never add a second deploy path inside a mode (no Vercel Git auto-deploy alongside CI deploy in cloud mode). **CI owns deploy** in both modes.
3. Never hand-edit `db/migrations/`; use `drizzle-kit generate` (`npm run db:generate`). Migrations are forward-only/additive by default.
4. Selfhosted ≠ Neon OSS. Plain Postgres 16 only.
5. `PreviewDeploy.deploymentId` is required in both modes — Vercel deployment id or compose project `preview-pr-{N}`.
6. Before `CREATE DATABASE pr_{N}`, check `pg_database` (adapter already does). Retries must reuse.
7. App secrets via SOPS+age; never commit plaintext secrets or plaintext age private keys (`AGE-SECRET-KEY-…`).
8. When touching schema/API: run `ci:check-relations` and regenerate OpenAPI (`ci:export-openapi`).
9. Docker images are built with the **host Docker daemon** (`nix develop -c docker build …`), not Nix `dockerTools` — see `docs/nix-ci.md`.
10. Optional AI commit trailer: `Co-authored-by: …`. AI-authored PRs still need human review.
11. Do not claim live Neon/Vercel/GitHub Environment success unless those APIs were actually exercised with real credentials.

## Secrets (SOPS + age)

Committed ciphertext: `secrets/secrets.enc.yaml` + public recipient in `secrets/.sops.yaml`.

**Template demo passphrase path** (shipped for local/agent verification only):

- Passphrase: `Example123!` — **demo-only; rotate before any real project use.**
- Passphrase-wrapped identity: `secrets/template-age-identity.age` (age `--passphrase` armor; not a plaintext `AGE-SECRET-KEY`).
- Values inside the encrypted file are placeholders only — never real Neon/Vercel credentials.

Decrypt with the demo passphrase:

```bash
export DEPLOY_TARGET=cloud   # or selfhosted
export SOPS_AGE_PASSPHRASE='Example123!'
nix develop -c ./scripts/ci/sops-decrypt.sh
# → secrets/secrets.dec.json (gitignored, mode 0600)
```

Regenerate the shipped demo bundle (placeholders only):

```bash
nix develop -c ./scripts/ci/bootstrap-template-secrets.sh --force
```

**Production / CI path** uses a plaintext X25519 identity as `SOPS_AGE_KEY` or `SOPS_AGE_KEY_FILE` (never commit that key). Re-key with `scripts/ci/bootstrap-sops.sh` and store the private key only in the CI secret store. Details: `secrets/README.md`.

## Adapter entrypoints

- `src/lib/infra/` — `getInfraAdapter()` dispatches on `DEPLOY_TARGET`
- `npm run ci:ephemeral-db-setup` / `ci:preview-deploy` / `ci:ephemeral-cleanup`

## Docs map

| Topic          | Path                                |
| -------------- | ----------------------------------- |
| Deploy targets | `docs/deploy-targets.md`            |
| Nix vs Docker  | `docs/nix-ci.md`                    |
| DB conventions | `docs/database-conventions.md`      |
| Secrets / SOPS | `secrets/README.md`                 |
| Preview vhosts | `docs/selfhosted-preview-vhosts.md` |
| Supply chain   | `docs/supply-chain.md`              |
| Cost           | `docs/cost-controls.md`             |
| SEO / AEO      | `docs/seo.md`, `docs/aeo.md`        |
