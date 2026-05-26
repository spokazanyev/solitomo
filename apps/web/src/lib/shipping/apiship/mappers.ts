import type {
  CalculationInput,
  DeliveryTypeCode,
  OrderForShipment,
  PickupPoint,
  PointsInput,
  ShippingRate,
} from "../types";
import type {
  CalculatorRequest,
  CalculatorRequestPlace,
  OrderRequest,
  PointObject,
  TariffObject,
} from "./client";
import type { ApiShipSettings } from "./settings";

const DELIVERY_TYPE_MAP: Record<
  DeliveryTypeCode,
  { deliveryType: 1 | 2; pickupType: 1 | 2 }
> = {
  doortodoor: { deliveryType: 1, pickupType: 1 },
  doortopoint: { deliveryType: 2, pickupType: 1 },
  pointtodoor: { deliveryType: 1, pickupType: 2 },
  pointtopoint: { deliveryType: 2, pickupType: 2 },
};

/** Извлечь 6-значный почтовый индекс из произвольной строки адреса. */
function extractPostIndex(address: string): string | undefined {
  const m = address.match(/\b(\d{6})\b/);
  return m ? m[1] : undefined;
}

/** Извлечь название города после «г.» / «г » из строки адреса. */
function extractCity(address: string): string | undefined {
  const m = address.match(/г\.?\s+([А-ЯЁа-яё-]+)/u);
  return m ? m[1] : undefined;
}

export function toCalculatorRequest(
  input: CalculationInput,
  type: DeliveryTypeCode,
  settings: ApiShipSettings,
): CalculatorRequest {
  const { deliveryType } = DELIVERY_TYPE_MAP[type];

  // ApiShip calculator требует структурированный адрес отправителя (city или postIndex),
  // а не сырую строку — иначе возвращает 400. Парсим из addressString.
  const senderAddr = settings.sender.addressString ?? "";
  const fromPlace: CalculatorRequestPlace = {
    countryCode: settings.sender.countryCode || "RU",
    ...(extractPostIndex(senderAddr) ? { postIndex: extractPostIndex(senderAddr) } : {}),
    ...(extractCity(senderAddr) ? { city: extractCity(senderAddr) } : {}),
  };

  // 060: формируем массив places через flatMap c экспансией по quantity.
  // Каждая единица товара = отдельное место (FR-007). Физические параметры
  // берутся per-axis из item (если заполнены в каталоге), иначе fallback на
  // settings.defaults. Размеры конвертируются из мм (хранение) в см (ApiShip).
  const places = input.items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => buildCalculatorPlace(item, settings)),
  );

  return {
    from: fromPlace,
    to: {
      countryCode: input.address.countryCode || "RU",
      city: input.address.city,
      postIndex: input.address.postalCode,
      address: input.address.addressString,
    },
    places,
    // senderPickupType из настроек admin-панели:
    //   "courier"  → СДЭК приезжает к отправителю (pickupType=1, тарифы «дверь→»)
    //   "dropoff"  → отправитель сам везёт в офис СДЭК (pickupType=2, тарифы «склад→»)
    pickupTypes: [settings.senderPickupType === "courier" ? 1 : 2],
    deliveryTypes: [deliveryType],
    includeFees: 1,
  };
}

/**
 * 060: построить одно «место» для запроса в ApiShip /calculator.
 *
 * - cost = item.price (per-place, не price*quantity — quantity отражается
 *   через количество вызовов).
 * - weight в граммах: item.weightGrams ?? settings.defaults.weight.
 * - length/width/height: item.{length,width,height}Mm / 10 → см, clamp ≥1 см.
 *   Если поле не задано — берётся defaults.* (которые уже хранятся в см).
 */
function buildCalculatorPlace(
  item: CalculationInput["items"][number],
  settings: ApiShipSettings,
) {
  const toCm = (mm: number | undefined, fallbackCm: number): number =>
    mm != null ? Math.max(1, Math.round(mm / 10)) : fallbackCm;
  return {
    cost: item.price,
    weight: item.weightGrams ?? settings.defaults.weight,
    length: toCm(item.lengthMm, settings.defaults.length),
    width: toCm(item.widthMm, settings.defaults.width),
    height: toCm(item.heightMm, settings.defaults.height),
  };
}

export function toShippingRate(
  tariff: TariffObject,
  type: DeliveryTypeCode,
  variant: "cheapest" | "fastest" = "cheapest",
): ShippingRate {
  const { deliveryType, pickupType } = DELIVERY_TYPE_MAP[type];
  return {
    shippingOptionId: `apiship_${type}_${variant}`,
    providerKey: tariff.providerKey ?? "unknown",
    providerName: providerNameFromKey(tariff.providerKey),
    tariffId: tariff.tariffId ?? tariff.id,
    tariffName: tariff.name ?? tariff.tariffName,
    deliveryType,
    pickupType,
    cost: Number(tariff.deliveryCost ?? 0),
    currency: "RUB",
    etaMinDays: Number(tariff.daysMin ?? 1),
    etaMaxDays: Number(tariff.daysMax ?? 5),
    rawTariff: tariff,
  };
}

/**
 * Выбрать из массива тарифов два лучших для заданного типа доставки:
 * - cheapest: наименьшая стоимость
 * - fastest:  наименьшее время (daysMin)
 *
 * Если cheapest === fastest (один и тот же тарифId), fastest будет совпадать с cheapest —
 * вызывающий код должен отдедуплицировать по tariffId.
 */
