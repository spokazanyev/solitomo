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

// ---------------------------------------------------------------------------
// 055: Refund webhook integration (US4)
// Contract: specs/055-yookassa-payments-integration/contracts/refund-webhook-contract.md
// ---------------------------------------------------------------------------

export interface ApplyRefundSucceededInput {
  /** YooKassa refund ID — matches Returns.refundProviderRef. */
  providerRefundId: string;
  /** ISO datetime — when refund succeeded (use receive time if YooKassa doesn't send). */
  succeededAt: Date;
  /** Amount in kopecks (per 053 convention) — must match Return.refundAmount. */
  amount: number;
  /** PaymentEvents.eventId for trace. */
  receivedEventId: string;
}

export interface ApplyRefundCanceledInput {
  providerRefundId: string;
  canceledAt: Date;
  reason: string;
  receivedEventId: string;
}

export interface ApplyRefundResult {
  applied: boolean;
  returnId?: string;
  returnNumber?: string;
  orderId?: string;
  orderNumber?: string;
  reason?: "not_found" | "already_in_terminal_state" | "amount_mismatch";
}

/**
 * applyRefundSucceeded (055 US4 + 053 chain).
 *
 * Called from yookassa-webhook-handler on `refund.succeeded` event.
 * Atomic transition: received → refunded + Order.payment.refunds[i].providerStatus=succeeded.
 */
export async function applyRefundSucceeded(
  input: ApplyRefundSucceededInput,
): Promise<ApplyRefundResult> {
  const { default: configPromise } = await import("@payload-config");
  const { getPayload } = await import("payload");
  const { emitDomainEvent } = await import("../lifecycle/events");
  const payload = await getPayload({ config: configPromise });

  const res = await payload
    .find({
      collection: "returns",
      where: { refundProviderRef: { equals: input.providerRefundId } },
      limit: 1,
    })
    .catch(() => ({ docs: [] as Array<Record<string, unknown>> }));
  const doc = res.docs[0];
  if (!doc) {
    return { applied: false, reason: "not_found" };
  }
  const ret = toReturnRecord(doc as Record<string, unknown>);

  // Idempotent — already terminal
  if (ret.status === "refunded") {
    return {
      applied: false,
      reason: "already_in_terminal_state",
      returnId: ret.id,
      returnNumber: ret.returnNumber,
      orderId: ret.orderId,
    };
  }
  if (ret.status === "rejected" || ret.status === "cancelled") {
    return {
      applied: false,
      reason: "already_in_terminal_state",
      returnId: ret.id,
      returnNumber: ret.returnNumber,
      orderId: ret.orderId,
    };
  }

  // Amount-match (kopecks)
  const expectedKopecks = ret.refundAmount; // 053 convention: stored as kopecks
  if (Math.abs(expectedKopecks - input.amount) > 1) {
    return {
      applied: false,
      reason: "amount_mismatch",
      returnId: ret.id,
      returnNumber: ret.returnNumber,
      orderId: ret.orderId,
    };
  }

  // Transition: received → refunded
  await payload.update({
    collection: "returns",
    id: ret.id,
    data: {
      status: "refunded",
      refundedAt: input.succeededAt.toISOString(),
    } as never,
    context: { paymentWebhookVerified: true } as never,
  });

  // Update Order.payment.refunds[i].providerStatus
  try {
    const orderRaw = (await payload.findByID({
      collection: "orders",
      id: ret.orderId as never,
      depth: 0,
    })) as unknown as {
      id: string | number;
      payment?: { refunds?: Array<{ providerRefundId?: string; providerStatus?: string; refundedAt?: string }> } | null;
    };
    const refunds = orderRaw.payment?.refunds ?? [];
    let mutated = false;
    const updatedRefunds = refunds.map((r) => {
      if (r.providerRefundId === input.providerRefundId) {
        mutated = true;
        return { ...r, providerStatus: "succeeded", refundedAt: input.succeededAt.toISOString() };
      }
      return r;
    });
    if (mutated) {
      await payload.update({
        collection: "orders",
        id: ret.orderId,
        data: {
          payment: { ...(orderRaw.payment ?? {}), refunds: updatedRefunds },
        } as never,
        context: { paymentWebhookVerified: true, skipImmutability: true } as never,
      });
    }
  } catch (err) {
    // Non-fatal — Return is already updated; aggregate recompute below
    // eslint-disable-next-line no-console
    console.error(`[applyRefundSucceeded] failed to update Order.payment.refunds:`, err);
  }

  // Recompute Order aggregates (053 existing logic)
  const agg = await recomputeOrderReturnAggregates(payload, ret.orderId).catch(() => null);
  if (agg) {
    await maybeMarkOrderReturned(payload, ret.orderId, agg).catch(() => undefined);
  }

  // Emit domain event
  await emitDomainEvent({
    kind: "return.refunded",
    returnData: {
      id: ret.id,
      returnNumber: ret.returnNumber,
      orderId: ret.orderId,
      orderClientNumber: ret.orderNumberSnapshot,
      status: "refunded",
      refundAmount: ret.refundAmount,
    },
    eventIdSuffix: `${input.receivedEventId}:refunded`,
  });

  return {
    applied: true,
    returnId: ret.id,
    returnNumber: ret.returnNumber,
    orderId: ret.orderId,
    orderNumber: ret.orderNumberSnapshot,
  };
}

