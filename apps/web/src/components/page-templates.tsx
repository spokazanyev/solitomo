import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  FileTextIcon,
  Gauge,
  GitBranch,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CatalogFilterableList } from "@/components/catalog/CatalogFilterableList";
import { ComparisonPlaceholder } from "@/components/comparison/ComparisonPlaceholder";
import { ProductImageZoom } from "@/components/product/ProductImageZoom";
import { RackParametersForm } from "@/components/solutions/RackParametersForm";
import { ContactsTemplate } from "@/components/templates/ContactsTemplate";
import {
  getCatalogFacetGroups,
  getCatalogProducts,
  getProducts,
  type Product,
} from "@/lib/products/catalog";
import { getListingAttributeRows } from "@/lib/products/product-attributes";
import { RfqForm } from "@/components/RfqForm";
import { AddToRfqButton } from "@/components/rfq/RfqCart";
import {
  b2bTrustPoints,
  b2bProcess,
  b2bFaqsFor,
  documentNeeds,
  homeRoutes,
  catalogFaqsFor,
  knowledgeArticleFor,
  relatedRoutesFor,
  selectorSteps,
  solutionFaqsFor,
  trustSignals,
} from "@/lib/seo/template-content";
import type { SeoRoute } from "@/lib/seo/seo-registry";

type TemplateProps = {
  route: SeoRoute;
};

const iconClass = "h-4 w-4";

function SectionHeader({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-slate-950 md:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-base leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function LinkGrid({ route, types }: { route: SeoRoute; types?: SeoRoute["type"][] }) {
  const links = relatedRoutesFor(route, types);

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {links.map((item) => (
        <Link
          className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-sky-400"
          href={item.path}
          key={item.path}
        >
          <span className="text-sm font-semibold text-slate-950">{item.h1}</span>
          <span className="mt-2 block text-sm leading-6 text-slate-600">
            {item.summary}
          </span>
        </Link>
      ))}
    </div>
  );
}

function TrustBand() {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {trustSignals.map((signal) => {
        const content = (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ShieldCheck className={iconClass} />
              {signal.label}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{signal.text}</p>
            {signal.href ? (
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
                Подробнее
                <ArrowRight className="h-3 w-3" />
              </span>
            ) : null}
          </>
        );
        if (signal.href) {
          return (
            <Link
              className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-sky-400 hover:bg-sky-50/40"
              href={signal.href}
              key={signal.label}
            >
              {content}
            </Link>
          );
        }
        return (
          <div className="rounded-lg border border-slate-200 bg-white p-4" key={signal.label}>
            {content}
          </div>
        );
      })}
    </section>
  );
}

