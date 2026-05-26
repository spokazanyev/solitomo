import "server-only";

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

    for (const type of types) {
      const cacheKey = `apiship:calc:${input.cartId}:apiship_${type}`;
      let raw = (await getCalculation(cacheKey)) as
        | { deliveryToDoor?: unknown[]; deliveryToPoint?: unknown[]; tariffs?: unknown[] }
        | null;
      if (!raw) {
        try {
          const req = toCalculatorRequest(input, type, this.settings);
          const { data } = await this.apis.calculator.getCalculator({ calculatorRequest: req });
          raw = data;
          await saveCalculation(cacheKey, data, CACHE_TTL_MS);
          await logRequest("calculator.get", { input: req, output: data });
        } catch (err) {
          await logError(`calculator.get(${type})`, err);
          warnings.push(`Не удалось рассчитать «${type}»`);
          continue;
        }
      }
      // Реальный ApiShip API возвращает разделённые массивы по типу доставки,
      // legacy-форма (`tariffs[]`) поддерживается на всякий случай.
      const { flattenCalculatorTariffs } = await import("./client");
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
    const req = toOrderRequest(order, this.settings);
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
