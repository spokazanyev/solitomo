import { describe, it, expect } from "vitest";

import type { CalculationInput, OrderForShipment } from "../../types";
import { FallbackShippingProvider } from "../provider";

const provider = new FallbackShippingProvider();

const ORDER: OrderForShipment = {
  id: "ORD-X",
  customer: { fullName: "Test" },
  delivery: {
    provider: "fallback",
    providerKey: "cdek",
    tariffId: 0,
    deliveryType: 1,
    pickupType: 1,
    cost: 0,
  },
  items: [{ sku: "A", quantity: 1, price: 100 }],
  totals: { subtotal: 100, vat: 0, total: 100 },
};

describe("FallbackShippingProvider", () => {
  it("calculate() returns 4 fallback rates and a warning", async () => {
    const input: CalculationInput = {
      cartId: "c1",
      address: { countryCode: "RU", city: "Москва" },
      items: [{ sku: "A", quantity: 1, price: 100 }],
    };
    const result = await provider.calculate(input);

    expect(result.rates).toHaveLength(3);
    expect(result.rates.map((r) => r.providerKey).sort()).toEqual(
      ["manager-courier", "manager-point", "pickup"],
    );
    for (const r of result.rates) {
      expect(r.cost).toBe(0);
      expect(r.currency).toBe("RUB");
    }
    expect(result.warnings?.length ?? 0).toBeGreaterThan(0);
  });

  it("createShipment() returns status='none' with error message", async () => {
    const info = await provider.createShipment(ORDER);
    expect(info.status).toBe("none");
    expect(info.orderId).toBe("ORD-X");
    expect(info.errorMessage).toMatch(/Fallback/);
  });
});
