import "server-only";

/**
 * Return policies (053 T011, FR-5336, FR-5341, FR-5342, FR-5343).
 *
 * Pure functions — return-window calculations, refund amount computation,
 * qtyAvailableForReturn formula. All money in kopecks (integer).
 */

const SHORT_WINDOW_DAYS = 7; // ст. 26.1 Закона 2300-1 при наличии письменной памятки
const EXTENDED_WINDOW_DAYS = 90; // ст. 26.1 без письменной памятки (3 месяца)
const OVERDUE_REFUND_DAYS = 10; // ст. 22 — срок возврата денег

/**
 * Is the return request within the 7-day window after delivery?
 * FR-5341: window starts at `Order.deliveredAt`; fallback to createdAt+30d.
 */
export function isWithinShortWindow(deliveredAt: Date | string | null | undefined): boolean {
  if (!deliveredAt) return false;
  const ms = Date.now() - new Date(deliveredAt).getTime();
  return ms <= SHORT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Is the return request within the 3-month extended window?
 * Used when written notice was not provided to the customer (ст. 26.1).
 */
export function isWithinExtendedWindow(deliveredAt: Date | string | null | undefined): boolean {
  if (!deliveredAt) return false;
  const ms = Date.now() - new Date(deliveredAt).getTime();
  return ms <= EXTENDED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Has the 10-day refund deadline (ст. 22) been exceeded?
 * Counted from Return.requestedAt.
 */
export function isOverdueRefund(requestedAt: Date | string): boolean {
  const ms = Date.now() - new Date(requestedAt).getTime();
  return ms > OVERDUE_REFUND_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Resolve the effective "delivered at" for an order.
 * Priority: order.deliveredAt → fallback to order.createdAt + 30d.
 */
export function effectiveDeliveredAt(order: {
  deliveredAt?: string | Date | null;
  createdAt?: string | Date | null;
}): Date | null {
  if (order.deliveredAt) return new Date(order.deliveredAt);
  if (order.createdAt) {
    const created = new Date(order.createdAt);
    return new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  return null;
}

// ─── Refund amount computation (FR-5308) ──────────────────────────────────────

export interface ReturnItemInput {
  orderItemSku: string;
  qty: number;
  /** Price per unit in kopecks (snapshot). */
  priceSnapshot?: number | null;
}

export interface OrderItemSnapshot {
  sku: string;
  qty: number;
  /** Price per unit in kopecks (or rubles depending on Order.priceUnit convention). */
  price?: number | null;
  /** Optional explicit kopeck-denominated price. */
  priceKopecks?: number | null;
}

/**
 * Compute refund amount from return items × order snapshot.
 *
 * Sum of `qty × pricePerUnit`. Uses item's own `priceSnapshot` if provided;
 * otherwise looks up the SKU in `orderItems` and uses its `price`.
 *
 * Returned amount is in **kopecks** (integer). All inputs MUST be in kopecks
 * already for consistency — the caller is responsible for unit conversion.
 *
 * Returns 0 for any item whose price is missing (RFQ-only line).
 */
export function computeRefundAmount(
  items: readonly ReturnItemInput[],
  orderItems: readonly OrderItemSnapshot[],
): number {
  let total = 0;
  for (const item of items) {
    const priceFromItem =
      typeof item.priceSnapshot === "number" && Number.isFinite(item.priceSnapshot)
        ? item.priceSnapshot
        : null;
    const orderItem = orderItems.find((o) => o.sku === item.orderItemSku);
    const priceFromOrder =
      orderItem?.priceKopecks ??
      (typeof orderItem?.price === "number" ? orderItem.price : null);
    const price = priceFromItem ?? priceFromOrder ?? 0;
    const qty = Math.max(0, Math.floor(item.qty));
    total += price * qty;
  }
  return Math.round(total);
}

// ─── qtyAvailableForReturn (FR-5343) ──────────────────────────────────────────

const NON_TERMINAL_RETURN_STATUSES = new Set(["requested", "approved", "received"]);
const IN_TRANSIT_SHIPMENT_STATUSES = new Set(["pending", "created", "in_transit"]);

export interface ExistingReturnSummary {
  status: string;
  items: Array<{ orderItemSku: string; qty: number }>;
}

export interface ShipmentItemSummary {
  sku: string;
  qty: number;
  shipmentStatus: string;
}

/**
 * How many units of a given SKU may still be returned, given:
 *  - already-existing non-terminal returns claiming this SKU
 *  - shipment items still in transit (excluded from returnable pool)
 *
 * Result is clamped to ≥ 0.
 *
 * FR-5343.
 */
export function qtyAvailableForReturn(
  orderItem: { sku: string; qty: number },
  existingReturns: readonly ExistingReturnSummary[],
  shipmentItems: readonly ShipmentItemSummary[] = [],
): number {
  const nonTerminalReturnedQty = existingReturns
    .filter((r) => NON_TERMINAL_RETURN_STATUSES.has(r.status))
    .flatMap((r) => r.items)
    .filter((i) => i.orderItemSku === orderItem.sku)
    .reduce((sum, i) => sum + (Number.isFinite(i.qty) ? Math.max(0, i.qty) : 0), 0);

  const inTransitQty = shipmentItems
    .filter(
      (si) =>
        si.sku === orderItem.sku && IN_TRANSIT_SHIPMENT_STATUSES.has(si.shipmentStatus),
    )
    .reduce((sum, si) => sum + (Number.isFinite(si.qty) ? Math.max(0, si.qty) : 0), 0);

  return Math.max(0, orderItem.qty - nonTerminalReturnedQty - inTransitQty);
}

// ─── Non-returnable SKU check (FR-5342, stub) ─────────────────────────────────

/**
 * Stub for ПП РФ № 2463 list check.
 * Real implementation will check `Product.returnability` field (added in a
 * follow-up migration). For 053 MVP we return false (everything returnable)
 * unless the product is explicitly marked.
 */
export function isNonReturnableSku(product?: {
  returnability?: "returnable" | "non-returnable" | "defect-only";
}): boolean {
  return product?.returnability === "non-returnable";
}

/**
 * SKU returnable only for defect reason (ПП 2463 partial — e.g. cosmetics).
 */
export function isDefectOnlySku(product?: {
  returnability?: "returnable" | "non-returnable" | "defect-only";
}): boolean {
  return product?.returnability === "defect-only";
}

// ─── Constants (exported for tests + docs) ────────────────────────────────────

export const RETURN_POLICY_CONSTANTS = {
  SHORT_WINDOW_DAYS,
  EXTENDED_WINDOW_DAYS,
  OVERDUE_REFUND_DAYS,
} as const;
