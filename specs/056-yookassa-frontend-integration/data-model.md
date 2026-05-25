# Data Model: ЮKassa Frontend Integration (056, Phase 1)

**Date**: 2026-05-25

**Note**: 056 — frontend integration. **Никаких новых DB-entities**. Только UI types, mappings, и dataLayer events.

---

## 1. UI state shape — PaymentReturnClient

```ts
// apps/web/src/components/payment/types.ts (NEW)

export type PaymentReturnState =
  | { kind: "loading" }
  | { kind: "polling"; tickCount: number; lastChecked: Date }
  | { kind: "success"; clientNumber: string; receiptStatus: "pending" | "succeeded" | "canceled" | null; paidAt: string }
  | { kind: "failure"; reason: "cancelled" | "expired"; retryAvailable: boolean }
  | { kind: "processing_pending" } // polling-timeout, webhook не пришёл
  | { kind: "error"; status: 403 | 404 | 5 /* 5xx */; message?: string };

export interface PaymentReturnProps {
  // Передаётся из Server Component (page.tsx)
  orderId: string | number;
  initialStatus: string; // Order.status на момент SSR
  initialPaymentStatus: string; // Order.payment.providerStatus
  clientNumber?: string;
  paidAt?: string | null;
  receiptStatus?: "pending" | "succeeded" | "canceled" | null;
  retryAvailable: boolean;
  /** Для polling URL — может включать ?token=<publicToken> если auth через publicToken */
  pollingTokenParam?: string;
}
```

## 2. Polling configuration constants

```ts
// apps/web/src/components/payment/payment-polling-config.ts (NEW)

export const PAYMENT_POLLING_CONFIG = {
  intervalMs: 2_000,        // OQ-5 resolved: hardcode 2 sec
  maxAttempts: 30,          // OQ-5 resolved: 30 attempts × 2s = 60s
  /** Terminal states — polling останавливается. */
  terminalStates: ["paid", "cancelled", "expired", "refunded"] as const,
} as const;

export type TerminalState = (typeof PAYMENT_POLLING_CONFIG.terminalStates)[number];
```

## 3. Error code → Russian string mapping (FR-5605)

```ts
// apps/web/src/components/payment/payment-error-strings.ts (NEW)

export interface PaymentErrorString {
  title: string;
  description: string;
  /** Suggested CTA label */
  ctaLabel: string;
  /** Suggested CTA href */
  ctaHref: string;
}

export const PAYMENT_ERROR_STRINGS: Record<string, PaymentErrorString> = {
  // From /api/payment/yookassa/create
  YOOKASSA_UNAVAILABLE: {
    title: "Платёжная система временно недоступна",
    description: "Попробуйте через 1-2 минуты. Если проблема повторяется — свяжитесь с нами.",
    ctaLabel: "Вернуться в корзину",
    ctaHref: "/cart/",
  },
  YOOKASSA_REJECTED: {
    title: "Платёж отклонён",
    description: "Возможные причины: недостаточно средств, ограничения банка. Попробуйте другую карту.",
    ctaLabel: "Попробовать снова",
    ctaHref: "", // populated dynamically from Order.publicToken
  },
  CONFIG_INVALID: {
    title: "Ошибка конфигурации платёжной системы",
    description: "Мы уже знаем о проблеме и работаем над ней. Заказ не создан.",
    ctaLabel: "На главную",
    ctaHref: "/",
  },
  INVALID_ORDER_STATUS: {
    title: "Заказ нельзя оплатить повторно",
    description: "Этот заказ уже оплачен либо аннулирован.",
    ctaLabel: "Открыть заказ",
    ctaHref: "", // populated dynamically
  },
  AMOUNT_MISMATCH: {
    title: "Несоответствие суммы",
    description: "Мы свяжемся с вами в течение часа для разбирательства.",
    ctaLabel: "На главную",
    ctaHref: "/",
  },
  // From /api/orders/[id]/payment-status
  FORBIDDEN: {
    title: "Не удалось проверить вашу сессию",
    description: "Войдите в личный кабинет или откройте ссылку из письма с подтверждением.",
    ctaLabel: "Войти",
    ctaHref: "/me/login",
  },
  ORDER_NOT_FOUND: {
    title: "Заказ не найден",
    description: "Возможно, ссылка устарела или была повреждена.",
    ctaLabel: "В каталог",
    ctaHref: "/catalog/",
  },
  // Fallback
  UNKNOWN: {
    title: "Что-то пошло не так",
    description: "Если деньги уже списались, мы пришлём подтверждение email-ом.",
    ctaLabel: "На главную",
    ctaHref: "/",
  },
};

/**
 * Resolve error code → user-facing strings. Use this in UI failure-states.
 * Fallback to UNKNOWN if code not registered.
 */
export function resolvePaymentError(code: string | undefined): PaymentErrorString {
  if (!code) return PAYMENT_ERROR_STRINGS.UNKNOWN!;
  return PAYMENT_ERROR_STRINGS[code] ?? PAYMENT_ERROR_STRINGS.UNKNOWN!;
}
```

## 4. dataLayer event schema (FR-5630 NEW)

