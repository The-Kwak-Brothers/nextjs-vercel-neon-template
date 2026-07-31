import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveSiteUrl();
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
