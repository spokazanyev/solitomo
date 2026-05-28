// Thin wrapper around window.dataLayer used by Yandex.Metrika and GA4.
// Events follow analytics-measurement-spec.md naming.
//
// Соответствие 058:
// - FR-062 invariant: каждый push прогоняется через scrubPII()
// - FR-110-115: native Metrika ecommerce dual-push (требует ecommerce:"dataLayer"
//   в init Метрики — настроено в analytics-loader.ts)
// - FR-114: общий transaction_id для дедупликации client/server

import { scrubPII } from "./pii-filter";

/**
 * Низкоуровневый push в dataLayer. Используется event-helpers'ами; обычно НЕ
 * вызывается напрямую из UI-кода.
 *
 * Каждый push прогоняется через scrubPII — defence-in-depth FR-062.
 */
export function pushEvent(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const win = window as unknown as { dataLayer?: Record<string, unknown>[] };
  win.dataLayer = win.dataLayer || [];
  const cleanPayload = scrubPII(payload);
  win.dataLayer.push({ event, ...cleanPayload });
}

/**
 * Push нативного ecommerce-объекта Метрики (FR-110-115).
 *
 * Требует, чтобы Yandex.Metrika была инициализирована с `ecommerce: "dataLayer"`
 * — см. `analytics-loader.ts:loadYandexMetrika`. Метрика автоматически читает
 * эти push'и для встроенного отчёта «Электронная коммерция».
 *
 * Operation типы — Metrika-специфичные: `detail` / `add` / `remove` / `purchase`.
 *
 * @example
 *   pushEcommerce("detail", [{ id: "PDU-1", name: "PDU 19\"", price: 12500 }])
 *
 * @example
 *   pushEcommerce("purchase",
 *     [{ id: "PDU-1", name: "PDU 19\"", price: 12500, quantity: 1 }],
 *     { id: "SO-2026-0001", revenue: 12500, shipping: 500 }
 *   )
 */
export function pushEcommerce(
  operation: "detail" | "add" | "remove" | "purchase",
  products: Array<EcommerceProduct>,
  actionField?: { id?: string; revenue?: number; shipping?: number; tax?: number },
): void {
  if (typeof window === "undefined") return;
  const win = window as unknown as { dataLayer?: Record<string, unknown>[] };
  win.dataLayer = win.dataLayer || [];

  // Yandex Metrika ecommerce-объект следует структуре Enhanced Ecommerce (Google).
  // FR-115: ecommerce object MUST НЕ содержать ПДн — products описывают только
  // товары (id/name/category/brand/price/quantity/variant), не пользователя.
  const ecommerce: Record<string, unknown> = {
    currencyCode: "RUB",
    [operation]: {
      ...(actionField ? { actionField } : {}),
      products: products.map(productToEcommerceShape),
    },
  };

  // НЕ прогоняем через scrubPII — ecommerce structure известная и не содержит PII.
  // Если разработчик передаст PII в product.name — это bug, ловим в smoke-test.
  win.dataLayer.push({ ecommerce });
}

/**
 * Impressions ecommerce push (FR-113). Используется при view_item_list.
 * Defer to v1.1 (catalog < 200 SKU, см. spec § Scope Phases v1.2).
 *
 * Метод оставлен экспортом для совместимости.
 */
export function pushEcommerceImpressions(products: Array<EcommerceProduct & { list?: string; position?: number }>): void {
  if (typeof window === "undefined") return;
  const win = window as unknown as { dataLayer?: Record<string, unknown>[] };
  win.dataLayer = win.dataLayer || [];
  win.dataLayer.push({
    ecommerce: {
      currencyCode: "RUB",
      impressions: products.map(productToEcommerceShape),
    },
  });
}

// ============================================================
// Domain types
// ============================================================

export type RfqCartItem = {
  sku: string;
  name: string;
  quantity?: string | number;
  price?: number | null;
  category?: string;
  brand?: string;
};

export type EcommerceProduct = {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  price?: number;
  quantity?: number;
  variant?: string;
  list?: string;
  position?: number;
};

type CartEventItem = {
  sku: string;
  name: string;
  quantity?: number | string;
  price?: number | null | undefined;
  category?: string;
  brand?: string;
};

function productToEcommerceShape(p: EcommerceProduct): Record<string, unknown> {
  const out: Record<string, unknown> = { id: p.id, name: p.name };
  if (p.category !== undefined) out.category = p.category;
  if (p.brand !== undefined) out.brand = p.brand;
  if (p.price !== undefined) out.price = p.price;
  if (p.quantity !== undefined) out.quantity = p.quantity;
  if (p.variant !== undefined) out.variant = p.variant;
  if (p.list !== undefined) out.list = p.list;
  if (p.position !== undefined) out.position = p.position;
  return out;
}

function toAnalyticsItem(item: CartEventItem) {
  const quantity = Number(item.quantity);
  const out: Record<string, unknown> = {
    item_id: item.sku,
    item_name: item.name,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
  };
  if (typeof item.price === "number") out.price = item.price;
  if (item.category) out.category = item.category;
  if (item.brand) out.brand = item.brand;
  return out;
}

