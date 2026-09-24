import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/locale/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // Kept as a real package in the image instead of bundled into the server chunks, so the
  // operator command in scripts/ can import it too.
  serverExternalPackages: ["postgres"],
  async headers() {
    // The title fonts and the curated scenes in public/ are named after their content
    // (src/themes/public-files.test.ts), so what is behind such a name never changes and a browser
    // may keep it for a year without asking again. Anything else there keeps Next.js's default,
    // which asks each time.
    const forAYear = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      // Event pages are never indexed or listed (ADR-0004); the page repeats this in a meta tag.
      { source: "/e/:slug*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/fonts/:file([^/]+\\.[0-9a-f]+\\.woff2)", headers: forAYear },
      { source: "/backgrounds/:file([^/]+\\.[0-9a-f]+\\.svg)", headers: forAYear },
    ];
  },
};

export default withNextIntl(nextConfig);
