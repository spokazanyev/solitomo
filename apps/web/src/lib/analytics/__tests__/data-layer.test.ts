/**
 * Tests для data-layer.ts — ecommerce dual-push (FR-110-115).
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  pushEcommerce,
  pushEcommerceImpressions,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
  trackRemoveFromCart,
  trackViewCart,
  trackViewItem,
} from "../data-layer";

function getDataLayer(): Array<Record<string, unknown>> {
  const g = globalThis as unknown as { window?: { dataLayer?: Array<Record<string, unknown>> } };
  return g.window?.dataLayer ?? [];
}

function getLastEcommerce(): Record<string, unknown> | undefined {
  const dl = getDataLayer();
  for (let i = dl.length - 1; i >= 0; i--) {
    const entry = dl[i]!;
    if ("ecommerce" in entry) return entry.ecommerce as Record<string, unknown>;
  }
  return undefined;
}

function getLastEvent(): Record<string, unknown> | undefined {
  const dl = getDataLayer();
  for (let i = dl.length - 1; i >= 0; i--) {
    const entry = dl[i]!;
    if ("event" in entry) return entry;
  }
  return undefined;
}

beforeEach(() => {
  const g = globalThis as unknown as { window?: { dataLayer?: unknown } };
  if (!g.window) g.window = {};
  g.window.dataLayer = [];
});

describe("pushEcommerce — нативный формат Метрики (FR-110-115)", () => {
  it("detail operation корректно структурирован", () => {
    pushEcommerce("detail", [{ id: "X-1", name: "Item X", price: 100 }]);
    const ec = getLastEcommerce();
    expect(ec).toBeDefined();
    expect((ec as { currencyCode?: string }).currencyCode).toBe("RUB");
    const detail = (ec as { detail?: { products: Array<Record<string, unknown>> } }).detail!;
    expect(detail.products).toHaveLength(1);
    expect(detail.products[0]!.id).toBe("X-1");
    expect(detail.products[0]!.price).toBe(100);
  });

  it("purchase operation содержит actionField.id (FR-111)", () => {
    pushEcommerce(
      "purchase",
      [{ id: "X", name: "X", price: 100, quantity: 1 }],
      { id: "SO-2026-0001", revenue: 100 },
    );
    const ec = getLastEcommerce();
    const purchase = (ec as { purchase?: { actionField?: { id: string }; products: unknown[] } })
      .purchase!;
    expect(purchase.actionField?.id).toBe("SO-2026-0001");
    expect(purchase.products).toHaveLength(1);
  });

  it("add / remove операции", () => {
    pushEcommerce("add", [{ id: "X", name: "X", quantity: 2 }]);
    expect(((getLastEcommerce() as { add?: unknown }).add)).toBeDefined();

    pushEcommerce("remove", [{ id: "X", name: "X", quantity: 1 }]);
    expect(((getLastEcommerce() as { remove?: unknown }).remove)).toBeDefined();
  });
});

describe("pushEcommerceImpressions (FR-113, v1.2 defer но method готов)", () => {
  it("renders impressions with list+position", () => {
    pushEcommerceImpressions([
      { id: "X-1", name: "X1", list: "homepage", position: 1 },
      { id: "X-2", name: "X2", list: "homepage", position: 2 },
    ]);
    const ec = getLastEcommerce();
    const impressions = (ec as { impressions?: unknown[] }).impressions!;
    expect(impressions).toHaveLength(2);
  });
});

describe("trackViewItem — dual-push (event + ecommerce.detail)", () => {
  it("emits both view_item event AND ecommerce.detail", () => {
    trackViewItem({ sku: "PDU-1", name: "PDU 19\"", price: 12500, category: "rack" });
    const dl = getDataLayer();
    expect(dl).toHaveLength(2);

    const evt = getLastEvent();
    expect(evt?.event).toBe("view_item");
    const ec = getLastEcommerce();
    const detail = (ec as { detail?: { products: Array<Record<string, unknown>> } }).detail!;
    expect(detail.products[0]!.id).toBe("PDU-1");
    expect(detail.products[0]!.category).toBe("rack");
  });
});

describe("trackAddToCart — dual-push (event + ecommerce.add)", () => {
  it("event имеет items[] + value (= price*quantity)", () => {
    trackAddToCart({ sku: "PDU-1", name: "PDU", quantity: 2, price: 100 });
    const evt = getLastEvent();
    expect(evt?.event).toBe("add_to_cart");
    expect((evt as { items: unknown[] }).items).toHaveLength(1);
    expect(evt?.value).toBe(200);

    const ec = getLastEcommerce();
    const add = (ec as { add?: { products: Array<Record<string, unknown>> } }).add!;
    expect(add.products[0]!.id).toBe("PDU-1");
    expect(add.products[0]!.quantity).toBe(2);
  });
});

describe("trackRemoveFromCart — dual-push (event + ecommerce.remove)", () => {
  it("emits remove_from_cart + ecommerce.remove", () => {
    trackRemoveFromCart({ sku: "PDU-1", name: "PDU", quantity: 1, price: 100 });
    expect(getLastEvent()?.event).toBe("remove_from_cart");
    const ec = getLastEcommerce();
    expect(((ec as { remove?: unknown }).remove)).toBeDefined();
  });
});

describe("trackPurchase — критичный dual-push (FR-110, FR-111, FR-114)", () => {
  it("emits purchase event + ecommerce.purchase с тем же transaction_id (FR-114)", () => {
    trackPurchase({
      orderId: "SO-2026-0001",
      total: 12500,
      items: [
        { sku: "PDU-1", name: "PDU 19\"", quantity: 1, price: 12500, category: "rack", brand: "Soliton" },
      ],
      shipping: 500,
      tax: 0,
    });

    const evt = getLastEvent();
    expect(evt?.event).toBe("purchase");
    expect(evt?.transaction_id).toBe("SO-2026-0001");
    expect(evt?.value).toBe(12500);
    expect(evt?.shipping).toBe(500);

    const ec = getLastEcommerce();
    const purchase = (ec as {
      purchase?: {
        actionField: { id: string; revenue: number; shipping?: number };
        products: Array<Record<string, unknown>>;
      };
    }).purchase!;
    // FR-114 — same transaction_id
    expect(purchase.actionField.id).toBe("SO-2026-0001");
    expect(purchase.actionField.revenue).toBe(12500);
    expect(purchase.actionField.shipping).toBe(500);
    // FR-112: products содержат category + brand
    expect(purchase.products[0]!.category).toBe("rack");
    expect(purchase.products[0]!.brand).toBe("Soliton");
  });
});

describe("trackViewCart / trackBeginCheckout", () => {
  it("trackViewCart с items + value", () => {
    trackViewCart(
      [{ sku: "X", name: "X", quantity: 1, price: 100 }],
      100,
    );
    const evt = getLastEvent();
    expect(evt?.event).toBe("view_cart");
    expect(evt?.value).toBe(100);
  });

  it("trackBeginCheckout с checkout_type", () => {
    trackBeginCheckout("legal", 50000);
    const evt = getLastEvent();
    expect(evt?.event).toBe("begin_checkout");
    expect(evt?.checkout_type).toBe("legal");
  });
});
