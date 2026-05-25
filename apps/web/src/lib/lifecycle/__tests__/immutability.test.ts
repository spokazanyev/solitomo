/**
 * Unit tests for paid-order immutability guard (051).
 *
 * Tests checkPaidImmutability() and wasEverPaid() logic.
 * FR-5106, FR-5107, FR-5108.
 */

import { describe, expect, it } from "vitest";

// ─── Inline pure logic from immutability.ts (to avoid server-only import) ─────

const FROZEN_FIELDS: readonly string[] = [
  "items",
  "totals.subtotal",
  "totals.vat",
  "totals.total",
  "delivery.priceSnapshot",
  "delivery.priceSnapshot.cost",
  "delivery.priceSnapshot.currency",
  "delivery.priceSnapshot.capturedAt",
  "delivery.priceSnapshot.sourceCacheKey",
  "delivery.priceSnapshot.refreshCheckAt",
  "customer.email",
  "clientNumber",
];

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => key in bObj && deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

interface ImmutabilityCheckResult {
  allowed: boolean;
  violations: string[];
}

function isPathPresent(obj: Record<string, unknown>, path: string): boolean {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return false;
    if (!(part in (current as Record<string, unknown>))) return false;
    current = (current as Record<string, unknown>)[part];
  }
  return true;
}

