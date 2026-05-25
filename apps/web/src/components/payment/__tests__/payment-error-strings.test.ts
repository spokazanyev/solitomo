import { describe, expect, it } from "vitest";

import {
  PAYMENT_ERROR_STRINGS,
  resolvePaymentError,
} from "../payment-error-strings";

describe("resolvePaymentError (056 T006)", () => {
  it("returns dedicated entry for YOOKASSA_UNAVAILABLE", () => {
    const result = resolvePaymentError("YOOKASSA_UNAVAILABLE");
    expect(result.title).toContain("Платёжная система");
    expect(result.ctaLabel).toBe("Вернуться в корзину");
    expect(result.ctaHref).toBe("/cart/");
  });

  it("returns dedicated entry for INVALID_ORDER_STATUS", () => {
    const result = resolvePaymentError("INVALID_ORDER_STATUS");
    expect(result.title).toContain("повторно");
    // ctaHref empty — caller populates dynamically
    expect(result.ctaHref).toBe("");
  });

  it("returns dedicated entry for ORDER_NOT_FOUND", () => {
    const result = resolvePaymentError("ORDER_NOT_FOUND");
    expect(result.title).toContain("не найден");
    expect(result.ctaHref).toBe("/catalog/");
  });

  it("returns FORBIDDEN entry with login CTA", () => {
    const result = resolvePaymentError("FORBIDDEN");
    expect(result.ctaLabel).toBe("Войти");
    expect(result.ctaHref).toBe("/me/login");
  });

  it("falls back to UNKNOWN for unregistered code", () => {
    const result = resolvePaymentError("SOME_NEW_CODE_NOT_IN_DICT");
    expect(result).toBe(PAYMENT_ERROR_STRINGS.UNKNOWN);
  });

  it("falls back to UNKNOWN for null", () => {
    expect(resolvePaymentError(null)).toBe(PAYMENT_ERROR_STRINGS.UNKNOWN);
  });

  it("falls back to UNKNOWN for undefined", () => {
    expect(resolvePaymentError(undefined)).toBe(PAYMENT_ERROR_STRINGS.UNKNOWN);
  });

  it("falls back to UNKNOWN for empty string", () => {
    expect(resolvePaymentError("")).toBe(PAYMENT_ERROR_STRINGS.UNKNOWN);
  });

  it("all entries have non-empty title and description", () => {
    for (const [code, entry] of Object.entries(PAYMENT_ERROR_STRINGS)) {
      expect(entry.title, `${code}.title`).not.toBe("");
      expect(entry.description, `${code}.description`).not.toBe("");
      expect(entry.ctaLabel, `${code}.ctaLabel`).not.toBe("");
    }
  });
});
