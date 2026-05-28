import type { Product } from "@/lib/products/catalog";

/**
 * 039 — Product Schema Enrichment + Key Facts Block.
 *
 * Единый источник истины для:
 *  - `additionalProperty[]` в Product JSON-LD (через `properties`);
 *  - анти-галлюцинационного key-facts предложения на PDP (через `sentence`).
 *
 * Оба формируются из одного набора `ProductAttributes`, поэтому не расходятся
 * (FR-004). Числовые атрибуты получают машинные единицы UN/CEFACT (FR-005).
 */

export type KeyFact = {
  "@type": "PropertyValue";
  name: string;
  value: string | number;
  propertyID?: string;
  unitCode?: string;
  unitText?: string;
};

type NumericUnit = { unitCode: string; unitText: string };

// UN/CEFACT Recommendation 20 unit codes для числовых характеристик.
const NUMERIC_UNITS: Record<string, NumericUnit> = {
  cableLength: { unitCode: "MTR", unitText: "м" },
  maxCurrent: { unitCode: "AMP", unitText: "А" },
  outletCount: { unitCode: "C62", unitText: "шт" },
};

const PLACEHOLDERS = new Set(["", "Уточнить", "—", "-"]);

function isMeaningful(label: string | undefined): label is string {
  return Boolean(label) && !PLACEHOLDERS.has((label ?? "").trim());
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/**
 * Строит машиночитаемые `additionalProperty[]` + человекочитаемое key-facts
 * предложение из атрибутов товара.
 */
export function buildKeyFacts(product: Product): {
  sentence: string;
  properties: KeyFact[];
} {
  const a = product.attributes;

  const defs: Array<{
    name: string;
    label: string;
    key: string;
    numeric?: number | null;
  }> = [
    { key: "productType", name: "Тип изделия", label: a.productType.label },
    { key: "mounting", name: "Монтаж", label: a.mounting.label },
    { key: "outletTypes", name: "Тип розеток", label: a.outletTypes.label },
    {
      key: "outletCount",
      name: "Количество розеток",
      label: a.outletCount.label,
      numeric: a.outletCount.value,
    },
    {
      key: "maxCurrent",
      name: "Максимальный ток",
      label: a.maxCurrent.label,
      numeric: a.maxCurrent.value,
    },
    { key: "voltage", name: "Напряжение", label: a.voltage.label },
    { key: "phase", name: "Фаза", label: a.phase.label },
    { key: "inputType", name: "Тип входа", label: a.inputType.label },
    {
      key: "cableLength",
      name: "Длина кабеля",
      label: a.cableLength.label,
      numeric: a.cableLength.value,
    },
    { key: "functions", name: "Функции", label: a.functions.all.join(", ") },
  ];

  const properties: KeyFact[] = [];
  for (const def of defs) {
    if (!isMeaningful(def.label)) continue;
    const fact: KeyFact = {
      "@type": "PropertyValue",
      name: def.name,
      value: def.label,
      propertyID: def.key,
    };
    const unit = NUMERIC_UNITS[def.key];
    if (unit && typeof def.numeric === "number" && Number.isFinite(def.numeric)) {
      fact.value = def.numeric;
      fact.unitCode = unit.unitCode;
      fact.unitText = unit.unitText;
    }
    properties.push(fact);
  }

  return { properties, sentence: buildSentence(product) };
}

/**
 * Компактное предложение, которое ИИ-агент цитирует дословно.
 * Порядок: розетки (кол-во + тип) → ток → ввод → монтаж → кабель → страна.
 */
function buildSentence(product: Product): string {
  const a = product.attributes;
  const parts: string[] = [];

  const count = a.outletCount.value;
  const outletType = isMeaningful(a.outletTypes.label) ? a.outletTypes.label : "";
  if (typeof count === "number" && Number.isFinite(count)) {
    const word = pluralRu(count, "розетка", "розетки", "розеток");
    parts.push(outletType ? `${count} ${word} ${outletType}` : `${count} ${word}`);
  } else if (outletType) {
    parts.push(`розетки ${outletType}`);
  }

  if (isMeaningful(a.maxCurrent.label)) parts.push(`ток ${a.maxCurrent.label}`);
  if (isMeaningful(a.inputType.label)) parts.push(`ввод ${a.inputType.label}`);
  if (isMeaningful(a.mounting.label)) {
    parts.push(`${a.mounting.label.toLowerCase()} монтаж`);
  }
  if (isMeaningful(a.cableLength.label)) parts.push(`кабель ${a.cableLength.label}`);
  parts.push("российское производство");

  return `${product.sku}: ${parts.join(", ")}.`;
}
