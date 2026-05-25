import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stub Payload before importing modules that pull it in transitively.
vi.mock("payload", () => ({
  getPayload: vi.fn().mockResolvedValue({
    create: vi.fn().mockResolvedValue({ id: "log-1" }),
  }),
}));

vi.mock("@payload-config", () => ({
  default: Promise.resolve({}),
}));

import {
  renderCompletedEmail,
  renderDeliveredEmail,
  renderPaidEmail,
  renderShippedEmail,
  registerStubEmailSubscriber,
} from "../stub";
import {
  emitDomainEvent,
  listSubscribers,
  unregisterSubscriber,
  type DomainEventPayload,
} from "../../lifecycle/events";

function makeEvent(partial: Partial<DomainEventPayload> = {}): DomainEventPayload {
  return {
    eventId: "evt-1",
    kind: "order.paid",
    at: "2026-05-23T00:00:00.000Z",
    emittedAt: "2026-05-23T00:00:00.000Z",
    order: {
      id: "ORD-stub-1",
      publicToken: "tok-1",
      status: "paid",
      customer: {
        fullName: "Анна Иванова",
        email: "anna@example.com",
      },
      totals: { total: 12500, currency: "RUB" },
      delivery: { providerName: "СДЭК" },
      shipment: { trackingNumber: "TR-001", trackingUrl: "https://track/TR-001" },
      ...partial.order,
    },
    ...partial,
  };
}

describe("email renderers (T-001/T-003/T-005/T-008)", () => {
  it("renderPaidEmail returns message with formatted price and order URL", () => {
    const msg = renderPaidEmail(makeEvent({ kind: "order.paid" }));
    expect(msg).not.toBeNull();
    expect(msg!.to).toBe("anna@example.com");
    expect(msg!.subject).toContain("ORD-stub-1");
    // Intl.NumberFormat ru-RU uses a non-breaking space; assert via regex.
    expect(msg!.text).toMatch(/12[\s ]500/);
    expect(msg!.text).toContain("/cart/order/tok-1/");
    expect(msg!.text).not.toMatch(/NaN|undefined/);
  });

  it("renderShippedEmail includes tracking number and provider", () => {
    const msg = renderShippedEmail(makeEvent({ kind: "shipment.created" }));
    expect(msg).not.toBeNull();
    expect(msg!.subject).toContain("TR-001");
    expect(msg!.text).toContain("СДЭК");
    expect(msg!.text).toContain("TR-001");
    expect(msg!.text).toContain("https://track/TR-001");
    expect(msg!.text).not.toMatch(/NaN|undefined/);
  });

  it("renderDeliveredEmail mentions return window", () => {
    const msg = renderDeliveredEmail(makeEvent({ kind: "shipment.delivered" }));
    expect(msg).not.toBeNull();
    expect(msg!.subject).toContain("доставлен");
    expect(msg!.text).toContain("14 дней");
    expect(msg!.text).not.toMatch(/NaN|undefined/);
  });

  it("renderCompletedEmail provides review URL", () => {
    const msg = renderCompletedEmail(makeEvent({ kind: "order.completed" }));
    expect(msg).not.toBeNull();
    expect(msg!.subject).toContain("Как прошла покупка");
    expect(msg!.text).toContain("/cart/order/tok-1/review/");
    expect(msg!.text).not.toMatch(/NaN|undefined/);
  });

  it("returns null when customer.email missing", () => {
    const noEmail = makeEvent({
      order: {
        id: "ORD-stub-x",
        status: "paid",
        customer: { fullName: "Аноним" },
      },
    });
    expect(renderPaidEmail(noEmail)).toBeNull();
    expect(renderShippedEmail(noEmail)).toBeNull();
    expect(renderDeliveredEmail(noEmail)).toBeNull();
    expect(renderCompletedEmail(noEmail)).toBeNull();
  });

  it("handles missing totals/shipment without printing NaN/undefined", () => {
    const minimal = makeEvent({
      order: {
        id: "ORD-min",
        status: "paid",
        customer: { email: "m@example.com" },
      },
    });
    const paid = renderPaidEmail(minimal);
    expect(paid).not.toBeNull();
    expect(paid!.text).not.toMatch(/NaN|undefined/);

    const shipped = renderShippedEmail(minimal);
    expect(shipped).not.toBeNull();
    expect(shipped!.text).not.toMatch(/NaN|undefined/);
  });
});

describe("sendStubEmail dry-run behaviour (via subscriber)", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  // The stub subscriber is module-scoped and guarded by a `registered` flag,
  // so we register once and keep it for both tests. Other subscribers
  // registered in previous test files are removed.
  registerStubEmailSubscriber();

  beforeEach(() => {
    vi.unstubAllEnvs();
    // Strip any non-stub subscribers leftover from other test files.
    for (const name of listSubscribers()) {
      if (name !== "047-email-stub") unregisterSubscriber(name);
    }
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("logs 'skipped (no_api_key)' when EMAIL_API_KEY is empty", async () => {
    vi.stubEnv("EMAIL_API_KEY", "");
    vi.stubEnv("EMAIL_SANDBOX", "");

    await emitDomainEvent({
      kind: "order.paid",
      order: {
        id: "ORD-skip-1",
        status: "paid",
        publicToken: "tok-skip-1",
        customer: { email: "a@b.com", fullName: "Test" },
        totals: { total: 100 },
      },
      eventIdSuffix: "no-api",
    });

    const calls = infoSpy.mock.calls.map((c) => JSON.stringify(c));
    expect(calls.some((c) => c.includes("dry-run"))).toBe(true);
    expect(calls.some((c) => c.includes("no_api_key"))).toBe(true);
  });

  it("logs 'skipped (sandbox)' when EMAIL_SANDBOX=true even with API key", async () => {
    vi.stubEnv("EMAIL_API_KEY", "test-token");
    vi.stubEnv("EMAIL_SANDBOX", "true");

    await emitDomainEvent({
      kind: "shipment.delivered",
      order: {
        id: "ORD-skip-2",
        status: "delivered",
        publicToken: "tok-skip-2",
        customer: { email: "c@d.com", fullName: "Test" },
      },
      eventIdSuffix: "sandbox",
    });

    const calls = infoSpy.mock.calls.map((c) => JSON.stringify(c));
    expect(calls.some((c) => c.includes("sandbox"))).toBe(true);
  });
});
