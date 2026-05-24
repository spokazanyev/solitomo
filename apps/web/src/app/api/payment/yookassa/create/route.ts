/**
 * POST /api/payment/yookassa/create (055 US1, T027-T029).
 *
 * Coverage: FR-5500..5511, FR-5507 (UTM), FR-5538..5546 (receipt invocation).
 * Contract: specs/055-yookassa-payments-integration/contracts/create-payment.openapi.yaml
 */

import { randomUUID } from "node:crypto";

import configPromise from "@payload-config";
import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";

import { loadPaymentSettings } from "@/lib/payments/settings";
import { buildReceipt } from "@/lib/payments/yookassa-receipt";
import {
  createPayment,
  YooKassaClientError,
  YooKassaNetworkError,
} from "@/lib/payments/yookassa-client";
import type { CreatePaymentRequest } from "@/lib/payments/yookassa-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateRequestBody {
  orderId?: string;
  retryNonce?: string;
}

function jsonError(code: string, message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json({ code, message, details }, { status });
}

/** Map ЮKassa-side status to our Order.payment.providerStatus enum. */
function mapYkStatusToProviderStatus(
  status: string,
): "none" | "pending" | "authorized" | "succeeded" | "canceled" {
  if (status === "succeeded") return "succeeded";
  if (status === "canceled") return "canceled";
  if (status === "waiting_for_capture") return "authorized";
  return "pending";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: CreateRequestBody;
  try {
    body = (await request.json()) as CreateRequestBody;
  } catch {
    return jsonError("PARSE_ERROR", "Invalid JSON body", 400);
  }

  const orderId = String(body.orderId ?? "").trim();
  if (!orderId) {
    return jsonError("VALIDATION_FAILED", "orderId required", 400);
  }

  // Load settings (fail-fast on invalid config — FR-5544a)
  let settings;
  try {
    settings = await loadPaymentSettings();
  } catch (err) {
    return jsonError(
      "CONFIG_INVALID",
      err instanceof Error ? err.message : "paymentSettings invalid",
      500,
    );
  }
  if (!settings.enabled) {
    return jsonError("DISABLED", "Payment integration is disabled", 503);
  }

  const payload = await getPayload({ config: configPromise });
  const orderRaw = await payload
    .findByID({ collection: "orders", id: orderId, depth: 1 })
    .catch(() => null);
  if (!orderRaw) {
    return jsonError("ORDER_NOT_FOUND", `Order ${orderId} not found`, 404);
  }

  const order = orderRaw as unknown as {
    id: string | number;
    status?: string;
    clientNumber?: string;
    totals?: { total?: number };
    payment?: {
      providerRef?: string;
      idempotenceKey?: string;
      confirmationUrl?: string;
      confirmationType?: string;
      createdAt?: string;
    } | null;
    customer?: { email?: string | null; phone?: string | null } | null;
    items?: Array<{ title?: string | null; sku?: string | null; quantity?: number | null; price?: number | null; priceSnapshot?: { price?: number | null } | null }> | null;
    delivery?: { cost?: number | null; tariffName?: string | null } | null;
    cartId?: string | { id: string } | null;
  };

  // FR-5509: status must be pending_payment
  if (order.status !== "pending_payment") {
    return jsonError(
      "INVALID_ORDER_STATUS",
      `Order.status='${order.status}' — must be 'pending_payment'`,
      409,
    );
  }

  // Idempotency: reuse existing confirmation if retryNonce matches (FR-5510)
  const existingKey = order.payment?.idempotenceKey;
  const retryNonce = String(body.retryNonce ?? "").trim() || randomUUID();
  const idempotenceKey = existingKey ?? `${order.id}:${retryNonce}`;

  if (existingKey && order.payment?.confirmationUrl && order.payment?.providerRef) {
    // Re-issue same confirmation URL
    return NextResponse.json({
      confirmationUrl: order.payment.confirmationUrl,
      confirmationType: order.payment.confirmationType ?? "redirect",
      providerRef: order.payment.providerRef,
      retryNonce,
      availableMethods: settings.paymentMethods,
    });
  }

  // Validate totals.total
  const totalRub = order.totals?.total ?? 0;
  if (totalRub <= 0) {
    return jsonError("VALIDATION_FAILED", "Order.totals.total must be > 0", 400);
  }

  // Build receipt (FR-5540..5546)
  let receipt;
  try {
    receipt = buildReceipt(order, settings);
  } catch (err) {
    return jsonError(
      "VALIDATION_FAILED",
      err instanceof Error ? err.message : "receipt build failed",
      400,
    );
  }

  // Filter methods by SBP amount limit
  const availableMethods = settings.paymentMethods.filter((m) => {
    if (m === "sbp" && totalRub > settings.sbpMaxAmount) return false;
    return true;
  });

  // UTM snapshot from Cart (FR-5507)
  const utm = await loadUtmFromCart(payload, order);

  // Build origin URL for return_url (handles localhost + ngrok + prod)
  const origin = request.headers.get("x-forwarded-host")
    ? `https://${request.headers.get("x-forwarded-host")}`
    : new URL(request.url).origin;

  const captureMode = settings.captureMode === "one_stage";
  const ykRequest: CreatePaymentRequest = {
    amount: { value: totalRub.toFixed(2), currency: "RUB" },
    capture: captureMode, // true for one_stage; false for two_stage
    confirmation: {
      type: "redirect",
      return_url: `${origin}/payment/return/${order.id}`,
    },
    description: `${order.clientNumber ?? `Order ${order.id}`}`.slice(0, 128),
    receipt,
    metadata: {
      orderId: String(order.id),
      clientNumber: order.clientNumber,
      sourceVersion: "055",
      utm: utm ?? undefined,
    },
  };

  // Call ЮKassa with retry up to 3 (FR-5511)
  let ykResult;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      ykResult = await createPayment(ykRequest, { idempotencyKey: idempotenceKey });
      break;
    } catch (err) {
      lastError = err;
      if (err instanceof YooKassaClientError) {
        // 4xx → don't retry
        if (err.status >= 400 && err.status < 500) {
          return jsonError(
            "YOOKASSA_REJECTED",
            `ЮKassa rejected payment: ${err.message}`,
            502,
            { providerCode: err.providerCode, body: err.body.slice(0, 500) },
          );
        }
        // 5xx → retry with exp backoff
      } else if (!(err instanceof YooKassaNetworkError)) {
        // unexpected
        return jsonError("INTERNAL_ERROR", err instanceof Error ? err.message : "internal error", 500);
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1) ** 2));
    }
  }
  if (!ykResult) {
    return jsonError(
      "YOOKASSA_UNAVAILABLE",
      "ЮKassa unavailable after 3 retries",
      503,
      { lastError: String(lastError) },
    );
  }

  const ykPayment = ykResult.data;
  const confirmation = (ykPayment as unknown as {
    confirmation?: { type?: string; confirmation_url?: string; confirmation_data?: string };
  }).confirmation;
  const confirmationUrl = confirmation?.confirmation_url ?? `${origin}/payment/error/${order.id}`;
  const confirmationType: "redirect" | "qr" | "embedded" =
    confirmation?.type === "qr" ? "qr" : confirmation?.type === "embedded" ? "embedded" : "redirect";

  // Persist to Order (FR-5508)
  try {
    await payload.update({
      collection: "orders",
      id: order.id as never,
      data: {
        payment: {
          ...(order.payment ?? {}),
          method: "card", // generic — actual method only known after webhook
          providerStatus: mapYkStatusToProviderStatus(ykPayment.status),
          providerRef: ykPayment.id,
          idempotenceKey,
          confirmationUrl,
          confirmationType,
          createdAt: new Date().toISOString(),
        },
      },
      context: { paymentWebhookVerified: true },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[yookassa-create] failed to persist Order.payment for ${order.id}:`, err);
    return jsonError("INTERNAL_ERROR", "Failed to persist payment data", 500);
  }

  return NextResponse.json({
    confirmationUrl,
    confirmationType,
    providerRef: ykPayment.id,
    retryNonce,
    availableMethods,
  });
}

async function loadUtmFromCart(
  payload: Awaited<ReturnType<typeof getPayload>>,
  order: { cartId?: string | { id: string } | null },
): Promise<{ source?: string; medium?: string; campaign?: string; term?: string; content?: string } | null> {
  const cartIdRaw = order.cartId;
  if (!cartIdRaw) return null;
  const cartId = typeof cartIdRaw === "string" ? cartIdRaw : cartIdRaw.id;
  if (!cartId) return null;
  try {
    const cart = (await payload.findByID({ collection: "carts", id: cartId, depth: 0 })) as {
      metadata?: { utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string } } | null;
    };
    return cart.metadata?.utm ?? null;
  } catch {
    return null;
  }
}
