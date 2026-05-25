import "server-only";

/**
 * ЮKassa webhook handler — security pipeline + event dispatch (055).
 *
 * Coverage (Phase 3 US3 + Phase 4 US1 + Phase 6 US4):
 *   - FR-5530..5534: IP allowlist + idempotency + amount-match + currency
 *   - FR-5536: ≤3 sec response (heavy ops async)
 *   - FR-5550..5555: dispatch для 5 событий
 *   - FR-5595..5597: PII masking в логах
 *
 * Контракт: Order никогда не мутируется до записи PaymentEvents (FR-5555).
 * Returns мутируются только через 053 repository (Constitution IV).
 */

import configPromise from "@payload-config";
import { getPayload } from "payload";
import type { Payload } from "payload";

import { emitDomainEvent } from "../lifecycle/events";
import { extractClientIp, isIpInYooKassaAllowlist } from "./ip-allowlist";
import { loadPaymentSettings } from "./settings";
import {
  capturePayment,
  cancelPayment,
  YooKassaClientError,
  YooKassaNetworkError,
} from "./yookassa-client";
import {
  composeEventId,
  isPaymentEvent,
  isRefundEvent,
  tryParseWebhookEvent,
  type CapturePaymentRequest,
  type PaymentCanceledEvent,
  type PaymentSucceededEvent,
  type PaymentWaitingForCaptureEvent,
  type RefundCanceledEvent,
  type RefundSucceededEvent,
  type YooKassaBankCardMethod,
  type YooKassaPaymentObject,
  type YooKassaSberbankMethod,
  type YooKassaSbpMethod,
  type YooKassaWebhookEvent,
  type YooKassaYooMoneyMethod,
} from "./yookassa-types";

const AMOUNT_TOLERANCE_KOPECKS = 1; // 0.01 ₽

export type RejectedReason =
  | "ip_not_allowed"
  | "unknown_payment"
  | "unknown_refund"
  | "amount_mismatch"
  | "currency_mismatch"
  | "signature_invalid"
  | "settings_disabled"
  | "internal_error"
  | "parse_error";

export interface WebhookHandlerInput {
  rawBody: unknown;
  headers: Headers;
}

export interface WebhookHandlerResult {
  /** HTTP status сервис должен вернуть ЮKassa. */
  status: number;
  /** Body для ответа (для логов). */
  body: { ok?: boolean; code?: string; message?: string };
  /** Outcome для дальнейших heavy-ops в waitUntil. */
  outcome: {
    eventId?: string;
    accepted: boolean;
    rejectedReason?: RejectedReason;
    duplicate?: boolean;
    /** Domain events to emit AFTER 200 OK response (FR-5536). */
    afterResponse?: () => Promise<void>;
  };
}

interface DispatchContext {
  payload: Payload;
  paymentEventId: string | number;
  event: YooKassaWebhookEvent;
}

/**
 * Главная точка входа для webhook'ов.
 * НЕ выполняет heavy ops (emit + 049 send) — только верификация + PaymentEvents
 * + Order/Return mutation. Heavy ops — в outcome.afterResponse() через waitUntil.
 */
