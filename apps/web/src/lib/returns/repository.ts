import "server-only";

/**
 * Returns repository — Payload local API wrapper (053).
 *
 * Provides typed operations for Returns collection + the
 * `recomputeOrderReturnAggregates` helper used by the afterChange hook to
 * sync `Orders.{hasReturns, returnsCount, totalRefunded, disputeFlag}`.
 */

import type { Payload } from "payload";

import { OPEN_STATUSES, TERMINAL, type ReturnStatus } from "./state-machine";

export interface ReturnItemRecord {
  orderItemSku: string;
  productName?: string;
  qty: number;
  priceSnapshot: number;
  vatRate?: string;
  reason?: string;
  condition?: "unopened" | "opened_unused" | "used" | "defective";
  photos?: string[];
}

export interface ReturnRecord {
  id: string;
  returnNumber?: string;
  orderId: string;
  orderNumberSnapshot?: string;
  items: ReturnItemRecord[];
  reasonCategory: "defect" | "wrong-item" | "not-needed" | "other";
  customerNotes?: string;
  managerNotes?: string;
  refundAmount: number;
  refundMethod: "card-original" | "bank-transfer" | "other";
  refundProviderRef?: string;
  returnMethod?: "self_post" | "pickup_via_courier" | "drop_off";
  apiShipReturnOrderId?: string;
  returnLabelUrl?: string;
  creditMemoNumber?: string;
  creditMemoPdfUrl?: string;
  creditMemoIssuedAt?: string;
  status: ReturnStatus;
  statusReason?: string;
  requestedAt: string;
  approvedAt?: string;
  receivedAt?: string;
  refundedAt?: string;
  rejectedAt?: string;
  cancelledAt?: string;
  createdVia?: "customer-public" | "manager-manual" | "api";
  correctionReceiptStatus?: "pending" | "issued" | "not_required" | "error";
  history?: Array<{
    at: string;
    fromStatus: string;
    toStatus: string;
    byUser?: string;
    reason?: string;
  }>;
}

export function toReturnRecord(doc: Record<string, unknown>): ReturnRecord {
  const orderId = doc.orderId;
  const resolvedOrderId =
    typeof orderId === "string" ? orderId : (orderId as { id?: string })?.id ?? "";

  return {
    id: String(doc.id),
    returnNumber: typeof doc.returnNumber === "string" ? doc.returnNumber : undefined,
    orderId: resolvedOrderId,
    orderNumberSnapshot:
      typeof doc.orderNumberSnapshot === "string" ? doc.orderNumberSnapshot : undefined,
    items: Array.isArray(doc.items) ? (doc.items as ReturnItemRecord[]) : [],
    reasonCategory: (doc.reasonCategory as ReturnRecord["reasonCategory"]) ?? "other",
    customerNotes: typeof doc.customerNotes === "string" ? doc.customerNotes : undefined,
    managerNotes: typeof doc.managerNotes === "string" ? doc.managerNotes : undefined,
    refundAmount: typeof doc.refundAmount === "number" ? doc.refundAmount : 0,
    refundMethod: (doc.refundMethod as ReturnRecord["refundMethod"]) ?? "card-original",
    refundProviderRef:
      typeof doc.refundProviderRef === "string" ? doc.refundProviderRef : undefined,
    returnMethod: (doc.returnMethod as ReturnRecord["returnMethod"]) ?? undefined,
    apiShipReturnOrderId:
      typeof doc.apiShipReturnOrderId === "string" ? doc.apiShipReturnOrderId : undefined,
    returnLabelUrl: typeof doc.returnLabelUrl === "string" ? doc.returnLabelUrl : undefined,
    creditMemoNumber:
      typeof doc.creditMemoNumber === "string" ? doc.creditMemoNumber : undefined,
    creditMemoPdfUrl:
      typeof doc.creditMemoPdfUrl === "string" ? doc.creditMemoPdfUrl : undefined,
    creditMemoIssuedAt:
      typeof doc.creditMemoIssuedAt === "string" ? doc.creditMemoIssuedAt : undefined,
    status: (doc.status as ReturnStatus) ?? "requested",
    statusReason: typeof doc.statusReason === "string" ? doc.statusReason : undefined,
    requestedAt: String(doc.requestedAt ?? new Date().toISOString()),
    approvedAt: typeof doc.approvedAt === "string" ? doc.approvedAt : undefined,
    receivedAt: typeof doc.receivedAt === "string" ? doc.receivedAt : undefined,
    refundedAt: typeof doc.refundedAt === "string" ? doc.refundedAt : undefined,
    rejectedAt: typeof doc.rejectedAt === "string" ? doc.rejectedAt : undefined,
    cancelledAt: typeof doc.cancelledAt === "string" ? doc.cancelledAt : undefined,
    createdVia: (doc.createdVia as ReturnRecord["createdVia"]) ?? "customer-public",
    correctionReceiptStatus:
      (doc.correctionReceiptStatus as ReturnRecord["correctionReceiptStatus"]) ?? undefined,
    history: Array.isArray(doc.history)
      ? (doc.history as ReturnRecord["history"])
      : undefined,
  };
}

