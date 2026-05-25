import "server-only";

/**
 * Return domain events (053 T010, FR-5301a).
 *
 * Wraps `emitDomainEvent` from 047 with typed payload for return.* events.
 * Subscribers (049 notifications, 048 CRM) filter by `kinds` to opt in.
 */

import {
  emitDomainEvent,
  type ReturnEventKind,
  type ReturnSnapshot,
  type EventContext,
} from "../lifecycle/events";

/**
 * Build a ReturnSnapshot from a Payload Returns document.
 *
 * C3 fix: `customerEmail` and `orderClientNumber` must be passed explicitly
 * — the Returns document's `orderId` is unpopulated (just the FK) in
 * afterChange, so we can't pull email from it directly. Callers should
 * pre-resolve the Order and pass its fields here.
 */
export function buildReturnSnapshot(
  doc: Record<string, unknown>,
  enrichment: { orderClientNumber?: string; customerEmail?: string } = {},
): ReturnSnapshot {
  const orderId = doc.orderId;
  const resolvedOrderId =
    typeof orderId === "string"
      ? orderId
      : (orderId as { id?: string | number })?.id !== undefined
        ? String((orderId as { id?: string | number }).id)
        : "";

  return {
    id: String(doc.id),
    returnNumber: typeof doc.returnNumber === "string" ? doc.returnNumber : undefined,
    orderId: resolvedOrderId,
    orderClientNumber:
      enrichment.orderClientNumber ??
      (typeof doc.orderNumberSnapshot === "string" ? doc.orderNumberSnapshot : undefined),
    status: String(doc.status ?? "requested"),
    itemCount: Array.isArray(doc.items) ? (doc.items as unknown[]).length : 0,
    refundAmount: typeof doc.refundAmount === "number" ? doc.refundAmount : undefined,
    customerEmail: enrichment.customerEmail,
    createdVia: typeof doc.createdVia === "string" ? doc.createdVia : undefined,
  };
}

/**
 * Emit a return.* event with snapshot.
 */
export async function emitReturnEvent(
  kind: ReturnEventKind,
  snapshot: ReturnSnapshot,
  context?: EventContext,
): Promise<void> {
  await emitDomainEvent({
    kind,
    returnData: snapshot,
    context,
  });
}
