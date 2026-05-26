import { describe, it, expect } from "vitest";

import type {
  CalculationInput,
  OrderForShipment,
  PointsInput,
} from "../../types";
import type { ApiShipSettings } from "../settings";
import type { PointObject, TariffObject } from "../client";
import {
  pickBestTariffs,
  toCalculatorRequest,
  toOrderRequest,
  toPickupPoints,
  toShippingRate,
} from "../mappers";

const SETTINGS: ApiShipSettings = {
  enabled: true,
  isTest: true,
  token: "tok",
  webhookSecret: "secret",
  baseUrl: "http://api.dev.apiship.ru/v1",
  senderPickupType: "dropoff",
  senderDropoffAddress: "",
  sender: {
    countryCode: "RU",
    // Адрес с индексом — нужен для toCalculatorRequest (parses postIndex)
    addressString: "620034, г. Екатеринбург, ул. Щорса, д. 7",
    contactName: "Иван Соликс",
    phone: "+7 999 000 00 00",
  },
  defaults: {
    length: 30,
    width: 20,
    height: 15,
    weight: 1500,
    deliveryCostVat: "20",
    isCod: false,
  },
  disabledProviders: [],
  allowedDeliveryTypes: ["doortodoor", "doortopoint"],
  yandexMaps: { apiKey: "", tariffPlan: "free" },
  dadata: { apiKey: "", secret: "", tariffPlan: "free", cacheTtlDays: 30 },
  lifecycle: {
    closureWindowDays: 14,
    paymentRetryWindowMin: 30,
    invoiceExpiresDays: 5,
    stuckThresholdHours: { paid: 48, fulfilling: 48, shipped: 72, atPoint: 96 },
    priceMismatchTolerance: { percent: 5, absoluteR: 100 },
  },
};

describe("toCalculatorRequest", () => {
  it("pickupTypes берётся из senderPickupType, не из delivery type code", () => {
    const input: CalculationInput = {
      cartId: "c1",
      address: {
        countryCode: "RU",
        city: "Санкт-Петербург",
        postalCode: "190000",
        addressString: "СПб, Невский 1",
      },
      items: [{ sku: "A", quantity: 2, price: 1000, weight: 500 }],
    };

    // senderPickupType="dropoff" → всегда pickupTypes=[2], независимо от delivery type code
    const req = toCalculatorRequest(input, "doortodoor", SETTINGS);

    expect(req.pickupTypes).toEqual([2]);
    expect(req.deliveryTypes).toEqual([1]);
    expect(req.from?.countryCode).toBe("RU");
    expect(req.from?.postIndex).toBe("620034");
    expect(req.from?.city).toBe("Екатеринбург");
    expect(req.to.city).toBe("Санкт-Петербург");
    expect(req.places).toHaveLength(1);
    expect(req.places[0]).toMatchObject({ cost: 2000, weight: 500 });
    expect(req.includeFees).toBe(1);
  });

  it("courier senderPickupType → pickupTypes=[1]", () => {
    const courierSettings: ApiShipSettings = { ...SETTINGS, senderPickupType: "courier" };
    const input: CalculationInput = {
      cartId: "c2",
      address: { countryCode: "RU", city: "Москва" },
      items: [{ sku: "B", quantity: 1, price: 500 }],
    };
    const req = toCalculatorRequest(input, "doortopoint", courierSettings);
    expect(req.pickupTypes).toEqual([1]);
    expect(req.deliveryTypes).toEqual([2]);
  });

  it("falls back to settings.defaults when item lacks dims/weight", () => {
    const input: CalculationInput = {
      cartId: "c3",
      address: { countryCode: "RU", city: "Москва" },
      items: [{ sku: "B", quantity: 1, price: 500 }],
    };
    const req = toCalculatorRequest(input, "doortopoint", SETTINGS);
    expect(req.places[0]).toEqual({
      cost: 500,
      weight: SETTINGS.defaults.weight,
      length: SETTINGS.defaults.length,
      width: SETTINGS.defaults.width,
      height: SETTINGS.defaults.height,
    });
  });
});

describe("toShippingRate", () => {
  it("shippingOptionId включает variant (cheapest по умолчанию)", () => {
    const tariff: TariffObject = {
      tariffId: 101,
      providerKey: "cdek",
      name: "СДЭК Посылка",
      deliveryCost: 450,
      daysMin: 2,
      daysMax: 5,
    };

    const rate = toShippingRate(tariff, "pointtodoor");

    expect(rate.shippingOptionId).toBe("apiship_pointtodoor_cheapest");
    expect(rate.providerKey).toBe("cdek");
    expect(rate.providerName).toBe("СДЭК");
    expect(rate.tariffId).toBe(101);
    expect(rate.deliveryType).toBe(1);
    expect(rate.pickupType).toBe(2);
    expect(rate.cost).toBe(450);
    expect(rate.currency).toBe("RUB");
    expect(rate.etaMinDays).toBe(2);
    expect(rate.etaMaxDays).toBe(5);
    expect(rate.rawTariff).toBe(tariff);
  });

  it("shippingOptionId с вариантом fastest", () => {
    const tariff: TariffObject = { tariffId: 200, providerKey: "cdek", deliveryCost: 600, daysMin: 1 };
    const rate = toShippingRate(tariff, "doortodoor", "fastest");
    expect(rate.shippingOptionId).toBe("apiship_doortodoor_fastest");
  });
});

