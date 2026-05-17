import type { MetadataRoute } from "next";

import { getProducts } from "@/lib/products/catalog";
import { getSiteUrl, seoRoutes } from "@/lib/seo/seo-registry";

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