function checkPaidImmutability(
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown>,
  operation: string,
): ImmutabilityCheckResult {
  if (operation !== "update") {
    return { allowed: true, violations: [] };
  }

  const payment = originalDoc.payment as Record<string, unknown> | undefined;
  const paidAt = payment?.paidAt;
  if (!paidAt) {
    return { allowed: true, violations: [] };
  }

  const violations: string[] = [];

  for (const frozenPath of FROZEN_FIELDS) {
    const parentCovered = FROZEN_FIELDS.some(
      (f) => f !== frozenPath && frozenPath.startsWith(f + "."),
    );
    if (parentCovered) continue;

    // Only check if the frozen path is explicitly present in the update data
    if (!isPathPresent(data, frozenPath)) continue;

    const oldValue = getNestedValue(originalDoc, frozenPath);
    const newValue = getNestedValue(data, frozenPath);

    if (!deepEqual(oldValue, newValue)) {
      violations.push(frozenPath);
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
  };
}

function wasEverPaid(doc: Record<string, unknown>): boolean {
  const payment = doc.payment as Record<string, unknown> | undefined;
  return payment?.paidAt != null;
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makePaidOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "order-1",
    status: "paid",
    clientNumber: "SO-2026-0001",
    items: [
      { sku: "SKU-1", name: "Product 1", quantity: 2, price: 1000 },
    ],
    totals: { subtotal: 2000, vat: 400, total: 2400 },
    customer: { fullName: "Иван Иванов", email: "ivan@example.com", phone: "+79001234567" },
    delivery: {
      method: "cdek",
      priceSnapshot: { cost: 500, currency: "RUB", capturedAt: "2026-05-24" },
    },
    payment: { paidAt: "2026-05-24T10:00:00Z", amount: 2900, providerStatus: "succeeded" },
    internalComment: "Test order",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("wasEverPaid", () => {
  it("returns false when payment is undefined", () => {
    expect(wasEverPaid({})).toBe(false);
  });

  it("returns false when paidAt is null", () => {
    expect(wasEverPaid({ payment: { paidAt: null } })).toBe(false);
  });

  it("returns false when paidAt is undefined", () => {
    expect(wasEverPaid({ payment: { paidAt: undefined } })).toBe(false);
  });

  it("returns true when paidAt is set", () => {
    expect(wasEverPaid({ payment: { paidAt: "2026-05-24T10:00:00Z" } })).toBe(true);
  });

  it("returns true even for cancelled order with prior payment", () => {
    expect(
      wasEverPaid({ status: "cancelled", payment: { paidAt: "2026-05-24T10:00:00Z" } }),
    ).toBe(true);
  });
});

describe("checkPaidImmutability", () => {
  describe("skip conditions", () => {
    it("allows all changes on create operation", () => {
      const original = makePaidOrder();
      const data = { ...original, items: [] };
      const result = checkPaidImmutability(data, original, "create");
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("allows all changes when order is not paid", () => {
      const original = makePaidOrder({ payment: { paidAt: null } });
      const data = { ...original, items: [] };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(true);
    });
  });

  describe("frozen fields — should block", () => {
    it("blocks items change on paid order", () => {
      const original = makePaidOrder();
      const data = {
        items: [{ sku: "SKU-1", name: "Product 1", quantity: 5, price: 1000 }], // changed quantity
      };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("items");
    });

    it("blocks totals.total change on paid order", () => {
      const original = makePaidOrder();
      const data = {
        totals: { subtotal: 2000, vat: 400, total: 9999 }, // changed total
      };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("totals.total");
    });

    it("blocks totals.subtotal change", () => {
      const original = makePaidOrder();
      const data = {
        totals: { subtotal: 5000, vat: 400, total: 2400 },
      };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("totals.subtotal");
    });

    it("blocks delivery.priceSnapshot change", () => {
      const original = makePaidOrder();
      const data = {
        delivery: {
          method: "cdek",
          priceSnapshot: { cost: 999, currency: "RUB", capturedAt: "2026-05-24" },
        },
      };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("delivery.priceSnapshot");
    });

    it("blocks customer.email change", () => {
      const original = makePaidOrder();
      const data = {
        customer: { fullName: "Иван Иванов", email: "new@example.com", phone: "+79001234567" },
      };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("customer.email");
    });

    it("blocks clientNumber change", () => {
      const original = makePaidOrder();
      const data = { clientNumber: "SO-2026-9999" };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("clientNumber");
    });
  });

  describe("always-mutable fields — should allow", () => {
    it("allows internalComment change on paid order", () => {
      const original = makePaidOrder();
      const data = { internalComment: "Updated comment" };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("allows status change on paid order", () => {
      const original = makePaidOrder();
      const data = { status: "fulfilling" };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(true);
    });

    it("allows delivery.trackNumber change (with full delivery spread)", () => {
      const original = makePaidOrder();
      const data = {
        delivery: {
          ...original.delivery as Record<string, unknown>,
          trackNumber: "TRK-12345",
        },
      };
      // priceSnapshot is the same, only trackNumber changed
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(true);
    });

    it("allows partial delivery update without priceSnapshot (H3 regression)", () => {
      const original = makePaidOrder();
      // Real-world scenario: operator adds trackNumber but doesn't send priceSnapshot
      const data = {
        delivery: {
          trackNumber: "TRK-12345",
          shippedAt: "2026-05-25",
        },
      };
      // priceSnapshot is NOT in data at all → must not be flagged as violation
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("allows payment.providerStatus change", () => {
      const original = makePaidOrder();
      const data = {
        payment: {
          paidAt: "2026-05-24T10:00:00Z",
          amount: 2900,
          providerStatus: "refunded",
        },
      };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(true);
    });

    it("allows history append", () => {
      const original = makePaidOrder();
      const data = {
        history: [{ at: "2026-05-24", from: "paid", to: "fulfilling", note: "" }],
      };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(true);
    });

    it("allows hasReturns/returnsCount/totalRefunded changes", () => {
      const original = makePaidOrder();
      const data = {
        hasReturns: true,
        returnsCount: 1,
        totalRefunded: 1000,
      };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(true);
    });

    it("allows customer.emailValid flip (049 bounce)", () => {
      const original = makePaidOrder();
      const data = {
        customer: {
          ...(original.customer as Record<string, unknown>),
          emailValid: false,
        },
      };
      // email itself unchanged, only emailValid changed
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(true);
    });
  });

  describe("multiple violations", () => {
    it("reports all frozen fields that changed", () => {
      const original = makePaidOrder();
      const data = {
        items: [], // changed
        totals: { subtotal: 0, vat: 0, total: 0 }, // changed
        clientNumber: "SO-2026-9999", // changed
      };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("items");
      expect(result.violations).toContain("totals.subtotal");
      expect(result.violations).toContain("totals.total");
      expect(result.violations).toContain("clientNumber");
    });
  });

  describe("no-change passes", () => {
    it("allows update with identical frozen field values", () => {
      const original = makePaidOrder();
      // Send same items and totals
      const data = {
        items: [
          { sku: "SKU-1", name: "Product 1", quantity: 2, price: 1000 },
        ],
        totals: { subtotal: 2000, vat: 400, total: 2400 },
        internalComment: "Updated",
      };
      const result = checkPaidImmutability(data, original, "update");
      expect(result.allowed).toBe(true);
    });
  });
});

describe("deepEqual (used by immutability check)", () => {
  it("compares arrays deeply", () => {
    expect(
      deepEqual(
        [{ a: 1, b: [2, 3] }],
        [{ a: 1, b: [2, 3] }],
      ),
    ).toBe(true);
  });

  it("detects different array length", () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("detects different nested values", () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it("handles null vs undefined", () => {
    expect(deepEqual(null, undefined)).toBe(true); // both nullish
  });

  it("handles primitives", () => {
    expect(deepEqual(42, 42)).toBe(true);
    expect(deepEqual("abc", "abc")).toBe(true);
    expect(deepEqual(42, 43)).toBe(false);
  });
});
