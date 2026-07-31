/**
 * SEO smoke — run against a live SEO_BASE_URL when available:
 *   SEO_BASE_URL=http://localhost:3000 npx vitest run tests/seo/smoke.test.ts
 *
 * Skips when BASE_URL is unset so unit CI stays offline-capable.
 */
import { describe, expect, it } from "vitest";

const rawBase =
  process.env.SEO_BASE_URL || process.env.PREVIEW_URL || "";
const base = rawBase.startsWith("http://") || rawBase.startsWith("https://")
  ? rawBase.replace(/\/$/, "")
  : "";

describe.skipIf(!base)("SEO smoke", () => {
  it("home has title, canonical, and parseable JSON-LD", async () => {
    const res = await fetch(`${base}/`);
    expect(res.ok).toBe(true);
    const html = await res.text();
    expect(html).toMatch(/<title[^>]*>.*Next Neon CI Template/i);
    expect(html).toMatch(/rel="canonical"/i);
    const ld = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    expect(ld?.[1]).toBeTruthy();
    const json = JSON.parse(ld![1]!);
    expect(json).toBeTruthy();
  });

  it("serves robots and sitemap", async () => {
    const robots = await fetch(`${base}/robots.txt`);
    expect(robots.ok).toBe(true);
    const sitemap = await fetch(`${base}/sitemap.xml`);
    expect(sitemap.ok).toBe(true);
  });

  it("serves llms.txt", async () => {
    const res = await fetch(`${base}/llms.txt`);
    expect(res.ok).toBe(true);
    const text = await res.text();
    expect(text).toMatch(/Next Neon CI Template/);
  });
});