/**
 * applyRefundCanceled — webhook refund.canceled handler.
 *
 * 053 state-machine не имеет explicit `refund_failed` статуса. Стратегия:
 *   - Return.status остаётся `received` (refund в процессе но не успешен)
 *   - statusReason = `Refund failed: <reason>`
 *   - Order.payment.refunds[i].providerStatus = "canceled"
 *   - emit return.refund_failed → 049 alerts manager
 */
export async function applyRefundCanceled(
  input: ApplyRefundCanceledInput,
): Promise<ApplyRefundResult> {
  const { default: configPromise } = await import("@payload-config");
  const { getPayload } = await import("payload");
  const { emitDomainEvent } = await import("../lifecycle/events");
  const payload = await getPayload({ config: configPromise });

  const res = await payload
    .find({
      collection: "returns",
      where: { refundProviderRef: { equals: input.providerRefundId } },
      limit: 1,
    })
    .catch(() => ({ docs: [] as Array<Record<string, unknown>> }));
  const doc = res.docs[0];
  if (!doc) {
    return { applied: false, reason: "not_found" };
  }
  const ret = toReturnRecord(doc as Record<string, unknown>);
  if (ret.status === "refunded" || ret.status === "rejected" || ret.status === "cancelled") {
    return { applied: false, reason: "already_in_terminal_state", returnId: ret.id, returnNumber: ret.returnNumber, orderId: ret.orderId };
  }

  await payload.update({
    collection: "returns",
    id: ret.id,
    data: {
      statusReason: `Refund failed via webhook: ${input.reason}`.slice(0, 500),
    } as never,
    context: { paymentWebhookVerified: true } as never,
  });

  try {
    const orderRaw = (await payload.findByID({
      collection: "orders",
      id: ret.orderId as never,
      depth: 0,
    })) as unknown as {
      id: string | number;
      payment?: { refunds?: Array<{ providerRefundId?: string; providerStatus?: string }> } | null;
    };
    const refunds = orderRaw.payment?.refunds ?? [];
    let mutated = false;
    const updated = refunds.map((r) => {
      if (r.providerRefundId === input.providerRefundId) {
        mutated = true;
        return { ...r, providerStatus: "canceled" };
      }
      return r;
    });
    if (mutated) {
      await payload.update({
        collection: "orders",
        id: ret.orderId,
        data: { payment: { ...(orderRaw.payment ?? {}), refunds: updated } } as never,
        context: { paymentWebhookVerified: true, skipImmutability: true } as never,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[applyRefundCanceled] failed to update Order.payment.refunds:`, err);
  }

  // 056 R-02: serialize structured data into errorMessage so T-111 template
  // can extract returnNumber/returnId/providerRefundId/reason for manager email.
  await emitDomainEvent({
    kind: "return.refund_failed",
    returnData: {
      id: ret.id,
      returnNumber: ret.returnNumber,
      orderId: ret.orderId,
      orderClientNumber: ret.orderNumberSnapshot,
      status: ret.status,
      refundAmount: ret.refundAmount,
    },
    context: {
      errorMessage: `returnNumber=${ret.returnNumber ?? "-"},returnId=${ret.id},providerRefundId=${input.providerRefundId},reason=${input.reason}`,
    },
    eventIdSuffix: `${input.receivedEventId}:refund-failed`,
  });

  return {
    applied: true,
    returnId: ret.id,
    returnNumber: ret.returnNumber,
    orderId: ret.orderId,
    orderNumber: ret.orderNumberSnapshot,
  };
}
