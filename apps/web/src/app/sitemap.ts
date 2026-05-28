import type { MetadataRoute } from "next";

import { getProducts } from "@/lib/products/catalog";
import { getSiteUrl, seoRoutes } from "@/lib/seo/seo-registry";

// 059 Phase 0: рендер в runtime — иначе при build-time генерации (1) getSiteUrl()
// падает в localhost-fallback (БД/env недоступны на сборке), (2) getProducts()
// возвращает пустой каталог (нет доступа к Postgres). На runtime обе проблемы
// решаются: env-домен корректен, 66 карточек товаров попадают в карту сайта.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  const staticRoutes = seoRoutes
    .filter((route) => route.indexable)
    .map((route) => ({
      url: `${siteUrl}${route.path}`,
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }));

  const products = await getProducts();
  const productRoutes = products.map((product) => ({
    url: `${siteUrl}/product/${product.slug}/`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.64,
  }));

  return [...staticRoutes, ...productRoutes];
}
