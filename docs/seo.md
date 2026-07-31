# SEO

Shipped hygiene for the demo app:

- Metadata API / `metadata` in `src/app/layout.tsx`
- `src/app/sitemap.ts` → `/sitemap.xml`
- `src/app/robots.ts` → `/robots.txt`
- JSON-LD `Organization` + `WebSite` in the root layout

Preview deployments should set `NEXT_PUBLIC_SITE_URL` to the preview origin so canonicals are not stuck on localhost.

Smoke checks live in `tests/seo/`. Preview jobs run them through
`npm run ci:seo-live`; locally, set `SEO_BASE_URL` before `npm run test:seo`.
