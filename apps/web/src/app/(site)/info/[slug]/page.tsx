import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StaticPageRenderer } from "@/components/static-pages/StaticPageRenderer";
import { createMetadata, getSeoRoute } from "@/lib/seo/seo-registry";
import { getStaticPage } from "@/lib/static-pages/get-static-page";

// Operational info only — the 4 versioned legal docs (offer / privacy /
// pd-policy / terms) live under /legal/* now. See apps/web/src/app/(site)/legal/.
const ALLOWED_SLUGS = ["payment", "delivery", "return", "warranty", "faq"] as const;
type AllowedSlug = (typeof ALLOWED_SLUGS)[number];

// 057 → repo pattern: DB-backed pages are `force-dynamic` so the docker build
// step (where Postgres is unreachable) doesn't try to prerender them and
// crash. Runtime caching is handled by `getStaticPage` itself (60 s in-process
// LRU + afterChange-hook invalidation), so dynamic-rendering is cheap.
// See Dockerfile note: "catalog.ts graceful-fallback'ит на пустой каталог.
// /catalog/[...slug]/ и /product/[slug]/ помечены dynamic = 'force-dynamic'".
export const dynamic = "force-dynamic";

// `generateStaticParams` kept as a hint to Next about the closed set of slugs.
// With force-dynamic it's not prerendered at build, but it keeps the static
// type-narrowing for tooling and lets future migration to ISR be one-line.
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
  return <StaticPageRenderer page={page} section="info" />;
}
