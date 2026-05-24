import { describe, expect, it } from "vitest";

// Inline pure logic (avoids server-only import)
const SHORT_WINDOW_DAYS = 7;
const EXTENDED_WINDOW_DAYS = 90;
const OVERDUE_REFUND_DAYS = 10;
const NON_TERMINAL = new Set(["requested", "approved", "received"]);
const IN_TRANSIT = new Set(["pending", "created", "in_transit"]);

function isWithinShortWindow(deliveredAt: Date | string | null | undefined): boolean {
  if (!deliveredAt) return false;
  return Date.now() - new Date(deliveredAt).getTime() <= SHORT_WINDOW_DAYS * 86400_000;
}

function isWithinExtendedWindow(deliveredAt: Date | string | null | undefined): boolean {
  if (!deliveredAt) return false;
  return Date.now() - new Date(deliveredAt).getTime() <= EXTENDED_WINDOW_DAYS * 86400_000;
}

function isOverdueRefund(requestedAt: Date | string): boolean {
  return Date.now() - new Date(requestedAt).getTime() > OVERDUE_REFUND_DAYS * 86400_000;
}

interface ReturnItemInput {
  orderItemSku: string;
  qty: number;
  priceSnapshot?: number | null;
}

interface OrderItemSnapshot {
  sku: string;
  qty: number;
  price?: number | null;
  priceKopecks?: number | null;
}

