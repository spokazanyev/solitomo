import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/seo/seo-registry";

// 059 Phase 0: runtime-рендер, чтобы host/sitemap указывали на боевой домен
// (а не на build-time localhost-fallback).
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 059 Phase 2 (crawl-budget): закрываем технические/личные/транзакционные
      // разделы и URL с query-параметрами (UTM/фильтры → дубли). Бот тратит
      // лимит обхода только на товары, категории, knowledge и info.
      disallow: [
        "/admin/",
        "/api/",
        "/_next/",
        "/cart/",
        "/checkout/",
        "/payment/",
        "/me/",
        "/*?*",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
