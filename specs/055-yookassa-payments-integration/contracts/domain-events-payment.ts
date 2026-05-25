/**
 * Outbound domain events emitted by 055 webhook handler + cron.
 *
 * Subscribed by:
 *   - 049 NotificationsSubscriber (email matrix)
 *   - 052 CartRecoverySubscriber (payment.canceled, payment.expired)
 *   - 048 CrmSubscriber (payment.succeeded; gated by crmSettings.enabled)
 *
 * Cross-spec events `return.refunded` / `return.refund_failed` are also defined
 * here as they originate in 055 webhook handler (via 053 repository call).
 *
 * See spec.md §4 Key Entities, data-model.md §4.
 */

import type { YooKassaPaymentMethod } from "./yookassa-webhook-events";

// --- Payment events ---------------------------------------------------------

export type PaymentEvent =
  | PaymentAuthorized
  | PaymentCaptured
  | PaymentSucceeded
  | PaymentCanceled
  | PaymentExpired
  | PaymentAmountMismatch
  | PaymentReceiptFailed;

export type PaymentEventKind = PaymentEvent["kind"];

export interface PaymentAuthorized {
  kind: "payment.authorized";
  payment: {
    providerRef: string;
    amount: number; // rubles, 2 decimals
    method: PaymentMethodType;
  };
  order: { id: string; clientNumber: string };
  authorizedAt: string;
  meta: { eventId: string };
}

export interface PaymentCaptured {
  kind: "payment.captured";
  payment: {
    providerRef: string;
    authorizedAmount: number;
    capturedAmount: number;
  };
  order: { id: string; clientNumber: string };
  capturedAt: string;
  meta: { eventId: string };
}

export interface PaymentSucceeded {
  kind: "payment.succeeded";
  payment: {
    providerRef: string;
    amount: number;
    method: PaymentMethodType;
    receiptStatus: "pending" | "succeeded" | "canceled";
    paymentMethodSnapshot: PaymentMethodSnapshot;
    vatCodeApplied: number;
  };
  order: { id: string; clientNumber: string };
  succeededAt: string;
  meta: {
    eventId: string;
    /** UTM snapshot from Cart.metadata.utm (FR-5507, FR-5599 for analytics) */
    utm?: UtmSnapshot;
  };
}

export interface PaymentCanceled {
  kind: "payment.canceled";
  payment: {
    providerRef: string;
    reason: PaymentCancelReason;
  };
  order: { id: string; clientNumber: string };
  canceledAt: string;
  meta: { eventId: string };
}

export interface PaymentExpired {
  kind: "payment.expired";
  payment: { providerRef: string };
  order: { id: string; clientNumber: string };
  expiredAt: string;
  meta: { eventId: string };
}

export interface PaymentAmountMismatch {
  kind: "payment.amount_mismatch";
  payment: {
    providerRef: string;
    expected: number;
    actual: number;
  };
  order: { id: string; clientNumber: string };
  mismatchAt: string;
  meta: { eventId: string };
}

export interface PaymentReceiptFailed {
  kind: "payment.receipt_failed";
  payment: {
    providerRef: string;
    receiptStatus: "canceled";
  };
  order: { id: string; clientNumber: string };
  failedAt: string;
  meta: { eventId: string; errorHint?: string };
}

// --- Cross-spec: Return events emitted by 055 (subscribed by 049 + 053) -----

export type ReturnRefundEvent = ReturnRefunded | ReturnRefundFailed;

export interface ReturnRefunded {
  kind: "return.refunded";
  return: { id: string; clientNumber: string };
  order: { id: string; clientNumber: string };
  refund: {
    providerRefundId: string;
    amount: number; // kopecks (per 053 convention)
  };
  refundedAt: string;
  meta: { eventId: string };
}

export interface ReturnRefundFailed {
  kind: "return.refund_failed";
  return: { id: string; clientNumber: string };
  order: { id: string; clientNumber: string };
  refund: {
    providerRefundId: string;
    reason: string;
  };
  failedAt: string;
  meta: { eventId: string };
}

// --- Shared types -----------------------------------------------------------

export type PaymentMethodType = "bank_card" | "sbp" | "yoo_money" | "sberbank";

export type PaymentCancelReason =
  | "customer_canceled"
  | "3ds_failed"
  | "insufficient_funds"
  | "issuer_declined"
  | "fraud_suspected"
  | "expired"
  | "stock_unavailable"
  | "capture_retries_exhausted"
  | "manual_cancel"
  | "amount_mismatch"
  | "unknown";

export interface PaymentMethodSnapshot {
  type: PaymentMethodType;
  title: string;
  card?: {
    first6: string;
    last4: string;
    expiryMonth: string;
    expiryYear: string;
    cardType: "visa" | "mastercard" | "mir" | "jcb" | "unionpay";
    issuerCountry?: string;
    issuerName?: string;
  };
  sbp?: {
    bankId?: string;
    bankName?: string;
  };
  yooMoney?: {
    accountNumber?: string; // masked
  };
  sberbank?: {
    phone?: string; // masked
  };
}

export interface UtmSnapshot {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

// --- Extend DomainEventKind union (existing, in lib/lifecycle/domain-events.ts) ---

/**
 * Updates needed in `apps/web/src/lib/lifecycle/domain-events.ts`:
 *
 *   type DomainEventKind =
 *     | OrderEventKind
 *     | ShipmentEventKind
 *     | CartEventKind
 *     | ReturnEventKind
 *     | CustomerEventKind
 *     | PaymentEventKind;   // ⭐ NEW
 *
 *   type DomainEvent =
 *     | OrderEvent | ShipmentEvent | CartEvent | ReturnEvent | CustomerEvent
 *     | PaymentEvent;       // ⭐ NEW
 *
 * Also add ReturnRefunded / ReturnRefundFailed to the existing ReturnEvent
 * union (053 already defines ReturnEvent; we extend it).
 */