```ts
// apps/web/src/components/payment/datalayer-events.ts (NEW)

interface PurchaseDataLayerEvent {
  event: "purchase";
  transaction_id: string;        // SO-2026-NNNN
  value: number;                 // в рублях
  currency: "RUB";
  payment_type: "bank_card" | "sbp" | "yoo_money" | "sberbank";
  items: Array<{
    item_id: string;             // sku
    item_name: string;           // product title
    price: number;
    quantity: number;
  }>;
}

interface PaymentIntentDataLayerEvent {
  event: "payment_intent";       // funnel-step при click «Оплатить»
  order_id: string | number;
  value: number;
  currency: "RUB";
}

export type CheckoutDataLayerEvent =
  | PurchaseDataLayerEvent
  | PaymentIntentDataLayerEvent;

export function pushPurchaseEvent(payload: Omit<PurchaseDataLayerEvent, "event">): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event: "purchase", ...payload });
}

export function pushPaymentIntentEvent(payload: Omit<PaymentIntentDataLayerEvent, "event">): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event: "payment_intent", ...payload });
}
```

## 5. Notification template registration

```ts
// apps/web/src/lib/notifications/templates/index.ts — РАСШИРЕНИЕ existing REGISTRY

import { renderT015PaymentExpired } from "./t-015-payment-expired";
import { renderT109AmountMismatch } from "./t-109-amount-mismatch";
import { renderT110ReceiptFailed } from "./t-110-receipt-failed";
import { renderT111RefundFailed } from "./t-111-refund-failed";

// Existing REGISTRY получает 4 новых entries:
const REGISTRY: Record<string, TemplateRenderer> = {
  // ... existing T-001..T-009 + T-101..T-105
  "T-015": renderT015PaymentExpired,    // ⭐ NEW (056 US4)
  "T-109": renderT109AmountMismatch,    // ⭐ NEW
  "T-110": renderT110ReceiptFailed,     // ⭐ NEW
  "T-111": renderT111RefundFailed,      // ⭐ NEW
};
```

## 6. Order schema requirements (existing — verification только)

```ts
// Уже существует в Orders.js — для referencing:
{
  id: number,                              // PG numeric
  clientNumber: "SO-2026-0042",            // 051 generated on create
  publicToken: "xxxxxxxxxxxxxxxxxxxxxx",   // 047 auto-generated 128-bit (OQ-2 verified)
  status: "pending_payment" | "paid" | ...,
  cartId: number | { id: number } | null,  // 052
  customerId: number | { id: number } | null, // 054 — 056 FR-5609 enables auto-fill
  totals: { total: number, ... },
  payment: {
    providerStatus: "none" | "pending" | "authorized" | "succeeded" | "canceled",
    providerRef: string,                   // YooKassa payment.id
    paidAt: string | null,
    confirmationUrl: string,
    confirmationType: "redirect" | "qr" | "embedded",
    paymentMethodSnapshot: {
      type: "bank_card" | "sbp" | "yoo_money" | "sberbank",
      title: string,
      card?: { first6, last4, expiryMonth, expiryYear, cardType, ... },
      sbp?: { bankId, bankName },
      // ...
    },
    receiptStatus: "pending" | "succeeded" | "canceled" | null,
    createdAt: string,
    idempotenceKey: string,
  },
  items: Array<{ title, sku, quantity, price, priceSnapshot, ... }>,
  delivery: { cost, tariffName, ... },
}
```

## 7. Privacy & PII handling

| Field | PII | Usage in UI | Risk |
|---|---|---|---|
| `customer.email` | Yes | Не отображается на public page; используется в email-templates | Server-only |
| `customer.phone` | Yes | Не отображается; в emails | Server-only |
| `payment.paymentMethodSnapshot.card.last4` | Masked (PCI-OK) | Можно показать в success-state: «Карта •••• 1234» | Acceptable |
| `payment.paymentMethodSnapshot.card.first6` | Masked (PCI-OK) | Не показывать (избыточно) | Server-side only |
| `Order.publicToken` | Security-critical | URL `?token=<...>`; не log'аем в analytics | Token rotation на reissue (051 FR) |
| dataLayer events | None — только product data | Public (GA4) | OK |

**Critical**: dataLayer `purchase` event **не должен** содержать email/phone/card details (GDPR/152-ФЗ + Google policy).

## 8. State transitions (UI side)

```
[mount] → loading (1-2 ticks)
  ↓
  ├─ initial status from SSR = paid → success (no polling needed)
  ├─ initial status from SSR = expired/cancelled → failure
  ├─ initial status from SSR = pending_payment → polling
  │    ↓ poll every 2s (max 30 attempts)
  │    ├─ tick returns paid → success + fire dataLayer purchase event
  │    ├─ tick returns expired/cancelled → failure
  │    └─ 30 attempts reached → processing_pending (final state)
  └─ HTTP 403/404/5xx → error
```

**Side-effects** (one-time only, useRef guard):
- `success` reached → push `purchase` event to dataLayer
- (Optionally) `failure` reached → push `payment_failed` event (not in MVP scope)

---

**End of data-model.md.**
