import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoLandingPage } from "@/components/SeoLandingPage";
import {
  createMetadata,
  getSeoRoute,
  getSingleSlugParamsForSection,
  pathFromSegments,
} from "@/lib/seo/seo-registry";

type KnowledgePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return getSingleSlugParamsForSection("knowledge");
}

export async function generateMetadata({
  params,
}: KnowledgePageProps): Promise<Metadata> {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("knowledge", [slug]));

  if (!route) {
    return {};
  }

  return createMetadata(route);
}

export default async function KnowledgePage({ params }: KnowledgePageProps) {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("knowledge", [slug]));

  if (!route) {
    notFound();
  }

  return <SeoLandingPage route={route} />;
}
