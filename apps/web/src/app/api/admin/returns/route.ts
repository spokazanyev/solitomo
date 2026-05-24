/**
 * POST /api/admin/returns (053 US7).
 *
 * Manager creates a Return on behalf of a customer (phone/messenger requests).
 * Body: AdminCreateReturnRequest (extends customer schema + orderId).
 * createdVia = manager-manual.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { assertAdminAuth } from "@/lib/returns/admin-helpers";
import { returnError } from "@/lib/returns/api-utils";
import { computeRefundAmount, qtyAvailableForReturn } from "@/lib/returns/policies";
import { findByOrder } from "@/lib/returns/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  orderId: string;
  items: Array<{
    orderItemSku: string;
    qty: number;
    reason?: string;
    condition?: "unopened" | "opened_unused" | "used" | "defective";
  }>;
  reasonCategory: "defect" | "wrong-item" | "not-needed" | "other";
  customerNotes?: string;
  managerNotes?: string;
  refundMethod: "card-original" | "bank-transfer" | "other";
  returnMethod?: "self_post" | "pickup_via_courier" | "drop_off";
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config: configPromise });
  // H1 fix: role-based access (admin/sales only)
  const authResult = await assertAdminAuth(payload);
  if (!authResult.ok) return authResult.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return returnError(400, "validation_failed", "Invalid JSON");
  }

  if (!body.orderId) return returnError(400, "validation_failed", "orderId required");
  if (!Array.isArray(body.items) || body.items.length < 1) {
    return returnError(400, "validation_failed", "At least one item required");
  }
  if (!["defect", "wrong-item", "not-needed", "other"].includes(body.reasonCategory)) {
    return returnError(400, "validation_failed", "Invalid reasonCategory");
  }
  if (!["card-original", "bank-transfer", "other"].includes(body.refundMethod)) {
    return returnError(400, "validation_failed", "Invalid refundMethod");
  }

  let order: Record<string, unknown>;
  try {
    order = (await payload.findByID({
      collection: "orders",
      id: body.orderId,
    })) as unknown as Record<string, unknown>;
  } catch {
    return returnError(404, "not_found", "Order not found");
  }

  const status = String(order.status ?? "");
  if (status !== "delivered" && status !== "completed") {
    return returnError(403, "order_not_returnable", `Order status=${status} cannot be returned`);
  }

  const orderItems =
    (order.items as Array<{ sku: string; quantity: number; price?: number; name?: string }>) ?? [];
  const existingReturns = await findByOrder(payload, String(order.id));

  for (const item of body.items) {
    if (!item.orderItemSku || !Number.isFinite(item.qty) || item.qty < 1) {
      return returnError(400, "validation_failed", `Invalid item: ${item.orderItemSku}`);
    }
    const orderItem = orderItems.find((o) => o.sku === item.orderItemSku);
    if (!orderItem) {
      return returnError(400, "validation_failed", `Unknown SKU: ${item.orderItemSku}`);
    }
    const available = qtyAvailableForReturn(
      { sku: orderItem.sku, qty: orderItem.quantity },
      existingReturns.map((r) => ({
        status: r.status,
        items: r.items.map((i) => ({ orderItemSku: i.orderItemSku, qty: i.qty })),
      })),
    );
    if (item.qty > available) {
      return returnError(
        409,
        "qty_exceeds_available",
        `qty=${item.qty} exceeds available=${available} for ${item.orderItemSku}`,
        { sku: item.orderItemSku, requested: item.qty, available },
      );
    }
  }

  const snapshotItems = body.items.map((item) => {
    const orderItem = orderItems.find((o) => o.sku === item.orderItemSku);
    const priceRub = typeof orderItem?.price === "number" ? orderItem.price : 0;
    return {
      orderItemSku: item.orderItemSku,
      productName: orderItem?.name,
      qty: Math.floor(item.qty),
      priceSnapshot: Math.round(priceRub * 100),
      reason: item.reason,
      condition: item.condition,
    };
  });

  const refundAmount = computeRefundAmount(
    snapshotItems.map((i) => ({
      orderItemSku: i.orderItemSku,
      qty: i.qty,
      priceSnapshot: i.priceSnapshot,
    })),
    orderItems.map((o) => ({ sku: o.sku, qty: o.quantity, price: Math.round((o.price ?? 0) * 100) })),
  );

  const orderTotalKopecks = Math.round(
    ((order.totals as { total?: number } | undefined)?.total ?? 0) * 100,
  );
  const alreadyRefunded = typeof order.totalRefunded === "number" ? order.totalRefunded : 0;
  if (alreadyRefunded + refundAmount > orderTotalKopecks) {
    return returnError(409, "refund_exceeds_total", "Total refunds would exceed order total", {
      orderTotal: orderTotalKopecks,
      alreadyRefunded,
      requestedRefund: refundAmount,
    });
  }

  try {
    const doc = await payload.create({
      collection: "returns" as never,
      data: {
        orderId: String(order.id),
        items: snapshotItems,
        reasonCategory: body.reasonCategory,
        customerNotes: body.customerNotes,
        managerNotes: body.managerNotes,
        refundAmount,
        refundMethod: body.refundMethod,
        returnMethod: body.returnMethod ?? "self_post",
        createdVia: "manager-manual",
        status: "requested",
      } as never,
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[returns:admin-create] failed:", err);
    return returnError(500, "validation_failed", "Failed to create return");
  }
}
