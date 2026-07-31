# Traefik dynamic previews

`docker-compose.ci.yml` labels the app service for Traefik:

- `traefik.http.routers.preview-{PR}.rule=Host(\`pr-{N}.preview.example.com\`)`
- loadbalancer port `3000`

Run Traefik on the preview host with Docker provider enabled and a wildcard cert resolver. See `docs/selfhosted-preview-vhosts.md` for DNS/TLS and the fixed-URL fallback.
