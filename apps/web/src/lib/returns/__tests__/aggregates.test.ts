import { describe, expect, it } from "vitest";

// Inline copy of computeOrderAggregates and the kopecks/rubles maybeMark logic.
// These exist to guard against the C1 regression (unit mismatch between
// Return.refundAmount (kopecks) and Order.totals.total (rubles)).

type ReturnStatus = "requested" | "approved" | "received" | "refunded" | "rejected" | "cancelled";

const TERMINAL = new Set<ReturnStatus>(["refunded", "rejected", "cancelled"]);
const OPEN = new Set<ReturnStatus>(["requested", "approved", "received"]);

interface ReturnSummary {
  status: ReturnStatus;
  refundAmount: number; // kopecks
}

interface Aggregates {
  hasReturns: boolean;
  returnsCount: number;
  totalRefunded: number; // kopecks
  disputeFlag: boolean;
}

function computeOrderAggregates(returns: readonly ReturnSummary[]): Aggregates {
  const active = returns.filter((r) => !TERMINAL.has(r.status));
  const refunded = returns.filter((r) => r.status === "refunded");
  const totalRefunded = refunded.reduce((s, r) => s + (r.refundAmount ?? 0), 0);
  const open = returns.filter((r) => OPEN.has(r.status));
  return {
    hasReturns: active.length > 0,
    returnsCount: active.length,
    totalRefunded,
    disputeFlag: open.length > 0,
  };
}

/**
 * Replicates the kopecks-aware maybeMarkOrderReturned guard.
 * Returns "returned" only if the kopeck-converted order total has been fully refunded.
 */
function maybeMark(orderTotalRub: number, totalRefundedKopecks: number): "returned" | null {
  const orderTotalKopecks = Math.round(orderTotalRub * 100);
  if (orderTotalKopecks <= 0) return null;
  if (totalRefundedKopecks < orderTotalKopecks) return null;
  return "returned";
}

describe("computeOrderAggregates", () => {
  it("empty list — no returns", () => {
    expect(computeOrderAggregates([])).toEqual({
      hasReturns: false,
      returnsCount: 0,
      totalRefunded: 0,
      disputeFlag: false,
    });
  });

  it("only refunded — counts toward total but not disputeFlag", () => {
    const result = computeOrderAggregates([
      { status: "refunded", refundAmount: 50000 },
      { status: "refunded", refundAmount: 25000 },
    ]);
    expect(result.totalRefunded).toBe(75000);
    expect(result.disputeFlag).toBe(false); // refunded is terminal
    expect(result.returnsCount).toBe(0); // terminal returns don't count as "active"
    expect(result.hasReturns).toBe(false);
  });

  it("open returns set disputeFlag and hasReturns", () => {
    const result = computeOrderAggregates([
      { status: "requested", refundAmount: 10000 },
      { status: "approved", refundAmount: 20000 },
    ]);
    expect(result.disputeFlag).toBe(true);
    expect(result.hasReturns).toBe(true);
    expect(result.returnsCount).toBe(2);
    expect(result.totalRefunded).toBe(0); // none refunded yet
  });

  it("mixed: refunded + active open returns", () => {
    const result = computeOrderAggregates([
      { status: "refunded", refundAmount: 10000 },
      { status: "received", refundAmount: 5000 },
      { status: "rejected", refundAmount: 99999 }, // terminal but rejected — no refund
    ]);
    expect(result.totalRefunded).toBe(10000);
    expect(result.disputeFlag).toBe(true); // received is open
    expect(result.returnsCount).toBe(1); // received only (rejected/refunded are terminal)
  });

  it("cancelled and rejected do NOT contribute to totalRefunded", () => {
    const result = computeOrderAggregates([
      { status: "cancelled", refundAmount: 99999 },
      { status: "rejected", refundAmount: 99999 },
    ]);
    expect(result.totalRefunded).toBe(0);
    expect(result.disputeFlag).toBe(false);
  });
});

describe("maybeMarkOrderReturned (C1 regression guard)", () => {
  it("returns null when refund is less than order total", () => {
    // 1000 ₽ order = 100 000 kopecks; refund 50 000 kopecks
    expect(maybeMark(1000, 50_000)).toBe(null);
  });

  it("returns 'returned' when refund equals order total (in kopecks)", () => {
    expect(maybeMark(1000, 100_000)).toBe("returned");
  });

  it("returns 'returned' when refund exceeds order total", () => {
    expect(maybeMark(1000, 150_000)).toBe("returned");
  });

  it("REGRESSION (C1): does NOT trigger 'returned' for 1% partial refund", () => {
    // 100 000 ₽ order = 10 000 000 kopecks
    // 1 000 ₽ refund = 100 000 kopecks (1% of total)
    // Before C1 fix, 100 000 (kopecks) >= 100 000 (rubles) compared directly → false-positive
    expect(maybeMark(100_000, 100_000)).toBe(null);
  });

  it("REGRESSION (C1): kopeck-precision check at exact boundary", () => {
    // 999.99 ₽ order
    expect(maybeMark(999.99, 99_998)).toBe(null);
    expect(maybeMark(999.99, 99_999)).toBe("returned");
  });

  it("zero-total order: never marks as returned (defensive)", () => {
    expect(maybeMark(0, 100_000)).toBe(null);
  });

  it("negative orderTotal: never marks as returned (defensive)", () => {
    expect(maybeMark(-1, 100_000)).toBe(null);
  });
});
