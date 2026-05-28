/**
 * 039 — Tests для buildKeyFacts: проверяют единый источник истины
 * (sentence ↔ additionalProperty), единицы UN/CEFACT и фильтрацию плейсхолдеров.
 */
import { describe, expect, it } from "vitest";

import type { Product } from "../catalog.ts";
import { buildKeyFacts, type KeyFact } from "../key-facts.ts";

type Overrides = Record<string, unknown>;

function attr(label: string, value: unknown): Overrides {
  return { confidence: "high", label, source: "test", value };
}

function mockProduct(overrides: Overrides = {}): Product {
  const attributes = {
    availability: { label: "Наличие подтверждается при КП" },
    cableLength: attr("3 м", 3),
    delivery: { label: "Поставка по России" },
    documents: { count: 0, hasDocuments: false, label: "—" },
    functions: { all: [], management: [], monitoring: [], protection: [] },
    inputType: attr("Schuko", "schuko"),
    maxCurrent: attr("16 А", 16),
    mounting: attr("Вертикальный", "vertical"),
    outletCount: attr("18 шт", 18),
    outletTypes: attr("Schuko", ["schuko"]),
    phase: attr("1 фаза", 1),
    productType: attr("PDU / блок розеток", "pdu"),
    voltage: attr("230 В", "230"),
    ...overrides,
  };

  return { attributes, sku: "S-18" } as unknown as Product;
}

function findProp(props: KeyFact[], propertyID: string): KeyFact | undefined {
  return props.find((p) => p.propertyID === propertyID);
}

describe("buildKeyFacts", () => {
  it("формирует key-facts предложение в правильном порядке (FR-003)", () => {
    const { sentence } = buildKeyFacts(mockProduct());
    expect(sentence).toBe(
      "S-18: 18 розеток Schuko, ток 16 А, ввод Schuko, вертикальный монтаж, кабель 3 м, российское производство.",
    );
  });

  it("числовые атрибуты несут единицы UN/CEFACT (FR-005)", () => {
    const { properties } = buildKeyFacts(mockProduct());

    const current = findProp(properties, "maxCurrent");
    expect(current).toMatchObject({ unitCode: "AMP", unitText: "А", value: 16 });

    const count = findProp(properties, "outletCount");
    expect(count).toMatchObject({ unitCode: "C62", value: 18 });

    const cable = findProp(properties, "cableLength");
    expect(cable).toMatchObject({ unitCode: "MTR", unitText: "м", value: 3 });
  });

  it("категориальные атрибуты — строковое value без unitCode", () => {
    const { properties } = buildKeyFacts(mockProduct());
    const type = findProp(properties, "productType");
    expect(type?.value).toBe("PDU / блок розеток");
    expect(type?.unitCode).toBeUndefined();
  });

  it("каждый property имеет @type PropertyValue и propertyID (FR-001)", () => {
    const { properties } = buildKeyFacts(mockProduct());
    expect(properties.length).toBeGreaterThanOrEqual(6);
    for (const p of properties) {
      expect(p["@type"]).toBe("PropertyValue");
      expect(p.propertyID).toBeTruthy();
    }
  });

  it("плейсхолдеры (Уточнить / —) исключаются из properties", () => {
    const { properties } = buildKeyFacts(
      mockProduct({ maxCurrent: attr("Уточнить", null) }),
    );
    expect(findProp(properties, "maxCurrent")).toBeUndefined();
  });

  it("русская плюрализация розеток корректна", () => {
    expect(buildKeyFacts(mockProduct({ outletCount: attr("1 шт", 1) })).sentence).toContain(
      "1 розетка Schuko",
    );
    expect(buildKeyFacts(mockProduct({ outletCount: attr("3 шт", 3) })).sentence).toContain(
      "3 розетки Schuko",
    );
    expect(buildKeyFacts(mockProduct({ outletCount: attr("18 шт", 18) })).sentence).toContain(
      "18 розеток Schuko",
    );
  });
});
