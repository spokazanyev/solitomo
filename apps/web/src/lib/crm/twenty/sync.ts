import type { Order } from "@/payload-types";
import type {
  DomainEventKind,
  DomainEventPayload,
} from "@/lib/domain-events/types";

export interface TwentyConfig {
  apiUrl: string;
  apiKey: string;
}

interface TwentyCompanyPayload {
  name: string;
  inn?: string;
  email?: string;
  phone?: string;
}

interface TwentyDealPayload {
  name: string;
  stage: string;
  amount?: number;
  companyId?: string;
}

interface TwentyActivityPayload {
  title: string;
  body: string;
  dealId?: string;
}

function buildCompanyPayload(order: Order): TwentyCompanyPayload {
  return {
    name: order.customer?.companyName ?? order.customer?.fullName ?? "Unknown",
    inn: order.customer?.inn ?? undefined,
    email: order.customer?.email ?? undefined,
    phone: order.customer?.phone ?? undefined,
  };
}

function orderStatusToStage(status: Order["status"]): string {
  const stageMap: Record<Order["status"], string> = {
    new: "LEAD",
    pending_payment: "PROPOSAL",
    awaiting_payment: "PROPOSAL",
    paid: "WON",
    fulfilling: "WON",
    shipped: "WON",
    delivered: "WON",
    cancelled: "LOST",
    expired: "LOST",
  };
  return stageMap[status];
}

function buildDealPayload(order: Order): TwentyDealPayload {
  return {
    name: `Order #${order.id}`,
    stage: orderStatusToStage(order.status),
    amount: order.totals?.total ?? undefined,
  };
}

async function upsertCompany(
  company: TwentyCompanyPayload,
  config: TwentyConfig,
): Promise<string> {
  const res = await fetch(`${config.apiUrl}/api/companies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(company),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function upsertDeal(
  deal: TwentyDealPayload,
  config: TwentyConfig,
): Promise<string> {
  const res = await fetch(`${config.apiUrl}/api/deals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(deal),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function createActivity(
  activity: TwentyActivityPayload,
  config: TwentyConfig,
): Promise<void> {
  await fetch(`${config.apiUrl}/api/activities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(activity),
  });
}

const eventLabel: Partial<Record<DomainEventKind, string>> = {
  "order.created": "Order Created",
  "order.updated": "Order Updated",
  "order.status_changed": "Status Changed",
  "order.cancelled": "Order Cancelled",
};

export async function syncOrderToTwenty(
  orderId: number,
  kind: DomainEventKind,
  config: TwentyConfig,
): Promise<void> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/orders/${orderId}`,
  );
  if (!res.ok) return;

  const order = (await res.json()) as Order;

  const company = buildCompanyPayload(order);
  const companyId = await upsertCompany(company, config);

  const deal = buildDealPayload(order);
  deal.companyId = companyId;
  const dealId = await upsertDeal(deal, config);

  const label = eventLabel[kind] ?? kind;
  await createActivity(
    {
      title: label,
      body: `${label} — Order #${order.id}, status: ${order.status}`,
      dealId,
    },
    config,
  );
}

export function handleDomainEvent(
  event: DomainEventPayload,
  config: TwentyConfig,
): Promise<void> | undefined {
  if (!event.order) return;

  const order = event.order;
  const label = eventLabel[event.kind] ?? event.kind;

  console.info(
    `[twenty-sync] ${label} for order #${order.id} (${order.status})`,
  );

  return syncOrderToTwenty(order.id, event.kind, config);
}
