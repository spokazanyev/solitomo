import { describe, expect, it } from "vitest";

import type { NotificationJobPayload } from "../../types";
import { renderT015PaymentExpired } from "../t-015-payment-expired";

function makePayload(overrides: Partial<NotificationJobPayload["order"]> = {}): NotificationJobPayload {
  return {
    order: {
      id: "ord-123",
      clientNumber: "SO-2026-0042",
      status: "expired",
      customer: { email: "buyer@example.com", fullName: "Иван Иванов" },
      items: [{ sku: "PDU-1", name: "PDU", price: 10000, quantity: 1 }],
      totals: { total: 10000, currency: "RUB" },
      ...overrides,
    } as never,
    event: { kind: "payment.expired", at: new Date().toISOString() },
  };
}

describe("renderT015PaymentExpired (056 FR-5640)", () => {
  it("renders subject with clientNumber", () => {
    const r = renderT015PaymentExpired(makePayload());
    expect(r.subject).toContain("SO-2026-0042");
    expect(r.subject).toContain("аннулирован");
  });

  it("includes 2 CTAs in HTML — recovery + new-cart (OQ-6)", () => {
    const r = renderT015PaymentExpired(makePayload({ cartId: "cart-abc" } as never));
    expect(r.html).toContain("/cart/?recover=");
    expect(r.html).toContain("Вернуться к заказу");
    expect(r.html).toContain("оформить заново");
  });

  it("falls back to /cart/ if no cartId", () => {
    const r = renderT015PaymentExpired(makePayload({ cartId: undefined } as never));
    expect(r.html).not.toContain("?recover=");
    expect(r.html).toContain("/cart/");
  });

  it("escapes special chars in clientNumber", () => {
    const r = renderT015PaymentExpired(makePayload({ clientNumber: "<script>SO-1</script>" } as never));
    expect(r.html).not.toContain("<script>SO");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("plaintext fallback contains essential info", () => {
    const r = renderT015PaymentExpired(makePayload());
    expect(r.text).toContain("SO-2026-0042");
    expect(r.text).toContain("60 минут");
  });
});
