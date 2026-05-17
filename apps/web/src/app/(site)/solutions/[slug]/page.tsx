import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoLandingPage } from "@/components/SeoLandingPage";
import {
  createMetadata,
  getSeoRoute,
  getSingleSlugParamsForSection,
  pathFromSegments,
} from "@/lib/seo/seo-registry";

type SolutionPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return getSingleSlugParamsForSection("solution");
}

export async function generateMetadata({
  params,
}: SolutionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("solutions", [slug]));

  if (!route) {
    return {};
  }

  return createMetadata(route);
}

export default async function SolutionPage({ params }: SolutionPageProps) {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("solutions", [slug]));

  if (!route) {
    notFound();
  }

  return <SeoLandingPage route={route} />;
}
