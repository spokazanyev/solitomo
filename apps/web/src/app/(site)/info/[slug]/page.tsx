import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StaticPageRenderer } from "@/components/static-pages/StaticPageRenderer";
import { createMetadata, getSeoRoute } from "@/lib/seo/seo-registry";
import { getStaticPage } from "@/lib/static-pages/get-static-page";

const ALLOWED_SLUGS = [
  "payment",
  "delivery",
  "return",
  "warranty",
  "offer",
  "privacy",
  "pd-policy",
  "terms",
  "faq",
] as const;
type AllowedSlug = (typeof ALLOWED_SLUGS)[number];

export const dynamic = "force-static";
export const revalidate = 300; // 5 min ISR

export function generateStaticParams() {
  return ALLOWED_SLUGS.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!ALLOWED_SLUGS.includes(slug as AllowedSlug)) return {};
  const route = getSeoRoute(`/info/${slug}/`);
  if (!route) return {};
  return createMetadata(route);
}

export default async function InfoPage({ params }: Props) {
  const { slug } = await params;
  if (!ALLOWED_SLUGS.includes(slug as AllowedSlug)) notFound();
  const page = await getStaticPage(slug);
  if (!page) notFound();
  return <StaticPageRenderer page={page} />;
}
