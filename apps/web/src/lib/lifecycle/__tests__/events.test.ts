import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub Payload BEFORE importing the module under test.
vi.mock("payload", () => ({
  getPayload: vi.fn().mockResolvedValue({
    create: vi.fn().mockResolvedValue({ id: "log-1" }),
  }),
}));

vi.mock("@payload-config", () => ({
  default: Promise.resolve({}),
}));

import {
  emitDomainEvent,
  listSubscribers,
  registerSubscriber,
  unregisterSubscriber,
  type DomainEventPayload,
  type DomainEventSubscriber,
  type OrderSnapshot,
} from "../events";

const ORDER: OrderSnapshot = {
  id: "ORD-evt-1",
  status: "paid",
  customer: { email: "test@example.com" },
};

beforeEach(() => {
  // Clean up subscribers registered by previous tests.
  for (const name of listSubscribers()) unregisterSubscriber(name);
});

describe("emitDomainEvent", () => {
  it("invokes registered subscriber with payload", async () => {
    const handle = vi.fn();
    const sub: DomainEventSubscriber = { name: "test-sub-1", handle };
    registerSubscriber(sub);

    await emitDomainEvent({
      kind: "order.paid",
      order: ORDER,
      eventIdSuffix: "test-1",
    });

    expect(handle).toHaveBeenCalledTimes(1);
    const payload = handle.mock.calls[0][0] as DomainEventPayload;
    expect(payload.kind).toBe("order.paid");
    expect(payload.order?.id).toBe("ORD-evt-1");
    expect(payload.eventId).toContain("ORD-evt-1:order.paid:");
  });

  it("isolates throwing subscriber — other subscribers still run", async () => {
    const okHandle = vi.fn();
    const failHandle = vi.fn().mockRejectedValue(new Error("subscriber boom"));

    registerSubscriber({ name: "fail-sub", handle: failHandle });
    registerSubscriber({ name: "ok-sub", handle: okHandle });

    await expect(
      emitDomainEvent({
        kind: "order.paid",
        order: { ...ORDER, id: "ORD-evt-2" },
        eventIdSuffix: "isolation",
      }),
    ).resolves.toBeUndefined();

    expect(failHandle).toHaveBeenCalledTimes(1);
    expect(okHandle).toHaveBeenCalledTimes(1);
  });

  it("dedups identical eventId within process (same order+kind+suffix)", async () => {
    const handle = vi.fn();
    registerSubscriber({ name: "dedup-sub", handle });

    const order = { ...ORDER, id: "ORD-evt-dedup" };
    await emitDomainEvent({ kind: "order.paid", order, eventIdSuffix: "X" });
    await emitDomainEvent({ kind: "order.paid", order, eventIdSuffix: "X" });

    expect(handle).toHaveBeenCalledTimes(1);

    // Different suffix → not deduped.
    await emitDomainEvent({ kind: "order.paid", order, eventIdSuffix: "Y" });
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it("filters subscribers by kinds whitelist", async () => {
    const filtered = vi.fn();
    const universal = vi.fn();
    registerSubscriber({ name: "filtered-sub", kinds: ["order.completed"], handle: filtered });
    registerSubscriber({ name: "universal-sub", handle: universal });

    await emitDomainEvent({
      kind: "order.paid",
      order: { ...ORDER, id: "ORD-evt-filter" },
      eventIdSuffix: "f1",
    });

    expect(filtered).not.toHaveBeenCalled();
    expect(universal).toHaveBeenCalledTimes(1);
  });
});

describe("registerSubscriber", () => {
  it("does not register duplicates by name", () => {
    const handle = vi.fn();
    registerSubscriber({ name: "dup", handle });
    registerSubscriber({ name: "dup", handle });
    expect(listSubscribers().filter((n) => n === "dup")).toHaveLength(1);
  });
});
