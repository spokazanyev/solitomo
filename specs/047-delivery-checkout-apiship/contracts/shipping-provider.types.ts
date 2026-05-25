/**
 * Контрактный TypeScript-интерфейс модуля доставки Soliton.
 *
 * Источник: 047-delivery-checkout-apiship/contracts/shipping-provider.types.ts
 * Файл является «контрактом», а не рабочим кодом — реальная реализация будет
 * лежать в apps/web/src/lib/shipping/types.ts (структура идентична).
 *
 * Дизайн интерфейса согласуется с road-map'ом из
 * 05-implementation-roadmap/russian-payment-delivery-aggregators.md
 * (раздел «В коде сразу делать абстракцию»).
 */

export type ShippingProviderCode =
  | "apiship"
  | "fallback"
  | "cdek"           // зарезервировано под прямую интеграцию
  | "dellin"
  | "yandex_delivery"
  | "boxberry"
  | "russian_post"
  | "manual";

export type DeliveryTypeCode =
  | "doortodoor"   // 1/1
  | "doortopoint"  // 1/2
  | "pointtodoor"  // 2/1
  | "pointtopoint";// 2/2

export type ShipmentStatusCode =
  | "none"
  | "pending"
  | "created"
  | "pending_label"
  | "in_transit"
  | "at_point"
  | "delivered"
  | "returned"
  | "cancelled"
  | "error";

export interface AddressInput {
  countryCode: string;
  postalCode?: string;
  region?: string;
  city?: string;
  street?: string;
  house?: string;
  flat?: string;
  addressString?: string;
}

export interface AddressNormalized extends AddressInput {
  kladrId?: string;
  fiasId?: string;
  lat?: number;
  lon?: number;
  isValid: boolean;
  unparsedParts?: string[];
}

export interface CartItemForShipping {
  sku: string;
  name?: string;
  quantity: number;
  price: number;       // ₽ за единицу
  weight?: number;     // грамм
  length?: number;
  width?: number;
  height?: number;
}

export interface CalculationInput {
  cartId: string;
  address: AddressInput;
  items: CartItemForShipping[];
  deliveryTypes?: DeliveryTypeCode[];
}

export interface ShippingRate {
  shippingOptionId: `apiship_${DeliveryTypeCode}` | (string & {});
  providerKey: string;
  providerName?: string;
  tariffId?: number;
  tariffName?: string;
  deliveryType: 1 | 2;
  pickupType: 1 | 2;
  cost: number;
  currency: "RUB";
  etaMinDays: number;
  etaMaxDays: number;
  badges?: Array<"cheapest" | "fastest" | "recommended">;
  rawTariff?: unknown;
}

export interface ShippingCalculationResult {
  cachedAt: string;
  rates: ShippingRate[];
  warnings?: string[];
}

export interface PointsInput {
  cartId: string;
  shippingOptionId: string;
  providerKey: string;
  city: string;
  radiusKm?: number;
  boundingBox?: {
    northEast: { lat: number; lon: number };
    southWest: { lat: number; lon: number };
  };
  maxWeightGrams?: number;
  maxDimensions?: { length: number; width: number; height: number };
}

export interface PickupPoint {
  pointId: string;
  providerKey: string;
  name?: string;
  address: string;
  city?: string;
  postalCode?: string;
  lat?: number;
  lon?: number;
  workHours?: string;
  phone?: string;
  paymentMethods?: Array<"cash" | "card">;
  maxDimensions?: { length?: number; width?: number; height?: number; weight?: number };
  photos?: string[];
}

export interface ShipmentEvent {
  eventId: string;
  providerStatus: string;
  internalStatus: ShipmentStatusCode;
  at: string;          // ISO
  receivedAt: string;  // ISO
  message?: string;
  raw?: unknown;
}

export interface ShipmentInfo {
  orderId: string;
  providerOrderId?: string;
  providerKey?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  waybillUrl?: string;
  status: ShipmentStatusCode;
  errorMessage?: string;
  events: ShipmentEvent[];
  createdAt?: string;
  cancelledAt?: string;
  lastSyncedAt?: string;
}

/**
 * Минимальная форма заказа, требуемая провайдеру для создания отправления.
 * Намеренно не зависит от конкретной формы Payload-коллекции `orders`.
 */
export interface OrderForShipment {
  id: string;
  publicToken?: string;
  customer: {
    fullName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
  };
  delivery: {
    provider: ShippingProviderCode;
    providerKey: string;
    tariffId: number;
    deliveryType: 1 | 2;
    pickupType: 1 | 2;
    pointId?: string;
    pointAddress?: string;
    address?: AddressNormalized;
    city?: string;
    cost: number;
  };
  stockLocationId?: string;
  items: Array<CartItemForShipping & { vatRate?: string; declaredValue?: number }>;
  totals: { subtotal: number; vat: number; total: number };
}

/**
 * Основной интерфейс модуля доставки.
 * Реализации:
 *   - apps/web/src/lib/shipping/apiship/provider.ts   (порт Medusa-плагина)
 *   - apps/web/src/lib/shipping/fallback/provider.ts  (3-4 фиксированные опции)
 */
export interface ShippingProvider {
  readonly code: ShippingProviderCode;

  /** Готов ли провайдер (есть ли валидные настройки). */
  isReady(): Promise<boolean>;

  /** Рассчитать тарифы для корзины. */
  calculate(input: CalculationInput): Promise<ShippingCalculationResult>;

  /** Список ПВЗ. Реализуется только если провайдер их поддерживает. */
  getPickupPoints?(input: PointsInput): Promise<PickupPoint[]>;

  /** Создать отправление в провайдере. */
  createShipment(order: OrderForShipment): Promise<ShipmentInfo>;

  /** Отменить отправление до фактической отгрузки. */
  cancelShipment(orderId: string, reason?: string): Promise<ShipmentInfo>;

  /** Перезапросить документ (этикетку или накладную). */
  getDocument(orderId: string, kind: "label" | "waybill"): Promise<{ url: string }>;

  /** Принудительно подтянуть статус (на случай пропущенного webhook). */
  refreshTracking(orderId: string): Promise<ShipmentInfo>;

  /** Применить inbound webhook-событие. */
  applyWebhookEvent(event: {
    eventId: string;
    providerOrderId: string;
    rawStatus: string | number;
    statusText?: string;
    at: string;
    payload?: unknown;
  }): Promise<ShipmentInfo>;
}
