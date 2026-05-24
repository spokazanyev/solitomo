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

  // 052: For cart.* events, the "entity id" is the cart id (event.order is absent).
  // For order/shipment/return events, fall back to event.order.id.
  const entityId =
    (event.kind.startsWith("cart.") && event.cart?.id) ||
    event.order?.id ||
    "unknown";

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
        orderId: String(entityId),
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
        orderId: String(entityId),
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
    const email = event.cart?.customerEmail ?? event.order?.customer?.email;
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
  if (requires === "marketingOptIn") {
    // 052: cart events carry marketingOptIn on the cart snapshot
    const cartOptIn = (event.cart as { marketingOptIn?: boolean } | undefined)?.marketingOptIn;
    if (cartOptIn === true) return true;
    return order?.customer?.marketingOptIn === true;
  }
  if (requires === "messengerOptIn") {
    return order?.customer?.messengerOptIn === true;
  }
  if (requires === "emailValid") {
    // если поле не задано — считаем true (default)
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
  // 052: for cart.* events, synthesize a minimal OrderSnapshot-shaped object from cart data
  // so downstream templates that expect order.customer.email don't crash.
  const order = event.order ?? (event.cart
    ? ({
        id: event.cart.id,
        status: event.cart.status,
        customer: { email: event.cart.customerEmail },
        // Bare minimum fields — templates targeting cart.* should look at event.cart instead.
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
  orderId: string;
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
    await p.create({
      collection: "notification-jobs",
      data: {
        notificationId: input.notificationId,
        orderId: Number(input.orderId),
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
      },
    });
    return true;
  } catch (err) {
    logWarn("emitter", "enqueue failed", { err: (err as Error).message });
    return false;
  }
}
