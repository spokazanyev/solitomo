import { describe, expect, it } from "vitest";

import type { PaymentSettingsResolved } from "../settings";
import { buildReceipt, buildRefundReceipt } from "../yookassa-receipt";

const baseSettings: PaymentSettingsResolved = {
  enabled: true,
  captureMode: "two_stage",
  paymentMethods: ["bank_card", "sbp"],
  paymentRetryWindowMin: 60,
  webhookSignatureMode: "off",
  taxSystemCode: 1,
  defaultVatCode: 12,
  allowedLegacyVatCodes: [4, 6],
  sbpMaxAmount: 1_000_000,
  senderCompanyInfo: {
    inn: "1234567890",
    legalName: "ИП Соликаново",
    address: "г. Москва",
  },
};

describe("buildReceipt (055 FR-5540..5546)", () => {
  it("returns receipt with email-priority customer (FR-5544b)", () => {
    const order = {
      customer: { email: "user@example.com", phone: "+71234567890" },
      items: [{ title: "PDU XYZ", quantity: 1, price: 12_000 }],
    };
    const r = buildReceipt(order, baseSettings);
    expect(r.customer).toEqual({ email: "user@example.com" });
    expect(r.customer.phone).toBeUndefined();
  });

  it("falls back to phone when email missing", () => {
    const order = {
      customer: { phone: "+71234567890" },
      items: [{ title: "PDU XYZ", quantity: 1, price: 12_000 }],
    };
    const r = buildReceipt(order, baseSettings);
    expect(r.customer).toEqual({ phone: "+71234567890" });
  });

  it("normalizes phone to +7XXXXXXXXXX format", () => {
    const order = {
      customer: { phone: "8 (123) 456-78-90" },
      items: [{ title: "PDU XYZ", quantity: 1, price: 12_000 }],
    };
    const r = buildReceipt(order, baseSettings);
    expect(r.customer.phone).toBe("+71234567890");
  });

  it("throws if both email and phone missing (FR-5544b)", () => {
    const order = {
      customer: {},
      items: [{ title: "PDU XYZ", quantity: 1, price: 12_000 }],
    };
    expect(() => buildReceipt(order, baseSettings)).toThrow(/email or phone/);
  });

  it("uses default vat_code=12 (FR-5544, ФЗ-425)", () => {
    const order = {
      customer: { email: "u@e.com" },
      items: [{ title: "PDU", quantity: 2, price: 5_000 }],
    };
    const r = buildReceipt(order, baseSettings);
    expect(r.items[0]?.vat_code).toBe(12);
  });

  it("uses tax_system_code=1 (OQ-1 ОСН)", () => {
    const order = {
      customer: { email: "u@e.com" },
      items: [{ title: "PDU", quantity: 1, price: 1_000 }],
    };
    expect(buildReceipt(order, baseSettings).tax_system_code).toBe(1);
  });

  it("includes delivery as separate service item when delivery.cost > 0 (FR-5542)", () => {
    const order = {
      customer: { email: "u@e.com" },
      items: [{ title: "PDU", quantity: 1, price: 12_000 }],
      delivery: { cost: 650, tariffName: "СДЭК ПВЗ" },
    };
    const r = buildReceipt(order, baseSettings);
    expect(r.items.length).toBe(2);
    expect(r.items[1]?.description).toContain("Доставка");
    expect(r.items[1]?.payment_subject).toBe("service");
    expect(r.items[1]?.vat_code).toBe(12);
  });

  it("uses priceSnapshot over current price when available (047 chain)", () => {
    const order = {
      customer: { email: "u@e.com" },
      items: [
        { title: "PDU", quantity: 1, price: 999, priceSnapshot: { price: 12_000 } },
      ],
    };
    const r = buildReceipt(order, baseSettings);
    expect(r.items[0]?.amount.value).toBe("12000.00");
  });

  it("rejects vat_code outside {1..6, 11, 12}", () => {
    const bad: PaymentSettingsResolved = { ...baseSettings, defaultVatCode: 7 };
    const order = { customer: { email: "u@e.com" }, items: [{ title: "X", quantity: 1, price: 100 }] };
    expect(() => buildReceipt(order, bad)).toThrow(/vat_code/);
  });

  it("throws on empty items+delivery", () => {
    const order = { customer: { email: "u@e.com" }, items: [] };
    expect(() => buildReceipt(order, baseSettings)).toThrow(/no items/);
  });
});

describe("buildRefundReceipt (055 FR-5544c)", () => {
  it("uses vatCodeApplied from Order over defaultVatCode", () => {
    const order = { customer: { email: "u@e.com" } };
    const r = buildRefundReceipt({
      order,
      refundItems: [{ title: "PDU", quantity: 1, refundAmount: 5_000 }],
      vatCodeApplied: 11,
      settings: baseSettings,
    });
    expect(r.items[0]?.vat_code).toBe(11);
  });

  it("allows legacy vat_code=4 if in allowedLegacyVatCodes (FR-5544d)", () => {
    const order = { customer: { email: "u@e.com" } };
    const r = buildRefundReceipt({
      order,
      refundItems: [{ title: "PDU", quantity: 1, refundAmount: 5_000 }],
      vatCodeApplied: 4,
      settings: baseSettings, // allowedLegacyVatCodes: [4, 6]
    });
    expect(r.items[0]?.vat_code).toBe(4);
  });

  it("throws on legacy vat_code if not in allowedLegacyVatCodes", () => {
    const settings: PaymentSettingsResolved = { ...baseSettings, allowedLegacyVatCodes: [] };
    const order = { customer: { email: "u@e.com" } };
    expect(() =>
      buildRefundReceipt({
        order,
        refundItems: [{ title: "PDU", quantity: 1, refundAmount: 5_000 }],
        vatCodeApplied: 4,
        settings,
      }),
    ).toThrow(/legacy vat_code/);
  });
});
