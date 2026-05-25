import type {
  CalculationInput,
  OrderForShipment,
  PickupPoint,
  PointsInput,
  ShipmentInfo,
  ShippingCalculationResult,
  ShippingProvider,
} from "../types";

/**
 * Нейтральные опции для случая, когда ApiShip недоступен или у аккаунта
 * нет подключённых служб доставки. НЕ имитирует конкретных перевозчиков —
 * только «согласовать с менеджером».
 */
const FIXED_RATES: Array<{
  providerKey: string;
  providerName: string;
  cost: number;
  etaMinDays: number;
  etaMaxDays: number;
  deliveryType: 1 | 2;
  pickupType: 1 | 2;
  label: string;
}> = [
  {
    providerKey: "pickup",
    providerName: "Самовывоз со склада",
    cost: 0,
    etaMinDays: 0,
    etaMaxDays: 1,
    deliveryType: 2,
    pickupType: 2,
    label: "Москва, склад Soliton",
  },
  {
    providerKey: "manager-courier",
    providerName: "Курьером (по согласованию)",
    cost: 0,
    etaMinDays: 2,
    etaMaxDays: 7,
    deliveryType: 1,
    pickupType: 1,
    label: "Менеджер подберёт службу и уточнит стоимость",
  },
  {
    providerKey: "manager-point",
    providerName: "В пункт выдачи (по согласованию)",
    cost: 0,
    etaMinDays: 2,
    etaMaxDays: 10,
    deliveryType: 2,
    pickupType: 1,
    label: "Менеджер подберёт ПВЗ и уточнит стоимость",
  },
];

export class FallbackShippingProvider implements ShippingProvider {
  public readonly code = "fallback" as const;

  async isReady(): Promise<boolean> {
    return true;
  }

  async calculate(_input: CalculationInput): Promise<ShippingCalculationResult> {
    return {
      cachedAt: new Date().toISOString(),
      rates: FIXED_RATES.map((r) => ({
        shippingOptionId: `fallback_${r.providerKey}_${r.deliveryType === 2 ? "point" : "door"}`,
        providerKey: r.providerKey,
        providerName: r.providerName,
        tariffName: r.label,
        deliveryType: r.deliveryType,
        pickupType: r.pickupType,
        cost: r.cost,
        currency: "RUB",
        etaMinDays: r.etaMinDays,
        etaMaxDays: r.etaMaxDays,
      })),
      warnings: [
        "Автоматический расчёт пока недоступен (в кабинете ApiShip ещё не подключены службы доставки). Менеджер свяжется в течение рабочего дня и согласует точный способ и стоимость.",
      ],
    };
  }

  async getPickupPoints(_input: PointsInput): Promise<PickupPoint[]> {
    return [];
  }

  async createShipment(order: OrderForShipment): Promise<ShipmentInfo> {
    return {
      orderId: order.id,
      providerKey: order.delivery.providerKey,
      status: "none",
      events: [],
      errorMessage: "Fallback provider does not create shipments — оформите вручную.",
    };
  }

  async cancelShipment(orderId: string): Promise<ShipmentInfo> {
    return { orderId, status: "cancelled", events: [] };
  }

  async getDocument(_orderId: string): Promise<{ url: string }> {
    return { url: "" };
  }

  async refreshTracking(orderId: string): Promise<ShipmentInfo> {
    return { orderId, status: "none", events: [] };
  }

  async applyWebhookEvent(event: {
    eventId: string;
    providerOrderId: string;
    rawStatus: string | number;
    at: string;
  }): Promise<ShipmentInfo> {
    return {
      orderId: "",
      providerOrderId: event.providerOrderId,
      status: "none",
      events: [
        {
          eventId: event.eventId,
          providerStatus: String(event.rawStatus),
          internalStatus: "none",
          at: event.at,
          receivedAt: new Date().toISOString(),
        },
      ],
    };
  }
}
