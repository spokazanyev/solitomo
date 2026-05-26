import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  trailingSlash: true,
  async redirects() {
    return [
      // 057 follow-up: 4 versioned legal docs moved from /info/ to /legal/.
      // Permanent (308 — Next preserves method, equivalent to 301 for search
      // engines) so any cached/external links keep working.
      { source: "/info/offer/", destination: "/legal/offer/", permanent: true },
      { source: "/info/privacy/", destination: "/legal/privacy/", permanent: true },
      { source: "/info/pd-policy/", destination: "/legal/pd-policy/", permanent: true },
      { source: "/info/terms/", destination: "/legal/terms/", permanent: true },
    ];
  },
};

export default withPayload(nextConfig);
