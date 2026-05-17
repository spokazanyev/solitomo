import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoLandingPage } from "@/components/SeoLandingPage";
import {
  createMetadata,
  getSeoRoute,
  getStaticParamsForSection,
  pathFromSegments,
} from "@/lib/seo/seo-registry";

type B2BPageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export function generateStaticParams() {
  return [{ slug: undefined }, ...getStaticParamsForSection("b2b")];
}

export async function generateMetadata({
  params,
}: B2BPageProps): Promise<Metadata> {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("b2b", slug));

  if (!route) {
    return {};
  }

  return createMetadata(route);
}

export default async function B2BPage({ params }: B2BPageProps) {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("b2b", slug));

  if (!route) {
    notFound();
  }

  return <SeoLandingPage route={route} />;
}
