/**
 * Минимальный TypeScript-клиент ApiShip API v1.
 *
 * Источник: docs.apiship.ru.
 * Полноценная генерация из OpenAPI (как в Medusa-плагине) — отложена; здесь — ручной
 * минимум для покрытия 047 MVP. Регенерация через openapi-generator-cli — отдельная задача.
 *
 * MIT-атрибуция: ядро портировано из gorgojs/medusa-plugins
 *   (packages/medusa-fulfillment-apiship/src/lib/apiship-client),
 *   адаптировано под Next.js + Payload.
 */

import "server-only";

import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";

export interface Configuration {
  basePath: string;
  apiKey: string;
}

export interface CalculatorRequestItem {
  cost: number;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
}

export interface CalculatorRequestPlace {
  countryCode?: string;
  city?: string;
  postIndex?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface CalculatorRequest {
  from?: CalculatorRequestPlace;
  to: CalculatorRequestPlace;
  places: CalculatorRequestItem[];
  pickupTypes: number[];
  deliveryTypes: number[];
  includeFees?: number;
  providerKeys?: string[];
}

export interface TariffObject {
  id?: number;
  tariffId?: number;
  providerKey?: string;
  name?: string;
  deliveryCost?: number;
  deliveryCostVat?: number;
  daysMin?: number;
  daysMax?: number;
  pickupType?: number;
  deliveryType?: number;
  isError?: boolean;
  errorMessages?: string[];
}

/**
 * Реальный ответ ApiShip /v1/calculator (по факту PROD API 2026-05).
 * Структура: { deliveryToDoor: TariffObject[], deliveryToPoint: TariffObject[] }.
 *
 * Поле `tariffs` оставлено для обратной совместимости с устаревшей формой ответа
 * (которая использовалась в Medusa-плагине-источнике); фактический API возвращает
 * именно `deliveryToDoor` + `deliveryToPoint`.
 */
export interface CalculatorResponse {
  deliveryToDoor?: TariffObject[];
  deliveryToPoint?: TariffObject[];
  tariffs?: TariffObject[];
}

/** Собрать все тарифы из ответа в один массив с проставленным deliveryType. */
export function flattenCalculatorTariffs(resp: CalculatorResponse | null | undefined): TariffObject[] {
  if (!resp) return [];
  const result: TariffObject[] = [];
  for (const t of resp.deliveryToDoor ?? []) {
    result.push({ ...t, deliveryType: t.deliveryType ?? 1 });
  }
  for (const t of resp.deliveryToPoint ?? []) {
    result.push({ ...t, deliveryType: t.deliveryType ?? 2 });
  }
  for (const t of resp.tariffs ?? []) {
    result.push(t);
  }
  return result;
}

export type CostDeliveryCostVatEnum = "-1" | "0" | "5" | "7" | "10" | "20" | "22";

export interface OrderRequestSender {
  countryCode?: string;
  addressString?: string;
  contactName?: string;
  phone?: string;
}

export interface OrderRequestReceiver {
  countryCode?: string;
  addressString?: string;
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface OrderRequestPlace {
  description: string;
  height: number;
  length: number;
  weight: number;
  width: number;
  items?: Array<{
    description: string;
    quantity: number;
    cost?: number;
    weight?: number;
  }>;
}

export interface OrderRequest {
  order: {
    clientNumber?: string;
    description?: string;
    pickupType: number;
    deliveryType: number;
    pointInId?: string | number;
    pointOutId?: string | number;
    weight: number;
    length?: number;
    width?: number;
    height?: number;
  };
  cost: {
    cost: number;
    assessedCost: number;
    deliveryCost?: number;
    deliveryCostVat?: CostDeliveryCostVatEnum;
  };
  sender: OrderRequestSender;
  recipient: OrderRequestReceiver;
  providerKey: string;
  tariffId: number;
  places: OrderRequestPlace[];
}

export interface OrderResponse {
  orderId?: number;
  order?: {
    providerNumber?: string;
    trackingUrl?: string;
  };
}

class HttpClient {
  protected http: AxiosInstance;

  constructor(config: Configuration) {
    this.http = axios.create({
      baseURL: config.basePath,
      timeout: 30_000,
      headers: {
        Authorization: config.apiKey,
        "Content-Type": "application/json",
      },
    });
    axiosRetry(this.http, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (err) =>
        axiosRetry.isNetworkOrIdempotentRequestError(err) ||
        (err.response?.status !== undefined && err.response.status >= 500),
    });
  }
}

export class CalculatorApi extends HttpClient {
  async getCalculator(req: { calculatorRequest: CalculatorRequest }): Promise<{ data: CalculatorResponse }> {
    const res = await this.http.post<CalculatorResponse>("/calculator", req.calculatorRequest);
    return { data: res.data };
  }
}

export class OrdersApi extends HttpClient {
  async addOrder(req: { orderRequest: OrderRequest }): Promise<{ data: OrderResponse }> {
    const res = await this.http.post<OrderResponse>("/orders", req.orderRequest);
    return { data: res.data };
  }

  async getOrderInfo(req: { orderId: number }): Promise<{ data: OrderResponse }> {
    const res = await this.http.get<OrderResponse>(`/orders/${req.orderId}`);
    return { data: res.data };
  }

  async cancelOrder(req: { orderId: number }): Promise<{ data: unknown }> {
    const res = await this.http.post(`/orders/${req.orderId}/cancel`);
    return { data: res.data };
  }
}

export interface LabelsResponse {
  url?: string;
}

export interface WaybillsResponse {
  waybillItems?: Array<{ orderId: number; file?: string }>;
}

export class OrderDocsApi extends HttpClient {
  async getLabels(req: {
    labelsRequest: { orderIds: number[]; format: "pdf" | "zpl" };
  }): Promise<{ data: LabelsResponse }> {
    const res = await this.http.post<LabelsResponse>("/orders/labels", req.labelsRequest);
    return { data: res.data };
  }

  async getWaybills(req: {
    documentsRequest: { orderIds: number[]; format: "pdf" };
  }): Promise<{ data: WaybillsResponse }> {
    const res = await this.http.post<WaybillsResponse>("/orders/waybills", req.documentsRequest);
    return { data: res.data };
  }
}

export interface ListServicesResponse {
  rows?: Array<{ key?: string; name?: string }>;
}

export interface PointObject {
  id?: string | number;
  providerKey?: string;
  name?: string;
  address?: string;
  city?: string;
  postIndex?: string;
  lat?: number;
  lng?: number;
  timetable?: string;
  phone?: string;
  cashPayment?: boolean;
  cardPayment?: boolean;
  maxLength?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxWeight?: number;
}

export interface ListPointsResponse {
  rows?: PointObject[];
}

export interface ListTariffsResponse {
  rows?: TariffObject[];
}

export class ListsApi extends HttpClient {
  async getServices(req: { limit?: number; offset?: number }): Promise<{ data: ListServicesResponse }> {
    const res = await this.http.get<ListServicesResponse>("/lists/services", { params: req });
    return { data: res.data };
  }

  async getListPoints(req: {
    limit?: number;
    offset?: number;
    filter?: string;
    fields?: string;
  }): Promise<{ data: ListPointsResponse }> {
    const res = await this.http.get<ListPointsResponse>("/lists/points", { params: req });
    return { data: res.data };
  }

  async getListTariffs(req: {
    limit?: number;
    offset?: number;
    filter?: string;
    fields?: string;
  }): Promise<{ data: ListTariffsResponse }> {
    const res = await this.http.get<ListTariffsResponse>("/lists/tariffs", { params: req });
    return { data: res.data };
  }
}
