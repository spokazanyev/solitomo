import { describe, it, expect } from "vitest";

import { assertTransition, canTransition } from "../status-machine";

describe("canTransition", () => {
  it("allows paid → fulfilling", () => {
    expect(canTransition("paid", "fulfilling")).toBe(true);
  });

  it("blocks delivered → shipped (backwards in lifecycle)", () => {
    expect(canTransition("delivered", "shipped")).toBe(false);
  });

  it("allows delivered → returned", () => {
    expect(canTransition("delivered", "returned")).toBe(true);
  });

  it("allows delivered → completed", () => {
    expect(canTransition("delivered", "completed")).toBe(true);
  });

  it("allows same-status no-op transitions (idempotency)", () => {
    expect(canTransition("paid", "paid")).toBe(true);
    expect(canTransition("completed", "completed")).toBe(true);
  });
});

describe("assertTransition", () => {
  it("throws on completed → paid without reopenAuthorized (FR-905)", () => {
    expect(() => assertTransition("completed", "paid")).toThrow(/FR-905|Реоткрыть|completed/);
  });

  it("still throws when reopenAuthorized=true if status-machine doesn't allow it", () => {
    // completed allows only completed → completed; reopenAuthorized bypasses
    // the lock-check, but the underlying canTransition still rejects → assertTransition throws.
    expect(() =>
      assertTransition("completed", "paid", { reopenAuthorized: true }),
    ).toThrow(/Запрещённый переход/);
  });

  it("does not throw for an explicitly allowed transition", () => {
    expect(() => assertTransition("paid", "fulfilling")).not.toThrow();
    expect(() => assertTransition("shipped", "delivered")).not.toThrow();
    expect(() => assertTransition("delivered", "returned")).not.toThrow();
  });
});
