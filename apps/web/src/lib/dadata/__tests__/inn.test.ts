/**
 * Unit-тесты для isValidInn — FR-007/FR-008.
 *
 * Покрывают тест-таблицу из contracts/inn-validation.md:
 * валидные/невалидные контрольные суммы, неверная длина, не-цифры, пустая строка.
 */
import { describe, expect, it } from "vitest";

import { isValidInn } from "../inn";

describe("isValidInn", () => {
  it("принимает валидный 10-значный ИНН (юрлицо)", () => {
    expect(isValidInn("7707083893")).toBe(true);
  });

  it("принимает валидный 12-значный ИНН (ИП/физлицо)", () => {
    expect(isValidInn("500100732259")).toBe(true);
  });

  it("отклоняет 10-значный ИНН с неверной контрольной цифрой", () => {
    expect(isValidInn("7707083894")).toBe(false);
  });

  it("отклоняет 12-значный ИНН с неверной контрольной цифрой", () => {
    expect(isValidInn("500100732250")).toBe(false);
  });

  it("отклоняет 9 цифр (короткий)", () => {
    expect(isValidInn("123456789")).toBe(false);
  });

  it("отклоняет 11 цифр (между 10 и 12)", () => {
    expect(isValidInn("12345678901")).toBe(false);
  });

  it("отклоняет не-цифры", () => {
    expect(isValidInn("abcdefghij")).toBe(false);
  });

  it("отклоняет пустую строку", () => {
    expect(isValidInn("")).toBe(false);
  });
});
