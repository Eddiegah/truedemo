import type { MetadataRoute } from "next";

const SITE_URL = "https://frontend-dun-chi-56.vercel.app";

// Only the static marketing pages - individual /v/[id] share pages aren't
// listed here since they're dynamic, per-user content, not pages meant for
// general discovery (they're already indexable via robots.txt if linked to,
// just not proactively enumerated in a generated sitemap).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/generate`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
