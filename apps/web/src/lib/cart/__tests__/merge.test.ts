import { describe, expect, it } from "vitest";

// Inline pure logic
interface CartItem {
  sku: string;
  name: string;
  qty: number;
  priceAtAdd?: number | null;
  addedAt: string;
  productId?: string;
  slug?: string;
  image?: string;
  warning?: "none" | "removed" | "price_changed" | "stock_low";
}

const MAX_QTY = 9999;

function mergeItems(existing: readonly CartItem[], incoming: readonly CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const item of existing) map.set(item.sku, { ...item });

  for (const item of incoming) {
    const prev = map.get(item.sku);
    if (!prev) {
      map.set(item.sku, {
        ...item,
        qty: Math.min(MAX_QTY, Math.max(1, item.qty)),
        warning: "none",
      });
      continue;
    }
    const newQty = Math.min(MAX_QTY, prev.qty + item.qty);
    const prevTs = new Date(prev.addedAt).getTime();
    const newTs = new Date(item.addedAt).getTime();
    const priceAtAdd =
      newTs >= prevTs && item.priceAtAdd != null ? item.priceAtAdd : prev.priceAtAdd;
    map.set(item.sku, {
      ...prev,
      qty: newQty,
      priceAtAdd,
      addedAt: newTs >= prevTs ? item.addedAt : prev.addedAt,
      name: newTs >= prevTs ? item.name : prev.name,
      slug: newTs >= prevTs ? item.slug : prev.slug,
      image: newTs >= prevTs ? item.image : prev.image,
      productId: item.productId ?? prev.productId,
      warning: "none",
    });
  }
  return Array.from(map.values());
}

function setQuantity(items: readonly CartItem[], sku: string, qty: number): CartItem[] {
  const capped = Math.min(MAX_QTY, Math.max(1, qty));
  return items.map((item) => (item.sku === sku ? { ...item, qty: capped } : item));
}

function removeItem(items: readonly CartItem[], sku: string): CartItem[] {
  return items.filter((i) => i.sku !== sku);
}

const item = (overrides: Partial<CartItem> = {}): CartItem => ({
  sku: "SKU-1",
  name: "Item 1",
  qty: 1,
  priceAtAdd: 100,
  addedAt: "2026-05-24T10:00:00Z",
  warning: "none",
  ...overrides,
});

describe("mergeItems", () => {
  it("appends new SKU", () => {
    const result = mergeItems([item({ sku: "A", qty: 1 })], [item({ sku: "B", qty: 2 })]);
    expect(result).toHaveLength(2);
    expect(result.find((i) => i.sku === "B")?.qty).toBe(2);
  });

  it("sums qty for existing SKU", () => {
    const result = mergeItems(
      [item({ sku: "A", qty: 3 })],
      [item({ sku: "A", qty: 2 })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].qty).toBe(5);
  });

  it("caps qty at MAX_QTY", () => {
    const result = mergeItems(
      [item({ sku: "A", qty: 9000 })],
      [item({ sku: "A", qty: 5000 })],
    );
    expect(result[0].qty).toBe(MAX_QTY);
  });

  it("uses latest addedAt for priceAtAdd", () => {
    const earlier = item({ sku: "A", qty: 1, priceAtAdd: 100, addedAt: "2026-05-23T10:00:00Z" });
    const later = item({ sku: "A", qty: 1, priceAtAdd: 200, addedAt: "2026-05-24T10:00:00Z" });
    const result = mergeItems([earlier], [later]);
    expect(result[0].priceAtAdd).toBe(200);
  });

  it("keeps older priceAtAdd when incoming is older", () => {
    const earlier = item({ sku: "A", qty: 1, priceAtAdd: 200, addedAt: "2026-05-24T10:00:00Z" });
    const later = item({ sku: "A", qty: 1, priceAtAdd: 100, addedAt: "2026-05-23T10:00:00Z" });
    const result = mergeItems([earlier], [later]);
    expect(result[0].priceAtAdd).toBe(200);
  });

  it("resets warning to none on merge", () => {
    const result = mergeItems(
      [item({ sku: "A", qty: 1, warning: "price_changed" })],
      [item({ sku: "A", qty: 1 })],
    );
    expect(result[0].warning).toBe("none");
  });

  it("does not mutate inputs", () => {
    const existing = [item({ sku: "A", qty: 1 })];
    const incoming = [item({ sku: "A", qty: 2 })];
    mergeItems(existing, incoming);
    expect(existing[0].qty).toBe(1);
    expect(incoming[0].qty).toBe(2);
  });
});

describe("setQuantity", () => {
  it("updates qty for matching SKU", () => {
    const result = setQuantity([item({ sku: "A", qty: 1 })], "A", 5);
    expect(result[0].qty).toBe(5);
  });

  it("no-op for unknown SKU", () => {
    const result = setQuantity([item({ sku: "A", qty: 1 })], "B", 5);
    expect(result[0].qty).toBe(1);
  });

  it("caps at MAX_QTY", () => {
    const result = setQuantity([item({ sku: "A", qty: 1 })], "A", 99999);
    expect(result[0].qty).toBe(MAX_QTY);
  });

  it("floors at 1", () => {
    const result = setQuantity([item({ sku: "A", qty: 1 })], "A", 0);
    expect(result[0].qty).toBe(1);
  });
});

describe("removeItem", () => {
  it("removes by SKU", () => {
    const result = removeItem(
      [item({ sku: "A" }), item({ sku: "B" }), item({ sku: "C" })],
      "B",
    );
    expect(result.map((i) => i.sku)).toEqual(["A", "C"]);
  });

  it("no-op for unknown SKU", () => {
    const result = removeItem([item({ sku: "A" })], "B");
    expect(result).toHaveLength(1);
  });
});
