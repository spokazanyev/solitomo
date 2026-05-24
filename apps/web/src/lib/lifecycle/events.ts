import "server-only";

/**
 * Domain Event Emitter — единая точка эмита событий жизненного цикла заказа.
 *
 * Источник: specs/047-delivery-checkout-apiship/contracts/event-payload.ts
 * FR-407, FR-411, FR-412, FR-117, FR-118.
 *
 * Подписчики:
 *  - apps/web/src/lib/notifications/stub.ts (047, email на критичные события)
 *  - apps/web/src/lib/crm/twenty/subscriber.ts (048, при включенной CRM)
 *  - apps/web/src/lib/notifications/subscriber.ts (049, полная матрица)
 */

import { getPayload } from "payload";
import configPromise from "@payload-config";

// --- Order events (047) ---
export type OrderEventKind =
  | "order.identified"
  | "order.created"
  | "order.invoice_issued"
  | "order.paid"
  | "order.payment_failed"
  | "order.cancelled"
  | "order.completed"
  | "order.returned"
  | "order.stuck"
  | "order.expired";

// --- Shipment events (047) ---
export type ShipmentEventKind =
  | "shipment.created"
  | "shipment.in_transit"
  | "shipment.at_point"
  | "shipment.courier_today"
  | "shipment.delivered"
  | "shipment.returned"
  | "shipment.error";

// --- Cart events (052) ---
export type CartEventKind =
  | "cart.created"
  | "cart.updated"
  | "cart.abandoned"
  | "cart.converted"
  | "cart.recovered"
  | "cart.expired"
  | "cart.merged";

// --- Return events (053) ---
export type ReturnEventKind =
  | "return.created"
  | "return.approved"
  | "return.rejected"
  | "return.received"
  | "return.refunded"
  | "return.cancelled"
  | "return.overdue";

export type DomainEventKind =
  | OrderEventKind
  | ShipmentEventKind
  | CartEventKind
  | ReturnEventKind;

export interface OrderSnapshot {
  id: string;
  clientNumber?: string; // 051: human-readable order number (SO-YYYY-NNNN)
  publicToken?: string;
  type?: string;
  status: string;
  createdAt?: string;
  customer?: {
    fullName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    inn?: string;
    kpp?: string;
    secondaryEmails?: Array<{ email: string; role?: string }>;
    marketingOptIn?: boolean;
    messengerOptIn?: boolean;
  };
  totals?: {
    subtotal?: number;
    vat?: number;
    deliveryCost?: number;
    total?: number;
    currency?: string;
  };
  delivery?: Record<string, unknown>;
  shipment?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
  crmRefs?: Record<string, unknown>;
  // 053: return aggregates (computed from returns collection)
  hasReturns?: boolean;
  returnsCount?: number;
  totalRefunded?: number;
}

/** 052: Snapshot of a Cart for cart.* domain events */
export interface CartSnapshot {
  id: string;
  cartToken?: string;
  status: string;
  customerEmail?: string;
  customerId?: string;
  itemCount?: number;
  totalAmount?: number;
  lastActivityAt?: string;
  abandonedAt?: string;
  convertedToOrderId?: string;
}

/** 053: Snapshot of a Return for return.* domain events */
export interface ReturnSnapshot {
  id: string;
  returnNumber?: string; // RT-YYYY-NNNN
  orderId: string;
  orderClientNumber?: string;
  status: string;
  itemCount?: number;
  refundAmount?: number;
  customerEmail?: string;
  createdVia?: string;
}

export interface EventContext {
  statusFrom?: string;
  statusTo?: string;
  providerStatus?: string | number;
  trackingNumber?: string;
  trackingUrl?: string;
  errorMessage?: string;
  meta?: Record<string, unknown>;
}

export interface DomainEventPayload {
  eventId: string;
  kind: DomainEventKind;
  at: string;
  emittedAt: string;
  /** Required for order and shipment events; optional for cart and return events */
  order?: OrderSnapshot;
  /** Present for cart.* events (052) */
  cart?: CartSnapshot;
  /** Present for return events (053) */
  returnData?: ReturnSnapshot;
  context?: EventContext;
}

export interface DomainEventSubscriber {
  name: string;
  kinds?: DomainEventKind[];
  handle(event: DomainEventPayload): Promise<void> | void;
}

