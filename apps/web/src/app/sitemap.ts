import type { MetadataRoute } from "next";

import { getProducts } from "@/lib/products/source-products";
import { getSiteUrl, seoRoutes } from "@/lib/seo/seo-registry";

export default function sitemap(): MetadataRoute.Sitemap {
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

  const productRoutes = getProducts().map((product) => ({
    url: `${siteUrl}/product/${product.slug}/`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.64,
  }));

  return [...staticRoutes, ...productRoutes];
}
