const DEFAULT_SITE_URL = "http://localhost:3000";

export function resolveSiteUrl(
  raw = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL,
): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid HTTP(S) origin");
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin without credentials, path, query, or hash",
    );
  }

  return parsed.origin;
}
