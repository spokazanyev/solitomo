import { describe, expect, it } from "vitest";

import type { NotificationJobPayload } from "../../types";
import { renderT111RefundFailed } from "../t-111-refund-failed";

function makePayload(eventMessage = "returnNumber=RT-2026-0007,returnId=ret-1,providerRefundId=yk_ref_abc,reason=card_expired"): NotificationJobPayload {
  return {
    order: {
      id: 999,
      clientNumber: "SO-2026-0200",
      status: "paid",
      customer: { email: "buyer@example.com", fullName: "Пётр С." },
      items: [],
      totals: { total: 5000, currency: "RUB" },
    } as never,
    event: { kind: "return.refund_failed", at: new Date().toISOString(), message: eventMessage },
  };
}

describe("renderT111RefundFailed (056 FR-5643)", () => {
  it("subject contains returnNumber", () => {
    const r = renderT111RefundFailed(makePayload());
    expect(r.subject).toContain("RT-2026-0007");
    expect(r.subject).toContain("Refund failed");
  });

  it("extracts providerRefundId + reason from event.message", () => {
    const r = renderT111RefundFailed(makePayload());
    expect(r.html).toContain("yk_ref_abc");
    expect(r.html).toContain("card_expired");
  });

  it("provides multi-path resolution options", () => {
    const r = renderT111RefundFailed(makePayload());
    expect(r.text).toContain("Повторить refund");
    expect(r.text).toContain("Bank-transfer");
  });

  it("admin Return URL includes returnId", () => {
    const r = renderT111RefundFailed(makePayload());
    expect(r.html).toMatch(/\/admin\/collections\/returns\/ret-1/);
  });

  it("falls back to returns list URL if returnId missing", () => {
    const r = renderT111RefundFailed(makePayload("returnNumber=RT-1,providerRefundId=ref_x,reason=test"));
    expect(r.html).toContain("/admin/collections/returns");
    expect(r.html).not.toContain("/admin/collections/returns/undefined");
  });
});
