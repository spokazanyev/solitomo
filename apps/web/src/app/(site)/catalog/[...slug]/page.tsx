import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoLandingPage } from "@/components/SeoLandingPage";
import {
  createMetadata,
  getSeoRoute,
  getStaticParamsForSection,
  pathFromSegments,
} from "@/lib/seo/seo-registry";

type CatalogPageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getStaticParamsForSection("catalog");
}

export async function generateMetadata({
  params,
}: CatalogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("catalog", slug));

  if (!route) {
    return {};
  }

  return createMetadata(route);
}

export default async function CatalogPage({ params }: CatalogPageProps) {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("catalog", slug));

  if (!route) {
    notFound();
  }

  return <SeoLandingPage route={route} />;
}