describe("pickBestTariffs", () => {
  const tariffs: TariffObject[] = [
    { tariffId: 1, providerKey: "cdek", deliveryCost: 500, deliveryType: 1, pickupType: 1, daysMin: 3 },
    { tariffId: 2, providerKey: "cdek", deliveryCost: 350, deliveryType: 1, pickupType: 1, daysMin: 5 },
    { tariffId: 3, providerKey: "cdek", deliveryCost: 420, deliveryType: 1, pickupType: 1, daysMin: 1 },
    { tariffId: 4, providerKey: "cdek", deliveryCost: 100, deliveryType: 2, pickupType: 2, daysMin: 2 },
    { tariffId: 5, providerKey: "dpd",  deliveryCost: 250, deliveryType: 1, pickupType: 1, isError: true },
  ];

  it("возвращает cheapest по стоимости и fastest по daysMin", () => {
    const { cheapest, fastest } = pickBestTariffs(tariffs, "doortodoor");
    expect(cheapest?.tariffId).toBe(2); // 350₽
    expect(fastest?.tariffId).toBe(3);  // 1 день
  });

  it("игнорирует ошибочные тарифы", () => {
    const errTariffs: TariffObject[] = [
      { tariffId: 1, deliveryCost: 100, deliveryType: 1, pickupType: 1, isError: true },
    ];
    const { cheapest, fastest } = pickBestTariffs(errTariffs, "doortodoor");
    expect(cheapest).toBeUndefined();
    expect(fastest).toBeUndefined();
  });

  it("возвращает {} если нет подходящих тарифов", () => {
    // doortopoint = deliveryType=2, pickupType=1; в tariffs только tariff 4 = deliveryType=2, pickupType=2 — не совпадает
    const { cheapest } = pickBestTariffs(tariffs, "doortopoint");
    expect(cheapest).toBeUndefined();
  });
});

describe("toOrderRequest", () => {
  it("maps recipient and places correctly", () => {
    const order: OrderForShipment = {
      id: "ORD-1",
      customer: {
        fullName: "Анна Иванова",
        email: "anna@example.com",
        phone: "+7 921 111 22 33",
      },
      delivery: {
        provider: "apiship",
        providerKey: "cdek",
        tariffId: 99,
        deliveryType: 1,
        pickupType: 1,
        cost: 350,
        address: {
          countryCode: "RU",
          city: "СПб",
          street: "Невский",
          house: "1",
          postalCode: "190000",
          isValid: true,
          addressString: "СПб, Невский 1",
        },
      },
      items: [
        { sku: "A", name: "Чай", quantity: 2, price: 500, weight: 300 },
        { sku: "B", quantity: 1, price: 200 },
      ],
      totals: { subtotal: 1200, vat: 200, total: 1400 },
    };

    const req = toOrderRequest(order, SETTINGS);

    expect(req.order.clientNumber).toBe("ORD-1");
    expect(req.order.pickupType).toBe(1);
    expect(req.order.deliveryType).toBe(1);
    expect(req.order.weight).toBe(300 * 2 + SETTINGS.defaults.weight);
    expect(req.cost.cost).toBe(1400);
    expect(req.cost.assessedCost).toBe(1200);
    expect(req.cost.deliveryCost).toBe(350);
    expect(req.cost.deliveryCostVat).toBe(SETTINGS.defaults.deliveryCostVat);
    expect(req.sender.contactName).toBe(SETTINGS.sender.contactName);
    expect(req.recipient.fullName).toBe("Анна Иванова");
    expect(req.recipient.email).toBe("anna@example.com");
    expect(req.recipient.addressString).toBe("СПб, Невский 1");
    expect(req.providerKey).toBe("cdek");
    expect(req.tariffId).toBe(99);
    expect(req.places).toHaveLength(2);
    expect(req.places[0]).toMatchObject({ description: "Чай", weight: 300 });
    expect(req.places[0].items?.[0]).toMatchObject({ description: "Чай", quantity: 2, cost: 500 });
  });
});

describe("toPickupPoints", () => {
  const input: PointsInput = {
    cartId: "c1",
    shippingOptionId: "apiship_doortopoint_cheapest",
    providerKey: "cdek",
    city: "Москва",
    maxDimensions: { length: 40, width: 30, height: 20 },
    maxWeightGrams: 5000,
  };

  it("converts API rows to PickupPoint shape and filters by max dimensions", () => {
    const rows: PointObject[] = [
      {
        id: "p1",
        providerKey: "cdek",
        name: "СДЭК Тверская",
        address: "Москва, Тверская 5",
        city: "Москва",
        maxLength: 100,
        maxWidth: 80,
        maxHeight: 60,
        maxWeight: 20000,
        cashPayment: true,
        cardPayment: true,
      },
      {
        id: "p2",
        providerKey: "cdek",
        name: "Слишком маленький ПВЗ",
        address: "Москва, Малая 1",
        maxLength: 10,
        maxWidth: 10,
        maxHeight: 10,
        maxWeight: 1000,
      },
      {
        // отсутствует address — должно быть отфильтровано
        id: "p3",
        providerKey: "cdek",
        name: "Без адреса",
      },
    ];

    const points = toPickupPoints(rows, input);

    expect(points).toHaveLength(1);
    expect(points[0].pointId).toBe("p1");
    expect(points[0].paymentMethods).toEqual(["cash", "card"]);
    expect(points[0].maxDimensions).toEqual({ length: 100, width: 80, height: 60, weight: 20000 });
  });

  it("returns all points (filtered for required fields) when no constraints", () => {
    const rows: PointObject[] = [
      { id: "p1", providerKey: "cdek", address: "addr1" },
      { id: "p2", providerKey: "cdek", address: "" },
    ];
    const points = toPickupPoints(rows, {
      cartId: "c",
      shippingOptionId: "apiship_doortopoint_cheapest",
      providerKey: "cdek",
      city: "Москва",
    });
    expect(points).toHaveLength(1);
    expect(points[0].pointId).toBe("p1");
  });
});
