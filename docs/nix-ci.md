# Nix + CI

## What the flake pins

`flake.nix` provides a reproducible shell with:

- Node.js 22 + npm
- `sops` + `age`
- Vercel CLI
- `actionlint`, `shellcheck`, `yq`, `uv`, and `osv-scanner`
- git, jq, python3

Both GitHub Actions and GitLab CI should invoke quality/deploy scripts via:

```bash
nix develop -c npm run ci:check
nix develop -c npm run ci:ephemeral-db-setup
```

## Host Docker daemon vs Nix `dockerTools`

**These are different things — do not conflate them.**

| Path | What runs | Who builds the image layers |
|------|-----------|-----------------------------|
| `nix develop -c docker build -t … .` | Nix shell puts tools on `PATH`; `docker` CLI talks to the **host Docker daemon** (`DOCKER_HOST` / socket) | **Host Docker** |
| `pkgs.dockerTools.buildLayeredImage` | Pure Nix derivation | **Nix store** (optional later upgrade) |

This template uses the **host daemon** path. The flake does **not** build container images with `dockerTools` by default.

Requirements for selfhosted image builds:

1. Docker daemon reachable from the runner (NixOS: enable `virtualisation.docker` or podman socket).
2. Your user/CI job can access the socket.
3. `nix develop -c` only needs `docker` on `PATH` (from the host profile or a package that provides the client).

Docker socket access is effectively host-root access. The workflows reject fork
previews; additionally protect the `preview` environment/runner so only trusted
same-repository changes can reach a selfhosted deploy job.

## Cachix / binary cache

Cold `nix develop` is slower on first run. Prefer a project Cachix cache for runners. GitLab `cache:` alone is **not** Nix-store-aware.

## Unsupported for “same everywhere”

GitLab.com SaaS runners **without** a Nix daemon or flakes-capable image do not satisfy this template’s parity claim. Prefer a NixOS self-hosted runner sharing `/nix`.
