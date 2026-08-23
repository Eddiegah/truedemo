import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /library shows a signed-in user's own jobs (auth-gated anyway, but
      // no reason to invite crawling); API routes aren't pages.
      disallow: ["/library", "/api/"],
    },
    sitemap: "https://frontend-dun-chi-56.vercel.app/sitemap.xml",
  };
}
