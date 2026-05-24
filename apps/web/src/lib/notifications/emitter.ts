import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

import type { DomainEventPayload } from "../lifecycle/events";
import { dedupKey, findExistingByDedupKey } from "./dedup";
import { logInfo, logWarn, maskRecipient } from "./logger";
import { notificationMatrix } from "./matrix";
import { loadNotificationsSettings } from "./settings";
import type {
  NotificationChannel,
  NotificationJobPayload,
  NotificationRequires,
  NotificationRule,
} from "./types";

/**
 * Создаёт записи `notification-jobs` для конкретного доменного события.
 *
 * Шаги:
 *   1. Найти подходящие правила в `notificationMatrix`.
 *   2. Для каждого правила определить получателей (1+).
 *   3. Проверить opt-in / emailValid (FR-4921).
 *   4. Проверить dedup (FR-4922).
 *   5. Создать `notification-jobs` row со status=queued.
 *
 * Реальная отправка — в `scheduler.processNotificationQueue`.
 */
export async function emitNotificationJobs(event: DomainEventPayload): Promise<{
  created: number;
  skipped: number;
}> {
  const matched = notificationMatrix.filter((r) => r.event === event.kind);
  if (matched.length === 0) return { created: 0, skipped: 0 };

  const settings = await loadNotificationsSettings();
  let created = 0;
  let skipped = 0;

  // 052/053 C2 fix: derive polymorphic entity reference per event family.
  // For order/shipment events: orderId carries the Order FK.
  // For cart.* events: orderId is null, entity is in carts table.
  // For return.* events: orderId is the Order FK (returnData.orderId), entityId
  //   carries the Return id so dedup-keys stay unique per-return.
  let entityCollection: "orders" | "carts" | "returns";
  let entityId: string;
  let orderFk: string | null;

  if (event.kind.startsWith("cart.") && event.cart?.id) {
    entityCollection = "carts";
    entityId = String(event.cart.id);
    orderFk = null;
  } else if (event.kind.startsWith("return.") && event.returnData) {
    entityCollection = "returns";
    entityId = String(event.returnData.id);
    orderFk = event.returnData.orderId || null;
  } else {
    entityCollection = "orders";
    entityId = String(event.order?.id ?? "unknown");
    orderFk = entityId !== "unknown" ? entityId : null;
  }

  for (const rule of matched) {
    const recipients = await resolveRecipients(rule, event, settings.managers);
    for (const recipient of recipients) {
      if (!recipient.email) {
        skipped++;
        continue;
      }
      if (!checkRequires(rule.requires, event)) {
        skipped++;
        continue;
      }
      const key = dedupKey({
        orderId: entityId, // dedup key is per-entity (Return/Cart/Order id)
        event: event.kind,
        channel: rule.channel,
        recipient: recipient.email,
        at: event.at,
      });
      const existing = await findExistingByDedupKey(key);
      if (existing) {
        skipped++;
        logInfo("emitter", "duplicate", { key, channel: rule.channel });
        continue;
      }
      const ok = await enqueueJob({
        notificationId: makeNotificationId(event, rule, recipient.email),
        orderId: orderFk,
        entityCollection,
        entityId,
        channel: rule.channel,
        event: event.kind,
        template: rule.template,
        recipient: recipient.email,
        scheduledAt: new Date().toISOString(),
        payload: buildPayload(event, recipient),
        dedupKey: key,
      });
      if (ok) {
        created++;
        logInfo("emitter", "enqueued", {
          event: event.kind,
          template: rule.template,
          channel: rule.channel,
          to: maskRecipient(rule.channel, recipient.email),
        });
      } else {
        skipped++;
      }
    }
  }
  return { created, skipped };
}

interface ResolvedRecipient {
  email: string;
  name?: string;
  isManager?: boolean;
}

async function resolveRecipients(
  rule: NotificationRule,
  event: DomainEventPayload,
  managers: Array<{ email: string; name?: string; events: string[] }>,
): Promise<ResolvedRecipient[]> {
  if (rule.recipient === "customer") {
    // 052: cart.* events carry customerEmail on event.cart, not event.order
    // 053: return.* events carry customerEmail on event.returnData, not event.order
    const email =
      event.returnData?.customerEmail ??
      event.cart?.customerEmail ??
      event.order?.customer?.email;
    if (!email) return [];
    const name = event.order?.customer?.fullName;
    return [{ email, name }];
  }
  if (rule.recipient === "manager") {
    const subscribed = managers.filter(
      (m) => m.events.includes("everything") || m.events.includes(event.kind),
    );
    return subscribed.map((m) => ({ email: m.email, name: m.name, isManager: true }));
  }
  return [];
}

