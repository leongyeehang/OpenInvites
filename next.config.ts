import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/locale/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // Kept as a real package in the image instead of bundled into the server chunks, so the
  // operator command in scripts/ can import it too.
  serverExternalPackages: ["postgres"],
  // Event pages are never indexed or listed (ADR-0004); the page repeats this in a meta tag.
  async headers() {
    return [{ source: "/e/:slug*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default withNextIntl(nextConfig);
