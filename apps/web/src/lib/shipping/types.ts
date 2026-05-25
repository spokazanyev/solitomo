/**
 * Shipping module — общие TypeScript-типы.
 * Источник: specs/047-delivery-checkout-apiship/contracts/shipping-provider.types.ts
 */

export type ShippingProviderCode =
  | "apiship"
  | "fallback"
  | "cdek"
  | "dellin"
  | "yandex_delivery"
  | "boxberry"
  | "russian_post"
  | "manual";

export type DeliveryTypeCode =
  | "doortodoor"
  | "doortopoint"
  | "pointtodoor"
  | "pointtopoint";

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
  price: number;
  weight?: number;
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
  shippingOptionId: string;
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
  at: string;
  receivedAt: string;
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

export interface ShippingProvider {
  readonly code: ShippingProviderCode;
  isReady(): Promise<boolean>;
  calculate(input: CalculationInput): Promise<ShippingCalculationResult>;
  getPickupPoints?(input: PointsInput): Promise<PickupPoint[]>;
  createShipment(order: OrderForShipment): Promise<ShipmentInfo>;
  cancelShipment(orderId: string, reason?: string): Promise<ShipmentInfo>;
  getDocument(orderId: string, kind: "label" | "waybill"): Promise<{ url: string }>;
  refreshTracking(orderId: string): Promise<ShipmentInfo>;
  applyWebhookEvent(event: {
    eventId: string;
    providerOrderId: string;
    rawStatus: string | number;
    statusText?: string;
    at: string;
    payload?: unknown;
  }): Promise<ShipmentInfo>;
}

export interface PriceSnapshot {
  cost: number;
  currency: "RUB";
  capturedAt: string;
  sourceCacheKey: string;
  refreshCheckAt: string;
}
