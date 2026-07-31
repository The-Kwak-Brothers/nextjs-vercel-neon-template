# Selfhosted preview vhosts

Goal: `https://pr-{N}.preview.<domain>` for each MR/PR.

## Preferred: wildcard DNS + TLS + dynamic reverse proxy

1. **DNS:** wildcard `*.preview.example.com` → preview host.
2. **TLS:** wildcard cert (ACME DNS-01) or Caddy/Traefik automatic HTTPS with DNS challenge.
3. **Proxy:** Traefik routes `pr-{N}.preview.example.com` → compose project `preview-pr-{N}` app port.

Example Traefik labels: already on `docker-compose.ci.yml` app service.

On deploy, the selfhosted adapter sets:

- `COMPOSE_PROJECT_NAME=preview-pr-{N}` → **deploymentId**
- `PREVIEW_HOST=pr-{N}.preview.<domain>`
- `PREVIEW_URL=https://pr-{N}.preview.<domain>`

## v1 fallback: fixed staging URL

If wildcard DNS/certs are **not** ready, set:

```bash
export SELFHOSTED_PREVIEW_MODE=fixed
export SELFHOSTED_FIXED_PREVIEW_URL=https://staging.example.com
export SELFHOSTED_FIXED_PORT=3000
# or local:
export SELFHOSTED_FIXED_PREVIEW_URL=http://localhost:3000
```

The adapter adds `docker-compose.fixed-preview.yml`, binds that host port to
loopback, and disables Traefik routing labels. Put a host reverse proxy in
front; [`deploy/caddy/Caddyfile.preview`](../deploy/caddy/Caddyfile.preview) is
the Caddy example. The adapter still returns a required `deploymentId`
(`preview-pr-{N}`) for teardown. Contract/e2e jobs then hit the fixed URL (last
deploy wins — acceptable for early selfhosted bring-up).

Do **not** treat the fixed URL as the long-term multi-PR preview model.
