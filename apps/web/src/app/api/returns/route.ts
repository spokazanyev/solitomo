/**
 * POST / GET /api/returns (053 FR-5326, FR-5328, T016).
 *
 * POST: customer creates a return for their own order (orderToken auth).
 *   - Rate limit: 3/hour per token (FR-5328).
 *   - Idempotent by `clientRequestId` within a 10-min window.
 *   - Validates order is in `delivered` or `completed` status.
 *   - Validates qty per item ≤ qtyAvailableForReturn.
 *   - Computes refundAmount from item price snapshots.
 *
 * GET ?orderToken=... — list customer's returns for an order.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import {
  getClientIpForReturns,
  returnError,
  returnsRateLimit,
} from "@/lib/returns/api-utils";
import { computeRefundAmount, qtyAvailableForReturn } from "@/lib/returns/policies";
import { findByOrder } from "@/lib/returns/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateReturnRequest {
  orderToken: string;
  clientRequestId?: string;
  items: Array<{
    orderItemSku: string;
    qty: number;
    reason?: string;
    condition?: "unopened" | "opened_unused" | "used" | "defective";
  }>;
  reasonCategory: "defect" | "wrong-item" | "not-needed" | "other";
  customerNotes?: string;
  refundMethod: "card-original" | "bank-transfer" | "other";
  returnMethod?: "self_post" | "pickup_via_courier" | "drop_off";
  photoMediaIds?: string[];
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: CreateReturnRequest;
  try {
    body = (await req.json()) as CreateReturnRequest;
  } catch {
    return returnError(400, "validation_failed", "Invalid JSON");
  }

  if (!body.orderToken || typeof body.orderToken !== "string") {
    return returnError(400, "validation_failed", "orderToken required");
  }
  if (!Array.isArray(body.items) || body.items.length < 1) {
    return returnError(400, "validation_failed", "At least one item required");
  }
  if (!["defect", "wrong-item", "not-needed", "other"].includes(body.reasonCategory)) {
    return returnError(400, "validation_failed", "Invalid reasonCategory");
  }
  if (!["card-original", "bank-transfer", "other"].includes(body.refundMethod)) {
    return returnError(400, "validation_failed", "Invalid refundMethod");
  }

  // Rate limit per orderToken (FR-5328: 3/hour)
  if (!returnsRateLimit(`returns:create:${body.orderToken}:1h`, 3, 60 * 60 * 1000)) {
    return returnError(429, "rate_limited", "Too many return requests for this order");
  }
  // Additional per-IP throttle
  const ip = getClientIpForReturns(req);
  if (!returnsRateLimit(`returns:create:${ip}:1h`, 20, 60 * 60 * 1000)) {
    return returnError(429, "rate_limited", "Too many requests");
  }

  const payload = await getPayload({ config: configPromise });

  // Resolve order by publicToken
  const orderResult = await payload.find({
    collection: "orders",
    where: { publicToken: { equals: body.orderToken } },
    limit: 1,
  });
  const order = orderResult.docs[0] as unknown as Record<string, unknown> | undefined;
  if (!order) return returnError(404, "not_found", "Order not found");

  // Order status check (FR-5326)
  const status = String(order.status ?? "");
  if (status !== "delivered" && status !== "completed") {
    return returnError(403, "order_not_returnable", `Order status=${status} cannot be returned`);
  }

  // Idempotency by clientRequestId (10-min window)
  if (body.clientRequestId) {
    const existing = await payload.find({
      collection: "returns" as never,
      where: { clientRequestId: { equals: body.clientRequestId } },
      limit: 1,
    });
    const dup = existing.docs[0] as unknown as Record<string, unknown> | undefined;
    if (dup) {
      const age = Date.now() - new Date(String(dup.createdAt ?? Date.now())).getTime();
      if (age < 10 * 60 * 1000) {
        return NextResponse.json(toPublicView(dup), { status: 200 });
      }
    }
  }

  // Validate items against order
  const orderItems = (order.items as Array<{ sku: string; quantity: number; price?: number }>) ?? [];
  const existingReturns = await findByOrder(payload, String(order.id));

  for (const item of body.items) {
    if (!item.orderItemSku || !Number.isFinite(item.qty) || item.qty < 1) {
      return returnError(400, "validation_failed", `Invalid item: ${item.orderItemSku}`);
    }
    const orderItem = orderItems.find((o) => o.sku === item.orderItemSku);
    if (!orderItem) {
      return returnError(400, "validation_failed", `Unknown SKU in order: ${item.orderItemSku}`);
    }
    const available = qtyAvailableForReturn(
      { sku: orderItem.sku, qty: orderItem.quantity },
      existingReturns.map((r) => ({
        status: r.status,
        items: r.items.map((i) => ({ orderItemSku: i.orderItemSku, qty: i.qty })),
      })),
    );
    if (item.qty > available) {
      return returnError(409, "qty_exceeds_available", `qty=${item.qty} exceeds available=${available} for SKU ${item.orderItemSku}`, {
        sku: item.orderItemSku,
        requested: item.qty,
        available,
      });
    }
  }

  // Build snapshot items with prices in kopecks
  const snapshotItems = body.items.map((item) => {
    const orderItem = orderItems.find((o) => o.sku === item.orderItemSku);
    const priceRub = typeof orderItem?.price === "number" ? orderItem.price : 0;
    // Convert RUB to kopecks (Orders store price in rubles; Returns store in kopecks)
    const priceSnapshot = Math.round(priceRub * 100);
    return {
      orderItemSku: item.orderItemSku,
      productName: (orderItem as { name?: string } | undefined)?.name,
      qty: Math.floor(item.qty),
      priceSnapshot,
      reason: item.reason,
      condition: item.condition,
    };
  });
  const refundAmount = computeRefundAmount(
    snapshotItems.map((i) => ({ orderItemSku: i.orderItemSku, qty: i.qty, priceSnapshot: i.priceSnapshot })),
    orderItems.map((o) => ({ sku: o.sku, qty: o.quantity, price: Math.round((o.price ?? 0) * 100) })),
  );

  // FR-5308b: refund ≤ order total
  const orderTotalRub = (order.totals as { total?: number } | undefined)?.total ?? 0;
  const orderTotalKopecks = Math.round(orderTotalRub * 100);
  const alreadyRefunded = typeof order.totalRefunded === "number" ? order.totalRefunded : 0;
  if (alreadyRefunded + refundAmount > orderTotalKopecks) {
    return returnError(409, "refund_exceeds_total", "Total refunds would exceed order total", {
      orderTotal: orderTotalKopecks,
      alreadyRefunded,
      requestedRefund: refundAmount,
    });
  }

  // M5 fix: don't silently downgrade refundMethod — surface the mismatch as 409
  // so the customer can re-submit with bank-transfer and provide details upfront.
  const paymentMethod = (order.payment as { method?: string } | undefined)?.method;
  if (body.refundMethod === "card-original" && paymentMethod !== "card") {
    return returnError(
      409,
      "validation_failed",
      `Card refund unavailable: order was paid via ${paymentMethod ?? "non-card method"}. Use refundMethod=bank-transfer.`,
      { paymentMethod },
    );
  }
  const refundMethod = body.refundMethod;

  try {
    const doc = await payload.create({
      collection: "returns" as never,
      data: {
        orderId: String(order.id),
        items: snapshotItems,
        reasonCategory: body.reasonCategory,
        customerNotes: body.customerNotes,
        refundAmount,
        refundMethod,
        returnMethod: body.returnMethod ?? "self_post",
        clientRequestId: body.clientRequestId,
        createdVia: "customer-public",
        status: "requested",
      } as never,
    });

    return NextResponse.json(toPublicView(doc as unknown as Record<string, unknown>), {
      status: 201,
    });
  } catch (err) {
    // M3 fix: catch unique-violation on clientRequestId → return existing record
    const code = (err as { code?: string }).code;
    const message = (err as Error)?.message ?? String(err);
    if (code === "23505" || /unique|duplicate/i.test(message)) {
      if (body.clientRequestId) {
        const existing = await payload.find({
          collection: "returns" as never,
          where: { clientRequestId: { equals: body.clientRequestId } },
          limit: 1,
        });
        const dup = existing.docs[0] as unknown as Record<string, unknown> | undefined;
        if (dup) {
          return NextResponse.json(toPublicView(dup), { status: 200 });
        }
      }
      return returnError(409, "idempotency_conflict", "Duplicate clientRequestId");
    }
    // eslint-disable-next-line no-console
    console.error("[returns] POST create failed:", err);
    return returnError(500, "validation_failed", "Failed to create return");
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const orderToken = req.nextUrl.searchParams.get("orderToken");
  if (!orderToken) return returnError(400, "validation_failed", "orderToken required");

  const payload = await getPayload({ config: configPromise });
  const orderResult = await payload.find({
    collection: "orders",
    where: { publicToken: { equals: orderToken } },
    limit: 1,
  });
  const order = orderResult.docs[0] as unknown as Record<string, unknown> | undefined;
  if (!order) return returnError(404, "not_found", "Order not found");

  const returns = await findByOrder(payload, String(order.id));
  return NextResponse.json({
    returns: returns.map((r) =>
      toPublicView(r as unknown as Record<string, unknown>),
    ),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPublicView(doc: Record<string, unknown>) {
  return {
    returnNumber: doc.returnNumber,
    status: doc.status,
    refundAmount: doc.refundAmount,
    refundMethod: doc.refundMethod,
    requestedAt: doc.requestedAt,
    approvedAt: doc.approvedAt ?? null,
    receivedAt: doc.receivedAt ?? null,
    refundedAt: doc.refundedAt ?? null,
    returnLabelUrl: doc.returnLabelUrl ?? null,
    creditMemoPdfUrl: doc.creditMemoPdfUrl ?? null,
  };
}
