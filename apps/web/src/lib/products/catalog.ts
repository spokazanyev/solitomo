import { cache } from "react";

import { getPayload } from "payload";

import config from "@/payload.config";
import { rewriteLegacyAssetUrl } from "@/lib/legacy-assets/url";
import {
  getProductAttributeRows,
  normalizeProductAttributes,
  type ProductAttributes,
} from "@/lib/products/product-attributes";
import { getSiteUrl } from "@/lib/seo/seo-registry";
import type {
  Category as PayloadCategory,
  Document as PayloadDocument,
  Product as PayloadProduct,
} from "@/payload-types";

type CategoryLink = {
  name: string;
  url: string;
};

type DocumentLink = {
  title: string;
  url: string;
};

export type Product = {
  attributes: ProductAttributes;
  badges: string[];
  breadcrumbs?: string;
  categories: CategoryLink[];
  description: string;
  documents: DocumentLink[];
  h1: string;
  images: string[];
  legacyUrl: string;
  price: {
    amount: number | null;
    display: string;
    currency: "RUB";
    updatedAt?: string;
  };
  shortDescription: string;
  sku: string;
  slug: string;
  specs: string[];
  title: string;
};

type CatalogRule = {
  description: string;
  matcher: (product: Product) => boolean;
  path: string;
  title: string;
};

type CatalogFacetDefinition = {
  label: string;
  options: {
    label: string;
    path: string;
  }[];
};

export type CatalogFacetGroup = {
  label: string;
  options: {
    count: number;
    current: boolean;
    label: string;
    path: string;
  }[];
};

export type CatalogAttributeStatsGroup = {
  label: string;
  options: {
    count: number;
    label: string;
  }[];
};

function formatPrice(amount: number | null) {
  if (amount === null) {
    return "Цена по запросу";
  }

  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amount);
}

function derivePriceValidUntil(updatedAt?: string): string | undefined {
  if (!updatedAt) return undefined;
  const base = new Date(updatedAt);
  if (Number.isNaN(base.getTime())) return undefined;
  base.setDate(base.getDate() + 90);
  return base.toISOString().slice(0, 10);
}

