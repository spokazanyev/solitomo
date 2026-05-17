// Thin wrapper around window.dataLayer used by Yandex.Metrika and GA4.
// Events follow analytics-measurement-spec.md naming.
//
// TODO(owner): set NEXT_PUBLIC_YM_COUNTER_ID and NEXT_PUBLIC_GA4_MEASUREMENT_ID
// in .env so tags initialise in AnalyticsScripts.tsx.

export function pushEvent(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const win = window as unknown as { dataLayer?: Record<string, unknown>[] };
  win.dataLayer = win.dataLayer || [];
  win.dataLayer.push({ event, ...payload });
}

export type RfqCartItem = {
  sku: string;
  name: string;
  quantity?: string | number;
  price?: number | null;
};

export function trackViewItem(item: RfqCartItem) {
  pushEvent("view_item", {
    items: [
      {
        item_id: item.sku,
        item_name: item.name,
        price: item.price ?? undefined,
      },
    ],
  });
}

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

export function trackQuoteSubmitted(payload: {
  trackingId?: string;
  itemCount: number;
  value?: number;
}) {
  pushEvent("quote_submitted", {
    tracking_id: payload.trackingId,
    item_count: payload.itemCount,
    value: payload.value,
    currency: "RUB",
  });
}

// Cart and Checkout (spec 037) event helpers.
type CartEventItem = {
  sku: string;
  name: string;
  quantity?: number | string;
  price?: number | null | undefined;
};

function toAnalyticsItem(item: CartEventItem) {
  const quantity = Number(item.quantity);
  return {
    item_id: item.sku,
    item_name: item.name,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    price: typeof item.price === "number" ? item.price : undefined,
  };
}

export function trackViewCart(items: CartEventItem[], total: number) {
  pushEvent("view_cart", {
    items: items.map(toAnalyticsItem),
    value: total,
    currency: "RUB",
  });
}

export function trackBeginCheckout(
  checkoutType: "physical" | "legal" | "quote",
  total: number,
) {
  pushEvent("begin_checkout", {
    checkout_type: checkoutType,
    value: total,
    currency: "RUB",
  });
}

export function trackInvoiceRequested(payload: {
  orderId: string;
  total: number;
  items: CartEventItem[];
}) {
  pushEvent("invoice_requested", {
    order_id: payload.orderId,
    value: payload.total,
    currency: "RUB",
    items: payload.items.map(toAnalyticsItem),
  });
}

export function trackPurchase(payload: {
  orderId: string;
  total: number;
  items: CartEventItem[];
}) {
  pushEvent("purchase", {
    transaction_id: payload.orderId,
    value: payload.total,
    currency: "RUB",
    items: payload.items.map(toAnalyticsItem),
  });
}
