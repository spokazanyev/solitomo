/**
 * Скелет реализации ShippingProvider под ApiShip.
 *
 * Источник: спека 047-delivery-checkout-apiship.
 * Это контрактный референс — конечная реализация ляжет в
 * apps/web/src/lib/shipping/apiship/provider.ts и будет ровно этим файлом
 * с подключёнными утилитами из ./mappers, ./retry, ./cache, ./client.
 *
 * Логика — порт ядра Medusa-плагина gorgojs/medusa-plugins:
 * packages/medusa-fulfillment-apiship/src/providers/fulfillment-apiship/core/apiship-base.ts
 * Лицензия источника: MIT. Сохраняем атрибуцию в README/AGENTS.
 */

import "server-only";

import {
  Configuration,
  OrdersApi,
  OrderDocsApi,
  ListsApi,
  CalculatorApi,
  type TariffObject,
} from "./client";
import type {
  ShippingProvider,
  CalculationInput,
  ShippingCalculationResult,
  ShippingRate,
  PointsInput,
  PickupPoint,
  OrderForShipment,
  ShipmentInfo,
  ShipmentStatusCode,
  DeliveryTypeCode,
} from "../types";
import {
  toCalculatorRequest,
  toOrderRequest,
  pickCheapestTariff,
  toShippingRate,
  toPickupPoints,
} from "./mappers";
import { executeWithRetry } from "./retry";
import { getCalculation, saveCalculation } from "./cache";
import { mapApiShipStatus } from "./status-map";
import { loadSettings, type ApiShipSettings } from "./settings";
import { logRequest, logError } from "./logger";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 минут (как в плагине)
const POLL_MAX_ATTEMPTS = 10;
const POLL_BASE_DELAY = 500;

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

    const basePath = settings.isTest
      ? "http://api.dev.apiship.ru/v1"
      : "https://api.apiship.ru/v1";

    const config = new Configuration({ basePath, apiKey: settings.token });
    return new ApiShipProvider(settings, {
      orders: new OrdersApi(config),
      docs: new OrderDocsApi(config),
      lists: new ListsApi(config),
      calculator: new CalculatorApi(config),
    });
  }

  async isReady(): Promise<boolean> {
    try {
      await this.apis.lists.getServices({ limit: 1, offset: 0 } as any);
      return true;
    } catch {
      return false;
    }
  }

  // -------------------- Расчёт --------------------

  async calculate(input: CalculationInput): Promise<ShippingCalculationResult> {
    const types: DeliveryTypeCode[] =
      input.deliveryTypes ?? (this.settings.allowedDeliveryTypes as DeliveryTypeCode[]);

    const results: ShippingRate[] = [];
    const warnings: string[] = [];

    for (const type of types) {
      const shippingOptionId = `apiship_${type}` as const;
      const cacheKey = `apiship:calc:${input.cartId}:${shippingOptionId}`;

      // Кэш
      let raw = await getCalculation(cacheKey);
      if (!raw) {
        try {
          const calculatorRequest = toCalculatorRequest(input, type, this.settings);
          const { data } = await this.apis.calculator.getCalculator({ calculatorRequest });
          raw = data;
          await saveCalculation(cacheKey, raw, CACHE_TTL_MS);
          await logRequest("calculator.get", { input: calculatorRequest, output: raw });
        } catch (err) {
          await logError("calculator.get", err);
          warnings.push(`Не удалось рассчитать тариф «${type}»`);
          continue;
        }
      }

      // Отфильтровать отключённые провайдеры
      const disabled = new Set(this.settings.disabledProviders ?? []);

      // Развернуть raw в ShippingRate[]
      for (const tariff of (raw as any)?.tariffs ?? []) {
        const providerKey = String(tariff.providerKey ?? "");
        if (disabled.has(providerKey)) continue;
        results.push(toShippingRate(tariff, type));
      }
    }

    // Бейджи: cheapest / fastest по группе deliveryType
    annotateBadges(results);

    return { cachedAt: new Date().toISOString(), rates: results, warnings };
  }

  // -------------------- ПВЗ --------------------

  async getPickupPoints(input: PointsInput): Promise<PickupPoint[]> {
    const { data } = await this.apis.lists.getListPoints({
      limit: 500,
      offset: 0,
      filter: [
        `city=${encodeURIComponent(input.city)}`,
        `providerKey=${input.providerKey}`,
      ].join("&"),
      fields:
        "id,name,address,city,postIndex,lat,lng,timetable,phone,cashPayment,cardPayment,maxLength,maxWidth,maxHeight,maxWeight,photos",
    } as any);

    return toPickupPoints((data as any)?.rows ?? [], input);
  }

  // -------------------- Создание отправления --------------------

  async createShipment(order: OrderForShipment): Promise<ShipmentInfo> {
    const orderRequest = toOrderRequest(order, this.settings);
    let providerOrderId: number;
    try {
      const { data } = await this.apis.orders.addOrder({ orderRequest });
      providerOrderId = data.orderId as number;
      await logRequest("orders.add", { input: orderRequest, output: data });
    } catch (err) {
      await logError("orders.add", err);
      throw buildError("createShipment", err);
    }

    // Polling готовности providerNumber + label
    const tracking = await this.waitForOrderInfo(providerOrderId);
    const labelUrl = await this.waitForLabelUrl(providerOrderId);

    return {
      orderId: order.id,
      providerOrderId: String(providerOrderId),
      providerKey: order.delivery.providerKey,
      trackingNumber: tracking.trackingNumber,
      trackingUrl: tracking.trackingUrl,
      labelUrl,
      status: "created",
      events: [],
      createdAt: new Date().toISOString(),
    };
  }

  async cancelShipment(orderId: string, reason?: string): Promise<ShipmentInfo> {
    // 1. Найти orderId в payload Order (вне ответственности этого класса — делает caller)
    //    Здесь принимаем уже providerOrderId через external lookup.
    throw new Error("Implement via Payload-side wrapper that resolves providerOrderId");
  }

  async getDocument(orderId: string, kind: "label" | "waybill"): Promise<{ url: string }> {
    throw new Error("Implement via Payload-side wrapper that resolves providerOrderId");
  }

  async refreshTracking(orderId: string): Promise<ShipmentInfo> {
    throw new Error("Implement via Payload-side wrapper that resolves providerOrderId");
  }

  async applyWebhookEvent(event: {
    eventId: string;
    providerOrderId: string;
    rawStatus: string | number;
    statusText?: string;
    at: string;
    payload?: unknown;
  }): Promise<ShipmentInfo> {
    // Маппинг статуса — чистая функция; запись в Payload — снаружи.
    const internalStatus: ShipmentStatusCode = mapApiShipStatus(event.rawStatus);
    return {
      orderId: "", // resolved by caller (через providerOrderId → orders.where)
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

  // -------------------- Низкоуровневое (приватное) --------------------

  /**
   * Порт executeWithRetry → ожидание присвоения providerNumber.
   * Источник: apiship-base.ts:waitForOrderInfo
   */
  private async waitForOrderInfo(orderId: number) {
    const response = await executeWithRetry({
      apiCall: () => this.apis.orders.getOrderInfo({ orderId }),
      isReady: (r: any) => Boolean(r?.data?.order?.providerNumber),
      maxAttempts: POLL_MAX_ATTEMPTS,
      baseDelay: POLL_BASE_DELAY,
      label: `orderInfo:${orderId}`,
    });
    const ord = (response as any).data.order;
    return {
      trackingNumber: String(ord.providerNumber ?? ""),
      trackingUrl: String(ord.trackingUrl ?? ""),
    };
  }

  /**
   * Порт executeWithRetry → ожидание генерации PDF-этикетки.
   * Источник: apiship-base.ts:waitForLabelUrl
   */
  private async waitForLabelUrl(orderId: number): Promise<string> {
    const response = await executeWithRetry({
      apiCall: () =>
        this.apis.docs.getLabels({
          labelsRequest: { orderIds: [orderId], format: "pdf" },
        }),
      isReady: (r: any) => Boolean(r?.data?.url),
      maxAttempts: POLL_MAX_ATTEMPTS,
      baseDelay: POLL_BASE_DELAY,
      label: `labels:${orderId}`,
    });
    return String((response as any).data.url ?? "");
  }
}

// ---------- helpers ----------

function annotateBadges(rates: ShippingRate[]): void {
  if (!rates.length) return;
  const cheapest = rates.reduce((a, b) => (a.cost <= b.cost ? a : b));
  const fastest = rates.reduce((a, b) => (a.etaMinDays <= b.etaMinDays ? a : b));
  cheapest.badges = [...(cheapest.badges ?? []), "cheapest"];
  fastest.badges = [...(fastest.badges ?? []), "fastest"];
}

function buildError(prefix: string, err: unknown): Error {
  const e = err as any;
  if (e?.isAxiosError) {
    const code = e.response?.data?.code ?? "";
    const desc = e.response?.data?.description ?? e.message;
    return new Error(`${prefix}: ${e.response?.status ?? "?"} ${code} - ${desc}`.trim());
  }
  return new Error(`${prefix}: ${(err as Error).message ?? err}`);
}
