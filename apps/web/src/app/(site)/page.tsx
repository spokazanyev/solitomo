import type { Metadata } from "next";

import { SeoLandingPage } from "@/components/SeoLandingPage";
import { createMetadata, getSeoRoute } from "@/lib/seo/seo-registry";

const route = getSeoRoute("/");

export const metadata: Metadata = {
  ...createMetadata(route!),
  // Верификация домена Mail.ru (Unisender Go / Mail.ru postmaster) — рендерится
  // как <meta name="mailru-domain" content="..."> в <head> главной страницы.
  verification: {
    other: {
      "mailru-domain": "DdQtXnpJN3oLiRCx",
    },
  },
};

export const dynamic = "force-dynamic";

export default function Home() {
  return <SeoLandingPage route={route!} />;
}
