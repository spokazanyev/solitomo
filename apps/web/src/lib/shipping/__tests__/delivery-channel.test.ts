/**
 * 064 — Unit-тесты для normalizeDeliveryChannel / resolveProviderName.
 * Покрывают таблицу правил из data-model.md §2 (FR-002/004/006/009/010, edge cases).
 */
import { describe, expect, it } from "vitest";

import {
  isDeliveryChannel,
  normalizeDeliveryChannel,
  resolveProviderName,
} from "../delivery-channel";

describe("isDeliveryChannel", () => {
  it("принимает только закрытый набор", () => {
    expect(isDeliveryChannel("pickup")).toBe(true);
    expect(isDeliveryChannel("service")).toBe(true);
    expect(isDeliveryChannel("own_carrier")).toBe(true);
    expect(isDeliveryChannel("cdek")).toBe(false);
    expect(isDeliveryChannel("")).toBe(false);
    expect(isDeliveryChannel(undefined)).toBe(false);
    expect(isDeliveryChannel(null)).toBe(false);
  });
});

describe("normalizeDeliveryChannel", () => {
  it("доверяет присланному валидному channel", () => {
    expect(normalizeDeliveryChannel({ channel: "service", providerKey: "dpd" })).toBe("service");
    expect(normalizeDeliveryChannel({ channel: "pickup" })).toBe("pickup");
    expect(normalizeDeliveryChannel({ channel: "own_carrier" })).toBe("own_carrier");
  });

  it("service для перевозчика вне прежних трёх (по присланному channel)", () => {
    expect(normalizeDeliveryChannel({ channel: "service", providerKey: "dellin" })).toBe("service");
    expect(normalizeDeliveryChannel({ channel: "service", providerKey: "iml" })).toBe("service");
  });

  it("выводит pickup/own_carrier из legacy method", () => {
    expect(normalizeDeliveryChannel({ method: "pickup" })).toBe("pickup");
    expect(normalizeDeliveryChannel({ method: "own_carrier" })).toBe("own_carrier");
    expect(normalizeDeliveryChannel({ method: "tc" })).toBe("own_carrier");
  });

  it("выводит service по наличию providerKey/tariffId (нет channel)", () => {
    expect(normalizeDeliveryChannel({ providerKey: "dpd" })).toBe("service");
    expect(normalizeDeliveryChannel({ tariffId: 123 })).toBe("service");
  });

  it("старый фронт: method = providerKey → service", () => {
    expect(normalizeDeliveryChannel({ method: "cdek" })).toBe("service");
    expect(normalizeDeliveryChannel({ method: "dellin" })).toBe("service");
  });

  it("безопасный fallback pickup при пустом теле", () => {
    expect(normalizeDeliveryChannel({})).toBe("pickup");
    expect(normalizeDeliveryChannel({ channel: "" })).toBe("pickup");
    expect(normalizeDeliveryChannel({ channel: "bogus" })).toBe("pickup");
  });
});

describe("resolveProviderName", () => {
  it("возвращает присланное имя приоритетно", () => {
    expect(resolveProviderName("Деловые Линии", "dellin")).toBe("Деловые Линии");
  });

  it("маппит код в имя при отсутствии имени", () => {
    expect(resolveProviderName(undefined, "dpd")).toBe("DPD");
    expect(resolveProviderName("", "dellin")).toBe("Деловые Линии");
    expect(resolveProviderName(null, "cdek")).toBe("СДЭК");
  });

  it("fallback на сам код для незнакомой службы (FR-006)", () => {
    expect(resolveProviderName(undefined, "some-new-carrier")).toBe("some-new-carrier");
  });

  it("«служба доставки» при пустом/unknown коде (FR-009)", () => {
    expect(resolveProviderName(undefined, undefined)).toBe("служба доставки");
    expect(resolveProviderName("", "")).toBe("служба доставки");
    expect(resolveProviderName(null, "unknown")).toBe("служба доставки");
  });
});
