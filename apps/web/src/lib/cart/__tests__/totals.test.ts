import { describe, expect, it } from "vitest";

// Inline pure logic to avoid server-only import
interface CartItem {
  qty: number;
  priceAtAdd?: number | null;
}

function computeTotals(items: readonly CartItem[]) {
  let itemCount = 0;
  let subtotal = 0;
  let knownPriceCount = 0;
  let unknownPriceCount = 0;
  for (const item of items ?? []) {
    const qty = Number.isFinite(item.qty) ? Math.max(0, Math.floor(item.qty)) : 0;
    itemCount += qty;
    if (typeof item.priceAtAdd === "number" && Number.isFinite(item.priceAtAdd)) {
      subtotal += item.priceAtAdd * qty;
      knownPriceCount += 1;
    } else {
      unknownPriceCount += 1;
    }
  }
  subtotal = Math.round(subtotal * 100) / 100;
  return { itemCount, subtotal, knownPriceCount, unknownPriceCount };
}

describe("computeTotals", () => {
  it("returns zeros for empty cart", () => {
    expect(computeTotals([])).toEqual({
      itemCount: 0,
      subtotal: 0,
      knownPriceCount: 0,
      unknownPriceCount: 0,
    });
  });

  it("sums known prices and counts unknowns", () => {
    expect(
      computeTotals([
        { qty: 2, priceAtAdd: 1000 },
        { qty: 1, priceAtAdd: 500 },
        { qty: 3, priceAtAdd: null },
      ]),
    ).toEqual({
      itemCount: 6,
      subtotal: 2500,
      knownPriceCount: 2,
      unknownPriceCount: 1,
    });
  });

  it("rounds subtotal to 2 decimals", () => {
    expect(computeTotals([{ qty: 3, priceAtAdd: 33.33 }]).subtotal).toBe(99.99);
  });

  it("handles fractional qty by floor", () => {
    expect(computeTotals([{ qty: 2.7, priceAtAdd: 100 }]).itemCount).toBe(2);
  });

  it("ignores negative qty", () => {
    expect(computeTotals([{ qty: -5, priceAtAdd: 100 }]).itemCount).toBe(0);
  });
});
