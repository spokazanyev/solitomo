/**
 * Inbound webhook event types from ЮKassa (055 Phase 1 contract).
 *
 * Source: https://yookassa.ru/developers/using-api/webhooks (verified 2026-05).
 * See spec.md FR-5550, FR-5551..5554, research.md R3.
 *
 * All inbound POST bodies match `YooKassaWebhookEvent` union. Webhook handler
 * MUST verify per FR-5530..5534 BEFORE typing as one of the variants below.
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

// --- Payment object (shared by payment.* events) -----------------------------

export interface YooKassaPaymentObject {
  /** Payment ID, e.g. "2dbdbeb6-000f-5000-9000-0e6d4eb52a3d" */
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  amount: { value: string; currency: "RUB" };
  income_amount?: { value: string; currency: "RUB" }; // amount minus ЮKassa fee
  description?: string;
  recipient: { account_id: string; gateway_id: string };
  payment_method?: YooKassaPaymentMethod;
  captured_at?: string; // ISO datetime
  created_at: string;
  expires_at?: string; // For two-stage: when authorization expires (7 days)
  test: boolean;
  refunded_amount?: { value: string; currency: "RUB" };
  paid: boolean;
  refundable: boolean;
  receipt_registration?: "pending" | "succeeded" | "canceled";
  /** Custom data from create-payment (FR-5507) */
  metadata?: {
    orderId?: string;
    clientNumber?: string;
    sourceVersion?: string;
    utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  };
  authorization_details?: {
    rrn?: string; // Retrieval Reference Number
    auth_code?: string;
    three_d_secure?: { applied: boolean };
  };
  cancellation_details?: {
    party: "yoo_money" | "payment_network" | "merchant";
    reason: string; // e.g. "expired_on_capture", "fraud_suspected", "insufficient_funds"
  };
}

export type YooKassaPaymentMethod =
  | YooKassaBankCardMethod
  | YooKassaSbpMethod
  | YooKassaYooMoneyMethod
  | YooKassaSberbankMethod;

export interface YooKassaBankCardMethod {
  type: "bank_card";
  id: string;
  saved: boolean;
  title?: string;
  card: {
    first6: string;
    last4: string;
    expiry_month: string;
    expiry_year: string;
    card_type: "Visa" | "MasterCard" | "MIR" | "JCB" | "UnionPay";
    issuer_country?: string; // ISO-alpha2
    issuer_name?: string;
  };
}

export interface YooKassaSbpMethod {
  type: "sbp";
  id: string;
  sbp_operation_id?: string;
  payer_bank_details?: {
    bank_id?: string;
    bank_name?: string;
  };
}

export interface YooKassaYooMoneyMethod {
  type: "yoo_money";
  id: string;
  account_number?: string; // already masked by ЮKassa
}

export interface YooKassaSberbankMethod {
  type: "sberbank";
  id: string;
  phone?: string; // masked
}

// --- Refund object (shared by refund.* events) -------------------------------

export interface YooKassaRefundObject {
  /** Refund ID */
  id: string;
  payment_id: string; // original payment ref
  status: "pending" | "succeeded" | "canceled";
  amount: { value: string; currency: "RUB" };
  description?: string;
  created_at: string;
  receipt_registration?: "pending" | "succeeded" | "canceled"; // фискальный чек коррекции
  cancellation_details?: {
    party: "yoo_money" | "payment_network" | "merchant";
    reason: string;
  };
}

// --- Specific event variants -------------------------------------------------

export type PaymentWaitingForCaptureEvent = WebhookEnvelope<
  "payment.waiting_for_capture",
  YooKassaPaymentObject & { status: "waiting_for_capture" }
>;

export type PaymentSucceededEvent = WebhookEnvelope<
  "payment.succeeded",
  YooKassaPaymentObject & { status: "succeeded"; paid: true }
>;

export type PaymentCanceledEvent = WebhookEnvelope<
  "payment.canceled",
  YooKassaPaymentObject & { status: "canceled"; paid: false }
>;

export type RefundSucceededEvent = WebhookEnvelope<
  "refund.succeeded",
  YooKassaRefundObject & { status: "succeeded" }
>;

export type RefundCanceledEvent = WebhookEnvelope<
  "refund.canceled",
  YooKassaRefundObject & { status: "canceled" }
>;

// --- Type guards (for handler dispatch) --------------------------------------

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

// --- Composite eventId (R3 + FR-5531) ----------------------------------------

/**
 * ЮKassa does not currently send a unique `event.id` in the payload.
 * We compose one for our idempotency table:
 *   `${object.id}:${event}`
 *
 * This composite is unique per (payment, event-type) — sufficient for
 * dedup of retried-by-ЮKassa webhooks.
 *
 * If/when ЮKassa adds `event.id` in payload (see changelog R10), switch
 * to that and migrate `paymentEvents.eventId` column.
 */
export function composeEventId(event: YooKassaWebhookEvent): string {
  return `${event.object.id}:${event.event}`;
}

// --- Outbound (POST /v3/payments) request body — for yookassa-client.ts -----

export interface CreatePaymentRequest {
  amount: { value: string; currency: "RUB" };
  capture: boolean; // false for two_stage, true for one_stage
  confirmation: {
    type: "redirect";
    return_url: string;
    /** Optional, restricts payment methods on ЮKassa page */
    enforce_payment_method?: false;
  } | {
    type: "qr";
  };
  description?: string;
  receipt?: YooKassaReceiptInput;
  metadata?: {
    orderId: string;
    clientNumber: string;
    sourceVersion: "055";
    utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  };
  /** Whitelist (FR-5505). Если опущено — ЮKassa показывает все методы магазина. */
  payment_method_data?: { type: "bank_card" | "sbp" | "yoo_money" | "sberbank" };
}

export interface YooKassaReceiptInput {
  customer: { email?: string; phone?: string }; // FR-5544b
  items: Array<{
    description: string;
    quantity: string; // formatted as decimal
    amount: { value: string; currency: "RUB" };
    vat_code: 1 | 2 | 3 | 4 | 5 | 6 | 11 | 12; // FR-5544 (12 default for 22/122)
    payment_subject: "commodity" | "service";
    payment_mode: "full_prepayment";
  }>;
  tax_system_code: 1 | 2 | 3 | 4 | 5 | 6; // FR-5543 (1 = ОСН default)
}

// --- Outbound capture/cancel request body ------------------------------------

export interface CapturePaymentRequest {
  amount?: { value: string; currency: "RUB" }; // if omitted, captures full authorized amount
  receipt?: YooKassaReceiptInput;
}

export interface CancelPaymentRequest {
  // Empty body — ЮKassa cancels by payment ID via URL
}
