import Link from "next/link";

import { BuyerInfoNav } from "@/components/static-pages/BuyerInfoNav";
import { LexicalRenderer } from "@/components/static-pages/LexicalRenderer";
import {
  createArticleJsonLd,
  createWebPageJsonLd,
} from "@/lib/seo/structured-data";
import type { StaticPageDoc } from "@/lib/static-pages/get-static-page";

type Props = {
  page: StaticPageDoc;
};

function buildJsonLd(page: StaticPageDoc): unknown {
  if (page.category === "policy") {
    return createArticleJsonLd({
      headline: page.title,
      datePublished: page.effectiveFrom,
      dateModified: page.updatedAt,
      publisherName: "ООО «НПП Солитон-1»",
    });
  }
  if (page.category === "faq") {
    // TODO 057: parse FAQ items from Lexical body and emit FAQPage JSON-LD.
    // For now fall back to Article so the page still carries structured data.
    return createArticleJsonLd({
      headline: page.title,
      datePublished: page.effectiveFrom,
      dateModified: page.updatedAt,
      publisherName: "ООО «НПП Солитон-1»",
    });
  }
  return createWebPageJsonLd({
    name: page.title,
    description: page.subtitle,
  });
}

/**
 * Layout shell for any `/info/*` buyer-info page (spec 057, US1).
 *
 * Renders a 2-column grid: sticky sidebar nav (`BuyerInfoNav`) +
 * article body. The breadcrumb, page heading and optional policy
 * version disclaimer live inside the article so prose styling applies
 * consistently.
 */
export function StaticPageRenderer({ page }: Props) {
  const isPolicy = page.category === "policy";
  const showVersionLine = isPolicy && Boolean(page.version) && Boolean(page.effectiveFrom);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-10 md:px-10 lg:grid-cols-[260px_1fr] lg:px-12">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <BuyerInfoNav currentSlug={page.slug} />
      </aside>
      <article className="prose prose-slate max-w-none">
        <nav aria-label="breadcrumb" className="not-prose mb-6 text-sm text-slate-500">
          <Link href="/" className="hover:text-emerald-700">
            Главная
          </Link>
          {" / "}
          <Link href="/info/payment/" className="hover:text-emerald-700">
            Покупателям
          </Link>
          {" / "}
          <span className="text-slate-700">{page.title}</span>
        </nav>
        <h1>{page.title}</h1>
        {page.subtitle ? <p className="lead">{page.subtitle}</p> : null}
        {showVersionLine ? (
          <p className="not-prose text-sm text-slate-500">
            {`Версия ${page.version} · Действует с ${new Date(
              page.effectiveFrom as string,
            ).toLocaleDateString("ru-RU")}`}
          </p>
        ) : null}
        <LexicalRenderer body={page.body} />
      </article>
      <script
        type="application/ld+json"
        // JSON.stringify of compacted schema.org object built above (spec 057, US1).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(page)) }}
      />
    </div>
  );
}
