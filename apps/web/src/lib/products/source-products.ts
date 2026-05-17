import fs from "node:fs";
import path from "node:path";

import {
  getProductAttributeRows,
  normalizeProductAttributes,
  type ProductAttributes,
} from "@/lib/products/product-attributes";
import { rewriteLegacyAssetUrl } from "@/lib/legacy-assets/url";
import { getSiteUrl } from "@/lib/seo/seo-registry";

type RawCategory = {
  name: string;
  url: string;
};

type RawDocument = {
  title: string;
  url: string;
};

type RawProduct = {
  additional?: string[];
  breadcrumbs?: string;
  categories?: RawCategory[];
  clusters?: string[];
  descriptionText?: string;
  documents?: RawDocument[];
  images?: string[];
  priceRub?: string;
  shortDesc?: string;
  sku: string;
  specs?: string[];
  title: string;
  url: string;
};

type RawAssortment = {
  products: RawProduct[];
};

export type Product = {
  attributes: ProductAttributes;
  badges: string[];
  breadcrumbs?: string;
  categories: RawCategory[];
  description: string;
  documents: RawDocument[];
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

type CatalogAttributeStatsGroup = {
  label: string;
  options: {
    count: number;
    label: string;
  }[];
};

const assortmentPath = path.join(
  process.cwd(),
  "..",
  "..",
  "00-source-data",
  "assortment",
  "soliton1_assortment_raw.json",
);

const translit: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => translit[char] ?? char)
    .join("")
    .replace(/&/g, "-and-")
    .replace(/\+/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function parsePrice(priceRub?: string) {
  if (!priceRub) {
    return null;
  }

  const normalized = priceRub.replace(/\s/g, "").replace(/,/g, "");
  const amount = Number.parseFloat(normalized);

  return Number.isFinite(amount) ? amount : null;
}

function formatPrice(amount: number | null, source?: string) {
  if (amount === null) {
    return source ? `${source} руб.` : "Цена по запросу";
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

function buildBadges(product: RawProduct) {
  const clusters = product.clusters ?? [];
  const specs = product.specs ?? [];
  const badges = [...clusters];

  for (const spec of specs) {
    const match = spec.match(/(\d+)\s*(розет|schuko|c13|c19)/i);
    if (match) {
      badges.push(spec.replace(/\s+/g, " ").slice(0, 36));
    }
  }

  return Array.from(new Set(badges)).slice(0, 8);
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

function buildProductDisplayName(raw: RawProduct, attributes: ProductAttributes) {
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

function normalizeProduct(raw: RawProduct): Product {
  const priceAmount = parsePrice(raw.priceRub);
  const slug = slugify(raw.sku || raw.title);
  const categoryNames = (raw.categories ?? []).map((category) => category.name);
  const attributes = normalizeProductAttributes(raw);
  const h1 = buildProductDisplayName(raw, attributes);

  return {
    attributes,
    badges: buildBadges(raw),
    breadcrumbs: raw.breadcrumbs,
    categories: raw.categories ?? [],
    description: raw.descriptionText ?? raw.shortDesc ?? "",
    documents: (raw.documents ?? []).map((doc) => ({
      ...doc,
      url: rewriteLegacyAssetUrl(doc.url),
    })),
    h1,
    images: (raw.images ?? []).map(rewriteLegacyAssetUrl).filter(Boolean),
    legacyUrl: raw.url,
    price: {
      amount: priceAmount,
      display: formatPrice(priceAmount, raw.priceRub),
      currency: "RUB",
    },
    shortDescription:
      raw.shortDesc ||
      `PDU Солитон ${raw.sku}${categoryNames.length ? `: ${categoryNames.join(", ")}` : ""}.`,
    sku: raw.sku,
    slug,
    specs: raw.specs ?? [],
    title: raw.title,
  };
}

function readProducts() {
  const file = fs.readFileSync(assortmentPath, "utf8");
  const raw = JSON.parse(file) as RawAssortment;
  return raw.products.map(normalizeProduct);
}

const products = readProducts();
const productsBySlug = new Map(products.map((product) => [product.slug, product]));

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
    title: "Все PDU и блоки розеток",
    description:
      "Весь собранный ассортимент Солитон: горизонтальные, вертикальные, IEC, Schuko, 16A, 32A и проектные исполнения.",
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
    label: "Кол-во розеток",
    options: Array.from(
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
      })),
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

function getProductsByCatalogPath(path: string) {
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

export function getProducts() {
  return products;
}

export function getProductBySlug(slug: string) {
  return productsBySlug.get(slug);
}

export function getRelatedProducts(product: Product) {
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

export function getCatalogProducts(routePath: string) {
  const rule = getCatalogRule(routePath);
  const matchedProducts = getProductsByCatalogPath(routePath);

  return {
    description: rule.description,
    products: matchedProducts,
    title: rule.title,
    total: matchedProducts.length,
  };
}

export function getCatalogFacetGroups(currentPath: string) {
  return catalogFacetDefinitions.map((group) => ({
    label: group.label,
    options: group.options.map((option) => ({
      ...option,
      count: getProductsByCatalogPath(option.path).length,
      current: option.path === currentPath,
    })),
  }));
}

export function getCatalogAttributeStats(
  routePath: string,
): CatalogAttributeStatsGroup[] {
  const listing = getProductsByCatalogPath(routePath);
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