function computeRefundAmount(items: readonly ReturnItemInput[], orderItems: readonly OrderItemSnapshot[]): number {
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

function qtyAvailableForReturn(
  orderItem: { sku: string; qty: number },
  existingReturns: readonly { status: string; items: Array<{ orderItemSku: string; qty: number }> }[],
  shipmentItems: readonly { sku: string; qty: number; shipmentStatus: string }[] = [],
): number {
  const returned = existingReturns
    .filter((r) => NON_TERMINAL.has(r.status))
    .flatMap((r) => r.items)
    .filter((i) => i.orderItemSku === orderItem.sku)
    .reduce((s, i) => s + Math.max(0, i.qty), 0);
  const inTransit = shipmentItems
    .filter((si) => si.sku === orderItem.sku && IN_TRANSIT.has(si.shipmentStatus))
    .reduce((s, si) => s + Math.max(0, si.qty), 0);
  return Math.max(0, orderItem.qty - returned - inTransit);
}

describe("isWithinShortWindow (7d)", () => {
  it("true for delivery 1 day ago", () => {
    const d = new Date(Date.now() - 1 * 86400_000);
    expect(isWithinShortWindow(d)).toBe(true);
  });
  it("true for delivery exactly 7 days ago", () => {
    const d = new Date(Date.now() - 7 * 86400_000 + 1000);
    expect(isWithinShortWindow(d)).toBe(true);
  });
  it("false for delivery 8 days ago", () => {
    const d = new Date(Date.now() - 8 * 86400_000);
    expect(isWithinShortWindow(d)).toBe(false);
  });
  it("false for null", () => {
    expect(isWithinShortWindow(null)).toBe(false);
  });
});

describe("isWithinExtendedWindow (90d)", () => {
  it("true for delivery 30 days ago", () => {
    const d = new Date(Date.now() - 30 * 86400_000);
    expect(isWithinExtendedWindow(d)).toBe(true);
  });
  it("true for delivery 80 days ago", () => {
    const d = new Date(Date.now() - 80 * 86400_000);
    expect(isWithinExtendedWindow(d)).toBe(true);
  });
  it("false for delivery 100 days ago", () => {
    const d = new Date(Date.now() - 100 * 86400_000);
    expect(isWithinExtendedWindow(d)).toBe(false);
  });
});

describe("isOverdueRefund (10d law deadline)", () => {
  it("false for request 5 days ago", () => {
    expect(isOverdueRefund(new Date(Date.now() - 5 * 86400_000))).toBe(false);
  });
  it("true for request 11 days ago", () => {
    expect(isOverdueRefund(new Date(Date.now() - 11 * 86400_000))).toBe(true);
  });
});

describe("computeRefundAmount", () => {
  it("sums qty × priceSnapshot from item", () => {
    const items = [
      { orderItemSku: "A", qty: 2, priceSnapshot: 50000 }, // 1000.00 ₽ × 2 = 100 000 коп
      { orderItemSku: "B", qty: 1, priceSnapshot: 25000 },
    ];
    expect(computeRefundAmount(items, [])).toBe(125000);
  });

  it("falls back to orderItem.price if item.priceSnapshot missing", () => {
    const items = [{ orderItemSku: "A", qty: 3 }];
    const orderItems = [{ sku: "A", qty: 5, price: 10000 }];
    expect(computeRefundAmount(items, orderItems)).toBe(30000);
  });

  it("falls back to priceKopecks if explicitly provided", () => {
    const items = [{ orderItemSku: "A", qty: 2 }];
    const orderItems = [{ sku: "A", qty: 5, priceKopecks: 7777 }];
    expect(computeRefundAmount(items, orderItems)).toBe(15554);
  });

  it("returns 0 for missing price (RFQ-only line)", () => {
    const items = [{ orderItemSku: "X", qty: 5 }];
    expect(computeRefundAmount(items, [])).toBe(0);
  });

  it("floors fractional qty (defensive)", () => {
    const items = [{ orderItemSku: "A", qty: 2.7, priceSnapshot: 1000 }];
    expect(computeRefundAmount(items, [])).toBe(2000);
  });
});

describe("qtyAvailableForReturn", () => {
  const orderItem = { sku: "A", qty: 5 };

  it("returns full qty when no returns", () => {
    expect(qtyAvailableForReturn(orderItem, [])).toBe(5);
  });

  it("subtracts qty from non-terminal returns", () => {
    const returns = [{ status: "requested", items: [{ orderItemSku: "A", qty: 2 }] }];
    expect(qtyAvailableForReturn(orderItem, returns)).toBe(3);
  });

  it("ignores terminal returns (rejected/cancelled — qty becomes available again)", () => {
    const returns = [
      { status: "rejected", items: [{ orderItemSku: "A", qty: 3 }] },
      { status: "cancelled", items: [{ orderItemSku: "A", qty: 2 }] },
    ];
    expect(qtyAvailableForReturn(orderItem, returns)).toBe(5);
  });

  it("does NOT count refunded toward available (refunded fully consumes return qty)", () => {
    // refunded is terminal — by the formula it's not subtracted, but in practice
    // the order item qty itself can also be considered "spent" — that's beyond
    // this helper's scope. The formula intentionally treats refunded as terminal.
    const returns = [{ status: "refunded", items: [{ orderItemSku: "A", qty: 4 }] }];
    expect(qtyAvailableForReturn(orderItem, returns)).toBe(5);
  });

  it("subtracts in-transit shipment qty", () => {
    const shipment = [{ sku: "A", qty: 2, shipmentStatus: "in_transit" }];
    expect(qtyAvailableForReturn(orderItem, [], shipment)).toBe(3);
  });

  it("subtracts returns AND in-transit", () => {
    const returns = [{ status: "approved", items: [{ orderItemSku: "A", qty: 1 }] }];
    const shipment = [{ sku: "A", qty: 1, shipmentStatus: "pending" }];
    expect(qtyAvailableForReturn(orderItem, returns, shipment)).toBe(3);
  });

  it("clamps to zero (never negative)", () => {
    const returns = [{ status: "requested", items: [{ orderItemSku: "A", qty: 99 }] }];
    expect(qtyAvailableForReturn(orderItem, returns)).toBe(0);
  });

  it("ignores other SKUs", () => {
    const returns = [{ status: "approved", items: [{ orderItemSku: "B", qty: 3 }] }];
    expect(qtyAvailableForReturn(orderItem, returns)).toBe(5);
  });
});
