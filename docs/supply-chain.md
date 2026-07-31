# Supply-chain scanning

Quality job runs `npm run ci:audit` (`scripts/ci/audit.sh`) as a **hard gate** inside `ci:check`:

1. `npm audit --audit-level=high` — fails the job on high or critical advisories
2. `osv-scanner scan source` against `package-lock.json` and `tools/schemathesis/uv.lock` — required in Nix CI (`osv-scanner` is in `flake.nix`); missing binary fails the job

There is no warn-only / soft mode. Fix high+ findings with compatible upgrades or pin overrides in `package.json` when a transitive advisory has no clean major bump.

Do not use `npm audit fix --force` casually — it often downgrades Next/eslint to incompatible majors.

## Residuals

Document unavoidable residuals here only when a high+ finding cannot be fixed without breaking the template toolchain. As of the current lockfiles, **none**.
