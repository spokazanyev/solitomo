import { describe, expect, it } from "vitest";

import type { NotificationJobPayload } from "../../types";
import { renderT110ReceiptFailed } from "../t-110-receipt-failed";

function makePayload(eventMessage = "providerRef=yk_xyz"): NotificationJobPayload {
  return {
    order: {
      id: 555,
      clientNumber: "SO-2026-0100",
      status: "paid",
      customer: { email: "buyer@example.com", fullName: "Анна П." },
      items: [],
      totals: { total: 12000, currency: "RUB" },
    } as never,
    event: { kind: "payment.receipt_failed", at: new Date().toISOString(), message: eventMessage },
  };
}

describe("renderT110ReceiptFailed (056 FR-5642)", () => {
  it("includes 54-ФЗ + warning in subject", () => {
    const r = renderT110ReceiptFailed(makePayload());
    expect(r.subject).toContain("54-ФЗ");
    expect(r.subject).toContain("⚠️");
  });

  it("includes 24-hour SLA warning in HTML", () => {
    const r = renderT110ReceiptFailed(makePayload());
    expect(r.html).toContain("24 часа");
    expect(r.html).toContain("10 000");
  });

  it("provides instructions for online-cash troubleshooting", () => {
    const r = renderT110ReceiptFailed(makePayload());
    expect(r.text).toContain("онлайн-кассы");
    expect(r.text).toContain("АТОЛ");
  });

  it("extracts providerRef from event.message", () => {
    const r = renderT110ReceiptFailed(makePayload());
    expect(r.text).toContain("yk_xyz");
    expect(r.html).toContain("yk_xyz");
  });

  it("admin URL includes order id", () => {
    const r = renderT110ReceiptFailed(makePayload());
    expect(r.html).toMatch(/\/admin\/collections\/orders\/555/);
  });
});