const subscribers: DomainEventSubscriber[] = [];
const emittedIds = new Set<string>();
const DEDUP_WINDOW = 1000;

export function registerSubscriber(sub: DomainEventSubscriber): void {
  if (subscribers.some((s) => s.name === sub.name)) return;
  subscribers.push(sub);
}

export function unregisterSubscriber(name: string): void {
  const idx = subscribers.findIndex((s) => s.name === name);
  if (idx >= 0) subscribers.splice(idx, 1);
}

export function listSubscribers(): string[] {
  return subscribers.map((s) => s.name);
}

export async function emitDomainEvent(input: {
  kind: DomainEventKind;
  order?: OrderSnapshot;
  cart?: CartSnapshot;
  returnData?: ReturnSnapshot;
  context?: EventContext;
  at?: string;
  eventIdSuffix?: string;
}): Promise<void> {
  const entityId = input.order?.id ?? input.cart?.id ?? input.returnData?.id ?? "unknown";
  const eventId = `${entityId}:${input.kind}:${input.eventIdSuffix ?? Date.now()}`;
  if (emittedIds.has(eventId)) return;
  emittedIds.add(eventId);
  if (emittedIds.size > DEDUP_WINDOW) {
    const arr = Array.from(emittedIds);
    emittedIds.clear();
    arr.slice(-Math.floor(DEDUP_WINDOW / 2)).forEach((id) => emittedIds.add(id));
  }

  const payload: DomainEventPayload = {
    eventId,
    kind: input.kind,
    at: input.at ?? new Date().toISOString(),
    emittedAt: new Date().toISOString(),
    order: input.order,
    cart: input.cart,
    returnData: input.returnData,
    context: input.context,
  };

  await logToAdminChangeLog(payload);

  await Promise.all(
    subscribers
      .filter((s) => !s.kinds || s.kinds.includes(payload.kind))
      .map(async (s) => {
        try {
          await s.handle(payload);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[domain-event] subscriber "${s.name}" failed`, err);
        }
      }),
  );
}

async function logToAdminChangeLog(payload: DomainEventPayload): Promise<void> {
  try {
    // Determine target collection and entity ID based on event family
    let targetCollection: string;
    let targetId: string;
    let targetLabel: string;
    let entityStatus: string | undefined;

    if (payload.kind.startsWith("cart.") && payload.cart) {
      targetCollection = "carts";
      targetId = String(payload.cart.id);
      targetLabel = `Cart ${payload.cart.cartToken ?? payload.cart.id}`;
      entityStatus = payload.cart.status;
    } else if (payload.kind.startsWith("return.") && payload.returnData) {
      targetCollection = "returns";
      targetId = String(payload.returnData.id);
      targetLabel = `Return ${payload.returnData.returnNumber ?? payload.returnData.id}`;
      entityStatus = payload.returnData.status;
    } else {
      targetCollection = "orders";
      targetId = String(payload.order?.id ?? "unknown");
      targetLabel = `Order ${payload.order?.clientNumber ?? payload.order?.id ?? "unknown"}`;
      entityStatus = payload.order?.status;
    }

    const p = await getPayload({ config: configPromise });
    await p.create({
      collection: "admin-change-log",
      data: {
        actorType: "integration",
        actorName: "system:domain-event",
        targetCollection,
        targetId,
        targetLabel,
        changeType: "update",
        diffSummary: payload.kind,
        afterSnapshot: {
          eventId: payload.eventId,
          at: payload.at,
          status: entityStatus,
          context: payload.context,
        } as Record<string, unknown>,
      },
    });
  } catch {
    // AdminChangeLog может ещё не существовать или иметь другую схему — не блокируем emit.
  }
}

/**
 * Регистрирует штатных подписчиков. Вызывается из payload.config.ts onInit().
 */
export async function registerCoreSubscribers(): Promise<void> {
  // Динамические импорты, чтобы избежать циклов:
  const stub = await import("../notifications/stub").catch(() => null);
  if (stub?.registerStubEmailSubscriber) stub.registerStubEmailSubscriber();

  const twenty = await import("../crm/twenty/subscriber").catch(() => null);
  if (twenty?.registerTwentySubscriber) twenty.registerTwentySubscriber();

  const fullNotifications = await import("../notifications/subscriber").catch(() => null);
  if (fullNotifications?.registerNotificationsSubscriber) fullNotifications.registerNotificationsSubscriber();
}