/**
 * Find all returns for an order.
 */
export async function findByOrder(
  payload: Payload,
  orderId: string,
): Promise<ReturnRecord[]> {
  const result = await payload.find({
    collection: "returns" as never,
    where: { orderId: { equals: orderId } },
    limit: 200,
    sort: "-requestedAt",
  });
  return (result.docs as unknown as Array<Record<string, unknown>>).map(toReturnRecord);
}

/**
 * Find a return by id.
 */
export async function findById(
  payload: Payload,
  id: string,
): Promise<ReturnRecord | null> {
  try {
    const doc = (await payload.findByID({
      collection: "returns" as never,
      id,
    })) as unknown as Record<string, unknown>;
    return toReturnRecord(doc);
  } catch {
    return null;
  }
}

// ─── Aggregate sync on Order (FR-5310, FR-5310a) ──────────────────────────────

export interface OrderReturnAggregates {
  hasReturns: boolean;
  returnsCount: number;
  totalRefunded: number;
  disputeFlag: boolean;
}

export function computeOrderAggregates(returns: readonly ReturnRecord[]): OrderReturnAggregates {
  const active = returns.filter((r) => !TERMINAL.has(r.status));
  const refunded = returns.filter((r) => r.status === "refunded");
  const totalRefunded = refunded.reduce((sum, r) => sum + (r.refundAmount ?? 0), 0);
  const open = returns.filter((r) => OPEN_STATUSES.has(r.status));

  return {
    hasReturns: active.length > 0,
    returnsCount: active.length,
    totalRefunded,
    disputeFlag: open.length > 0,
  };
}

/**
 * Recompute and persist Order aggregates from all of its Returns.
 * Called from Returns.afterChange. Uses `skipImmutability` context so the
 * 051 paid-immutability guard lets these computed-field updates through.
 */
export async function recomputeOrderReturnAggregates(
  payload: Payload,
  orderId: string,
): Promise<OrderReturnAggregates> {
  const returns = await findByOrder(payload, orderId);
  const agg = computeOrderAggregates(returns);

  await payload.update({
    collection: "orders",
    id: orderId,
    data: {
      hasReturns: agg.hasReturns,
      returnsCount: agg.returnsCount,
      totalRefunded: agg.totalRefunded,
      disputeFlag: agg.disputeFlag,
    } as never,
    // Bypass 051 immutability guard for derived aggregate fields
    context: { skipImmutability: true } as never,
  });

  return agg;
}

/**
 * FR-5315: When total refunded matches order total, transition Order → returned.
 * Returns the new order status if a transition occurred, null otherwise.
 */
export async function maybeMarkOrderReturned(
  payload: Payload,
  orderId: string,
  agg: OrderReturnAggregates,
): Promise<"returned" | null> {
  const order = (await payload.findByID({
    collection: "orders",
    id: orderId,
  })) as unknown as Record<string, unknown>;

  // C1 fix: Order.totals.total is in rubles; agg.totalRefunded is in kopecks.
  // Convert both to kopecks before comparing.
  const orderTotalRub = (order.totals as { total?: number } | undefined)?.total ?? 0;
  const orderTotalKopecks = Math.round(orderTotalRub * 100);
  if (orderTotalKopecks <= 0) return null;
  if (agg.totalRefunded < orderTotalKopecks) return null;
  if (order.status === "returned") return null;

  await payload.update({
    collection: "orders",
    id: orderId,
    data: { status: "returned" } as never,
    context: { skipImmutability: true } as never,
  });
  return "returned";
}

/**
 * FR-5316: When a new Return is created and Order is already `completed`,
 * reopen it back to `delivered` (closedAt=null, disputeFlag=true).
 * Requires the status-machine `reopenAuthorized` context flag.
 */
export async function maybeReopenCompletedOrder(
  payload: Payload,
  orderId: string,
): Promise<boolean> {
  const order = (await payload.findByID({
    collection: "orders",
    id: orderId,
  })) as unknown as Record<string, unknown>;

  if (order.status !== "completed") return false;

  await payload.update({
    collection: "orders",
    id: orderId,
    data: {
      status: "delivered",
      closedAt: null,
      disputeFlag: true,
    } as never,
    context: { skipImmutability: true, reopenAuthorized: true } as never,
  });
  return true;
}
