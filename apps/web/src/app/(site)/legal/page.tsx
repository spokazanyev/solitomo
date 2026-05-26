import type { Metadata } from "next";
import Link from "next/link";

import { createMetadata, getSeoRoute } from "@/lib/seo/seo-registry";
import { getStaticPage, type StaticPageDoc } from "@/lib/static-pages/get-static-page";

export const dynamic = "force-dynamic";

const LEGAL_SLUGS = ["offer", "privacy", "pd-policy", "terms"] as const;

const LEGAL_LABELS: Record<(typeof LEGAL_SLUGS)[number], { title: string; description: string }> = {
  offer: {
    title: "Публичная оферта",
    description:
      "Договор поставки PDU и блоков розеток. Условия акцепта по ст. 432-435 ГК РФ, предмет, цена, гарантия и порядок разрешения споров.",
  },
  privacy: {
    title: "Политика конфиденциальности",
    description:
      "Какие персональные данные собираются на сайте при оформлении заказа, как они хранятся и защищаются согласно 152-ФЗ.",
  },
  "pd-policy": {
    title: "Политика обработки персональных данных",
    description:
      "Оператор ПДн, цели и правовые основания обработки, права субъекта персональных данных, сроки хранения и порядок реализации прав.",
  },
  terms: {
    title: "Пользовательское соглашение",
    description:
      "Правила использования сайта pdumarket.ru, ответственность сторон, ограничение ответственности и порядок разрешения споров.",
  },
};

const RU_LONG_DATE = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export async function generateMetadata(): Promise<Metadata> {
  const route = getSeoRoute("/legal/");
  if (!route) return {};
  return createMetadata(route);
}

/**
 * /legal/ landing — card-grid of all 4 published legal documents.
 *
 * Each card pulls live version + effectiveFrom from `static_pages.body` so
 * the user / ЮKassa moderator can audit current legal posture at a glance.
 * Docs that aren't published (yet) are skipped gracefully — the grid won't
 * show an empty broken card.
 */
export default async function LegalLandingPage() {
  // Load all 4 in parallel.
  const docs = await Promise.all(
    LEGAL_SLUGS.map(async (slug) => {
      const doc = await getStaticPage(slug);
      return doc ? ({ slug, doc } as { slug: typeof slug; doc: StaticPageDoc }) : null;
    }),
  );
  const visible = docs.filter((d): d is NonNullable<typeof d> => d !== null);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10 lg:px-12">
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
        <span className="text-slate-700">Юридические документы</span>
      </nav>

      <header className="mb-10 border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-950 md:text-4xl">
          Юридические документы
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
          Текущие редакции юридических документов сайта pdumarket.ru.
          Каждый документ хранится с указанием версии и даты вступления в силу
          в соответствии с 152-ФЗ и требованиями ЮKassa.
        </p>
      </header>

      <ul className="grid gap-5 sm:grid-cols-2">
        {visible.map(({ slug, doc }) => {
          const meta = LEGAL_LABELS[slug];
          const versionLine =
            doc.version && doc.effectiveFrom
              ? `${doc.version} · действует с ${RU_LONG_DATE.format(new Date(doc.effectiveFrom))}`
              : null;
          return (
            <li key={slug}>
              <Link
                href={`/legal/${slug}/`}
                className="group block h-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-sky-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold leading-tight text-slate-950 group-hover:text-sky-800">
                    {meta.title}
                  </h2>
                  <span className="shrink-0 rounded bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                    {doc.category === "policy" ? "Политика" : "Документ"}
                  </span>
                </div>
                {versionLine ? (
                  <p className="mt-2 font-mono text-xs text-slate-500">{versionLine}</p>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{meta.description}</p>
                <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-700 group-hover:underline">
                  Открыть
                  <span aria-hidden="true">→</span>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-sm leading-relaxed text-slate-500">
        <p>
          Документы опубликованы ООО «НПП Солитон-1». Архив прошлых редакций
          ведётся в админ-системе сайта и доступен по запросу.
        </p>
        <p className="mt-2">
          По вопросам, связанным с юридическими документами:{" "}
          <Link href="/company/contacts/" className="font-medium text-sky-700 hover:underline">
            /company/contacts/
          </Link>
        </p>
      </footer>
    </div>
  );
}