function uniqueText(parts: string[]) {
  const seen = new Set<string>();

  return parts.filter((part) => {
    const cleanPart = part.trim();
    const key = cleanPart.toLowerCase().replace(/ё/g, "е");

    if (!cleanPart || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getProductBaseName(attributes: ProductAttributes) {
  if (attributes.productType.value === "monitoring_controller") {
    return "Контроллер мониторинга PDU";
  }

  if (attributes.productType.value === "surge_filter") {
    return attributes.mounting.value === "rack_19_1u"
      ? "Сетевой фильтр 19” 1U"
      : "Сетевой фильтр";
  }

  if (attributes.mounting.value === "vertical") {
    return "Вертикальный PDU";
  }

  if (attributes.mounting.value === "rack_19_1u") {
    return "Блок розеток 19” 1U";
  }

  return "PDU / блок розеток";
}

function buildProductDisplayName(
  raw: { sku: string; title: string; shortDesc?: string; specs?: string[] },
  attributes: ProductAttributes,
) {
  const sourceText = [raw.sku, raw.title, raw.shortDesc, raw.specs?.join(" ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/ё/g, "е");
  const hasExplicitMonitoring = /монитор|измер|snmp|контроллер|контроль/.test(sourceText);
  const parts = [
    getProductBaseName(attributes),
    raw.sku,
    attributes.outletCount.value && attributes.outletTypes.value?.length
      ? `${attributes.outletCount.label} ${attributes.outletTypes.label}`
      : "",
    attributes.maxCurrent.value ? attributes.maxCurrent.label : "",
    attributes.inputType.value ? `ввод ${attributes.inputType.label}` : "",
    attributes.functions.protection.includes("УЗИП") ? "с УЗИП" : "",
    attributes.functions.monitoring.length && hasExplicitMonitoring ? "с мониторингом" : "",
    attributes.functions.management.length ? "с управлением" : "",
  ];

  const displayName = uniqueText(parts).join(", ");
  return displayName || raw.title.replace(/\s+/g, " ").trim();
}

function buildBadges(doc: PayloadProduct, categories: CategoryLink[]) {
  const clusters = categories.map((category) => category.name);
  const badges: string[] = [...clusters];
  const text = `${doc.title ?? ""} ${doc.shortDescription ?? ""}`;

  const specMatch = text.match(
    /(\d+)\s*(розет|schuko|c13|c19)/i,
  );
  if (specMatch) {
    badges.push(specMatch[0].slice(0, 36));
  }

  return Array.from(new Set(badges)).slice(0, 8);
}

function categoryLinksFromPayload(
  raw: PayloadProduct["categories"],
): CategoryLink[] {
  if (!raw) return [];
  const links: CategoryLink[] = [];
  for (const entry of raw) {
    if (typeof entry === "number") continue;
    const slug = entry.slug;
    const name = entry.title;
    if (!slug || !name) continue;
    links.push({ name, url: `/catalog/${slug}/` });
  }
  return links;
}

function documentLinksFromPayload(
  raw: PayloadProduct["documents"],
): DocumentLink[] {
  if (!raw) return [];
  const links: DocumentLink[] = [];
  for (const entry of raw) {
    if (typeof entry === "number") continue;
    if (entry.status && entry.status !== "published") continue;
    const url = rewriteLegacyAssetUrl(entry.externalUrl);
    if (!url) continue;
    links.push({ title: entry.title || "Документ", url });
  }
  return links;
}

function imageLinksFromPayload(doc: PayloadProduct): string[] {
  const links = (doc.imageLinks ?? [])
    .slice()
    .sort((a, b) => {
      const aPrimary = a.role === "primary" ? 0 : 1;
      const bPrimary = b.role === "primary" ? 0 : 1;
      return aPrimary - bPrimary;
    })
    .map((entry) => rewriteLegacyAssetUrl(entry.url ?? ""))
    .filter(Boolean);
  return Array.from(new Set(links));
}

function mapPayloadProductToProduct(doc: PayloadProduct): Product {
  const categories = categoryLinksFromPayload(doc.categories);
  const priceAmount =
    doc.price?.status === "published" && typeof doc.price.amount === "number"
      ? doc.price.amount
      : null;
  const attributeInput = {
    categories: categories.map((category) => ({ name: category.name })),
    clusters: categories.map((category) => category.name),
    descriptionText: doc.description ?? doc.sourceRawDescription ?? "",
    documents: doc.documents
      ? doc.documents
          .filter((entry): entry is PayloadDocument => typeof entry !== "number")
          .map((entry) => ({
            title: entry.title || "",
            url: entry.externalUrl ?? "",
          }))
      : undefined,
    shortDesc: doc.shortDescription ?? "",
    sku: doc.sku,
    specs: [],
    title: doc.sourceRawTitle ?? doc.title,
  };
  const attributes = normalizeProductAttributes(attributeInput);
  const h1 = buildProductDisplayName(
    { sku: doc.sku, title: doc.title, shortDesc: doc.shortDescription ?? "" },
    attributes,
  );

  return {
    attributes,
    badges: buildBadges(doc, categories),
    breadcrumbs: categories[0]?.name,
    categories,
    description: doc.description ?? doc.shortDescription ?? "",
    documents: documentLinksFromPayload(doc.documents),
    h1,
    images: imageLinksFromPayload(doc),
    legacyUrl: doc.sourceUrl ?? "",
    price: {
      amount: priceAmount,
      display: formatPrice(priceAmount),
      currency: "RUB",
      updatedAt: doc.updatedAt,
    },
    shortDescription:
      doc.shortDescription ||
      `PDU Солитон ${doc.sku}${categories.length ? `: ${categories.map((category) => category.name).join(", ")}` : ""}.`,
    sku: doc.sku,
    slug: doc.slug,
    specs: [],
    title: doc.title,
  };
}

type CatalogData = {
  products: Product[];
  productsBySlug: Map<string, Product>;
  categoriesBySlug: Map<string, PayloadCategory>;
};

const loadCatalog = cache(async (): Promise<CatalogData> => {
  try {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: "products",
      depth: 1,
      limit: 1000,
      overrideAccess: true,
      where: {
        status: { equals: "published" },
      },
    });
    const products = result.docs.map(mapPayloadProductToProduct);
    const productsBySlug = new Map(products.map((product) => [product.slug, product]));

    const categoriesResult = await payload.find({
      collection: "categories",
      depth: 0,
      limit: 200,
      overrideAccess: true,
      where: {
        status: { equals: "published" },
      },
    });
    const categoriesBySlug = new Map(
      categoriesResult.docs.map((doc) => [doc.slug, doc]),
    );

    return { products, productsBySlug, categoriesBySlug };
  } catch (error) {
    console.warn(
      "[catalog] Payload load failed; rendering empty catalog. Reason:",
      error instanceof Error ? error.message : error,
    );
    return {
      products: [],
      productsBySlug: new Map(),
      categoriesBySlug: new Map(),
    };
  }
});

function searchableText(product: Product) {
  return [
    product.sku,
    product.title,
    product.h1,
    product.shortDescription,
    product.description,
    product.categories.map((category) => category.name).join(" "),
    product.badges.join(" "),
    product.specs.join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .replace(/ё/g, "е");
}

function matchesAny(product: Product, patterns: RegExp[]) {
  const text = searchableText(product);
  return patterns.some((pattern) => pattern.test(text));
}

const catalogRules: CatalogRule[] = [
  {
    path: "/catalog/pdu/",
    title: "Весь ассортимент",
    description:
      "Горизонтальные и вертикальные модели, Schuko и IEC C13/C19, 16A и 32A, проектные исполнения.",
    matcher: () => true,
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/",
    title: "Горизонтальные блоки 19 дюймов 1U",
    description:
      "Модели для установки в стандартную стойку 19 дюймов: базовые, IEC, Schuko, 16A и 32A.",
    matcher: (product) => matchesAny(product, [/19[”"\s]*1u/i, /19 дюйм/i]),
  },
  {
    path: "/catalog/vertical-pdu/",
    title: "Вертикальные PDU",
    description:
      "Вертикальные блоки розеток для стоек с высокой плотностью оборудования и проектной разводкой питания.",
    matcher: (product) => matchesAny(product, [/вертикаль/i, /верт\./i, /0u/i, /42u/i]),
  },
  {
    path: "/catalog/schuko/",
    title: "PDU с розетками Schuko",
    description:
      "Блоки розеток с евророзетками Schuko для оборудования, которому не требуется IEC-подключение.",
    matcher: (product) => matchesAny(product, [/schuko/i, /евро/i]),
  },
  {
    path: "/catalog/iec-c13-c19/",
    title: "PDU IEC C13 / C19",
    description:
      "Модели с IEC320 C13 и IEC320 C19 для серверного, сетевого и телеком-оборудования.",
    matcher: (product) => matchesAny(product, [/c13/i, /c19/i, /iec\s*320/i]),
  },
  {
    path: "/catalog/16a/",
    title: "PDU 16A",
    description:
      "Модели 16A для стандартных стоечных задач: 1U, вертикальные, Schuko и IEC-конфигурации.",
    matcher: (product) => matchesAny(product, [/16\s*[aа]/i, /16а/i]),
  },
  {
    path: "/catalog/32a/",
    title: "PDU 32A",
    description:
      "Модели 32A для более высокой нагрузки, ЦОД, вертикального монтажа и проектных поставок.",
    matcher: (product) => matchesAny(product, [/32\s*[aа]/i, /32а/i]),
  },
  {
    path: "/catalog/metered-pdu/",
    title: "Измерительные PDU и мониторинг",
    description:
      "Модели и компоненты с измерением, индикацией или мониторингом параметров питания.",
    matcher: (product) =>
      matchesAny(product, [/монитор/i, /измер/i, /индикац/i, /контроль/i, /м-брп/i]),
  },
  {
    path: "/catalog/managed-pdu/",
    title: "Управляемые PDU",
    description:
      "Модели, связанные с управлением и контролем питания. Функции нужно подтверждать по конкретной карточке.",
    matcher: (product) => matchesAny(product, [/управ/i, /контрол/i, /snmp/i]),
  },
  {
    path: "/catalog/three-phase-pdu/",
    title: "Трехфазные PDU",
    description:
      "Трехфазные блоки розеток и модели для стоек с высокой расчетной нагрузкой.",
    matcher: (product) => matchesAny(product, [/тр[её]х[-\s]?фаз/i, /3ф/i, /380/i, /400/i]),
  },
  {
    path: "/catalog/pdu-uzip/",
    title: "PDU и сетевые фильтры с УЗИП",
    description:
      "Модели с защитой и УЗИП, где важно уточнять фактическую схему защиты по конкретному изделию.",
    matcher: (product) =>
      matchesAny(product, [
        /узип/i,
        /сетев\w*\s+фильтр\w*/i,
        /фильтр\w*\s+радиопомех/i,
        /ограничител[ья]\s+перенапряж/i,
      ]),
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/8-rozetok/",
    title: "Блоки розеток 19″ 1U с 8 розетками",
    description:
      "Горизонтальные блоки розеток 1U в стойку с 8 розетками: классическая конфигурация для серверной стойки.",
    matcher: (product) =>
      matchesAny(product, [/19[”"\s]*1u/i, /19 дюйм/i]) &&
      product.attributes.outletCount.value === 8,
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/16-rozetok/",
    title: "Блоки розеток 19″ 1U с 16 розетками и более",
    description:
      "Блоки розеток 1U с количеством розеток от 16: плотные конфигурации для серверной и проектной инфраструктуры.",
    matcher: (product) =>
      matchesAny(product, [/19[”"\s]*1u/i, /19 дюйм/i]) &&
      (product.attributes.outletCount.value ?? 0) >= 16,
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/schuko/",
    title: "Блоки розеток Schuko 19″ 1U",
    description:
      "Горизонтальные блоки розеток 1U с евророзетками Schuko для серверной стойки и телеком-шкафа.",
    matcher: (product) =>
      matchesAny(product, [/19[”"\s]*1u/i, /19 дюйм/i]) &&
      (product.attributes.outletTypes.value?.includes("Schuko") ?? false),
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/iec-c13/",
    title: "Блоки розеток IEC C13 19″ 1U",
    description:
      "Блоки розеток 1U с IEC320 C13 для подключения серверного и сетевого оборудования.",
    matcher: (product) =>
      matchesAny(product, [/19[”"\s]*1u/i, /19 дюйм/i]) &&
      (product.attributes.outletTypes.value?.includes("IEC C13") ?? false),
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/16a/",
    title: "Блоки розеток 19″ 1U 16A",
    description:
      "Горизонтальные блоки 1U с номинальным током 16A для типовых серверных и телеком-нагрузок.",
    matcher: (product) =>
      matchesAny(product, [/19[”"\s]*1u/i, /19 дюйм/i]) &&
      product.attributes.maxCurrent.value === 16,
  },
  {
    path: "/catalog/vertical-pdu/32a/",
    title: "Вертикальные PDU 32A для стоек 0U / 42U",
    description:
      "Вертикальные блоки розеток с током 32A для ЦОД, стоек высокой плотности и проектных поставок.",
    matcher: (product) =>
      matchesAny(product, [/вертикаль/i, /верт\./i, /0u/i, /42u/i]) &&
      product.attributes.maxCurrent.value === 32,
  },
  {
    path: "/catalog/vertical-pdu/42u/",
    title: "Вертикальные PDU для стоек 42U",
    description:
      "Вертикальные блоки розеток повышенной длины для стоек 42U: высокая плотность подключений на одну PDU.",
    matcher: (product) =>
      matchesAny(product, [/вертикаль/i, /верт\./i, /0u/i, /42u/i]) &&
      (product.attributes.outletCount.value ?? 0) >= 18,
  },
  {
    path: "/catalog/iec-c13-c19/16a/",
    title: "PDU IEC C13 / C19 16A",
    description:
      "Блоки розеток IEC C13/C19 с номинальным током 16A для серверного и сетевого оборудования.",
    matcher: (product) =>
      (product.attributes.outletTypes.value?.some((value) =>
        ["IEC C13", "IEC C19"].includes(value),
      ) ?? false) &&
      product.attributes.maxCurrent.value === 16,
  },
  {
    path: "/catalog/iec-c13-c19/32a/",
    title: "PDU IEC C13 / C19 32A",
    description:
      "Блоки розеток IEC C13/C19 с током 32A для плотных стоек ЦОД и проектных поставок.",
    matcher: (product) =>
      (product.attributes.outletTypes.value?.some((value) =>
        ["IEC C13", "IEC C19"].includes(value),
      ) ?? false) &&
      product.attributes.maxCurrent.value === 32,
  },
  {
    path: "/catalog/metered-pdu/32a/",
    title: "Измерительные PDU 32A с мониторингом",
    description:
      "PDU с мониторингом тока и напряжения, номинальный ток 32A. Для ЦОД и проектной эксплуатации.",
    matcher: (product) =>
      (product.attributes.functions.monitoring.length > 0 ||
        product.attributes.productType.value === "monitoring_controller") &&
      product.attributes.maxCurrent.value === 32,
  },
];

const catalogFacetDefinitions: CatalogFacetDefinition[] = [
  {
    label: "Монтаж",
    options: [
      { label: "19 дюймов 1U", path: "/catalog/bloki-rozetok-19-1u/" },
      { label: "Вертикальный 0U / 42U", path: "/catalog/vertical-pdu/" },
    ],
  },
  {
    label: "Ток",
    options: [
      { label: "16A", path: "/catalog/16a/" },
      { label: "32A", path: "/catalog/32a/" },
      { label: "Трехфазные", path: "/catalog/three-phase-pdu/" },
    ],
  },
  {
    label: "Розетки",
    options: [
      { label: "Schuko", path: "/catalog/schuko/" },
      { label: "IEC C13 / C19", path: "/catalog/iec-c13-c19/" },
    ],
  },
  {
    label: "Функции",
    options: [
      { label: "Мониторинг / измерение", path: "/catalog/metered-pdu/" },
      { label: "Управление", path: "/catalog/managed-pdu/" },
      { label: "УЗИП / защита", path: "/catalog/pdu-uzip/" },
    ],
  },
];

function getCatalogRule(path: string) {
  return catalogRules.find((rule) => rule.path === path) ?? catalogRules[0];
}

function getProductsByCatalogPath(products: Product[], path: string) {
  const outletCountMatch = path.match(/^\/catalog\/outlet-count-(\d+)\/$/);

  if (outletCountMatch) {
    const outletCount = Number.parseInt(outletCountMatch[1] ?? "", 10);
    return products.filter((product) => product.attributes.outletCount.value === outletCount);
  }

  const rule = getCatalogRule(path);
  return products.filter(rule.matcher);
}

function countAttributeValues(values: string[]) {
  return Array.from(
    values
      .filter((value) => value && value !== "Уточнить")
      .reduce((counts, value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1);
        return counts;
      }, new Map<string, number>()),
  )
    .map(([label, count]) => ({ count, label }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"))
    .slice(0, 8);
}

export async function getProducts(): Promise<Product[]> {
  const { products } = await loadCatalog();
  return products;
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const { productsBySlug } = await loadCatalog();
  return productsBySlug.get(slug);
}

export async function getRelatedProducts(product: Product): Promise<Product[]> {
  const { products } = await loadCatalog();
  const category = product.categories[0]?.name;

  return products
    .filter((candidate) => candidate.slug !== product.slug)
    .filter((candidate) => {
      if (!category) {
        return true;
      }
      return candidate.categories.some((item) => item.name === category);
    })
    .slice(0, 4);
}

export async function getCatalogProducts(routePath: string) {
  const { products, categoriesBySlug } = await loadCatalog();
  const rule = getCatalogRule(routePath);
  const matchedProducts = getProductsByCatalogPath(products, routePath);

  const slug = routePath.replace(/^\/catalog\//, "").replace(/\/$/, "");
  const category = categoriesBySlug.get(slug);
  const title = category?.title ?? rule.title;
  const description = category?.intro ?? rule.description;

  return {
    description,
    products: matchedProducts,
    title,
    total: matchedProducts.length,
  };
}

export async function getCatalogFacetGroups(currentPath: string): Promise<CatalogFacetGroup[]> {
  const { products } = await loadCatalog();
  const outletCountOptions = Array.from(
    new Set(
      products
        .map((product) => product.attributes.outletCount.value)
        .filter((value): value is number => typeof value === "number"),
    ),
  )
    .sort((a, b) => a - b)
    .map((count) => ({
      label: `${count}`,
      path: `/catalog/outlet-count-${count}/`,
    }));

  const groupsWithOutlets: CatalogFacetDefinition[] = [
    ...catalogFacetDefinitions.slice(0, 3),
    {
      label: "Кол-во розеток",
      options: outletCountOptions,
    },
    ...catalogFacetDefinitions.slice(3),
  ];

  return groupsWithOutlets.map((group) => ({
    label: group.label,
    options: group.options.map((option) => ({
      ...option,
      count: getProductsByCatalogPath(products, option.path).length,
      current: option.path === currentPath,
    })),
  }));
}

export async function getCatalogAttributeStats(
  routePath: string,
): Promise<CatalogAttributeStatsGroup[]> {
  const { products } = await loadCatalog();
  const listing = getProductsByCatalogPath(products, routePath);
  const groups: CatalogAttributeStatsGroup[] = [
    {
      label: "Тип изделия",
      options: countAttributeValues(
        listing.map((product) => product.attributes.productType.label),
      ),
    },
    {
      label: "Монтаж",
      options: countAttributeValues(
        listing.map((product) => product.attributes.mounting.label),
      ),
    },
    {
      label: "Розетки",
      options: countAttributeValues(
        listing.flatMap((product) => product.attributes.outletTypes.value ?? []),
      ),
    },
    {
      label: "Ток",
      options: countAttributeValues(
        listing.map((product) => product.attributes.maxCurrent.label),
      ),
    },
    {
      label: "Функции",
      options: countAttributeValues(
        listing.flatMap((product) => product.attributes.functions.all),
      ),
    },
  ];

  return groups.filter((group) => group.options.length > 0);
}

export function createProductJsonLd(product: Product) {
  const siteUrl = getSiteUrl();
  const productUrl = `${siteUrl}/product/${product.slug}/`;
  const organization = {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "Солитон",
    url: siteUrl,
  };
  const additionalProperty = getProductAttributeRows(product.attributes)
    .filter(([, value]) => value !== "Уточнить")
    .map(([name, value]) => ({
      "@type": "PropertyValue",
      name,
      value,
    }));
  const documentEntities = product.documents.map((document) => ({
    "@type": "CreativeWork",
    name: document.title,
    url: document.url,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    additionalProperty,
    brand: {
      "@type": "Brand",
      name: "Солитон",
    },
    category:
      product.categories.map((category) => category.name).join(" / ") ||
      product.attributes.productType.label,
    name: product.h1,
    description: product.shortDescription,
    image: product.images,
    mainEntityOfPage: productUrl,
    manufacturer: organization,
    model: product.sku,
    mpn: product.sku,
    productID: product.sku,
    sku: product.sku,
    subjectOf: documentEntities.length ? documentEntities : undefined,
    url: productUrl,
    offers:
      product.price.amount !== null
        ? {
            "@type": "Offer",
            "@id": `${productUrl}#offer`,
            itemCondition: "https://schema.org/NewCondition",
            price: product.price.amount,
            priceCurrency: product.price.currency,
            priceValidUntil: derivePriceValidUntil(product.price.updatedAt),
            seller: organization,
            url: productUrl,
          }
        : undefined,
  };
}

export function createProductBreadcrumbJsonLd(product: Product) {
  const siteUrl = getSiteUrl();
  const category = product.categories[0];

  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Главная",
      item: `${siteUrl}/`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Каталог",
      item: `${siteUrl}/catalog/pdu/`,
    },
  ];

  if (category?.name) {
    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name: category.name,
      item: `${siteUrl}/catalog/pdu/`,
    });
  }

  items.push({
    "@type": "ListItem",
    position: items.length + 1,
    name: product.h1,
    item: `${siteUrl}/product/${product.slug}/`,
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}
