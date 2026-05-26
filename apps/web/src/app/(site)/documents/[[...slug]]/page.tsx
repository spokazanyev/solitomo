import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoLandingPage } from "@/components/SeoLandingPage";
import {
  createMetadata,
  getSeoRoute,
  getStaticParamsForSection,
  pathFromSegments,
} from "@/lib/seo/seo-registry";

type DocumentsPageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

// ISR: страница использует данные из коллекций products/documents (Payload).
// Контент-менеджер добавляет документы через админку — без revalidate
// статика заморозилась бы на build-time, и новые сертификаты не появились бы
// до следующего деплоя. 60s — компромисс между свежестью и нагрузкой.
export const revalidate = 60;

export function generateStaticParams() {
  return [{ slug: undefined }, ...getStaticParamsForSection("document")];
}

export async function generateMetadata({
  params,
}: DocumentsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("documents", slug));

  if (!route) {
    return {};
  }

  return createMetadata(route);
}

export default async function DocumentsPage({ params }: DocumentsPageProps) {
  const { slug } = await params;
  const route = getSeoRoute(pathFromSegments("documents", slug));

  if (!route) {
    notFound();
  }

  return <SeoLandingPage route={route} />;
}
