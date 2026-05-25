import { describe, expect, it } from "vitest";

import type { NotificationJobPayload } from "../../types";
import { renderT109AmountMismatch } from "../t-109-amount-mismatch";

function makePayload(eventMessage = "expected=10000,actual=9999,providerRef=yk_abc123"): NotificationJobPayload {
  return {
    order: {
      id: 12345,
      clientNumber: "SO-2026-0042",
      status: "pending_payment",
      customer: { email: "buyer@example.com", fullName: "Иван Иванов" },
      items: [],
      totals: { total: 10000, currency: "RUB" },
    } as never,
    event: { kind: "payment.amount_mismatch", at: new Date().toISOString(), message: eventMessage },
  };
}

describe("renderT109AmountMismatch (056 FR-5641)", () => {
  it("includes warning emoji + clientNumber in subject", () => {
    const r = renderT109AmountMismatch(makePayload());
    expect(r.subject).toContain("⚠️");
    expect(r.subject).toContain("SO-2026-0042");
  });

  it("renders expected/actual/providerRef from event.message", () => {
    const r = renderT109AmountMismatch(makePayload());
    expect(r.html).toContain("yk_abc123");
    // expected/actual are formatted as price strings
    expect(r.html).toContain("Ожидаемая сумма");
    expect(r.html).toContain("Фактическая");
  });

  it("admin link points to Order admin page", () => {
    const r = renderT109AmountMismatch(makePayload());
    expect(r.html).toMatch(/\/admin\/collections\/orders\/12345/);
  });

  it("handles missing actual gracefully", () => {
    const r = renderT109AmountMismatch(makePayload("expected=10000,providerRef=yk_test"));
    // actual fields absent → fallback message
    expect(r.text).toContain("см. PaymentEvents");
  });

  it("includes action items list", () => {
    const r = renderT109AmountMismatch(makePayload());
    expect(r.text).toContain("Открыть Order");
    expect(r.text).toContain("ЮKassa ЛК");
  });
});
