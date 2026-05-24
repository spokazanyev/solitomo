import "server-only";

/**
 * Типизированные контракты ЮKassa (055 Foundational, T011).
 *
 * Re-export из contracts/yookassa-webhook-events.ts spec'и + canonical helpers.
 * Spec source: specs/055-yookassa-payments-integration/contracts/yookassa-webhook-events.ts
 */

// --- Common envelope ---------------------------------------------------------

export type YooKassaWebhookEvent =
  | PaymentWaitingForCaptureEvent
  | PaymentSucceededEvent
  | PaymentCanceledEvent
  | RefundSucceededEvent
  | RefundCanceledEvent;

interface WebhookEnvelope<TEvent extends string, TObject> {
  type: "notification";
  event: TEvent;
  object: TObject;
}

// --- Payment object ----------------------------------------------------------

export interface YooKassaPaymentObject {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  amount: { value: string; currency: "RUB" };
  income_amount?: { value: string; currency: "RUB" };
  description?: string;
  recipient?: { account_id?: string; gateway_id?: string };
  payment_method?: YooKassaPaymentMethod;
  captured_at?: string;
  created_at: string;
  expires_at?: string;
  test?: boolean;
  refunded_amount?: { value: string; currency: "RUB" };
  paid?: boolean;
  refundable?: boolean;
  receipt_registration?: "pending" | "succeeded" | "canceled";
  metadata?: {
    orderId?: string;
    clientNumber?: string;
    sourceVersion?: string;
    utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  };
  authorization_details?: {
    rrn?: string;
    auth_code?: string;
    three_d_secure?: { applied: boolean };
  };
  cancellation_details?: {
    party?: "yoo_money" | "payment_network" | "merchant";
    reason?: string;
  };
}

export type YooKassaPaymentMethod =
  | YooKassaBankCardMethod
  | YooKassaSbpMethod
  | YooKassaYooMoneyMethod
  | YooKassaSberbankMethod
  | { type: string; id?: string; [k: string]: unknown };

export interface YooKassaBankCardMethod {
  type: "bank_card";
  id?: string;
  saved?: boolean;
  title?: string;
  card?: {
    first6?: string;
    last4?: string;
    expiry_month?: string;
    expiry_year?: string;
    card_type?: string;
    issuer_country?: string;
    issuer_name?: string;
  };
}

export interface YooKassaSbpMethod {
  type: "sbp";
  id?: string;
  sbp_operation_id?: string;
  payer_bank_details?: {
    bank_id?: string;
    bank_name?: string;
  };
}

export interface YooKassaYooMoneyMethod {
  type: "yoo_money";
  id?: string;
  account_number?: string;
}

export interface YooKassaSberbankMethod {
  type: "sberbank";
  id?: string;
  phone?: string;
}

// --- Refund object -----------------------------------------------------------

export interface YooKassaRefundObject {
  id: string;
  payment_id: string;
  status: "pending" | "succeeded" | "canceled";
  amount: { value: string; currency: "RUB" };
  description?: string;
  created_at: string;
  receipt_registration?: "pending" | "succeeded" | "canceled";
  cancellation_details?: {
    party?: "yoo_money" | "payment_network" | "merchant";
    reason?: string;
  };
}

// --- Specific event variants -------------------------------------------------

export type PaymentWaitingForCaptureEvent = WebhookEnvelope<"payment.waiting_for_capture", YooKassaPaymentObject>;
export type PaymentSucceededEvent = WebhookEnvelope<"payment.succeeded", YooKassaPaymentObject>;
export type PaymentCanceledEvent = WebhookEnvelope<"payment.canceled", YooKassaPaymentObject>;
export type RefundSucceededEvent = WebhookEnvelope<"refund.succeeded", YooKassaRefundObject>;
export type RefundCanceledEvent = WebhookEnvelope<"refund.canceled", YooKassaRefundObject>;

// --- Receipt input -----------------------------------------------------------

export interface YooKassaReceiptInput {
  customer: { email?: string; phone?: string };
  items: Array<{
    description: string;
    quantity: string;
    amount: { value: string; currency: "RUB" };
    vat_code: 1 | 2 | 3 | 4 | 5 | 6 | 11 | 12;
    payment_subject: "commodity" | "service";
    payment_mode: "full_prepayment";
  }>;
  tax_system_code: 1 | 2 | 3 | 4 | 5 | 6;
}

// --- Outbound requests -------------------------------------------------------

export interface CreatePaymentRequest {
  amount: { value: string; currency: "RUB" };
  capture: boolean;
  confirmation:
    | { type: "redirect"; return_url: string; enforce_payment_method?: false }
    | { type: "qr" };
  description?: string;
  receipt?: YooKassaReceiptInput;
  metadata?: {
    orderId: string;
    clientNumber?: string;
    sourceVersion: "055";
    utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  };
  payment_method_data?: { type: "bank_card" | "sbp" | "yoo_money" | "sberbank" };
}

export interface CapturePaymentRequest {
  amount?: { value: string; currency: "RUB" };
  receipt?: YooKassaReceiptInput;
}

// --- Helpers -----------------------------------------------------------------

export function isPaymentEvent(
  e: YooKassaWebhookEvent,
): e is PaymentWaitingForCaptureEvent | PaymentSucceededEvent | PaymentCanceledEvent {
  return e.event.startsWith("payment.");
}

export function isRefundEvent(
  e: YooKassaWebhookEvent,
): e is RefundSucceededEvent | RefundCanceledEvent {
  return e.event.startsWith("refund.");
}

/**
 * Composite eventId для дедупликации (FR-5531).
 * Format: `${object.id}:${event}`.
 *
 * ЮKassa не присылает уникальный event.id в payload. Композит уникален
 * per (payment/refund, event-type) — достаточно для retry-deduplication.
 */
export function composeEventId(event: YooKassaWebhookEvent): string {
  return `${event.object.id}:${event.event}`;
}

/** Type guard для парсинга unknown payload как webhook event. */
export function tryParseWebhookEvent(raw: unknown): YooKassaWebhookEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.type !== "notification") return null;
  if (typeof r.event !== "string") return null;
  if (!r.object || typeof r.object !== "object") return null;
  const obj = r.object as Record<string, unknown>;
  if (typeof obj.id !== "string") return null;
  const validEvents = new Set([
    "payment.waiting_for_capture",
    "payment.succeeded",
    "payment.canceled",
    "refund.succeeded",
    "refund.canceled",
  ]);
  if (!validEvents.has(r.event)) return null;
  return raw as YooKassaWebhookEvent;
}
