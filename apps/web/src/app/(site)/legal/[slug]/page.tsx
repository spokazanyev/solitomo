import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StaticPageRenderer } from "@/components/static-pages/StaticPageRenderer";
import { createMetadata, getSeoRoute } from "@/lib/seo/seo-registry";
import { getStaticPage } from "@/lib/static-pages/get-static-page";

// 4 versioned legal documents previously lived under /info/. Moved to /legal/
// so the URL semantically reflects category (договоры и политики). Operational
// info (payment / delivery / return / warranty / faq) stays under /info/.
const ALLOWED_SLUGS = ["offer", "privacy", "pd-policy", "terms"] as const;
type AllowedSlug = (typeof ALLOWED_SLUGS)[number];

// Same rationale as /info/[slug]/page.tsx — Postgres is unreachable at docker
// build, so prerendering must be deferred to runtime.
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return ALLOWED_SLUGS.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!ALLOWED_SLUGS.includes(slug as AllowedSlug)) return {};
  const route = getSeoRoute(`/legal/${slug}/`);
  if (!route) return {};
  return createMetadata(route);
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  if (!ALLOWED_SLUGS.includes(slug as AllowedSlug)) notFound();
  const page = await getStaticPage(slug);
  if (!page) notFound();
  return <StaticPageRenderer page={page} section="legal" />;
}
