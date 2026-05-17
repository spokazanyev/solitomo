import fs from "node:fs/promises";
import path from "node:path";

import { getPayload } from "payload";

const translit = {
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

function slugify(value) {
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

function normalizeText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/с(?=\s*(?:13|19|20))/g, "c")
    .replace(/[×х]/g, "x")
    .replace(/\s+/g, " ");
}

function parsePrice(value) {
  if (!value) {
    return null;
  }

  // Source JSON хранит цены в US-формате: "11,055.00" = 11055 руб.
  // Запятая — разделитель тысяч (а не дробной части), точка — десятичный.
  const parsed = Number.parseFloat(String(value).replace(/\s/g, "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function inferProductType(text) {
  if (/сетев\w*\s+фильтр/.test(text)) return "surge_filter";
  if (/контроллер|датчик/.test(text)) return "monitoring_controller";
  return "pdu";
}

function inferMounting(text) {
  if (/вертик|верт\.|0u|42u/.test(text)) return "vertical";
  if (/19[”"\s]*1u|19\s*дюйм|1u/.test(text)) return "rack_19_1u";
  if (/\bdin\b/.test(text)) return "din";
  return "unknown";
}

function inferCurrent(text) {
  if (/32\s*[aа]/.test(text)) return "32a";
  if (/16\s*[aа]/.test(text)) return "16a";
  if (/10\s*[aа]/.test(text)) return "10a";
  return null;
}

function inferPhase(text) {
  return /тр[её]х[-\s]?фаз|3ф|380|400/.test(text) ? "three_phase" : "single_phase";
}

function inferInputType(text) {
  if (/iec60309/.test(text)) return "iec60309";
  if (/iec320\s*c20|\bc20\b/.test(text)) return "iec_c20";
  if (/iec320\s*c14|\bc14\b/.test(text)) return "iec_c14";
  if (/schuko|shuko|евровилка/.test(text)) return "schuko";
  if (/клемм\w*\s+терминал/.test(text)) return "terminal";
  if (/open end/.test(text)) return "open_end";
  return null;
}

function inferOutletCount(text) {
  const candidates = [];

  for (const match of text.matchAll(/\((\d+)\s*\+\s*(\d+)\s*(?:c13|c19|sh|schuko)?\)\s*x\s*(\d+)/g)) {
    candidates.push((Number(match[1]) + Number(match[2])) * Number(match[3]));
  }

  for (const match of text.matchAll(/два\s+[^.]{0,80}?по\s+(\d+)\s+розет[^+]{0,60}\+\s*(\d+)\s+розет/g)) {
    candidates.push((Number(match[1]) + Number(match[2])) * 2);
  }

  for (const match of text.matchAll(/(\d+)\s*x\s*(\d+)\s*(?:iec\s*320\s*)?(?:c13|c19|sh|schuko)\b/g)) {
    candidates.push(Number(match[1]) * Number(match[2]));
  }

  for (const match of text.matchAll(/\b(?:s-pdu|spf|sp|s)-\s*(\d+)\s*\+\s*(\d+)\s*(?:c13|c19|sh|schuko)\b/g)) {
    candidates.push(Number(match[1]) + Number(match[2]));
  }

  for (const match of text.matchAll(/\b(?:s-pdu|spf|sp|s)-\s*1\s*x\s*(\d+)(?:-|$)/g)) {
    candidates.push(Number(match[1]));
  }

  const byOutletType = new Map();
  const typedPatterns = [
    ["iec_c13", /(?:^|[^a-z0-9])(\d+)\s*(?:x\s*)?(?:розет(?:ок|ки|ка)?\s*)?(?:iec\s*320\s*)?c\s*13\b/g],
    ["iec_c19", /(?:^|[^a-z0-9])(\d+)\s*(?:x\s*)?(?:розет(?:ок|ки|ка)?\s*)?(?:iec\s*320\s*)?c\s*19\b/g],
    ["schuko", /(?:^|[^a-z0-9])(\d+)\s*(?:x\s*)?(?:розет(?:ок|ки|ка)?\s*)?(?:schuko|shuko|sh\b|cee\s*7\/?4|евро)/g],
  ];

  for (const [type, pattern] of typedPatterns) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) {
        byOutletType.set(type, Math.max(byOutletType.get(type) ?? 0, value));
      }
    }
  }

  if (byOutletType.size) {
    candidates.push(Array.from(byOutletType.values()).reduce((sum, value) => sum + value, 0));
  }

  for (const match of text.matchAll(/(\d+)\s*(?:розет|гнезд)/g)) {
    candidates.push(Number(match[1]));
  }

  const fallback = text.match(/(?:^|\s)(?:s-pdu|spf|sp|s)-(\d+)(?:\s|-|\+|c|sh|$)/);
  if (fallback?.[1]) {
    candidates.push(Number(fallback[1]));
  }

  const validCandidates = candidates.filter((value) => Number.isFinite(value) && value > 0 && value < 100);
  return validCandidates.length ? String(Math.max(...validCandidates)) : null;
}

function inferOutletTypes(text) {
  return [
    [/schuko|shuko|cee7|евро/, "schuko"],
    [/c13/, "iec_c13"],
    [/c19/, "iec_c19"],
  ]
    .filter(([pattern]) => pattern.test(text))
    .map(([, value]) => value);
}

function inferFunctions(text) {
  return {
    management: /управ|snmp/.test(text) ? ["management"] : [],
    monitoring: /монитор|измер|индикац|контроль|м-брп/.test(text) ? ["monitoring"] : [],
    protection: [
      [/узип/, "uzip"],
      [/узо/, "uzo"],
      [/автомат|защитн\w*\s+автомат/, "automatic_protection"],
      [/фильтр\w*\s+радиопомех/, "emi_filter"],
    ]
      .filter(([pattern]) => pattern.test(text))
      .map(([, value]) => value),
  };
}

const attributeGroups = [
  { code: "product", label: "Тип изделия", sortOrder: 10 },
  { code: "mounting", label: "Монтаж", sortOrder: 20 },
  { code: "electrical", label: "Электрика", sortOrder: 30 },
  { code: "outlets", label: "Розетки", sortOrder: 40 },
  { code: "functions", label: "Функции", sortOrder: 50 },
];

const attributes = [
  { code: "product_type", group: "product", label: "Тип изделия", valueType: "option" },
  { code: "mounting", group: "mounting", isFilterable: true, label: "Монтаж", valueType: "option" },
  { code: "max_current", group: "electrical", isFilterable: true, label: "Ток", unit: "A", valueType: "option" },
  { code: "phase", group: "electrical", isFilterable: true, label: "Фазность", valueType: "option" },
  { code: "input_type", group: "electrical", label: "Тип входа", valueType: "option" },
  { code: "outlet_count", group: "outlets", isFilterable: true, label: "Кол-во розеток", valueType: "option" },
  { code: "outlet_type", group: "outlets", isFilterable: true, label: "Тип розеток", valueType: "multi_option" },
  { code: "protection", group: "functions", isFilterable: true, label: "Защита", valueType: "multi_option" },
  { code: "monitoring", group: "functions", isFilterable: true, label: "Мониторинг", valueType: "option" },
  { code: "management", group: "functions", isFilterable: true, label: "Управление", valueType: "option" },
];

const attributeOptions = [
  ["product_type", "pdu", "PDU / блок розеток"],
  ["product_type", "surge_filter", "Сетевой фильтр"],
  ["product_type", "monitoring_controller", "Контроллер мониторинга"],
  ["mounting", "rack_19_1u", "19 дюймов 1U"],
  ["mounting", "vertical", "Вертикальный"],
  ["mounting", "din", "DIN"],
  ["mounting", "unknown", "Уточнить"],
  ["max_current", "10a", "10A"],
  ["max_current", "16a", "16A"],
  ["max_current", "32a", "32A"],
  ["phase", "single_phase", "1 фаза"],
  ["phase", "three_phase", "3 фазы"],
  ["input_type", "schuko", "Schuko"],
  ["input_type", "iec_c14", "IEC C14"],
  ["input_type", "iec_c20", "IEC C20"],
  ["input_type", "iec60309", "IEC60309"],
  ["input_type", "terminal", "Клеммный терминал"],
  ["input_type", "open_end", "Open end"],
  ["outlet_count", "3", "3"],
  ["outlet_count", "4", "4"],
  ["outlet_count", "5", "5"],
  ["outlet_count", "6", "6"],
  ["outlet_count", "7", "7"],
  ["outlet_count", "8", "8"],
  ["outlet_count", "9", "9"],
  ["outlet_count", "10", "10"],
  ["outlet_count", "12", "12"],
  ["outlet_count", "13", "13"],
  ["outlet_count", "14", "14"],
  ["outlet_count", "16", "16"],
  ["outlet_count", "18", "18"],
  ["outlet_count", "24", "24"],
  ["outlet_count", "27", "27"],
  ["outlet_count", "32", "32"],
  ["outlet_count", "42", "42"],
  ["outlet_type", "schuko", "Schuko"],
  ["outlet_type", "iec_c13", "IEC C13"],
  ["outlet_type", "iec_c19", "IEC C19"],
  ["protection", "uzip", "УЗИП"],
  ["protection", "uzo", "УЗО"],
  ["protection", "automatic_protection", "Автоматическая защита"],
  ["protection", "emi_filter", "Фильтр радиопомех"],
  ["monitoring", "monitoring", "Мониторинг / измерение"],
  ["management", "management", "Управление"],
];

const targetCategories = [
  ["pdu", "Все PDU и блоки розеток", "/catalog/pdu/"],
  ["bloki-rozetok-19-1u", "Горизонтальные блоки 19 дюймов 1U", "/catalog/bloki-rozetok-19-1u/"],
  ["vertical-pdu", "Вертикальные PDU", "/catalog/vertical-pdu/"],
  ["schuko", "PDU с розетками Schuko", "/catalog/schuko/"],
  ["iec-c13-c19", "PDU IEC C13 / C19", "/catalog/iec-c13-c19/"],
  ["16a", "PDU 16A", "/catalog/16a/"],
  ["32a", "PDU 32A", "/catalog/32a/"],
  ["metered-pdu", "Измерительные PDU и мониторинг", "/catalog/metered-pdu/"],
  ["managed-pdu", "Управляемые PDU", "/catalog/managed-pdu/"],
  ["three-phase-pdu", "Трехфазные PDU", "/catalog/three-phase-pdu/"],
  ["pdu-uzip", "PDU и сетевые фильтры с УЗИП", "/catalog/pdu-uzip/"],
];

const filterGroups = [
  { code: "mounting", label: "Монтаж", sortOrder: 10 },
  { code: "electrical", label: "Электрика", sortOrder: 20 },
  { code: "outlets", label: "Розетки", sortOrder: 30 },
  { code: "functions", label: "Функции", sortOrder: 40 },
];

const filterFields = [
  { attribute: "mounting", code: "mounting", group: "mounting", label: "Монтаж" },
  { attribute: "max_current", code: "max_current", group: "electrical", label: "Ток" },
  { attribute: "phase", code: "phase", group: "electrical", label: "Фазность", allowMultiple: false },
  { attribute: "outlet_count", code: "outlet_count", group: "outlets", label: "Кол-во розеток" },
  { attribute: "outlet_type", code: "outlet_type", group: "outlets", label: "Розетки" },
  { attribute: "monitoring", code: "monitoring", group: "functions", label: "Мониторинг" },
  { attribute: "management", code: "management", group: "functions", label: "Управление" },
  { attribute: "protection", code: "protection", group: "functions", label: "Защита" },
];

function categoriesForProduct(inferred) {
  const categories = ["pdu"];
  if (inferred.mounting === "rack_19_1u") categories.push("bloki-rozetok-19-1u");
  if (inferred.mounting === "vertical") categories.push("vertical-pdu");
  if (inferred.outletTypes.includes("schuko")) categories.push("schuko");
  if (inferred.outletTypes.some((type) => type === "iec_c13" || type === "iec_c19")) categories.push("iec-c13-c19");
  if (inferred.maxCurrent === "16a") categories.push("16a");
  if (inferred.maxCurrent === "32a") categories.push("32a");
  if (inferred.phase === "three_phase") categories.push("three-phase-pdu");
  if (inferred.functions.monitoring.length) categories.push("metered-pdu");
  if (inferred.functions.management.length) categories.push("managed-pdu");
  if (inferred.functions.protection.length) categories.push("pdu-uzip");
  return Array.from(new Set(categories));
}

async function upsertBy(payload, collection, field, value, data, dryRun) {
  const existing = await payload.find({
    collection,
    limit: 1,
    overrideAccess: true,
    where: {
      [field]: {
        equals: value,
      },
    },
  });

  if (dryRun) {
    return {
      doc: existing.docs[0] ?? { id: `dry-${collection}-${value}` },
      operation: existing.docs.length ? "would-update" : "would-create",
    };
  }

  if (existing.docs.length) {
    const doc = await payload.update({
      id: existing.docs[0].id,
      collection,
      data,
      overrideAccess: true,
    });
    return { doc, operation: "updated" };
  }

  const doc = await payload.create({
    collection,
    data,
    overrideAccess: true,
  });
  return { doc, operation: "created" };
}

async function removeDuplicatesByField(payload, collection, field, dryRun) {
  const result = await payload.find({
    collection,
    limit: 1000,
    overrideAccess: true,
  });
  const seen = new Map();
  let removed = 0;

  for (const doc of result.docs) {
    const value = doc[field];
    if (!value) {
      continue;
    }

    if (!seen.has(value)) {
      seen.set(value, doc.id);
      continue;
    }

    removed += 1;
    if (!dryRun) {
      await payload.delete({
        collection,
        id: doc.id,
        overrideAccess: true,
      });
    }
  }

  return removed;
}

function getId(doc) {
  return typeof doc === "object" ? doc.id : doc;
}

function inferProduct(raw) {
  const text = normalizeText(raw.sku, raw.title, raw.shortDesc, raw.descriptionText, raw.specs, raw.additional, raw.clusters);
  const functions = inferFunctions(text);

  return {
    functions,
    inputType: inferInputType(text),
    maxCurrent: inferCurrent(text),
    mounting: inferMounting(text),
    outletCount: inferOutletCount(text),
    outletTypes: inferOutletTypes(text),
    phase: inferPhase(text),
    productType: inferProductType(text),
    text,
  };
}

export async function script(config) {
  const dryRun = process.argv.includes("--dry-run");
  const payload = await getPayload({ config });
  const assortmentPath = path.resolve(process.cwd(), "../../00-source-data/assortment/soliton1_assortment_raw.json");
  const raw = JSON.parse(await fs.readFile(assortmentPath, "utf8"));
  const stats = new Map();

  function mark(operation) {
    stats.set(operation, (stats.get(operation) ?? 0) + 1);
  }

  const groupIds = new Map();
  const attributeIds = new Map();
  const optionIds = new Map();
  const categoryIds = new Map();
  const filterGroupIds = new Map();
  const filterFieldIds = new Map();
  const filterOptionIds = new Map();

  for (const group of attributeGroups) {
    const { doc, operation } = await upsertBy(payload, "attribute-groups", "code", group.code, group, dryRun);
    groupIds.set(group.code, getId(doc));
    mark(`attribute-groups:${operation}`);
  }

  for (const attribute of attributes) {
    const { doc, operation } = await upsertBy(payload, "attributes", "code", attribute.code, {
      ...attribute,
      group: groupIds.get(attribute.group),
    }, dryRun);
    attributeIds.set(attribute.code, getId(doc));
    mark(`attributes:${operation}`);
  }

  for (const [attributeCode, code, label] of attributeOptions) {
    const { doc, operation } = await upsertBy(payload, "attribute-options", "code", `${attributeCode}_${code}`, {
      attribute: attributeIds.get(attributeCode),
      code: `${attributeCode}_${code}`,
      label,
      seoSlug: slugify(label),
    }, dryRun);
    optionIds.set(`${attributeCode}:${code}`, getId(doc));
    mark(`attribute-options:${operation}`);
  }

  for (const [slug, title, previewPath] of targetCategories) {
    const { doc, operation } = await upsertBy(payload, "categories", "slug", slug, {
      agentEditable: true,
      categoryType: "catalog",
      h1: title,
      indexingPolicy: "index",
      intro: "Категория создана из текущей карты ассортимента. Текст требует SEO-редактирования перед публикацией.",
      previewPath,
      qualityStatus: "content_review",
      schemaItemListEnabled: true,
      slug,
      status: "published",
      title,
    }, dryRun);
    categoryIds.set(slug, getId(doc));
    mark(`categories:${operation}`);
  }

  for (const group of filterGroups) {
    const { doc, operation } = await upsertBy(payload, "filter-groups", "code", group.code, group, dryRun);
    filterGroupIds.set(group.code, getId(doc));
    mark(`filter-groups:${operation}`);
  }

  for (const field of filterFields) {
    const { doc, operation } = await upsertBy(payload, "filter-fields", "code", field.code, {
      allowMultiple: field.allowMultiple ?? true,
      attribute: attributeIds.get(field.attribute),
      code: field.code,
      fieldType: field.allowMultiple === false ? "single_select" : "multi_select",
      group: filterGroupIds.get(field.group),
      indexableAllowed: false,
      isActive: true,
      label: field.label,
      recalculateCounters: true,
      showCounters: true,
      zeroResultsBehavior: "disable",
    }, dryRun);
    filterFieldIds.set(field.code, getId(doc));
    mark(`filter-fields:${operation}`);
  }

  for (const [attributeCode, code, label] of attributeOptions) {
    const fieldCode = attributeCode === "max_current" || attributeCode === "phase" || attributeCode === "mounting" || attributeCode === "outlet_count" || attributeCode === "outlet_type" || attributeCode === "protection" || attributeCode === "monitoring" || attributeCode === "management" ? attributeCode : null;
    if (!fieldCode || !filterFieldIds.has(fieldCode)) continue;

    const filterOptionCode = `${fieldCode}_${code}`;
    const { doc, operation } = await upsertBy(payload, "filter-options", "code", filterOptionCode, {
      attributeOption: optionIds.get(`${attributeCode}:${code}`),
      code: filterOptionCode,
      field: filterFieldIds.get(fieldCode),
      indexableAllowed: false,
      isActive: true,
      label,
      seoSlug: slugify(label),
    }, dryRun);
    filterOptionIds.set(`${fieldCode}:${code}`, getId(doc));
    mark(`filter-options:${operation}`);
  }

  for (const product of raw.products) {
    const inferred = inferProduct(product);
    const categorySlugs = categoriesForProduct(inferred);
    const categoryRelations = categorySlugs.map((slug) => categoryIds.get(slug)).filter(Boolean);
    const slug = slugify(product.sku || product.title);
    const priceAmount = parsePrice(product.priceRub);

    const mediaRelations = [];
    const imageLinks = [];
    for (const [index, imageUrl] of (product.images ?? []).entries()) {
      const mediaKey = `image-${slug}-${index + 1}`;
      imageLinks.push({
        alt: `${product.title} ${product.sku}`.trim(),
        role: index === 0 ? "primary" : "gallery",
        url: imageUrl,
      });
      const { doc, operation } = await upsertBy(payload, "media", "externalUrl", imageUrl || mediaKey, {
        alt: `${product.title} ${product.sku}`.trim(),
        externalUrl: imageUrl,
        previewPath: `/product/${slug}/`,
        role: index === 0 ? "product_primary" : "product_gallery",
        sourceOfTruth: "source_json",
        status: "published",
        title: mediaKey,
      }, dryRun);
      mediaRelations.push(getId(doc));
      mark(`media:${operation}`);
    }

    const documentRelations = [];
    for (const [index, document] of (product.documents ?? []).entries()) {
      const documentKey = `document-${slug}-${index + 1}`;
      const { doc, operation } = await upsertBy(payload, "documents", "externalUrl", document.url || documentKey, {
        externalUrl: document.url,
        previewPath: `/product/${slug}/`,
        sourceOfTruth: "source_json",
        status: "published",
        title: document.title || documentKey,
      }, dryRun);
      documentRelations.push(getId(doc));
      mark(`documents:${operation}`);
    }

    const technicalAttributes = [
      ["product_type", inferred.productType],
      ["mounting", inferred.mounting],
      ["max_current", inferred.maxCurrent],
      ["phase", inferred.phase],
      ["input_type", inferred.inputType],
      ["outlet_count", inferred.outletCount],
      ...inferred.outletTypes.map((value) => ["outlet_type", value]),
      ...inferred.functions.protection.map((value) => ["protection", value]),
      ...inferred.functions.monitoring.map((value) => ["monitoring", value]),
      ...inferred.functions.management.map((value) => ["management", value]),
    ]
      .filter(([, value]) => value)
      .map(([attributeCode, value]) => ({
        attribute: attributeIds.get(attributeCode),
        confidence: "medium",
        option: optionIds.get(`${attributeCode}:${value}`),
        valueText: value,
      }))
      .filter((item) => item.attribute);

    const normalizedSku = String(product.sku || product.title || slug).trim();

    try {
      const { operation } = await upsertBy(payload, "products", "sku", normalizedSku, {
        agentEditable: true,
        availabilityStatus: "request",
        categories: categoryRelations,
        ctaMode: "rfq",
        description: product.descriptionText || product.shortDesc || "",
        documents: documentRelations,
        externalId: product.url,
        h1: product.title,
        imageLinks,
        lastImportedAt: new Date().toISOString(),
        media: mediaRelations,
        previewPath: `/product/${slug}/`,
        price: {
          amount: priceAmount,
          currency: "RUB",
          status: priceAmount ? "published" : "request",
        },
        primaryCategory: categoryRelations[0],
        productType: inferred.productType,
        qualityStatus: "needs_review",
        rfqEnabled: true,
        schemaBrand: "Soliton",
        schemaManufacturer: "Soliton",
        schemaProductEnabled: true,
        shortDescription: product.shortDesc || "",
        sku: normalizedSku,
        slug,
        sourceOfTruth: "source_json",
        sourceRawDescription: product.descriptionText || "",
        sourceRawTitle: product.title,
        sourceUrl: product.url,
        status: "published",
        technicalAttributes,
        title: product.title,
      }, dryRun);
      mark(`products:${operation}`);
    } catch (error) {
      console.error(`Failed to seed product ${normalizedSku} (${product.title})`);
      console.error(JSON.stringify(error?.data ?? error, null, 2));
      throw error;
    }
  }

  const duplicateDocuments = await removeDuplicatesByField(payload, "documents", "externalUrl", dryRun);
  if (duplicateDocuments) {
    mark(`documents:${dryRun ? "would-remove-duplicates" : "removed-duplicates"}`);
    stats.set(`documents:${dryRun ? "would-remove-duplicates" : "removed-duplicates"}`, duplicateDocuments);
  }

  const duplicateMedia = await removeDuplicatesByField(payload, "media", "externalUrl", dryRun);
  if (duplicateMedia) {
    mark(`media:${dryRun ? "would-remove-duplicates" : "removed-duplicates"}`);
    stats.set(`media:${dryRun ? "would-remove-duplicates" : "removed-duplicates"}`, duplicateMedia);
  }

  console.log(`${dryRun ? "Dry run" : "Seed"} complete.`);
  console.table(Array.from(stats.entries()).map(([operation, count]) => ({ count, operation })));
}
