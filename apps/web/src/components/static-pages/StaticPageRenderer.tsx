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
  /**
   * Which top-level section the page lives under. Drives the breadcrumb label
   * and tells the sidebar which group to mark as "current category". Default
   * `"info"` keeps backward compatibility — only the new /legal/[slug]/ route
   * needs to pass `"legal"` explicitly.
   */
  section?: "info" | "legal";
};

const SECTION_META = {
  info: {
    breadcrumbLabel: "Покупателям",
    breadcrumbHref: "/info/payment/",
  },
  legal: {
    breadcrumbLabel: "Юридические документы",
    breadcrumbHref: "/legal/offer/",
  },
} as const;

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

const RU_LONG_DATE = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Layout shell for any `/info/*` buyer-info page (spec 057, US1).
 *
 * Typographic principles applied:
 *  - Restricted body line-length to ~70ch (`max-w-3xl` ≈ 768px) for
 *    comfortable reading; sticky sidebar nav lives in the outer grid.
 *  - Clear visual hierarchy through Tailwind `prose-*` modifiers:
 *    headings have a noticeable size + weight contrast, paragraphs use
 *    relaxed leading (1.65), inline links are brand-coloured with
 *    underline-on-hover (no underline at rest — cleaner blocks).
 *  - Policy documents (offer / privacy / pd-policy / terms) carry a
 *    prominent version badge — important both for legal display and for
 *    the ЮKassa moderation reviewer.
 *  - Breadcrumb is `not-prose` so its styling is independent of the
 *    article body.
 */
export function StaticPageRenderer({ page, section = "info" }: Props) {
  const isPolicy = page.category === "policy";
  const showVersionLine = isPolicy && Boolean(page.version) && Boolean(page.effectiveFrom);
  const sectionMeta = SECTION_META[section];

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-10 md:px-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-12">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <BuyerInfoNav currentSlug={page.slug} currentSection={section} />
      </aside>

      <article className="min-w-0 max-w-3xl">
        {/* Breadcrumb — own typography, not driven by prose */}
        <nav
          aria-label="Хлебные крошки"
          className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500"
        >
          <Link href="/" className="hover:text-sky-700 hover:underline">
            Главная
          </Link>
          <span aria-hidden="true" className="text-slate-300">
            /
          </span>
          <Link href={sectionMeta.breadcrumbHref} className="hover:text-sky-700 hover:underline">
            {sectionMeta.breadcrumbLabel}
          </Link>
          <span aria-hidden="true" className="text-slate-300">
            /
          </span>
          <span className="text-slate-700">{page.title}</span>
        </nav>

        {/* Hero block: title, optional subtitle, version disclaimer for legal docs */}
        <header className="mb-10 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 md:text-4xl">
            {page.title}
          </h1>
          {page.subtitle ? (
            <p className="mt-3 text-base leading-relaxed text-slate-600 md:text-lg">
              {page.subtitle}
            </p>
          ) : null}
          {showVersionLine ? (
            <div className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900">
              <span className="inline-flex items-center gap-1 rounded bg-sky-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Версия
              </span>
              <span className="font-mono">{page.version}</span>
              <span aria-hidden="true" className="text-sky-400">
                ·
              </span>
              <span>
                Действует с {RU_LONG_DATE.format(new Date(page.effectiveFrom as string))}
              </span>
            </div>
          ) : null}
        </header>

        {/* Body — full Tailwind `prose` with brand-aware tweaks */}
        <div
          className={[
            "prose prose-slate max-w-none",
            // Headings: slightly bolder, tighter leading, more breathing room above
            "prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:text-slate-950",
            "prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-2xl prose-h2:tracking-tight md:prose-h2:text-3xl",
            "prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2",
            "prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-lg prose-h3:font-semibold md:prose-h3:text-xl",
            "prose-h4:mt-6 prose-h4:mb-2 prose-h4:text-base prose-h4:font-semibold prose-h4:text-slate-800",
            // Body paragraphs: relaxed leading, normal weight
            "prose-p:leading-relaxed prose-p:text-[15.5px] prose-p:text-slate-700 md:prose-p:text-base",
            // Inline emphasis
            "prose-strong:font-semibold prose-strong:text-slate-900",
            "prose-em:italic prose-em:text-slate-800",
            // Links: brand sky, no default underline (cleaner blocks), underline on hover
            "prose-a:font-medium prose-a:text-sky-700 prose-a:no-underline hover:prose-a:underline prose-a:underline-offset-4",
            // Lists: tighter spacing, brand bullets
            "prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6",
            "prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6",
            "prose-li:my-1.5 prose-li:leading-relaxed prose-li:text-slate-700 prose-li:marker:text-slate-400",
            // Inline code & blockquotes
            "prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.875em] prose-code:font-mono prose-code:text-slate-800 prose-code:before:hidden prose-code:after:hidden",
            "prose-blockquote:border-l-4 prose-blockquote:border-sky-300 prose-blockquote:bg-sky-50/40 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:not-italic prose-blockquote:text-slate-700",
            // Tables
            "prose-table:my-6 prose-table:border prose-table:border-slate-200",
            "prose-th:bg-slate-100 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-sm prose-th:font-semibold prose-th:text-slate-900",
            "prose-td:border-t prose-td:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:text-slate-700",
            // HR
            "prose-hr:my-10 prose-hr:border-slate-200",
          ].join(" ")}
        >
          <LexicalRenderer body={page.body} />
        </div>

        {/* Footer info for legal docs — secondary disclaimer beneath body */}
        {isPolicy ? (
          <footer className="mt-12 border-t border-slate-200 pt-6 text-sm leading-relaxed text-slate-500">
            <p>
              Документ опубликован ООО «НПП Солитон-1»
              {showVersionLine ? (
                <>
                  . Текущая редакция —{" "}
                  <span className="font-mono text-slate-700">{page.version}</span>
                  {" "}от{" "}
                  {RU_LONG_DATE.format(new Date(page.effectiveFrom as string))}.
                </>
              ) : (
                "."
              )}
            </p>
            <p className="mt-2">
              По вопросам, связанным с настоящим документом, обратитесь:{" "}
              <Link href="/company/contacts/" className="font-medium text-sky-700 hover:underline">
                /company/contacts/
              </Link>
            </p>
          </footer>
        ) : null}
      </article>

      <script
        type="application/ld+json"
        // JSON.stringify of compacted schema.org object built above (spec 057, US1).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(page)) }}
      />
    </div>
  );
}
