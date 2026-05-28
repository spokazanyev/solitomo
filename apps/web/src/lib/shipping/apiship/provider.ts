import "server-only";

import { createHash } from "node:crypto";

import { CalculatorApi, Configuration, ListsApi, OrderDocsApi, OrdersApi } from "./client";
import { getCalculation, saveCalculation } from "./cache";
import { logError, logRequest } from "./logger";
import { pickBestTariffs, toCalculatorRequest, toOrderRequest, toPickupPoints, toShippingRate } from "./mappers";
import { executeWithRetry } from "./retry";
import { type ApiShipSettings, loadSettings } from "./settings";
import { mapApiShipStatus } from "./status-map";
import type {
  CalculationInput,
  DeliveryTypeCode,
  OrderForShipment,
  PickupPoint,
  PointsInput,
  ShipmentInfo,
  ShippingCalculationResult,
  ShippingProvider,
  ShippingRate,
} from "../types";

const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Стабильный 16-hex-символьный fingerprint от полей, влияющих на стоимость доставки:
 * адрес получателя + items (вес/габариты/цена/кол-во). Используется в cache key,
 * чтобы при смене адреса или состава корзины не возвращался устаревший расчёт.
 *
 * До этого ключ был `apiship:calc:{cartId}:{type}` — при смене адреса в той же
 * корзине отдавалась старая цена (баг — Москва-цена вместо Екатеринбург-цены).
 */
