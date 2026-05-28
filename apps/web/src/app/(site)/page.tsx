import type { Metadata } from "next";

import { SeoLandingPage } from "@/components/SeoLandingPage";
import { createMetadata, getSeoRoute } from "@/lib/seo/seo-registry";

const route = getSeoRoute("/");

// 059 FR-010: verification-токены читаются из runtime-env (Webmaster/GSC),
// поэтому generateMetadata (а не статичный const) — env доступен на request-time.
// Токены появятся в env после регистрации сайта в панелях; до этого meta не
// рендерится (graceful absence).
export async function generateMetadata(): Promise<Metadata> {
  const yandex = process.env.YANDEX_VERIFICATION;
  const google = process.env.GOOGLE_VERIFICATION;

  return {
    ...createMetadata(route!),
    verification: {
      ...(google ? { google } : {}),
      ...(yandex ? { yandex } : {}),
      // Верификация домена Mail.ru (Unisender Go / Mail.ru postmaster) —
      // рендерится как <meta name="mailru-domain"> в <head> главной.
      other: {
        "mailru-domain": "DdQtXnpJN3oLiRCx",
      },
    },
  };
}

export const dynamic = "force-dynamic";

export default function Home() {
  return <SeoLandingPage route={route!} />;
}
