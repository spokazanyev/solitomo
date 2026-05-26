/**
 * dataLayer event helpers for analytics (056 T007, FR-5630).
 *
 * Source: data-model.md §4 + contracts/ui-events.md.
 *
 * GA4-compliant `purchase` event + funnel `payment_intent` event.
 * Никаких PII — только product data + transaction_id (clientNumber).
 */

interface PurchaseDataLayerEvent {
  event: "purchase";
  transaction_id: string;
  value: number;
  currency: "RUB";
  payment_type?: "bank_card" | "sbp" | "yoo_money" | "sberbank";
  items: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
  }>;
}

interface PaymentIntentDataLayerEvent {
  event: "payment_intent";
  order_id: string | number;
  value: number;
  currency: "RUB";
}

export type CheckoutDataLayerEvent =
  | PurchaseDataLayerEvent
  | PaymentIntentDataLayerEvent;

function pushToDataLayer(event: CheckoutDataLayerEvent): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(event as unknown as Record<string, unknown>);
}

/**
 * Fire `purchase` event on success-state of /payment/return.
 * Caller MUST guard against double-fire (useRef + sessionStorage marker).
 *
 * 058 enhancement: дополнительно отправляется ecommerce dual-push (FR-110-115,
 * FR-114) — нативный объект Метрики `ecommerce.purchase` с тем же
 * `transaction_id` для активации встроенного отчёта «Электронная коммерция».
 *
 * См. analytics-loader.ts — Метрика инициализирована с `ecommerce: "dataLayer"`,
 * поэтому она автоматически читает наш push.
 */
export function pushPurchaseEvent(
  payload: Omit<PurchaseDataLayerEvent, "event">,
): void {
  pushToDataLayer({ event: "purchase", ...payload });

  // 058 FR-110-115: ecommerce native dual-push для Yandex.Metrika dashboard
  if (typeof window === "undefined") return;
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({
    ecommerce: {
      currencyCode: "RUB",
      purchase: {
        actionField: {
          id: payload.transaction_id,
          revenue: payload.value,
        },
        products: payload.items.map((item) => ({
          id: item.item_id,
          name: item.item_name,
          price: item.price,
          quantity: item.quantity,
        })),
      },
    },
  });
}

/**
 * Fire `payment_intent` event on click «Оплатить» в ReviewClient /
 * RetryPaymentButton. Multiple-fire OK (per-click funnel measurement).
 */
export function pushPaymentIntentEvent(
  payload: Omit<PaymentIntentDataLayerEvent, "event">,
): void {
  pushToDataLayer({ event: "payment_intent", ...payload });
}

/**
 * Session-storage marker key для anti-double-fire purchase event.
 * При page refresh после success — event не повторяется.
 */
export function purchaseFiredMarkerKey(orderId: string | number): string {
  return `purchase_fired_${orderId}`;
}

export function isPurchaseAlreadyFired(orderId: string | number): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(purchaseFiredMarkerKey(orderId)) === "1";
  } catch {
    return false;
  }
}

export function markPurchaseFired(orderId: string | number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(purchaseFiredMarkerKey(orderId), "1");
  } catch {
    // sessionStorage недоступен (private mode) — игнорируем
  }
}