function calcInputFingerprint(input: CalculationInput): string {
  const payload = JSON.stringify({
    a: {
      cc: input.address.countryCode ?? "",
      pc: input.address.postalCode ?? "",
      ct: input.address.city ?? "",
      rg: input.address.region ?? "",
      ad: input.address.addressString ?? "",
    },
    i: input.items.map((it) => ({
      p: it.price,
      q: it.quantity,
      w: it.weightGrams ?? null,
      l: it.lengthMm ?? null,
      wd: it.widthMm ?? null,
      h: it.heightMm ?? null,
    })),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export class ApiShipProvider implements ShippingProvider {
  public readonly code = "apiship" as const;

  private constructor(
    private readonly settings: ApiShipSettings,
    private readonly apis: {
      orders: OrdersApi;
      docs: OrderDocsApi;
      lists: ListsApi;
      calculator: CalculatorApi;
    },
  ) {}

  static async create(): Promise<ApiShipProvider | null> {
    const settings = await loadSettings();
    if (!settings.enabled || !settings.token) return null;

    const config: Configuration = { basePath: settings.baseUrl, apiKey: settings.token };
    return new ApiShipProvider(settings, {
      orders: new OrdersApi(config),
      docs: new OrderDocsApi(config),
      lists: new ListsApi(config),
      calculator: new CalculatorApi(config),
    });
  }

  async isReady(): Promise<boolean> {
    try {
      await this.apis.lists.getServices({ limit: 1, offset: 0 });
      return true;
    } catch {
      return false;
    }
  }

  async calculate(input: CalculationInput): Promise<ShippingCalculationResult> {
    const types: DeliveryTypeCode[] =
      input.deliveryTypes ?? this.settings.allowedDeliveryTypes;

    const rates: ShippingRate[] = [];
    const warnings: string[] = [];
    const disabled = new Set(this.settings.disabledProviders);

    // Fingerprint всего input — чтобы кеш инвалидировался при смене адреса / товаров.
    const fp = calcInputFingerprint(input);

    // Реальный ApiShip API возвращает разделённые массивы по типу доставки,
    // legacy-форма (`tariffs[]`) поддерживается на всякий случай.
    const { flattenCalculatorTariffs } = await import("./client");
    const countTariffs = (raw: unknown) =>
      flattenCalculatorTariffs(raw as Parameters<typeof flattenCalculatorTariffs>[0]).length;

    for (const type of types) {
      const cacheKey = `apiship:calc:${input.cartId}:${type}:${fp}`;
      let raw = (await getCalculation(cacheKey)) as
        | { deliveryToDoor?: unknown[]; deliveryToPoint?: unknown[]; tariffs?: unknown[] }
        | null;
      if (!raw) {
        try {
          const req = toCalculatorRequest(input, type, this.settings);
          let { data } = await this.apis.calculator.getCalculator({ calculatorRequest: req });
          await logRequest("calculator.get", { input: req, output: data });

          // 047 fix: ApiShip/СДЭК недетерминированно возвращает ПУСТОЙ список
          // тарифов (особенно для ПВЗ, deliveryType=2) — см. инцидент с заказом
          // #12 (лог 168 вернул пункты, лог 170 — пустой `tariffs:[]`). Один
          // retry почти всегда даёт полный список. Без этого DeliveryBlock
          // показывает только курьера, теряя ПВЗ.
          if (countTariffs(data) === 0) {
            try {
              const retry = await this.apis.calculator.getCalculator({ calculatorRequest: req });
              await logRequest("calculator.get(retry-empty)", { input: req, output: retry.data });
              if (countTariffs(retry.data) > 0) data = retry.data;
            } catch (retryErr) {
              await logError(`calculator.get(${type}) retry`, retryErr);
            }
          }

          raw = data;
          // 047 fix: НЕ кэшируем пустой ответ — иначе залипший пустой результат
          // ApiShip держится весь CACHE_TTL и убивает ПВЗ для всех следующих
          // расчётов с тем же fingerprint. Кэшируем только непустой.
          if (countTariffs(data) > 0) {
            await saveCalculation(cacheKey, data, CACHE_TTL_MS);
          }
        } catch (err) {
          await logError(`calculator.get(${type})`, err);
          warnings.push(`Не удалось рассчитать «${type}»`);
          continue;
        }
      }
      const tariffs = flattenCalculatorTariffs(raw as Parameters<typeof flattenCalculatorTariffs>[0]);

      // Для каждого delivery-type кода выбираем два лучших тарифа:
      // cheapest (дешевле) и fastest (быстрее).
      const { cheapest, fastest } = pickBestTariffs(tariffs, type);
      if (cheapest) {
        const pk = String(cheapest.providerKey ?? "");
        if (!disabled.has(pk)) rates.push(toShippingRate(cheapest, type, "cheapest"));
      }
      // Добавляем fastest только если это другой тариф.
      if (fastest && fastest !== cheapest) {
        const pk = String(fastest.providerKey ?? "");
        if (!disabled.has(pk)) rates.push(toShippingRate(fastest, type, "fastest"));
      }
    }

    // Дедупликация: для каждой пары (deliveryType, variant) оставляем лучший.
    // Это схлопывает doortodoor+pointtodoor → 1 «курьером» (дешевле) + 1 «курьером» (быстрее).
    const cheapestByType = new Map<number, ShippingRate>();
    const fastestByType  = new Map<number, ShippingRate>();
    for (const rate of rates) {
      const isFastest = rate.shippingOptionId.includes("_fastest");
      if (isFastest) {
        const ex = fastestByType.get(rate.deliveryType);
        if (!ex || rate.etaMinDays < ex.etaMinDays) fastestByType.set(rate.deliveryType, rate);
      } else {
        const ex = cheapestByType.get(rate.deliveryType);
        if (!ex || rate.cost < ex.cost) cheapestByType.set(rate.deliveryType, rate);
      }
    }

    // Финальный список: сначала курьер (deliveryType=1), потом ПВЗ (deliveryType=2).
    // Внутри группы: сначала cheapest, потом fastest (только если другой тарифId).
    const deduped: ShippingRate[] = [];
    for (const [dt, cheapest] of [...cheapestByType.entries()].sort(([a], [b]) => a - b)) {
      deduped.push(cheapest);
      const fastest = fastestByType.get(dt);
      if (fastest && fastest.tariffId !== cheapest.tariffId) {
        deduped.push(fastest);
      }
    }

    annotateBadges(deduped);
    return { cachedAt: new Date().toISOString(), rates: deduped, warnings };
  }

  async getPickupPoints(input: PointsInput): Promise<PickupPoint[]> {
    // ApiShip /v1/lists/points does NOT support city/geo server-side filters —
    // every filter format (JSON, query-string, FIAS GUID, bounding box) is
    // silently ignored; the API always returns the full sorted list.
    // The only working server-side filter is `providerKey`.
    //
    // Strategy: cache the city-specific PointObject[] in Payload for 12 h.
    //   • Cache miss → fetch all provider points (limit=5000, 1 request),
    //     filter by city in-process, persist filtered rows to cache.
    //   • Cache hit  → return cached rows instantly (≈ DB lookup time).
    // Dimension/weight filtering from `input` is applied after cache lookup
    // so per-request constraints still take effect.

    const POINTS_TTL_MS = 12 * 60 * 60 * 1000; // 12 h
    const normalCity = input.city?.trim().toLowerCase() ?? "";
    const cacheKey = `apiship:points:${input.providerKey}:${normalCity}`;

    try {
      // ── Cache read ────────────────────────────────────────────────────────
      const cached = await getCalculation(cacheKey);
      if (Array.isArray(cached)) {
        return toPickupPoints(
          cached as Parameters<typeof toPickupPoints>[0],
          input,
        );
      }

      // ── Cache miss: fetch from ApiShip ────────────────────────────────────
      const { data } = await this.apis.lists.getListPoints({
        limit: 5000,
        offset: 0,
        providerKey: input.providerKey || undefined,
        fields:
          "id,providerKey,name,address,city,postIndex,lat,lng,timetable,phone,cashPayment,cardPayment,maxLength,maxWidth,maxHeight,maxWeight",
      });

      // City filter client-side (the only viable approach given the API limitations)
      const rows = normalCity
        ? (data.rows ?? []).filter(
            (r) => r.city?.trim().toLowerCase() === normalCity,
          )
        : (data.rows ?? []);

      // Persist filtered rows — next request for the same city is instant
      await saveCalculation(cacheKey, rows, POINTS_TTL_MS);

      return toPickupPoints(rows, input);
    } catch (err) {
      await logError("lists.getPoints", err);
      return [];
    }
  }

  async createShipment(order: OrderForShipment): Promise<ShipmentInfo> {
    // 060: симметрично с /api/shipping/calculate — обогащаем order.items
    // физическими параметрами из products каталога, чтобы waybill использовал
    // те же значения, что и расчёт цены, показанной клиенту (FR-008).
    const enrichedOrder = await enrichOrderWithPhysical(order);
    const req = toOrderRequest(enrichedOrder, this.settings);
    let providerOrderId: number;
    try {
      const { data } = await this.apis.orders.addOrder({ orderRequest: req });
      providerOrderId = Number(data.orderId ?? 0);
      if (!providerOrderId) throw new Error("ApiShip did not return orderId");
      await logRequest("orders.add", { input: req, output: data, orderId: order.id });
    } catch (err) {
      await logError("orders.add", err);
      throw new Error(`createShipment failed: ${(err as Error).message}`);
    }

    const tracking = await this.waitForOrderInfo(providerOrderId);
    const labelUrl = await this.waitForLabelUrl(providerOrderId).catch(() => undefined);

    return {
      orderId: order.id,
      providerOrderId: String(providerOrderId),
      providerKey: order.delivery.providerKey,
      trackingNumber: tracking.trackingNumber,
      trackingUrl: tracking.trackingUrl,
      labelUrl,
      status: labelUrl ? "created" : "pending_label",
      events: [],
      createdAt: new Date().toISOString(),
    };
  }

  async cancelShipment(_orderId: string, _reason?: string): Promise<ShipmentInfo> {
    throw new Error(
      "ApiShipProvider.cancelShipment must be called via wrapper that resolves providerOrderId from Payload Order",
    );
  }

  async getDocument(_orderId: string, _kind: "label" | "waybill"): Promise<{ url: string }> {
    throw new Error(
      "ApiShipProvider.getDocument must be called via wrapper that resolves providerOrderId",
    );
  }

  async refreshTracking(_orderId: string): Promise<ShipmentInfo> {
    throw new Error(
      "ApiShipProvider.refreshTracking must be called via wrapper that resolves providerOrderId",
    );
  }

  async applyWebhookEvent(event: {
    eventId: string;
    providerOrderId: string;
    rawStatus: string | number;
    statusText?: string;
    at: string;
    payload?: unknown;
  }): Promise<ShipmentInfo> {
    const internalStatus = mapApiShipStatus(event.rawStatus);
    return {
      orderId: "",
      providerOrderId: event.providerOrderId,
      status: internalStatus,
      events: [
        {
          eventId: event.eventId,
          providerStatus: String(event.rawStatus),
          internalStatus,
          at: event.at,
          receivedAt: new Date().toISOString(),
          message: event.statusText,
          raw: event.payload,
        },
      ],
    };
  }

  /** Прямой вызов отмены по providerOrderId (используется wrapper'ом). */
  async cancelByProviderOrderId(providerOrderId: number): Promise<void> {
    try {
      await this.apis.orders.cancelOrder({ orderId: providerOrderId });
      await logRequest("orders.cancel", { input: { providerOrderId }, output: "ok" });
    } catch (err) {
      await logError("orders.cancel", err);
      throw err;
    }
  }

  async getLabelUrl(providerOrderId: number): Promise<string> {
    return this.waitForLabelUrl(providerOrderId);
  }

  async getWaybillUrl(providerOrderId: number): Promise<string> {
    const { data } = await this.apis.docs.getWaybills({
      documentsRequest: { orderIds: [providerOrderId], format: "pdf" },
    });
    return data.waybillItems?.[0]?.file ?? "";
  }

  async pullTracking(providerOrderId: number) {
    return this.waitForOrderInfo(providerOrderId);
  }

  private async waitForOrderInfo(orderId: number): Promise<{ trackingNumber: string; trackingUrl: string }> {
    const response = await executeWithRetry({
      apiCall: () => this.apis.orders.getOrderInfo({ orderId }),
      isReady: (r) => Boolean(r.data.order?.providerNumber),
      maxAttempts: 10,
      baseDelay: 500,
      label: `orderInfo:${orderId}`,
    });
    const ord = response.data.order ?? {};
    return {
      trackingNumber: String(ord.providerNumber ?? ""),
      trackingUrl: String(ord.trackingUrl ?? ""),
    };
  }

  private async waitForLabelUrl(orderId: number): Promise<string> {
    const response = await executeWithRetry({
      apiCall: () => this.apis.docs.getLabels({ labelsRequest: { orderIds: [orderId], format: "pdf" } }),
      isReady: (r) => Boolean(r.data.url),
      maxAttempts: 10,
      baseDelay: 500,
      label: `labels:${orderId}`,
    });
    return String(response.data.url ?? "");
  }
}

/**
 * Расставить значки "cheapest" / "fastest" внутри каждой группы по deliveryType.
 * Значок ставится только если в группе есть хотя бы 2 разных тарифа.
 */
function annotateBadges(rates: ShippingRate[]): void {
  const byType = new Map<number, ShippingRate[]>();
  for (const r of rates) {
    if (!byType.has(r.deliveryType)) byType.set(r.deliveryType, []);
    byType.get(r.deliveryType)!.push(r);
  }
  for (const group of byType.values()) {
    if (group.length < 2) continue;
    const cheapest = group.reduce((a, b) => (a.cost <= b.cost ? a : b));
    const fastest  = group.reduce((a, b) => (a.etaMinDays <= b.etaMinDays ? a : b));
    if (cheapest !== fastest) {
      cheapest.badges = [...(cheapest.badges ?? []), "cheapest"];
      fastest.badges  = [...(fastest.badges  ?? []), "fastest"];
    }
  }
}

/**
 * 060: подмешать physical-параметры товаров из products каталога в order.items
 * перед формированием waybill. Симметрично с enrichItemsWithPhysical в
 * /api/shipping/calculate route — обеспечивает consistency расчёта показанной
 * клиенту цены и реальной отправки (FR-008).
 *
 * Если товар удалён между оплатой и созданием waybill, lookup вернёт пустоту →
 * fallback на defaults в mapper'е. Логируем для диагностики, но не блокируем.
 */
async function enrichOrderWithPhysical(order: OrderForShipment): Promise<OrderForShipment> {
  const skus = order.items.map((i) => i.sku).filter(Boolean);
  if (skus.length === 0) return order;

  try {
    const { getPayload } = await import("payload");
    const configPromise = (await import("@payload-config")).default;
    const payload = await getPayload({ config: configPromise });
    const products = await payload.find({
      collection: "products",
      where: { sku: { in: skus } },
      depth: 0,
      limit: 100,
      pagination: false,
    });

    type PhysGroup = {
      weightGrams?: number | null;
      lengthMm?: number | null;
      widthMm?: number | null;
      heightMm?: number | null;
    } | null;
    const bySku = new Map<string, PhysGroup>();
    for (const p of products.docs) {
      const phys = (p as { physicalPackaging?: PhysGroup }).physicalPackaging ?? null;
      const key = (p as { sku?: string }).sku;
      if (typeof key === "string") bySku.set(key, phys);
    }

    const missing: string[] = [];
    const enrichedItems = order.items.map((item) => {
      const phys = bySku.get(item.sku);
      if (!phys) {
        if (!bySku.has(item.sku)) missing.push(item.sku);
        return item;
      }
      return {
        ...item,
        weightGrams: item.weightGrams ?? (typeof phys.weightGrams === "number" ? phys.weightGrams : undefined),
        lengthMm: item.lengthMm ?? (typeof phys.lengthMm === "number" ? phys.lengthMm : undefined),
        widthMm: item.widthMm ?? (typeof phys.widthMm === "number" ? phys.widthMm : undefined),
        heightMm: item.heightMm ?? (typeof phys.heightMm === "number" ? phys.heightMm : undefined),
      };
    });

    if (missing.length > 0) {
      await logRequest("createShipment.lookup-miss", {
        orderId: order.id,
        output: { missingSkus: missing },
      });
    }

    return { ...order, items: enrichedItems };
  } catch (err) {
    await logError("createShipment.enrich", err);
    return order; // fallback — продолжаем с тем что было, mapper использует defaults
  }
}
