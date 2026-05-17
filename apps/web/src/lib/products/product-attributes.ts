type ProductAttributeSource = {
  categories?: { name: string }[];
  clusters?: string[];
  descriptionText?: string;
  documents?: { title: string; url: string }[];
  shortDesc?: string;
  sku: string;
  specs?: string[];
  title: string;
};

type AttributeConfidence = "high" | "low" | "medium";

export type NormalizedAttribute<T> = {
  confidence: AttributeConfidence;
  label: string;
  source: string;
  value: T | null;
};

export type ProductAttributes = {
  availability: {
    label: string;
  };
  cableLength: NormalizedAttribute<number>;
  delivery: {
    label: string;
  };
  documents: {
    count: number;
    hasDocuments: boolean;
    label: string;
  };
  functions: {
    all: string[];
    management: string[];
    monitoring: string[];
    protection: string[];
  };
  inputType: NormalizedAttribute<string>;
  maxCurrent: NormalizedAttribute<number>;
  mounting: NormalizedAttribute<string>;
  outletCount: NormalizedAttribute<number>;
  outletTypes: NormalizedAttribute<string[]>;
  phase: NormalizedAttribute<1 | 3>;
  productType: NormalizedAttribute<string>;
  voltage: NormalizedAttribute<string>;
};

type AttributeMatch<T> = {
  confidence: AttributeConfidence;
  label: string;
  source: string;
  value: T;
};

const unknown = {
  confidence: "low" as const,
  label: "Уточнить",
  source: "not-detected",
  value: null,
};

function normalizeSearchText(parts: Array<string | string[] | undefined>) {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/с(?=\s*(?:13|19|20))/g, "c")
    .replace(/[×х]/g, "x")
    .replace(/\s+/g, " ");
}

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNumberMatch(
  text: string,
  patterns: RegExp[],
  label: (value: number) => string,
): NormalizedAttribute<number> {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ? parseNumber(match[1]) : null;

    if (value !== null) {
      return {
        confidence: "medium",
        label: label(value),
        source: pattern.source,
        value,
      };
    }
  }

  return unknown;
}

function firstTextMatch(
  text: string,
  matches: AttributeMatch<string>[],
): NormalizedAttribute<string> {
  return matches.find((match) => text.match(match.source)) ?? unknown;
}

function inferProductType(text: string): NormalizedAttribute<string> {
  return firstTextMatch(text, [
    {
      confidence: "high",
      label: "Сетевой фильтр",
      source: "сетев\\w*\\s+фильтр",
      value: "surge_filter",
    },
    {
      confidence: "high",
      label: "Контроллер мониторинга",
      source: "контроллер|датчик",
      value: "monitoring_controller",
    },
    {
      confidence: "medium",
      label: "PDU / блок розеток",
      source: "pdu|брп|блок",
      value: "pdu",
    },
  ]);
}

function inferMounting(text: string): NormalizedAttribute<string> {
  return firstTextMatch(text, [
    {
      confidence: "high",
      label: "Вертикальный",
      source: "вертик|верт\\.|0u|42u",
      value: "vertical",
    },
    {
      confidence: "high",
      label: "19 дюймов 1U",
      source: "19[”\"\\s]*1u|19\\s*дюйм|1u",
      value: "rack_19_1u",
    },
    {
      confidence: "medium",
      label: "DIN",
      source: "\\bdin\\b",
      value: "din",
    },
  ]);
}

function inferOutletTypes(text: string): NormalizedAttribute<string[]> {
  const types = [
    [/schuko|shuko|cee7|евро/, "Schuko"],
    [/c13/, "IEC C13"],
    [/c19/, "IEC C19"],
    [/клемм/, "Клеммный терминал"],
  ]
    .filter(([pattern]) => (pattern as RegExp).test(text))
    .map(([, label]) => label as string);

  if (!types.length) {
    return unknown;
  }

  return {
    confidence: "high",
    label: Array.from(new Set(types)).join(", "),
    source: "outlet-type-patterns",
    value: Array.from(new Set(types)),
  };
}