export async function handleYooKassaWebhook(
  input: WebhookHandlerInput,
): Promise<WebhookHandlerResult> {
  const sourceIp = extractClientIp(input.headers);

  // (а) FR-5530: IP-allowlist
  if (!isIpInYooKassaAllowlist(sourceIp)) {
    await logRejected("ip_not_allowed", sourceIp, undefined, undefined);
    return {
      status: 403,
      body: { code: "IP_NOT_ALLOWED", message: "Source IP is not in ЮKassa allowlist" },
      outcome: { accepted: false, rejectedReason: "ip_not_allowed" },
    };
  }

  // Parse payload
  const event = tryParseWebhookEvent(input.rawBody);
  if (!event) {
    await logRejected("parse_error", sourceIp, undefined, input.rawBody);
    return {
      status: 400,
      body: { code: "PARSE_ERROR", message: "Invalid webhook payload" },
      outcome: { accepted: false, rejectedReason: "parse_error" },
    };
  }

  const eventId = composeEventId(event);
  const settings = await loadPaymentSettings().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[yookassa-webhook] loadPaymentSettings failed:", err);
    return null;
  });

  if (!settings) {
    await logRejected("internal_error", sourceIp, eventId, event);
    return {
      status: 503,
      body: { code: "SETTINGS_UNAVAILABLE", message: "PaymentSettings cannot be loaded" },
      outcome: { accepted: false, rejectedReason: "internal_error", eventId },
    };
  }
  if (!settings.enabled) {
    await logRejected("settings_disabled", sourceIp, eventId, event);
    return {
      status: 503,
      body: { code: "DISABLED", message: "Payment integration is disabled" },
      outcome: { accepted: false, rejectedReason: "settings_disabled", eventId },
    };
  }

  const payload = await getPayload({ config: configPromise });

  // (б) FR-5531: idempotency by eventId
  const existing = await payload
    .find({
      collection: "paymentEvents",
      where: { eventId: { equals: eventId } },
      limit: 1,
    })
    .catch(() => ({ docs: [] as Array<{ id: string; duplicateCount?: number }> }));

  if (existing.docs.length > 0) {
    const doc = existing.docs[0];
    if (doc) {
      await payload
        .update({
          collection: "paymentEvents",
          id: doc.id as never,
          data: { duplicateCount: ((doc as { duplicateCount?: number }).duplicateCount ?? 0) + 1 } as never,
        })
        .catch(() => undefined);
    }
    return {
      status: 200,
      body: { ok: true },
      outcome: { accepted: false, duplicate: true, eventId },
    };
  }

  // Find Order or Return + validate currency/amount (FR-5532..5534)
  let orderId: string | undefined;
  let returnId: string | undefined;

  if (isPaymentEvent(event)) {
    const obj = event.object;
    // FR-5533: currency
    if (obj.amount.currency !== "RUB") {
      await persistEvent(payload, {
        eventId,
        event,
        sourceIp,
        result: "rejected",
        rejectedReason: "currency_mismatch",
      });
      return {
        status: 200, // we acknowledge to stop retries
        body: { code: "CURRENCY_MISMATCH" },
        outcome: { accepted: false, rejectedReason: "currency_mismatch", eventId },
      };
    }
    // FR-5534: lookup Order by providerRef
    const orderRes = await payload
      .find({
        collection: "orders",
        where: { "payment.providerRef": { equals: obj.id } },
        limit: 1,
      })
      .catch(() => ({ docs: [] as Array<{ id: string; totals?: { total?: number } }> }));
    const order = orderRes.docs[0];
    if (!order) {
      await persistEvent(payload, {
        eventId,
        event,
        sourceIp,
        result: "rejected",
        rejectedReason: "unknown_payment",
      });
      return {
        status: 200,
        body: { code: "UNKNOWN_PAYMENT" },
        outcome: { accepted: false, rejectedReason: "unknown_payment", eventId },
      };
    }
    orderId = String(order.id);

    // FR-5532: amount-match с допуском 0.01 ₽
    const expectedRub = (order as { totals?: { total?: number } }).totals?.total ?? 0;
    const expectedKop = Math.round(expectedRub * 100);
    const actualKop = Math.round(Number(obj.amount.value) * 100);
    if (Math.abs(expectedKop - actualKop) > AMOUNT_TOLERANCE_KOPECKS) {
      await persistEvent(payload, {
        eventId,
        event,
        sourceIp,
        result: "rejected",
        rejectedReason: "amount_mismatch",
        orderId,
      });

      const clientNumber = (order as { clientNumber?: string }).clientNumber;

      return {
        status: 200,
        body: { code: "AMOUNT_MISMATCH" },
        outcome: {
          accepted: false,
          rejectedReason: "amount_mismatch",
          eventId,
          // FR-5532a: эмит amount_mismatch event + alert менеджеру (after response)
          afterResponse: async () => {
            await emitDomainEvent({
              kind: "payment.amount_mismatch",
              order: {
                id: orderId!,
                clientNumber,
                status: (order as { status?: string }).status ?? "unknown",
              },
              context: {
                payment: {
                  providerRef: obj.id,
                  expected: expectedKop,
                  actual: actualKop,
                  eventId,
                },
              },
              eventIdSuffix: eventId,
            });
          },
        },
      };
    }
  } else if (isRefundEvent(event)) {
    const obj = event.object;
    if (obj.amount.currency !== "RUB") {
      await persistEvent(payload, {
        eventId,
        event,
        sourceIp,
        result: "rejected",
        rejectedReason: "currency_mismatch",
      });
      return {
        status: 200,
        body: { code: "CURRENCY_MISMATCH" },
        outcome: { accepted: false, rejectedReason: "currency_mismatch", eventId },
      };
    }
    // For refund events the actual return-lookup happens in 053 repository
    // (applyRefundSucceeded / applyRefundCanceled), not here.
  }

  // Persist PaymentEvents entry as success-pending (FR-5555: before mutations)
  const created = await persistEvent(payload, {
    eventId,
    event,
    sourceIp,
    result: "success",
    orderId,
    returnId,
  });
  const paymentEventId: string | number = created?.id ?? "";

  // Dispatch (mutations + emit) — внутри outcome.afterResponse() для FR-5536
  return {
    status: 200,
    body: { ok: true },
    outcome: {
      accepted: true,
      eventId,
      afterResponse: async () => {
        try {
          await dispatchEvent({ payload, paymentEventId, event });
          await payload
            .update({
              collection: "paymentEvents",
              id: paymentEventId as never,
              data: { processedAt: new Date().toISOString() } as never,
            })
            .catch(() => undefined);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[yookassa-webhook] dispatch failed for ${eventId}:`, err);
          await payload
            .update({
              collection: "paymentEvents",
              id: paymentEventId as never,
              data: {
                result: "rejected",
                rejectedReason: "internal_error",
                processedAt: new Date().toISOString(),
              } as never,
            })
            .catch(() => undefined);
        }
      },
    },
  };
}

/**
 * Dispatch — фактическая бизнес-логика (мутации Order/Return + emit).
 * Вызывается после ответа 200 OK ЮKassa (FR-5536).
 */
async function dispatchEvent(ctx: DispatchContext): Promise<void> {
  const { event } = ctx;
  if (event.event === "payment.waiting_for_capture") {
    await handlePaymentWaitingForCapture(ctx, event);
  } else if (event.event === "payment.succeeded") {
    await handlePaymentSucceeded(ctx, event);
  } else if (event.event === "payment.canceled") {
    await handlePaymentCanceled(ctx, event);
  } else if (event.event === "refund.succeeded") {
    await handleRefundSucceeded(ctx, event);
  } else if (event.event === "refund.canceled") {
    await handleRefundCanceled(ctx, event);
  }
}

// --- payment.waiting_for_capture (US1, FR-5520..5522) -----------------------

async function handlePaymentWaitingForCapture(
  ctx: DispatchContext,
  event: PaymentWaitingForCaptureEvent,
): Promise<void> {
  const obj = event.object;
  const order = await findOrderByProviderRef(ctx.payload, obj.id);
  if (!order) return;

  // Mark as authorized
  await ctx.payload.update({
    collection: "orders",
    id: order.id,
    data: {
      payment: { ...((order as { payment?: object }).payment ?? {}), providerStatus: "authorized" },
    },
    context: { paymentWebhookVerified: true },
  });

  await emitDomainEvent({
    kind: "payment.authorized",
    order: {
      id: String(order.id),
      clientNumber: (order as { clientNumber?: string }).clientNumber,
      status: "pending_payment",
    },
    context: {
      payment: {
        providerRef: obj.id,
        amount: Math.round(Number(obj.amount.value) * 100),
        method: extractMethodType(obj),
        eventId: String(ctx.paymentEventId),
      },
    },
    eventIdSuffix: String(ctx.paymentEventId),
  });

  // Trigger capture immediately (MVP: always capture per FR-5520)
  try {
    const captureBody: CapturePaymentRequest = {
      amount: obj.amount,
    };
    await capturePayment(obj.id, captureBody, { idempotencyKey: `${order.id}:capture` });
  } catch (err) {
    await recordCaptureFailure(ctx.payload, String(order.id), err);
    // Don't throw — let cron retry (FR-5523a)
  }
}

// --- payment.succeeded (US1, FR-5551) ---------------------------------------

async function handlePaymentSucceeded(
  ctx: DispatchContext,
  event: PaymentSucceededEvent,
): Promise<void> {
  const obj = event.object;
  const order = await findOrderByProviderRef(ctx.payload, obj.id);
  if (!order) return;

  // C-01 (code-review): idempotent guard for terminal-state Orders.
  // If Order is already paid / cancelled / expired / refunded — webhook is duplicate
  // or out-of-band (e.g. cron-reconciliation already applied). Don't re-mutate.
  // 051 immutability hook would block frozen-field changes anyway, but exiting
  // early avoids wasted DB writes + duplicate domain events.
  const currentStatus = (order as { status?: string }).status;
  if (
    currentStatus === "paid" ||
    currentStatus === "cancelled" ||
    currentStatus === "expired" ||
    currentStatus === "refunded" ||
    currentStatus === "fulfilling" ||
    currentStatus === "shipped" ||
    currentStatus === "delivered" ||
    currentStatus === "completed"
  ) {
    // eslint-disable-next-line no-console
    console.info(
      `[yookassa-webhook] payment.succeeded idempotent skip: orderId=${String(order.id)} already in status=${currentStatus}`,
    );
    return;
  }

  const settings = await loadPaymentSettings();
  const amountRub = Number(obj.amount.value);
  const snapshot = extractPaymentMethodSnapshot(obj);
  const methodType = extractMethodType(obj);
  const receiptStatus = obj.receipt_registration ?? "pending";
  const orderTyped = order as { id: string; clientNumber?: string; status?: string; payment?: object };

  await ctx.payload.update({
    collection: "orders",
    id: order.id,
    data: {
      status: "paid",
      payment: {
        ...(orderTyped.payment ?? {}),
        providerStatus: "succeeded",
        paidAt: new Date().toISOString(),
        capturedAt: obj.captured_at ?? new Date().toISOString(),
        amount: amountRub,
        paymentMethodSnapshot: snapshot,
        receiptStatus,
        vatCodeApplied: settings.defaultVatCode,
      },
    },
    context: { paymentWebhookVerified: true },
  });

  // UTM snapshot from Cart (052) for analytics (FR-5599)
  const utm = await loadUtmFromCart(ctx.payload, order);

  await emitDomainEvent({
    kind: "payment.captured",
    order: { id: String(order.id), clientNumber: orderTyped.clientNumber, status: "paid" },
    context: {
      payment: {
        providerRef: obj.id,
        amount: Math.round(amountRub * 100),
        eventId: String(ctx.paymentEventId),
      },
    },
    eventIdSuffix: `${ctx.paymentEventId}:captured`,
  });

  await emitDomainEvent({
    kind: "payment.succeeded",
    order: { id: String(order.id), clientNumber: orderTyped.clientNumber, status: "paid" },
    context: {
      payment: {
        providerRef: obj.id,
        amount: Math.round(amountRub * 100),
        currency: "RUB",
        method: methodType,
        receiptStatus,
        vatCodeApplied: settings.defaultVatCode,
        utm,
        eventId: String(ctx.paymentEventId),
      },
    },
    eventIdSuffix: String(ctx.paymentEventId),
  });

  // Existing order.paid emit for 047 + 048 + 049 consumers
  await emitDomainEvent({
    kind: "order.paid",
    order: { id: String(order.id), clientNumber: orderTyped.clientNumber, status: "paid" },
    context: { statusFrom: orderTyped.status, statusTo: "paid" },
    eventIdSuffix: `${ctx.paymentEventId}:order-paid`,
  });

  // Receipt failure → emit alert (FR-5546)
  if (receiptStatus === "canceled") {
    await emitDomainEvent({
      kind: "payment.receipt_failed",
      order: { id: String(order.id), clientNumber: orderTyped.clientNumber, status: "paid" },
      context: {
        payment: { providerRef: obj.id, receiptStatus, eventId: String(ctx.paymentEventId) },
      },
      eventIdSuffix: `${ctx.paymentEventId}:receipt-failed`,
    });
  }
}

// --- payment.canceled (US1, FR-5552) ----------------------------------------

async function handlePaymentCanceled(
  ctx: DispatchContext,
  event: PaymentCanceledEvent,
): Promise<void> {
  const obj = event.object;
  const order = await findOrderByProviderRef(ctx.payload, obj.id);
  if (!order) return;

  // C-02 (code-review): idempotency + business-logic guard.
  // payment.canceled должен прилетать ТОЛЬКО для pending_payment Orders.
  // Если Order уже terminal (paid/cancelled/expired/refunded) — это либо replay,
  // либо out-of-band событие. 051 immutability hook all равно заблокирует
  // status-mutation после paid; явный guard избавляет от лога errors.
  const currentStatus = (order as { status?: string }).status;
  if (currentStatus !== "pending_payment" && currentStatus !== "awaiting_payment") {
    // eslint-disable-next-line no-console
    console.info(
      `[yookassa-webhook] payment.canceled idempotent skip: orderId=${String(order.id)} status=${currentStatus}`,
    );
    return;
  }

  const settings = await loadPaymentSettings();
  const orderTyped = order as {
    id: string;
    clientNumber?: string;
    status?: string;
    payment?: { createdAt?: string | null } | null;
  };

  // Decide cancelled vs expired by payment age
  const paymentCreatedAt = orderTyped.payment?.createdAt
    ? new Date(orderTyped.payment.createdAt).getTime()
    : new Date(obj.created_at).getTime();
  const ageMin = (Date.now() - paymentCreatedAt) / 60_000;
  const targetStatus = ageMin > settings.paymentRetryWindowMin ? "expired" : "cancelled";

  const reason = mapCancelReason(obj.cancellation_details?.reason);

  await ctx.payload.update({
    collection: "orders",
    id: order.id,
    data: {
      status: targetStatus,
      payment: {
        ...(orderTyped.payment ?? {}),
        providerStatus: "canceled",
      },
    },
    context: { paymentWebhookVerified: true },
  });

  const kind: "payment.canceled" | "payment.expired" =
    targetStatus === "expired" ? "payment.expired" : "payment.canceled";

  await emitDomainEvent({
    kind,
    order: { id: String(order.id), clientNumber: orderTyped.clientNumber, status: targetStatus },
    context: {
      payment: {
        providerRef: obj.id,
        reason,
        eventId: String(ctx.paymentEventId),
      },
    },
    eventIdSuffix: String(ctx.paymentEventId),
  });

  // Also emit existing order.cancelled (для 049 + 052 cart-recovery)
  await emitDomainEvent({
    kind: "order.cancelled",
    order: { id: String(order.id), clientNumber: orderTyped.clientNumber, status: targetStatus },
    context: { statusFrom: orderTyped.status, statusTo: targetStatus, errorMessage: reason },
    eventIdSuffix: `${ctx.paymentEventId}:order-cancelled`,
  });
}

// --- refund.succeeded / refund.canceled (US4) -------------------------------

async function handleRefundSucceeded(
  ctx: DispatchContext,
  event: RefundSucceededEvent,
): Promise<void> {
  const { applyRefundSucceeded } = await import("../returns/repository");
  const obj = event.object;
  const result = await applyRefundSucceeded({
    providerRefundId: obj.id,
    succeededAt: new Date(),
    amount: Math.round(Number(obj.amount.value) * 100),
    receivedEventId: String(ctx.paymentEventId),
  });

  if (!result.applied) {
    await ctx.payload
      .update({
        collection: "paymentEvents",
        id: ctx.paymentEventId as never,
        data: {
          result: "rejected",
          rejectedReason: result.reason === "not_found" ? "unknown_refund" : "amount_mismatch",
        } as never,
      })
      .catch(() => undefined);
    return;
  }

  // Link Return on PaymentEvents
  if (result.returnId) {
    await ctx.payload
      .update({
        collection: "paymentEvents",
        id: ctx.paymentEventId as never,
        data: { return: result.returnId as never } as never,
      })
      .catch(() => undefined);
  }
}

async function handleRefundCanceled(
  ctx: DispatchContext,
  event: RefundCanceledEvent,
): Promise<void> {
  const { applyRefundCanceled } = await import("../returns/repository");
  const obj = event.object;
  const result = await applyRefundCanceled({
    providerRefundId: obj.id,
    canceledAt: new Date(),
    reason: obj.cancellation_details?.reason ?? "unknown",
    receivedEventId: String(ctx.paymentEventId),
  });

  if (!result.applied) {
    await ctx.payload
      .update({
        collection: "paymentEvents",
        id: ctx.paymentEventId as never,
        data: {
          result: "rejected",
          rejectedReason: result.reason === "not_found" ? "unknown_refund" : "internal_error",
        } as never,
      })
      .catch(() => undefined);
  }
}

// --- helpers ----------------------------------------------------------------

async function findOrderByProviderRef(
  payload: Payload,
  providerRef: string,
): Promise<{ id: string | number; clientNumber?: string; status?: string; payment?: { createdAt?: string | null; refunds?: unknown[] } | null; cartId?: string | { id: string | number } | null } | null> {
  const res = await payload
    .find({
      collection: "orders",
      where: { "payment.providerRef": { equals: providerRef } },
      limit: 1,
    })
    .catch(() => ({ docs: [] as Array<unknown> }));
  return (res.docs[0] as { id: string | number } | undefined) as never ?? null;
}

function extractMethodType(obj: YooKassaPaymentObject): "bank_card" | "sbp" | "yoo_money" | "sberbank" | undefined {
  const t = obj.payment_method?.type;
  if (t === "bank_card" || t === "sbp" || t === "yoo_money" || t === "sberbank") return t;
  return undefined;
}

function extractPaymentMethodSnapshot(obj: YooKassaPaymentObject): Record<string, unknown> {
  const pm = obj.payment_method;
  if (!pm) return {};
  const out: Record<string, unknown> = { type: pm.type, title: (pm as { title?: string }).title };
  if (pm.type === "bank_card") {
    const card = (pm as YooKassaBankCardMethod).card;
    if (card) {
      out.card = {
        first6: card.first6,
        last4: card.last4,
        expiryMonth: card.expiry_month,
        expiryYear: card.expiry_year,
        cardType: card.card_type?.toLowerCase(),
        issuerCountry: card.issuer_country,
        issuerName: card.issuer_name,
      };
    }
  } else if (pm.type === "sbp") {
    const sbp = (pm as YooKassaSbpMethod).payer_bank_details;
    out.sbp = { bankId: sbp?.bank_id, bankName: sbp?.bank_name };
  } else if (pm.type === "yoo_money") {
    out.yooMoney = { accountNumber: (pm as YooKassaYooMoneyMethod).account_number };
  } else if (pm.type === "sberbank") {
    out.sberbank = { phone: (pm as YooKassaSberbankMethod).phone };
  }
  return out;
}

function mapCancelReason(reason: string | undefined): string {
  if (!reason) return "unknown";
  const map: Record<string, string> = {
    "3d_secure_failed": "3ds_failed",
    "card_expired": "issuer_declined",
    "fraud_suspected": "fraud_suspected",
    "insufficient_funds": "insufficient_funds",
    "issuer_unavailable": "issuer_declined",
    "payment_method_limit_exceeded": "issuer_declined",
    "payment_method_restricted": "issuer_declined",
    "permission_revoked": "customer_canceled",
    "expired_on_capture": "expired",
    "expired_on_confirmation": "expired",
    "general_decline": "issuer_declined",
  };
  return map[reason] ?? reason;
}

async function loadUtmFromCart(
  payload: Payload,
  order: { id: string | number; cartId?: string | { id: string | number } | null },
): Promise<Record<string, string | null> | undefined> {
  const cartIdRaw = (order as { cartId?: string | { id: string | number } | null }).cartId;
  if (!cartIdRaw) return undefined;
  const cartId: string | number = typeof cartIdRaw === "string" ? cartIdRaw : cartIdRaw.id;
  if (!cartId) return undefined;
  try {
    const cart = (await payload.findByID({ collection: "carts", id: cartId as never, depth: 0 })) as {
      metadata?: { utm?: Record<string, string | null | undefined> } | null;
    };
    const utm = cart.metadata?.utm;
    if (!utm) return undefined;
    return {
      source: utm.source ?? null,
      medium: utm.medium ?? null,
      campaign: utm.campaign ?? null,
      term: utm.term ?? null,
      content: utm.content ?? null,
    };
  } catch (err) {
    // M-03 (code-review): log instead of silent swallow — UTM is for analytics,
    // non-critical but debug-helpful when payments lose attribution.
    // eslint-disable-next-line no-console
    console.warn(
      `[yookassa-webhook] loadUtmFromCart failed for cart=${String(cartId)}:`,
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
}

async function recordCaptureFailure(
  payload: Payload,
  orderId: string,
  err: unknown,
): Promise<void> {
  const errorMsg =
    err instanceof YooKassaClientError || err instanceof YooKassaNetworkError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
  const errorCode = err instanceof YooKassaClientError ? err.providerCode : undefined;
  try {
    const order = (await payload.findByID({ collection: "orders", id: orderId, depth: 0 })) as {
      payment?: { captureAttempts?: Array<{ attemptedAt?: string; nextRetryAt?: string; exhausted?: boolean; error?: string }> } | null;
    };
    const attempts = order.payment?.captureAttempts ?? [];
    const nextRetryAt = computeNextRetryAt(attempts.length);
    const newAttempt = {
      attemptedAt: new Date().toISOString(),
      error: errorMsg.slice(0, 500),
      errorCode,
      nextRetryAt: nextRetryAt?.toISOString() ?? undefined,
      exhausted: nextRetryAt == null,
    };
    await payload.update({
      collection: "orders",
      id: orderId,
      data: { payment: { ...(order.payment ?? {}), captureAttempts: [...attempts, newAttempt] } },
      context: { paymentWebhookVerified: true },
    });
  } catch (innerErr) {
    // eslint-disable-next-line no-console
    console.error("[yookassa-webhook] recordCaptureFailure failed:", innerErr);
  }
}

/** Backoff sequence in milliseconds. After 6 attempts → exhausted (FR-5523a, R7). */
const CAPTURE_BACKOFF_MS = [1 * 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];

export function computeNextRetryAt(previousAttempts: number): Date | null {
  if (previousAttempts >= CAPTURE_BACKOFF_MS.length) return null; // exhausted
  const delayMs = CAPTURE_BACKOFF_MS[previousAttempts] ?? null;
  if (delayMs == null) return null;
  return new Date(Date.now() + delayMs);
}

interface PersistEventInput {
  eventId: string;
  event: YooKassaWebhookEvent;
  sourceIp: string | null;
  result: "success" | "rejected" | "duplicate";
  rejectedReason?: RejectedReason;
  orderId?: string;
  returnId?: string;
}

async function persistEvent(
  payload: Payload,
  input: PersistEventInput,
): Promise<{ id: string | number } | null> {
  try {
    const doc = await payload.create({
      collection: "paymentEvents",
      data: {
        eventId: input.eventId,
        eventType: input.event.event,
        providerRef: input.event.object.id,
        // 055: Payload PG uses numeric ids — pass as `as never` to bypass narrow union
        order: input.orderId as never,
        return: input.returnId as never,
        payload: input.event as unknown as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        result: input.result,
        rejectedReason: input.rejectedReason,
        sourceIp: input.sourceIp ?? undefined,
        duplicateCount: 0,
        source: "webhook",
      } as never,
    });
    return doc as unknown as { id: string | number };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[yookassa-webhook] persistEvent failed:", err);
    return null;
  }
}

async function logRejected(
  reason: RejectedReason,
  sourceIp: string | null,
  eventId: string | undefined,
  rawPayload: unknown,
): Promise<void> {
  try {
    const payload = await getPayload({ config: configPromise });
    await payload.create({
      collection: "paymentEvents",
      data: {
        eventId: eventId ?? `reject:${reason}:${Date.now()}`,
        eventType: "other",
        providerRef: "unknown",
        payload: typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>) : { _raw: String(rawPayload).slice(0, 1000) },
        receivedAt: new Date().toISOString(),
        result: "rejected",
        rejectedReason: reason,
        sourceIp: sourceIp ?? undefined,
        source: "webhook",
      } as never,
    });
  } catch {
    // ignore
  }
}

/**
 * Used by cron-reconciliation (T064) to apply a payment.succeeded outcome
 * for lost webhooks.
 */
export async function reconcilePaymentSucceeded(
  paymentEventId: string,
  order: { id: string },
  obj: YooKassaPaymentObject,
): Promise<void> {
  const synthetic: PaymentSucceededEvent = {
    type: "notification",
    event: "payment.succeeded",
    object: obj,
  };
  const payload = await getPayload({ config: configPromise });
  await handlePaymentSucceeded({ payload, paymentEventId, event: synthetic }, synthetic);
}

/**
 * Used by cron when 7-day capture window is exhausted: cancel auth-side
 * and emit payment.canceled with reason=capture_retries_exhausted.
 */
export async function cancelExhaustedCapture(
  orderId: string,
  providerRef: string,
  clientNumber: string | undefined,
): Promise<void> {
  try {
    await cancelPayment(providerRef, { idempotencyKey: `${orderId}:cancel-exhausted` });
  } catch (err) {
    // ЮKassa might already auto-cancel after 7d hold; log and continue
    // eslint-disable-next-line no-console
    console.warn(`[yookassa-webhook] cancelExhaustedCapture: ${err instanceof Error ? err.message : String(err)}`);
  }
  const payload = await getPayload({ config: configPromise });
  await payload.update({
    collection: "orders",
    id: orderId,
    data: { status: "cancelled", payment: { providerStatus: "canceled" } },
    context: { paymentWebhookVerified: true },
  });
  await emitDomainEvent({
    kind: "payment.canceled",
    order: { id: orderId, clientNumber, status: "cancelled" },
    context: {
      payment: { providerRef, reason: "capture_retries_exhausted" },
    },
    eventIdSuffix: `${orderId}:capture-exhausted`,
  });
  await emitDomainEvent({
    kind: "order.cancelled",
    order: { id: orderId, clientNumber, status: "cancelled" },
    context: { statusTo: "cancelled", errorMessage: "capture_retries_exhausted" },
    eventIdSuffix: `${orderId}:order-cancel-exhausted`,
  });
}