function checkRequires(requires: NotificationRequires | undefined, event: DomainEventPayload): boolean {
  if (!requires) return true;
  const order = event.order;
  // 054 FR-5431a: source-of-truth priority for opt-in flags:
  //   1. event.customer.* (direct customer event)
  //   2. event.cart.* (cart events carry their own consent)
  //   3. event.order.customer.* (order snapshot, fallback for guests)
  // For Order events with `customerId`, the caller should pre-load the Customer
  // and pass its flags via event.customer (helper: enrichOrderEventWithCustomer).
  const customer = event.customer;

  if (requires === "marketingOptIn") {
    if (customer?.marketingOptIn === true) return true;
    if ((event.cart as { marketingOptIn?: boolean } | undefined)?.marketingOptIn === true) return true;
    // 054 FR-5431a: if Customer is present, it's source-of-truth — don't fall
    // back to Order snapshot. (Customer's opt-out wins over Order's stale opt-in.)
    if (customer) return false;
    return order?.customer?.marketingOptIn === true;
  }
  if (requires === "messengerOptIn") {
    if (customer?.messengerOptIn === true) return true;
    if (customer) return false;
    return order?.customer?.messengerOptIn === true;
  }
  if (requires === "emailValid") {
    // если поле не задано — считаем true (default)
    if (customer && customer.emailValid === false) return false;
    const explicit = (order?.customer as { emailValid?: boolean } | undefined)?.emailValid;
    return explicit !== false;
  }
  return true;
}

function makeNotificationId(event: DomainEventPayload, rule: NotificationRule, recipient: string): string {
  const safeRecipient = recipient.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
  return `${event.eventId}:${rule.channel}:${rule.template}:${safeRecipient}`;
}

function buildPayload(event: DomainEventPayload, recipient: ResolvedRecipient): NotificationJobPayload {
  // 052/053: for cart.*/return.* events, synthesize a minimal OrderSnapshot-shaped object so
  // downstream templates that read order.customer.email don't crash. Templates that target
  // cart.*/return.* should read from event.cart / event.returnData directly.
  const order =
    event.order ??
    (event.cart
      ? ({
          id: event.cart.id,
          status: event.cart.status,
          customer: { email: event.cart.customerEmail },
        } as unknown as NotificationJobPayload["order"])
      : event.returnData
        ? ({
            id: event.returnData.orderId,
            clientNumber: event.returnData.orderClientNumber,
            status: "delivered",
            customer: { email: event.returnData.customerEmail },
          } as unknown as NotificationJobPayload["order"])
        : ({ id: "unknown", status: "unknown" } as unknown as NotificationJobPayload["order"]));

  return {
    order,
    event: {
      kind: event.kind,
      at: event.at,
      statusFrom: event.context?.statusFrom,
      statusTo: event.context?.statusTo,
      message: event.context?.errorMessage,
    },
    manager: recipient.isManager
      ? { email: recipient.email, fullName: recipient.name }
      : undefined,
  };
}

async function enqueueJob(input: {
  notificationId: string;
  /** Order FK for order/shipment/return.* events; null for cart.* events */
  orderId: string | null;
  /** 053 C2: polymorphic entity reference */
  entityCollection: "orders" | "carts" | "returns";
  entityId: string;
  event: string;
  channel: NotificationChannel;
  template: string;
  recipient: string;
  scheduledAt: string;
  payload: NotificationJobPayload;
  dedupKey: string;
}): Promise<boolean> {
  try {
    const p = await getPayload({ config: configPromise });
    const data: Record<string, unknown> = {
      notificationId: input.notificationId,
      entityCollection: input.entityCollection,
      entityId: input.entityId,
      event: input.event,
      channel: input.channel,
      template: input.template,
      recipient: input.recipient,
      scheduledAt: input.scheduledAt,
      status: "queued",
      attempt: 0,
      nextAttemptAt: input.scheduledAt,
      payload: input.payload as unknown as Record<string, unknown>,
      dedupKey: input.dedupKey,
    };
    if (input.orderId !== null) {
      data.orderId = Number(input.orderId);
    }
    await p.create({
      collection: "notification-jobs",
      data: data as never,
    });
    return true;
  } catch (err) {
    logWarn("emitter", "enqueue failed", { err: (err as Error).message });
    return false;
  }
}