function getOutletCountCandidates(text: string) {
  const candidates: number[] = [];

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

  const byOutletType = new Map<string, number>();
  const typedPatterns: Array<[string, RegExp]> = [
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

  return candidates.filter((value) => Number.isFinite(value) && value > 0 && value < 100);
}

function inferOutletCount(product: ProductAttributeSource): NormalizedAttribute<number> {
  const segments = [
    product.sku,
    product.title,
    product.shortDesc,
    product.specs?.join(" "),
  ]
    .filter(Boolean)
    .map((segment) => normalizeSearchText([segment]));
  const candidates = segments.flatMap(getOutletCountCandidates);

  if (candidates.length) {
    const value = Math.max(...candidates);
    return {
      confidence: "medium",
      label: `${value}`,
      source: "outlet-count-composition",
      value,
    };
  }

  return unknown;
}

function inferInputType(text: string): NormalizedAttribute<string> {
  return firstTextMatch(text, [
    {
      confidence: "high",
      label: "IEC60309",
      source: "iec60309",
      value: "iec60309",
    },
    {
      confidence: "high",
      label: "IEC C20",
      source: "iec320\\s*c20|\\bc20\\b",
      value: "iec_c20",
    },
    {
      confidence: "high",
      label: "IEC C14",
      source: "iec320\\s*c14|\\bc14\\b",
      value: "iec_c14",
    },
    {
      confidence: "high",
      label: "Schuko",
      source: "schuko|shuko|евровилка",
      value: "schuko",
    },
    {
      confidence: "medium",
      label: "Клеммный терминал",
      source: "клемм\\w*\\s+терминал",
      value: "terminal",
    },
    {
      confidence: "medium",
      label: "Open end",
      source: "open end",
      value: "open_end",
    },
  ]);
}

function inferFunctions(text: string) {
  const protection = [
    [/узип/, "УЗИП"],
    [/узо/, "УЗО"],
    [/\bав\b|\bab\b|автомат|защит[ауы]\s+от\s+перегруз/, "Автоматическая защита"],
    [/фильтр\w*\s+радиопомех|помехоподав/, "Фильтр радиопомех"],
  ]
    .filter(([pattern]) => (pattern as RegExp).test(text))
    .map(([, label]) => label as string);

  const monitoring = [
    [/монитор|измер|индикац|контроль|snmp|web-интерфейс/, "Мониторинг / измерение"],
  ]
    .filter(([pattern]) => (pattern as RegExp).test(text))
    .map(([, label]) => label as string);

  const management = [
    [/управ|smart|дистанционное\s+включение|snmp/, "Управление"],
  ]
    .filter(([pattern]) => (pattern as RegExp).test(text))
    .map(([, label]) => label as string);

  const all = Array.from(new Set([...protection, ...monitoring, ...management]));

  return {
    all: all.length ? all : ["Базовая конфигурация"],
    management: Array.from(new Set(management)),
    monitoring: Array.from(new Set(monitoring)),
    protection: Array.from(new Set(protection)),
  };
}

function inferPhase(text: string): NormalizedAttribute<1 | 3> {
  if (/тр[её]х[-\s]?фаз|3ф|3\s*ф|380|400/.test(text)) {
    return {
      confidence: "medium",
      label: "3 фазы",
      source: "three-phase-patterns",
      value: 3,
    };
  }

  if (/250в|250v|230в|230v|однофаз/.test(text)) {
    return {
      confidence: "medium",
      label: "1 фаза",
      source: "single-phase-patterns",
      value: 1,
    };
  }

  return unknown;
}

export function normalizeProductAttributes(
  product: ProductAttributeSource,
): ProductAttributes {
  const primaryText = normalizeSearchText([
    product.sku,
    product.title,
    product.shortDesc,
    product.clusters,
    product.categories?.map((category) => category.name),
  ]);
  const text = normalizeSearchText([
    product.sku,
    product.title,
    product.shortDesc,
    product.descriptionText,
    product.specs,
    product.clusters,
    product.categories?.map((category) => category.name),
  ]);
  const cableLength = /без\s+кабел/.test(text)
    ? {
        confidence: "high" as const,
        label: "Без кабеля",
        source: "без кабеля",
        value: 0,
      }
    : firstNumberMatch(text, [/(\d+(?:[,.]\d+)?)\s*м(?:\.|\s|,)/], (value) => `${value} м`);

  return {
    availability: {
      label: "Наличие и срок подтверждаются при КП",
    },
    cableLength,
    delivery: {
      label: "Поставка по России по согласованию",
    },
    documents: {
      count: product.documents?.length ?? 0,
      hasDocuments: Boolean(product.documents?.length),
      label: product.documents?.length
        ? `${product.documents.length} док.`
        : "Документы по запросу",
    },
    functions: inferFunctions(text),
    inputType: inferInputType(text),
    maxCurrent: firstNumberMatch(
      text,
      [/(\d+)\s*[aа](?:\/|\s|$)/, /максимальный\s+ток\s+\w*\s*-\s*(\d+)/],
      (value) => `${value}A`,
    ),
    mounting: inferMounting(primaryText),
    outletCount: inferOutletCount(product),
    outletTypes: inferOutletTypes(primaryText),
    phase: inferPhase(text),
    productType: inferProductType(primaryText),
    voltage: firstTextMatch(text, [
      {
        confidence: "medium",
        label: "250В",
        source: "250в|250v",
        value: "250v",
      },
      {
        confidence: "medium",
        label: "230В",
        source: "230в|230v",
        value: "230v",
      },
      {
        confidence: "medium",
        label: "380/400В",
        source: "380|400",
        value: "380_400v",
      },
    ]),
  };
}

export function getListingAttributeRows(attributes: ProductAttributes) {
  return [
    ["Тип", attributes.productType.label],
    ["Монтаж", attributes.mounting.label],
    ["Розетки", attributes.outletTypes.label],
    ["Кол-во", attributes.outletCount.label],
    ["Ток", attributes.maxCurrent.label],
    ["Вход", attributes.inputType.label],
  ];
}

export function getProductAttributeRows(attributes: ProductAttributes) {
  return [
    ["Тип изделия", attributes.productType.label],
    ["Монтаж", attributes.mounting.label],
    ["Тип розеток", attributes.outletTypes.label],
    ["Количество розеток", attributes.outletCount.label],
    ["Максимальный ток", attributes.maxCurrent.label],
    ["Напряжение", attributes.voltage.label],
    ["Фаза", attributes.phase.label],
    ["Тип входа", attributes.inputType.label],
    ["Длина кабеля", attributes.cableLength.label],
    ["Функции", attributes.functions.all.join(", ")],
  ];
}