function ManufacturingShowcase() {
  const tiles = [
    {
      title: "Паспорта и инструкции",
      text: "Паспорт изделия и инструкция по монтажу/эксплуатации идут с каждой моделью PDU. Подходит для эксплуатации и внутреннего согласования.",
      href: "/documents/",
      Icon: FileText,
    },
    {
      title: "Сертификаты и реестр",
      text: "Сертификаты соответствия и сведения о реестре российской промышленной продукции — для тендеров, конкурсов и закупок по 44/223-ФЗ.",
      href: "/documents/certificates/",
      Icon: ShieldCheck,
    },
    {
      title: "Чертежи и каталог",
      text: "PDF-каталог, габаритные чертежи и спецификации модулей — для инженера, проектировщика и подбора аналога.",
      href: "/documents/catalog/",
      Icon: FileTextIcon,
    },
  ];
  return (
    <section>
      <SectionHeader
        eyebrow="Документы для закупки"
        title="Производственная документация"
        text="Паспорта, сертификаты, реестр, чертежи и каталог Солитон — то, что нужно инженеру, закупщику и тендеру."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            className="rounded-lg border border-slate-200 bg-white p-5 transition hover:border-sky-400"
            href={tile.href}
            key={tile.href}
          >
            <tile.Icon className="h-5 w-5 text-sky-700" />
            <h3 className="mt-4 text-lg font-semibold text-slate-950">{tile.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{tile.text}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-800">
              Открыть раздел
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function FeaturedProducts() {
  const seen = new Set<string>();
  const products: Product[] = [];
  const sources = [
    "/catalog/schuko/",
    "/catalog/iec-c13-c19/",
    "/catalog/pdu-uzip/",
  ];
  for (const path of sources) {
    const listing = await getCatalogProducts(path);
    for (const product of listing.products) {
      if (seen.has(product.slug)) continue;
      seen.add(product.slug);
      products.push(product);
      break;
    }
  }
  if (products.length < 3) {
    const fallback = await getCatalogProducts("/catalog/pdu/");
    for (const product of fallback.products) {
      if (seen.has(product.slug)) continue;
      seen.add(product.slug);
      products.push(product);
      if (products.length >= 3) break;
    }
  }

  return (
    <section>
      <SectionHeader
        eyebrow="Серийные модели"
        title="Готовые блоки розеток — добавьте в корзину и купите"
        text="Самые востребованные конфигурации для быстрого заказа. Если ничего не подошло — сразу под этим блоком можно собрать модульный PDU под свою задачу."
      />
      <div className="mt-6 grid gap-3">
        {products.slice(0, 3).map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <Link
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-700 hover:text-sky-800"
          href="/catalog/pdu/"
        >
          Открыть весь каталог
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function SelectorPanel() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <SlidersHorizontal className={iconClass} />
        Мини-подбор PDU
      </div>
      <ol className="mt-4 grid gap-3">
        {selectorSteps.map((step, index) => (
          <li className="flex gap-3 text-sm leading-6 text-slate-600" key={step}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-50 text-xs font-semibold text-sky-800">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  const imageAlt = `${product.h1}, ${product.sku}`;
  const parameters = getListingAttributeRows(product.attributes);

  return (
    <article className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-sky-400 md:grid-cols-[128px_1fr_180px] md:items-start">
      <ProductImageZoom
        alt={imageAlt}
        buttonClassName="group flex aspect-square cursor-zoom-in items-center justify-center rounded-md border border-slate-100 bg-slate-50 transition hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        image={image || "/placeholders/pdu-silhouette.svg"}
        imageClassName="h-full w-full object-contain p-2 transition group-hover:scale-[1.03]"
        images={product.images.length > 0 ? product.images : undefined}
      />
      <div>
        <p className="font-mono text-xs text-slate-500">{product.sku}</p>
        <Link href={`/product/${product.slug}/`}>
          <h3 className="mt-1 text-base font-semibold leading-6 text-slate-950 hover:text-sky-800">
            {product.h1}
          </h3>
        </Link>
        <div className="mt-3 flex flex-wrap gap-2">
          {product.attributes.functions.all.slice(0, 3).map((badge) => (
            <span
              className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800"
              key={badge}
            >
              {badge}
            </span>
          ))}
        </div>
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {parameters.map(([label, value]) => (
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5" key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
          {product.shortDescription}
        </p>
      </div>
      <div className="grid gap-3 md:min-w-36 md:justify-items-end">
        <p className="text-sm font-semibold text-sky-800">{product.price.display}</p>
        <p className="text-right text-xs leading-5 text-slate-500">
          {product.attributes.availability.label}
        </p>
        <AddToRfqButton
          item={{
            name: product.h1,
            quantity: "1",
            sku: product.sku,
            price: product.price.amount,
            slug: product.slug,
            image: product.images[0],
          }}
        />
        <Link
          className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-sky-700 hover:text-sky-800"
          href={`/product/${product.slug}/`}
        >
          Открыть
        </Link>
      </div>
    </article>
  );
}

const routeToneStyles: Record<string, string> = {
  primary: "bg-sky-50/60 border-sky-200 hover:border-sky-400",
  accent: "bg-white border-slate-200 hover:border-sky-400 hover:bg-sky-50/40",
  neutral: "bg-white border-slate-200 hover:border-sky-400 hover:bg-slate-50",
  dark: "bg-white border-slate-200 hover:border-sky-400 hover:bg-sky-50/40",
};

const routeCtaStyles: Record<string, string> = {
  primary: "bg-sky-700 text-white hover:bg-sky-800",
  accent: "border border-sky-700 text-sky-800 hover:bg-sky-700 hover:text-white",
  neutral: "border border-slate-300 text-slate-700 hover:border-sky-700 hover:text-sky-800",
  dark: "border border-slate-300 text-slate-700 hover:border-sky-700 hover:text-sky-800",
};

function HomeRoutes() {
  return (
    <section>
      <SectionHeader
        eyebrow="Четыре пути работы"
        title="Как купить блоки розеток и PDU Солитон"
        text="От быстрой розничной покупки до изготовления модульного PDU под конкретную конфигурацию стойки — выберите подходящий маршрут."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {homeRoutes.map((route) => {
          const cardClass = routeToneStyles[route.tone];
          const ctaClass = routeCtaStyles[route.tone];
          return (
            <div
              className={`flex flex-col rounded-lg border p-6 transition ${cardClass}`}
              key={route.href}
            >
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                {route.badge}
              </span>
              <h3 className="mt-4 text-xl font-semibold text-slate-950">
                {route.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{route.text}</p>
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-700">
                {route.bullets.map((bullet) => (
                  <li className="flex gap-2" key={bullet}>
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex grow items-end">
                <Link
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold ${ctaClass}`}
                  href={route.href}
                >
                  {route.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function HomeTemplate({ route }: TemplateProps) {
  return (
    <div className="grid gap-14">
      <HomeRoutes />
      <FeaturedProducts />
      <ManufacturingShowcase />
      <section>
        <SectionHeader
          eyebrow="С чего начать"
          title="Выберите раздел для подбора PDU"
          text="Перейдите в каталог по типу монтажа и розеток, откройте сценарий подбора для стойки или статью по выбору, либо отправьте заявку на коммерческое предложение по артикулам или ТЗ."
        />
        <div className="mt-6">
          <LinkGrid route={route} types={["catalog", "solution", "knowledge"]} />
        </div>
      </section>
    </div>
  );
}

export async function CatalogTemplate({ route }: TemplateProps) {
  const listing = await getCatalogProducts(route.path);
  const facetGroups = await getCatalogFacetGroups(route.path);
  const faqs = catalogFaqsFor(route.path);

  return (
    <div className="grid gap-12">
      <CatalogFilterableList
        description={listing.description}
        facetGroups={facetGroups}
        products={listing.products}
        title={listing.title}
        total={listing.total}
      />
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader
            eyebrow="Как выбрать"
            title="Критерии выбора перед запросом КП"
            text="Проверьте ток, розетки, монтаж, ввод и защиту. Если параметров стойки не хватает, отправьте задачу на подбор."
          />
          <div className="mt-6 grid gap-3">
            {["Тип розеток и совместимость с оборудованием", "Ток, ввод и запас по нагрузке", "Монтаж в 1U или вертикально в стойке", "Документы, срок поставки и возможность исполнения под проект"].map((item) => (
              <div className="flex gap-3 text-sm leading-6 text-slate-700" key={item}>
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Gauge className={iconClass} />
            Сравнение параметров
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 py-2 pr-4">Параметр</th>
                  <th className="border-b border-slate-200 py-2 pr-4">Что уточнить</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {[
                  ["Розетки", "Schuko, IEC C13, IEC C19, смешанные"],
                  ["Ток", "16A, 32A, трехфазный ввод"],
                  ["Монтаж", "19 дюймов 1U или вертикальный 0U"],
                  ["Функции", "Защита, мониторинг, управление"],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="border-b border-slate-100 py-3 pr-4 font-medium">{label}</td>
                    <td className="border-b border-slate-100 py-3 pr-4">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section>
        <SectionHeader
          eyebrow="Смежные разделы"
          title="Смежные страницы для выбора"
          text="Перейдите к близким категориям, сценариям применения и материалам по выбору PDU."
        />
        <div className="mt-6">
          <LinkGrid route={route} types={["catalog", "solution", "knowledge"]} />
        </div>
      </section>
      <section>
        <SectionHeader
          eyebrow="FAQ"
          title="Вопросы перед заказом"
          text="Короткие ответы помогают закрыть базовые сомнения до перехода в карточку товара или запрос КП."
        />
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {faqs.map((item) => (
            <div className="rounded-lg border border-slate-200 bg-white p-5" key={item.question}>
              <h3 className="text-base font-semibold text-slate-950">{item.question}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function SolutionTemplate({ route }: TemplateProps) {
  const faqs = solutionFaqsFor(route.path);

  return (
    <div className="grid gap-12">
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <SectionHeader
            eyebrow="Сценарий применения"
            title="От задачи инфраструктуры к параметрам PDU"
            text="Опишите стойку, оборудование и требования к питанию, чтобы перейти к монтажу, току, розеткам и нужным документам."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {selectorSteps.slice(0, 4).map((step) => (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700" key={step}>
                {step}
              </div>
            ))}
          </div>
          <div className="mt-6">
            <RackParametersForm />
          </div>
        </div>
        <SelectorPanel />
      </section>
      <section>
        <SectionHeader
          eyebrow="Подходящие направления"
          title="Следующий шаг после подбора"
          text="Откройте подходящую категорию, сравните форм-факторы или отправьте параметры стойки на КП."
        />
        <div className="mt-6">
          <LinkGrid route={route} types={["catalog", "b2b"]} />
        </div>
      </section>
      {faqs.length ? (
        <section>
          <SectionHeader
            eyebrow="FAQ"
            title="Частые вопросы по сценарию"
            text="Короткие ответы по подбору параметров, монтажу и документам — чтобы перейти к КП или подбору без лишних шагов."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {faqs.map((item) => (
              <div className="rounded-lg border border-slate-200 bg-white p-5" key={item.question}>
                <h3 className="text-base font-semibold text-slate-950">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

const comparisonPages: Record<string, { vendor: string; comment: string }> = {
  "/knowledge/zamena-importnyh-pdu/": {
    vendor: "Импортный PDU",
    comment: "Замена импортного PDU на российский аналог Солитон",
  },
  "/knowledge/pdu-soliton-vs-hyperline/": {
    vendor: "Hyperline",
    comment: "Замена Hyperline PDU на Солитон",
  },
  "/knowledge/zamena-apc-pdu-rossijskij-analog/": {
    vendor: "APC by Schneider Electric",
    comment: "Замена APC PDU на Солитон",
  },
  "/knowledge/analogi-vertiv-eaton-pdu/": {
    vendor: "Vertiv / Eaton",
    comment: "Замена Vertiv или Eaton PDU на Солитон",
  },
  "/knowledge/analogi-rittal-schneider-pdu/": {
    vendor: "Rittal / Schneider Electric",
    comment: "Замена Rittal или Schneider PDU на Солитон",
  },
};

export function KnowledgeTemplate({ route }: TemplateProps) {
  const article = knowledgeArticleFor(route.path);
  const comparison = comparisonPages[route.path];

  return (
    <article className="grid gap-12">
      {comparison ? (
        <ComparisonPlaceholder
          vendorLabel={comparison.vendor}
          rfqComment={comparison.comment}
        />
      ) : null}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <BookOpen className={iconClass} />
            Материал по выбору PDU
          </div>
          <p className="mt-4 text-base leading-7 text-slate-700">{article.intro}</p>
          <div className="mt-5 grid gap-5">
            {article.sections.map((section) => (
              <section className="border-b border-slate-100 pb-4 last:border-0 last:pb-0" key={section.title}>
                <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{section.text}</p>
              </section>
            ))}
          </div>
        </div>
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Search className={iconClass} />
            Следующий шаг
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Перейдите к выбору категории, расчету параметров или запросу
            консультации по стойке.
          </p>
          <Link
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            href="/solutions/pdu-dlya-servernogo-shkafa/"
          >
            Перейти к подбору
            <ArrowRight className={iconClass} />
          </Link>
        </aside>
      </section>
      <section>
        <SectionHeader
          eyebrow="FAQ"
          title="Частые вопросы"
          text="Ответы помогают перейти от общей темы к выбору PDU и не обещают функций без подтверждения по конкретной модели."
        />
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {article.faqs.map((item) => (
            <div className="rounded-lg border border-slate-200 bg-white p-5" key={item.question}>
              <h2 className="text-base font-semibold text-slate-950">{item.question}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionHeader
          eyebrow="Что делать дальше"
          title="Следующий шаг по теме"
          text="Перейдите к подходящей категории каталога или к сценарию подбора, чтобы превратить материал в выбор конкретного PDU."
        />
        <div className="mt-6">
          <LinkGrid route={route} types={["catalog", "solution"]} />
        </div>
      </section>
    </article>
  );
}

function RfqPageTemplate() {
  return (
    <div className="grid gap-10">
      <section
        className="grid scroll-mt-6 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
        id="rfq-form"
      >
        <Suspense
          fallback={
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Загрузка формы запроса КП...
            </div>
          }
        >
          <RfqForm />
        </Suspense>
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ClipboardList className={iconClass} />
            Что ускорит КП
          </div>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
            {[
              "Артикулы или описание нужных PDU.",
              "Количество по каждой позиции.",
              "Город поставки и желаемый срок.",
              "Требования к документам, реестру, счету и доставке.",
              "ТЗ или список оборудования стойки, если нужен подбор.",
            ].map((item) => (
              <div className="flex gap-2" key={item}>
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                {item}
              </div>
            ))}
          </div>
        </aside>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Что будет после отправки</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            {
              title: "Подтверждение",
              text: "Заявка попадёт менеджеру; вы получите email с трекинг-ID.",
            },
            {
              title: "Уточнение",
              text: "Если нужно — менеджер уточнит ток, ввод, документы и сроки.",
            },
            {
              title: "Коммерческое предложение",
              text: "КП и счёт готовятся в течение 1 рабочего дня после согласования параметров.",
            },
          ].map((item, index) => (
            <li
              className="rounded-lg border border-slate-100 bg-slate-50 p-4"
              key={item.title}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-50 text-xs font-semibold text-sky-800">
                {index + 1}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <SectionHeader
          eyebrow="Пока ждёте КП"
          title="Что можно посмотреть параллельно"
          text="Откройте каталог по нужной категории, чтобы добавить ещё позиции в заявку, или скачайте документы для согласования внутри закупки."
        />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { title: "Каталог PDU", href: "/catalog/pdu/" },
            { title: "Фильтры с УЗИП", href: "/catalog/pdu-uzip/" },
            { title: "Документы", href: "/documents/" },
          ].map((item) => (
            <Link
              className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-sky-400"
              href={item.href}
              key={item.href}
            >
              <span className="text-sm font-semibold text-slate-950">{item.title}</span>
              <span className="mt-2 flex items-center gap-1 text-sm font-medium text-sky-700">
                Открыть
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function CustomPduSpotlight() {
  const params = [
    "Количество и тип розеток (Schuko, IEC C13, IEC C19, смешанные).",
    "Ток ввода: 16A, 32A или трёхфазный.",
    "Тип ввода: вилка, IEC 60309, кабельный или клеммный.",
    "Монтаж: 19″ 1U / 2U или вертикальный 0U под высоту стойки.",
    "Опции: УЗИП, мониторинг тока, управление розетками.",
    "Проектные партии и повторяемые поставки.",
  ];
  return (
    <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
      <div>
        <div className="inline-flex items-center gap-2 rounded-md bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-800">
          <Settings2 className="h-3.5 w-3.5" />
          Что можно настроить
        </div>
        <h2 className="mt-4 text-2xl font-semibold leading-tight text-slate-950 md:text-3xl">
          Параметры модульной сборки
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Соберём PDU под конкретную стойку и задачу. Розетки, ввод,
          длина, монтаж, защита и функции — каждое решение фиксируется
          в спецификации и в КП.
        </p>
        <ul className="mt-5 grid gap-2 text-sm leading-6 text-slate-700">
          {params.map((param) => (
            <li className="flex gap-2" key={param}>
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
              {param}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <Link
            className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800"
            href="/b2b/request-quote/"
          >
            Запросить КП на сборку
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="rounded-xl bg-gradient-to-br from-slate-100 to-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Пример сборки под задачу
        </p>
        <dl className="mt-4 grid gap-3">
          {[
            { label: "Стойка", value: "42U, серверный шкаф" },
            { label: "Розетки", value: "16 × IEC C13 + 4 × IEC C19" },
            { label: "Ввод", value: "32A, IEC 60309, кабель 3 м" },
            { label: "Монтаж", value: "Вертикальный 0U" },
            { label: "Опции", value: "Мониторинг тока, УЗИП" },
          ].map((row) => (
            <div className="grid grid-cols-[1fr_2fr] gap-3 border-b border-slate-200/80 pb-2 last:border-0" key={row.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</dt>
              <dd className="text-sm font-semibold text-slate-950">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          Конфигурация на схеме — иллюстративный пример. Реальный
          заказ согласуется по ТЗ, производство и сроки фиксируются в КП.
        </p>
      </div>
    </section>
  );
}

export function B2BTemplate({ route }: TemplateProps) {
  if (route.path === "/b2b/request-quote/") {
    return <RfqPageTemplate />;
  }

  const isCustomPdu = route.path === "/b2b/custom-pdu/";

  return (
    <div className="grid gap-12">
      {isCustomPdu ? <CustomPduSpotlight /> : null}
      {isCustomPdu ? (
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-sky-50/40 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="text-sm leading-6 text-slate-700">
            <p className="font-semibold text-slate-950">Замена импортного PDU?</p>
            <p className="mt-1">
              Если заменяете Hyperline, APC, Vertiv, Eaton, Rittal или Schneider — сравните параметры
              на отдельных страницах с прямыми аналогами Солитон.
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-2 rounded-md border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
            href="/knowledge/zamena-importnyh-pdu/"
          >
            Открыть обзор
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : null}
      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Building2 className={iconClass} />
            Корпоративная закупка
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">
            Быстрый путь от ТЗ к коммерческому предложению
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Отправьте готовые артикулы или опишите задачу: стойку, нагрузку,
            тип розеток, количество, срок поставки, требования к документам и
            условия доставки.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {b2bTrustPoints.map((point) => (
              <div className="flex gap-3 text-sm leading-6 text-slate-700" key={point}>
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                {point}
              </div>
            ))}
          </div>
        </div>
        <Link
          className="rounded-lg bg-slate-950 p-6 text-white transition hover:bg-slate-900"
          href="/b2b/request-quote/"
        >
          <FileTextIcon className="h-6 w-6 text-sky-300" />
          <h2 className="mt-5 text-2xl font-semibold">Запрос КП</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Укажите количество, город, срок, параметры PDU или приложите ТЗ.
            Такой сценарий важнее обычной кнопки “купить” для проектных
            поставок.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-sky-200">
            Перейти к заявке
            <ArrowRight className={iconClass} />
          </span>
        </Link>
      </section>
      <section className="grid gap-4 md:grid-cols-5">
        {b2bProcess.map((step, index) => (
          <div className="rounded-lg border border-slate-200 bg-white p-4" key={step}>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50 text-sm font-semibold text-sky-800">
              {index + 1}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{step}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader
            eyebrow="Для юрлиц"
            title="Какие данные нужны для коммерческого предложения"
            text="Корпоративный покупатель приходит с количеством, сроком, городом доставки, требованиями к документам и иногда с готовым ТЗ."
          />
          <div className="mt-6 grid gap-3">
            {["Компания, ИНН и контактное лицо", "Количество, сроки и город поставки", "Параметры PDU или файл ТЗ", "Нужные документы, счет и условия доставки"].map((item) => (
              <div className="flex items-center gap-3 text-sm text-slate-700" key={item}>
                <ClipboardList className="h-4 w-4 text-sky-700" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Building2 className={iconClass} />
            Что указать в заявке на КП
          </div>
          <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
            {[
              "Компания, ИНН и контактное лицо.",
              "Email и телефон для ответа менеджера.",
              "Что нужно подобрать: артикулы или параметры.",
              "Количество по каждой позиции.",
              "Комментарий, ТЗ или ссылка на оборудование стойки.",
            ].map((field, index) => (
              <li className="flex gap-3" key={field}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-50 text-xs font-semibold text-sky-800">
                  {index + 1}
                </span>
                {field}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <TrustBand />
      {(() => {
        const faqs = b2bFaqsFor(route.path);
        if (!faqs.length) return null;
        return (
          <section>
            <SectionHeader
              eyebrow="FAQ"
              title="Частые вопросы B2B-покупателей"
              text="Закупка, документы, реестр, доставка, оплата и условия объёмных поставок — коротко по делу."
            />
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {faqs.map((item) => (
                <div className="rounded-lg border border-slate-200 bg-white p-5" key={item.question}>
                  <h3 className="text-base font-semibold text-slate-950">{item.question}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })()}
      <section>
        <LinkGrid route={route} types={["catalog", "document", "company"]} />
      </section>
    </div>
  );
}

async function getDocumentRegistry() {
  const registry = new Map<
    string,
    {
      product: Product;
      title: string;
      url: string;
    }
  >();

  const products = await getProducts();
  products.forEach((product) => {
    product.documents.forEach((document) => {
      if (!registry.has(document.url)) {
        registry.set(document.url, {
          product,
          title: document.title,
          url: document.url,
        });
      }
    });
  });

  return Array.from(registry.values()).slice(0, 12);
}

export async function DocumentTemplate({ route }: TemplateProps) {
  const documents = await getDocumentRegistry();

  return (
    <div className="grid gap-12">
      <section>
        <SectionHeader
          eyebrow="Доступные файлы"
          title="Документы из карточек товаров"
          text="Ниже показаны файлы, уже привязанные к товарам Солитон. Недостающие паспорта, сертификаты или сведения по реестру можно запросить вместе с КП."
        />
        <div className="mt-6 grid gap-3">
          {documents.length ? (
            documents.map((document) => (
              <a
                className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm hover:border-sky-400 md:grid-cols-[1fr_180px]"
                href={document.url}
                key={document.url}
                rel="noreferrer"
                target="_blank"
              >
                <span>
                  <span className="flex items-center gap-2 font-semibold text-slate-950">
                    <FileText className="h-4 w-4 text-sky-700" />
                    {document.title}
                  </span>
                  <span className="mt-2 block text-slate-600">
                    {document.product.h1}
                  </span>
                </span>
                <span className="font-mono text-xs text-slate-500 md:text-right">
                  {document.product.sku}
                </span>
              </a>
            ))
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
              Документы пока не привязаны к товарным карточкам. Запросите
              нужный паспорт или сертификат через форму КП.
            </div>
          )}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {documentNeeds.map((doc) => (
          <div className="rounded-lg border border-slate-200 bg-white p-4" key={doc}>
            <FileText className="h-5 w-5 text-sky-700" />
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-800">{doc}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader
            eyebrow="Документы"
            title="Материалы для инженера и закупщика"
            text="Для PDU под проекты и закупки важны паспорта, инструкции, реквизиты, сведения о реестре и PDF-материалы по конкретным моделям."
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ShieldCheck className={iconClass} />
            Проверка утверждений
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Утверждения о реестре, российском производстве и сопоставимости с
            зарубежными аналогами публикуются только после привязки к
            конкретным документам или отзывам.
          </p>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-2xl font-semibold">Не нашли нужный документ?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Укажите модель, артикул или задачу закупки. Менеджер подготовит
              доступные документы вместе с коммерческим предложением.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500"
            href="/b2b/request-quote/"
          >
            Запросить документы
            <ArrowRight className={iconClass} />
          </Link>
        </div>
      </section>
      <section>
        <LinkGrid route={route} types={["b2b", "company", "catalog"]} />
      </section>
    </div>
  );
}

export function CompanyTemplate({ route }: TemplateProps) {
  const isAbout = route.path === "/company/about/";

  return (
    <div className="grid gap-12">
      <TrustBand />
      {isAbout ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-700">
          <p>
            <strong className="text-slate-950">Солитон (международное написание — Soliton)</strong>{" "}
            — российский производитель PDU, блоков розеток и стоечного силового
            оборудования. Компания работает с 2006 года и выпускает модульные
            PDU 19″ для серверных шкафов, ЦОД, телеком-стоек и проектной
            инфраструктуры.
          </p>
        </section>
      ) : null}
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <SectionHeader
            eyebrow="О компании"
            title="Производственный опыт и документы для закупки"
            text="Здесь собраны сведения о компании, производстве, реквизитах и контактах для подготовки коммерческого предложения и документов закупки."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {["История и компетенции", "Производственные возможности", "Документы и подтверждения", "Контакты для закупок"].map((item) => (
              <div className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700" key={item}>
                <GitBranch className="h-4 w-4 shrink-0 text-sky-700" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <Link
          className="h-fit rounded-lg border border-slate-200 bg-white p-5 hover:border-sky-400"
          href="/b2b/request-quote/"
        >
          <Settings2 className="h-5 w-5 text-sky-700" />
          <h2 className="mt-4 text-lg font-semibold text-slate-950">Запросить подбор</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Для проекта лучше сразу отправить параметры стойки, тип розеток,
            ток, количество и срок поставки.
          </p>
        </Link>
      </section>
      <section>
        <LinkGrid route={route} types={["b2b", "document", "catalog"]} />
      </section>
    </div>
  );
}

export function TemplateBody({ route }: TemplateProps) {
  if (route.type === "home") {
    return <HomeTemplate route={route} />;
  }

  if (route.type === "catalog") {
    return <CatalogTemplate route={route} />;
  }

  if (route.type === "solution") {
    return <SolutionTemplate route={route} />;
  }

  if (route.type === "knowledge") {
    return <KnowledgeTemplate route={route} />;
  }

  if (route.type === "b2b") {
    return <B2BTemplate route={route} />;
  }

  if (route.type === "document") {
    return <DocumentTemplate route={route} />;
  }

  if (route.path === "/company/contacts/") {
    return <ContactsTemplate />;
  }

  return <CompanyTemplate route={route} />;
}