export function pickBestTariffs(
  tariffs: TariffObject[],
  type: DeliveryTypeCode,
): { cheapest?: TariffObject; fastest?: TariffObject } {
  const { deliveryType, pickupType } = DELIVERY_TYPE_MAP[type];
  const candidates = tariffs
    .filter((t) => !t.isError)
    .filter((t) => (t.deliveryType ?? deliveryType) === deliveryType)
    .filter((t) => (t.pickupType ?? pickupType) === pickupType);

  if (!candidates.length) return {};

  const cheapest = candidates.reduce((best, t) =>
    Number(t.deliveryCost ?? Infinity) < Number(best.deliveryCost ?? Infinity) ? t : best,
  );
  const fastest = candidates.reduce((best, t) =>
    Number(t.daysMin ?? Infinity) < Number(best.daysMin ?? Infinity) ? t : best,
  );
  return { cheapest, fastest };
}

function providerNameFromKey(key?: string): string | undefined {
  if (!key) return undefined;
  const map: Record<string, string> = {
    cdek: "СДЭК",
    boxberry: "Boxberry",
    russianpost: "Почта России",
    "russian-post": "Почта России",
    pochta: "Почта России",
    dpd: "DPD",
    yandex: "Яндекс Доставка",
    "yandex-delivery": "Яндекс Доставка",
    pickpoint: "PickPoint",
    iml: "IML",
    dellin: "Деловые Линии",
  };
  return map[key] ?? key;
}


export function toOrderRequest(
  order: OrderForShipment,
  settings: ApiShipSettings,
): OrderRequest {
  const totalCost = order.totals.total;

  // 060: формируем places через flatMap — каждая единица товара = отдельное
  // место (FR-007). Симметрично с toCalculatorRequest, чтобы расчёт показанной
  // клиенту цены и реальная отправка использовали одни и те же физпараметры
  // (FR-008). Конверсия мм → см для размеров.
  const toCm = (mm: number | undefined, fallbackCm: number): number =>
    mm != null ? Math.max(1, Math.round(mm / 10)) : fallbackCm;

  const places: OrderRequest["places"] = order.items.flatMap((item) => {
    const weight = item.weightGrams ?? settings.defaults.weight;
    const length = toCm(item.lengthMm, settings.defaults.length);
    const width = toCm(item.widthMm, settings.defaults.width);
    const height = toCm(item.heightMm, settings.defaults.height);
    const description = item.name ?? item.sku;
    return Array.from({ length: item.quantity }, () => ({
      description,
      height,
      length,
      width,
      weight,
      items: [
        {
          description,
          quantity: 1, // каждое место содержит одну единицу
          cost: item.price,
          weight,
        },
      ],
    }));
  });

  // Total order.weight — сумма веса всех мест.
  const weight = places.reduce((sum, p) => sum + (p.weight ?? 0), 0);

  const receiverAddress =
    order.delivery.address?.addressString ??
    [
      order.delivery.address?.postalCode,
      order.delivery.address?.city,
      order.delivery.address?.street,
      order.delivery.address?.house,
      order.delivery.address?.flat,
    ]
      .filter(Boolean)
      .join(", ");

  return {
    order: {
      clientNumber: order.id,
      description: `Soliton order ${order.id}`,
      pickupType: order.delivery.pickupType,
      deliveryType: order.delivery.deliveryType,
      pointOutId: order.delivery.pointId,
      weight,
      length: settings.defaults.length,
      width: settings.defaults.width,
      height: settings.defaults.height,
    },
    cost: {
      cost: totalCost,
      assessedCost: order.totals.subtotal,
      deliveryCost: order.delivery.cost,
      deliveryCostVat: settings.defaults.deliveryCostVat as OrderRequest["cost"]["deliveryCostVat"],
    },
    sender: {
      countryCode: settings.sender.countryCode,
      addressString: settings.sender.addressString,
      contactName: settings.sender.contactName,
      phone: settings.sender.phone,
    },
    recipient: {
      countryCode: order.delivery.address?.countryCode ?? "RU",
      addressString: receiverAddress,
      fullName: order.customer.fullName ?? order.customer.companyName ?? "",
      email: order.customer.email,
      phone: order.customer.phone,
    },
    providerKey: order.delivery.providerKey,
    tariffId: order.delivery.tariffId,
    places,
  };
}

export function toPickupPoints(rows: PointObject[], input: PointsInput): PickupPoint[] {
  const filtered = rows
    .map((row) => ({
      pointId: String(row.id ?? ""),
      providerKey: row.providerKey ?? input.providerKey,
      name: row.name,
      address: row.address ?? "",
      city: row.city,
      postalCode: row.postIndex,
      lat: row.lat,
      lon: row.lng,
      workHours: row.timetable,
      phone: row.phone,
      paymentMethods: [
        row.cashPayment ? "cash" : null,
        row.cardPayment ? "card" : null,
      ].filter((x): x is "cash" | "card" => x != null),
      maxDimensions: {
        length: row.maxLength,
        width: row.maxWidth,
        height: row.maxHeight,
        weight: row.maxWeight,
      },
    }))
    .filter((p) => p.pointId && p.address);

  if (input.maxDimensions || input.maxWeightGrams) {
    return filtered.filter((p) => {
      const max = p.maxDimensions;
      if (!max) return true;
      if (
        input.maxDimensions &&
        max.length &&
        max.length < input.maxDimensions.length
      )
        return false;
      if (input.maxDimensions && max.width && max.width < input.maxDimensions.width)
        return false;
      if (input.maxDimensions && max.height && max.height < input.maxDimensions.height)
        return false;
      if (input.maxWeightGrams && max.weight && max.weight < input.maxWeightGrams)
        return false;
      return true;
    });
  }

  return filtered;
}
