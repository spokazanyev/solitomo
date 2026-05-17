import type { Metadata } from "next";

import { SeoLandingPage } from "@/components/SeoLandingPage";
import { createMetadata, getSeoRoute } from "@/lib/seo/seo-registry";

const route = getSeoRoute("/");

export const metadata: Metadata = createMetadata(route!);

export const dynamic = "force-dynamic";

export default function Home() {
  return <SeoLandingPage route={route!} />;
}
