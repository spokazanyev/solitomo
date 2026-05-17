import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoLandingPage } from "@/components/SeoLandingPage";
import {
  createMetadata,
  getSeoRoute,
  getSingleSlugParamsForSection,
  pathFromSegments,
} from "@/lib/seo/seo-registry";

type CompanyPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return getSingleSlugParamsForSection("company");
}

export async function generateMetadata({
  params,
}: CompanyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("company", [slug]));

  if (!route) {
    return {};
  }

  return createMetadata(route);
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("company", [slug]));

  if (!route) {
    notFound();
  }

  return <SeoLandingPage route={route} />;
}
