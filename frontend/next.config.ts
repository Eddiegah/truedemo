import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // No CSP here deliberately - Next.js's inline hydration scripts and
        // Vercel's own instrumentation make a strict one easy to get wrong
        // in a way that silently breaks the app. These are the headers
        // that are safe by default with no tradeoff.
        source: "/:path*",
        headers: [
          // This app has a real sign-in flow (GitHub OAuth) - clickjacking
          // protection matters here, not just as boilerplate.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
