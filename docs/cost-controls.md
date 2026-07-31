# Cost controls by `DEPLOY_TARGET`

## Cloud (`DEPLOY_TARGET=cloud`)

- **Neon:** enable scale-to-zero / autosuspend; set a project spending limit; delete PR branches on close (`ci:ephemeral-cleanup`).
- **Vercel:** CI-owned `vercel deploy --prebuilt` only. **Disable Vercel Git auto-deploy** for the linked project so you do not pay for dual builds.
- Prefer Vercel Remote Cache when available.
- Configure spend alerts on the Vercel team.

## Selfhosted (`DEPLOY_TARGET=selfhosted`)

- Cost model is **fixed VPS** (~flat monthly). Marginal cost per PR is near zero (disk for `pr_N` DBs + short-lived compose projects).
- Drop PR databases and compose projects on MR close.
- No Neon CU-hours; no Vercel build minutes.
- Tradeoff: no Neon copy-on-write branching — each PR gets migrate+seed on an empty DB.

## Shared

- `scripts/ci/should-deploy.sh` skips deploy when only docs/metadata change.
- GHA `cancel-in-progress` + GitLab `process_mode: newest_first` avoid stacking superseded preview work.
