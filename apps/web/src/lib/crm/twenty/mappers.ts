import type { OrderSnapshot } from "../../lifecycle/events";

export interface PersonInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface CompanyInput {
  name: string;
  taxId?: string;
  kpp?: string;
  ogrn?: string;
  legalAddress?: string;
}

export interface OpportunityInput {
  externalId: string;
  externalToken?: string;
  name: string;
  amount: { amountMicros: number; currencyCode: "RUB" };
  closeDate?: string;
  stage: string;
  fulfillmentStage?: string;
  shippingProvider?: string;
  shippingCost?: { amountMicros: number; currencyCode: "RUB" };
  trackingNumber?: string;
  trackingUrl?: string;
  shippingAddress?: string;
  pickupPointAddress?: string;
  deliveredAt?: string;
  closedAt?: string;
  orderUrl: string;
  personId?: string;
  companyId?: string;
}

export function toPersonInput(order: OrderSnapshot): PersonInput | null {
  const email = order.customer?.email;
  if (!email) return null;
  const full = order.customer?.fullName ?? "";
  const parts = full.trim().split(/\s+/);
  return {
    email,
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    phone: order.customer?.phone,
  };
}

export function toCompanyInput(order: OrderSnapshot): CompanyInput | null {
  const name = order.customer?.companyName;
  if (!name) return null;
  return {
    name,
    taxId: order.customer?.inn,
    kpp: order.customer?.kpp,
  };
}

export function toOpportunityInput(
  order: OrderSnapshot,
  stageMap: Record<string, string>,
  baseSiteUrl: string,
): OpportunityInput {
  const stage = stageMap[order.status] ?? "New";
  const fulfillmentStage = order.status;
  const delivery = (order.delivery ?? {}) as Record<string, unknown>;
  const shipment = (order.shipment ?? {}) as Record<string, unknown>;
  return {
    externalId: order.id,
    externalToken: order.publicToken,
    name: `${order.clientNumber ?? order.id} — ${order.customer?.companyName ?? order.customer?.fullName ?? order.customer?.email ?? "anonymous"}`,
    amount: { amountMicros: Math.round((order.totals?.total ?? 0) * 1_000_000), currencyCode: "RUB" },
    stage,
    fulfillmentStage,
    shippingProvider: typeof delivery.providerKey === "string" ? delivery.providerKey : undefined,
    shippingCost: delivery.cost != null
      ? { amountMicros: Math.round(Number(delivery.cost) * 1_000_000), currencyCode: "RUB" }
      : undefined,
    trackingNumber: typeof shipment.trackingNumber === "string" ? shipment.trackingNumber : undefined,
    trackingUrl: typeof shipment.trackingUrl === "string" ? shipment.trackingUrl : undefined,
    shippingAddress: typeof delivery.address === "string" ? delivery.address : undefined,
    pickupPointAddress: typeof delivery.pointAddress === "string" ? delivery.pointAddress : undefined,
    orderUrl: order.publicToken ? `${baseSiteUrl.replace(/\/$/, "")}/cart/order/${order.publicToken}/` : `${baseSiteUrl}/`,
  };
}
