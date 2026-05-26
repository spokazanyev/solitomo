import "server-only";

import { CalculatorApi, Configuration, ListsApi, OrderDocsApi, OrdersApi } from "./client";
import { getCalculation, saveCalculation } from "./cache";
import { logError, logRequest } from "./logger";
import { pickCheapestTariff, toCalculatorRequest, toOrderRequest, toPickupPoints, toShippingRate } from "./mappers";
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
      // Выбираем только дешевейший тариф для каждого delivery-type кода —
      // показывать все 25+ тарифов покупателю не нужно.
      const best = pickCheapestTariff(tariffs, type);
      if (best) {
        const providerKey = String(best.providerKey ?? "");
        if (!disabled.has(providerKey)) {
          rates.push(toShippingRate(best, type));
        }
      }
    }

    // Дедупликация по способу доставки (1=курьером, 2=ПВЗ): оставляем дешевейший.
    // Это схлопывает doortodoor+pointtodoor → 1 вариант «курьером до двери»
    // и doortopoint+pointtopoint → 1 вариант «до пункта выдачи».
    const byDeliveryType = new Map<number, ShippingRate>();
    for (const rate of rates) {
      const existing = byDeliveryType.get(rate.deliveryType);
      if (!existing || rate.cost < existing.cost) {
        byDeliveryType.set(rate.deliveryType, rate);
      }
    }
    const deduped = [...byDeliveryType.values()];

    annotateBadges(deduped);
    return { cachedAt: new Date().toISOString(), rates: deduped, warnings };
  }

  async getPickupPoints(input: PointsInput): Promise<PickupPoint[]> {
    try {
      const filter = [
        input.city ? `city=${encodeURIComponent(input.city)}` : "",
        input.providerKey ? `providerKey=${input.providerKey}` : "",
      ]
        .filter(Boolean)
        .join("&");
      const { data } = await this.apis.lists.getListPoints({
        limit: 500,
        offset: 0,
        filter,
        fields:
          "id,providerKey,name,address,city,postIndex,lat,lng,timetable,phone,cashPayment,cardPayment,maxLength,maxWidth,maxHeight,maxWeight",
      });
      return toPickupPoints(data.rows ?? [], input);
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

function annotateBadges(rates: ShippingRate[]): void {
  if (!rates.length) return;
  const cheapest = rates.reduce((a, b) => (a.cost <= b.cost ? a : b));
  const fastest = rates.reduce((a, b) => (a.etaMinDays <= b.etaMinDays ? a : b));
  cheapest.badges = [...(cheapest.badges ?? []), "cheapest"];
  fastest.badges = [...(fastest.badges ?? []), "fastest"];
}