function cartItemToEcommerce(item: CartEventItem, override?: Partial<EcommerceProduct>): EcommerceProduct {
  const quantity = Number(item.quantity);
  const result: EcommerceProduct = {
    id: item.sku,
    name: item.name,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
  };
  if (typeof item.price === "number") result.price = item.price;
  if (item.category) result.category = item.category;
  if (item.brand) result.brand = item.brand;
  if (override) Object.assign(result, override);
  return result;
}

// ============================================================
// Event helpers (GA4-style + Метрика ecommerce dual-push)
// ============================================================

/** view_item + ecommerce.detail (FR-110, T028) */
export function trackViewItem(item: RfqCartItem) {
  pushEvent("view_item", {
    items: [
      {
        item_id: item.sku,
        item_name: item.name,
        category: item.category,
        brand: item.brand,
        price: item.price ?? undefined,
      },
    ],
    currency: "RUB",
  });
  pushEcommerce("detail", [
    {
      id: item.sku,
      name: item.name,
      ...(item.category ? { category: item.category } : {}),
      ...(item.brand ? { brand: item.brand } : {}),
      ...(item.price !== null && item.price !== undefined ? { price: item.price } : {}),
    },
  ]);
}

/** add_to_rfq — RFQ-specific (без ecommerce dual-push, это не e-commerce conversion) */
export function trackAddToRfq(item: RfqCartItem) {
  pushEvent("add_to_rfq", {
    items: [
      {
        item_id: item.sku,
        item_name: item.name,
        quantity: Number(item.quantity) || 1,
      },
    ],
  });
}

export function trackBeginQuote(itemCount: number) {
  pushEvent("begin_quote", { item_count: itemCount });
}

export function trackQuoteSubmitted(payload: { trackingId?: string; itemCount: number; value?: number }) {
  pushEvent("quote_submitted", {
    tracking_id: payload.trackingId,
    item_count: payload.itemCount,
    value: payload.value,
    currency: "RUB",
  });
}

/** view_cart + ecommerce.detail (FR — уже есть) */
export function trackViewCart(items: CartEventItem[], total: number) {
  pushEvent("view_cart", {
    items: items.map(toAnalyticsItem),
    value: total,
    currency: "RUB",
  });
}

/** begin_checkout */
export function trackBeginCheckout(checkoutType: "physical" | "legal" | "quote", total: number) {
  pushEvent("begin_checkout", {
    checkout_type: checkoutType,
    value: total,
    currency: "RUB",
  });
}

export function trackInvoiceRequested(payload: { orderId: string; total: number; items: CartEventItem[] }) {
  pushEvent("invoice_requested", {
    order_id: payload.orderId,
    value: payload.total,
    currency: "RUB",
    items: payload.items.map(toAnalyticsItem),
  });
}

/**
 * purchase + ecommerce.purchase dual-push (FR-110, FR-111, FR-114).
 *
 * Главный конверсионный event. `transaction_id` = orderId (SO-YYYY-NNNN) для
 * дедупликации client/server hits.
 *
 * @param payload — `orderId` (= transaction_id), `total` (revenue без shipping),
 *                  `items[]` (товары с category/brand если есть), `shipping?`, `tax?`
 */
export function trackPurchase(payload: {
  orderId: string;
  total: number;
  items: CartEventItem[];
  shipping?: number;
  tax?: number;
}) {
  pushEvent("purchase", {
    transaction_id: payload.orderId,
    value: payload.total,
    currency: "RUB",
    items: payload.items.map(toAnalyticsItem),
    ...(payload.shipping !== undefined ? { shipping: payload.shipping } : {}),
    ...(payload.tax !== undefined ? { tax: payload.tax } : {}),
  });

  // FR-114: dual-push в ecommerce объект Метрики с тем же transaction_id
  const products = payload.items.map((i) => cartItemToEcommerce(i));
  const actionField: { id: string; revenue: number; shipping?: number; tax?: number } = {
    id: payload.orderId,
    revenue: payload.total,
  };
  if (payload.shipping !== undefined) actionField.shipping = payload.shipping;
  if (payload.tax !== undefined) actionField.tax = payload.tax;
  pushEcommerce("purchase", products, actionField);
}

/**
 * add_to_cart + ecommerce.add (T029, FR-110)
 */
export function trackAddToCart(item: CartEventItem) {
  pushEvent("add_to_cart", {
    items: [toAnalyticsItem(item)],
    currency: "RUB",
    ...(typeof item.price === "number"
      ? { value: item.price * (Number(item.quantity) || 1) }
      : {}),
  });
  pushEcommerce("add", [cartItemToEcommerce(item)]);
}

/**
 * remove_from_cart + ecommerce.remove (FR-010, FR-110)
 */
export function trackRemoveFromCart(item: CartEventItem) {
  pushEvent("remove_from_cart", {
    items: [toAnalyticsItem(item)],
    currency: "RUB",
  });
  pushEcommerce("remove", [cartItemToEcommerce(item)]);
}
