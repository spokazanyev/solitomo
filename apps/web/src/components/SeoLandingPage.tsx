import { Boxes } from "lucide-react";
import Link from "next/link";

import { TemplateBody } from "@/components/page-templates";
import { getCatalogProducts } from "@/lib/products/source-products";
import {
  b2bFaqsFor,
  catalogFaqsFor,
  knowledgeArticleFor,
  solutionFaqsFor,
} from "@/lib/seo/template-content";
import {
  createBreadcrumbJsonLd,
  createFaqJsonLd,
  createItemListJsonLd,
  createOrganizationJsonLd,
} from "@/lib/seo/structured-data";
import { getSeoRoute, type SeoRoute } from "@/lib/seo/seo-registry";

type SeoLandingPageProps = {
  route: SeoRoute;
};

function JsonLd({ data }: { data: object }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      type="application/ld+json"
    />
  );
}

function HomeHero() {
  return (
    <section className="grid gap-10 py-10 md:py-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
      <div>
        <div className="inline-flex items-center gap-2 rounded-md bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800">
          <Boxes className="h-4 w-4" />
          Модульные PDU российского производства
        </div>
        <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-slate-950 md:text-5xl">
          PDU и блоки розеток 19″ —{" "}
          <span className="text-sky-700">собираем под вашу конфигурацию</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Компания Солитон 19 лет производит стоечные PDU в России. Выберите
          серийную модель в каталоге. Закажите индивидуальную компоновку:
          количество и тип розеток, ток, ввод, контрольные модули. Получите
          коммерческое предложение для тендера или крупной поставки.
        </p>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Модульные PDU Солитон: горизонтальный 1U с мониторингом, вертикальные 0U со Schuko и IEC C13, кабель 32A IEC 60309 — на фоне собственного производства"
        className="block aspect-[3/2] w-full rounded-2xl object-cover lg:aspect-auto lg:h-full lg:min-h-[460px]"
        decoding="async"
        fetchPriority="high"
        src="/home/hero-manufacturing.webp"
      />
    </section>
  );
}


const breadcrumbFallbackLabels: Record<string, string> = {
  b2b: "B2B",
  catalog: "Каталог",
  company: "Компания",
  documents: "Документы",
  knowledge: "База знаний",
  solutions: "Подбор",
};

const breadcrumbFallbackHrefs: Record<string, string> = {
  catalog: "/catalog/pdu/",
  knowledge: "/knowledge/kak-vybrat-pdu/",
  solutions: "/solutions/pdu-dlya-servernogo-shkafa/",
};

function breadcrumbLabel(href: string, segment: string) {
  return getSeoRoute(href)?.h1 ?? breadcrumbFallbackLabels[segment] ?? segment;
}

function breadcrumbHref(href: string, segment: string) {
  return getSeoRoute(href) ? href : (breadcrumbFallbackHrefs[segment] ?? href);
}

function routeEyebrow(route: SeoRoute) {
  const labelsByPath: Record<string, string> = {
    "/b2b/": "Корпоративные поставки",
    "/b2b/custom-pdu/": "PDU под заказ",
    "/b2b/integrators/": "Для интеграторов",
    "/b2b/request-quote/": "Запрос КП",
    "/b2b/tenders/": "Документы для закупок",
    "/documents/": "Документы для закупки",
    "/documents/catalog/": "Каталоги и чертежи",
    "/documents/certificates/": "Сертификаты и паспорта",
    "/company/about/": "О компании",
    "/company/production/": "Производство",
    "/company/contacts/": "Контакты",
  };

  if (labelsByPath[route.path]) {
    return labelsByPath[route.path];
  }

  const labelsByType: Record<SeoRoute["type"], string> = {
    home: "Солитон",
    catalog: "Каталог",
    solution: "Подбор оборудования",
    knowledge: "База знаний",
    b2b: "Корпоративные поставки",
    document: "Документы для закупки",
    company: "Компания",
  };

  return labelsByType[route.type];
}

export function SeoLandingPage({ route }: SeoLandingPageProps) {
  const isHome = route.path === "/";
  const isRequestQuote = route.path === "/b2b/request-quote/";
  const catalogProducts =
    route.type === "catalog" ? getCatalogProducts(route.path).products : [];
  const faqItems =
    route.type === "catalog"
      ? catalogFaqsFor(route.path)
      : route.type === "knowledge"
        ? knowledgeArticleFor(route.path).faqs
        : route.type === "solution"
          ? solutionFaqsFor(route.path)
          : route.type === "b2b"
            ? b2bFaqsFor(route.path)
            : [];
  const breadcrumbs = route.path
    .split("/")
    .filter(Boolean)
    .map((segment, index, segments) => {
      const rawHref = `/${segments.slice(0, index + 1).join("/")}/`;

      return {
        href: breadcrumbHref(rawHref, segment),
        key: `${rawHref}-${index}`,
        label: breadcrumbLabel(rawHref, segment),
      };
    });

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <JsonLd data={createBreadcrumbJsonLd(route)} />
      {isHome ? <JsonLd data={createOrganizationJsonLd()} /> : null}
      {route.type === "catalog" ? (
        <JsonLd data={createItemListJsonLd(route, catalogProducts)} />
      ) : null}
      {faqItems.length ? <JsonLd data={createFaqJsonLd(faqItems)} /> : null}

      <section className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 lg:px-12">
        {!isHome ? (
          <nav className="mt-6 flex flex-wrap gap-2 text-sm text-slate-500">
            <Link href="/">Главная</Link>
            {breadcrumbs.map((item) => (
              <span className="flex gap-2" key={item.key}>
                <span>/</span>
                <Link href={item.href}>{item.label}</Link>
              </span>
            ))}
          </nav>
        ) : null}

        {isHome ? (
          <HomeHero />
        ) : (
          <div className={isRequestQuote ? "py-6" : "py-14"}>
            <p className="mb-5 inline-flex rounded-md bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800">
              {routeEyebrow(route)}
            </p>
            <h1
              className={
                isRequestQuote
                  ? "max-w-4xl text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl"
                  : "max-w-4xl text-4xl font-semibold tracking-normal text-slate-950 md:text-6xl"
              }
            >
              {route.h1}
            </h1>
            <p
              className={
                isRequestQuote
                  ? "mt-4 max-w-3xl text-base leading-7 text-slate-600"
                  : "mt-6 max-w-3xl text-lg leading-8 text-slate-600"
              }
            >
              {route.description}
            </p>
            <p
              className={
                isRequestQuote
                  ? "mt-3 max-w-3xl text-sm leading-6 text-slate-500"
                  : "mt-4 max-w-3xl text-base leading-7 text-slate-500"
              }
            >
              {route.summary}
            </p>
            <div className={isRequestQuote ? "mt-5 flex flex-wrap gap-3" : "mt-8 flex flex-wrap gap-3"}>
              <Link
                className="rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800"
                href={isRequestQuote ? "#rfq-form" : "/b2b/request-quote/"}
              >
                {route.cta}
              </Link>
              <Link
                className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-700 hover:text-sky-800"
                href="/catalog/pdu/"
              >
                В каталог
              </Link>
            </div>
          </div>
        )}

        <TemplateBody route={route} />
      </section>
    </div>
  );
}
