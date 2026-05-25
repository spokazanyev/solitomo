/**
 * GET /api/orders/[id]/payment-status (055 US1, T034).
 *
 * Polling endpoint для /payment/return и /payment/success страниц.
 * Возвращает текущий status + payment.providerStatus + paidAt.
 *
 * Auth: customer_session OR cart_session cookie OR ?token=<publicToken> query.
 * Contract: specs/055-yookassa-payments-integration/contracts/payment-status.openapi.yaml
 */

import configPromise from "@payload-config";
import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";

import { loadPaymentSettings } from "@/lib/payments/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  const orderId = params.id;
  if (!orderId) {
    return NextResponse.json({ code: "VALIDATION_FAILED", message: "id required" }, { status: 400 });
  }

  const payload = await getPayload({ config: configPromise });
  const raw = await payload.findByID({ collection: "orders", id: orderId, depth: 0 }).catch(() => null);
  if (!raw) {
    return NextResponse.json({ code: "ORDER_NOT_FOUND", message: "Order not found" }, { status: 404 });
  }

  const order = raw as unknown as {
    id: string | number;
    status?: string;
    clientNumber?: string;
    publicToken?: string;
    cartId?: string | number | { id: string | number } | null;
    customerId?: string | number | { id: string | number } | null;
    payment?: {
      providerStatus?: string;
      paidAt?: string | null;
      createdAt?: string | null;
      receiptStatus?: string | null;
    } | null;
  };

  // Auth check — one of:
  //   - customer_session cookie matches order.customerId
  //   - cart_session cookie matches order.cartId
  //   - ?token= matches order.publicToken
  const isAuthorized = await checkAuthorized(request, order);
  if (!isAuthorized) {
    return NextResponse.json({ code: "FORBIDDEN", message: "Not authorized" }, { status: 403 });
  }

  // Compute retryAvailable: only if pending_payment and within retry window
  let retryAvailable = false;
  if (order.status === "pending_payment" && order.payment?.createdAt) {
    const settings = await loadPaymentSettings().catch(() => null);
    const ageMin = (Date.now() - new Date(order.payment.createdAt).getTime()) / 60_000;
    retryAvailable = settings ? ageMin < settings.paymentRetryWindowMin : false;
  }

  return NextResponse.json({
    orderStatus: order.status ?? "unknown",
    paymentStatus: order.payment?.providerStatus ?? "none",
    paidAt: order.payment?.paidAt ?? null,
    clientNumber: order.clientNumber ?? null,
    retryAvailable,
    receiptStatus: order.payment?.receiptStatus ?? null,
  });
}

async function checkAuthorized(
  request: NextRequest,
  order: {
    publicToken?: string;
    cartId?: string | number | { id: string | number } | null;
    customerId?: string | number | { id: string | number } | null;
  },
): Promise<boolean> {
  // ?token query — publicToken match
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get("token");
  if (tokenParam && order.publicToken && tokenParam === order.publicToken) {
    return true;
  }

  // cart_session cookie — Payload PG uses numeric ids, so normalize via String()
  const cartCookie = request.cookies.get("cart_session")?.value;
  if (cartCookie && order.cartId) {
    const cartIdRaw =
      typeof order.cartId === "string" || typeof order.cartId === "number"
        ? order.cartId
        : order.cartId.id;
    if (String(cartIdRaw) === cartCookie) return true;
  }

  // customer_session cookie (054)
  const sessionCookie = request.cookies.get("customer_session")?.value;
  if (sessionCookie) {
    try {
      // Parse customer_session JWT to extract customer id
      const parts = sessionCookie.split(".");
      if (parts.length === 3) {
        const decoded = Buffer.from(parts[1] ?? "", "base64url").toString("utf8");
        const claims = JSON.parse(decoded) as { id?: string };
        const customerId = order.customerId
          ? typeof order.customerId === "string" || typeof order.customerId === "number"
            ? order.customerId
            : order.customerId.id
          : null;
        if (claims.id && customerId != null && String(claims.id) === String(customerId)) {
          return true;
        }
      }
    } catch {
      // ignore — fall through to forbidden
    }
  }

  return false;
}
