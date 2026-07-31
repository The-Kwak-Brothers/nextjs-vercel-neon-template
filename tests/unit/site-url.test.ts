import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "@/lib/site-url";

describe("resolveSiteUrl", () => {
  it("normalizes a valid HTTP(S) origin", () => {
    expect(resolveSiteUrl("https://Preview.Example.com:8443/")).toBe(
      "https://preview.example.com:8443",
    );
  });

  it.each([
    "javascript:alert(1)",
    "https://user:password@example.com",
    "https://example.com/path",
    "https://example.com?preview=true",
    "https://example.com/#section",
  ])("rejects non-origin input %s", (value) => {
    expect(() => resolveSiteUrl(value)).toThrow(
      /NEXT_PUBLIC_SITE_URL must be an HTTP\(S\) origin/,
    );
  });
});
