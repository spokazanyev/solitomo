import type { Order } from "@/payload-types";
import type {
  DomainEventHandler,
  DomainEventKind,
  DomainEventPayload,
} from "@/lib/domain-events/types";

interface NotificationChannel {
  send(subject: string, body: string): Promise<void>;
}

interface EmailChannel extends NotificationChannel {
  sendTo(email: string, subject: string, body: string): Promise<void>;
}

const channels: {
  admin?: NotificationChannel;
  email?: EmailChannel;
  telegram?: NotificationChannel;
} = {};

export function registerAdminChannel(ch: NotificationChannel): void {
  channels.admin = ch;
}

export function registerEmailChannel(ch: EmailChannel): void {
  channels.email = ch;
}

export function registerTelegramChannel(ch: NotificationChannel): void {
  channels.telegram = ch;
}

function formatOrderSummary(order: Order): string {
  const items = order.items
    .map((i) => `${i.name} x${i.quantity}`)
    .join(", ");
  const total = order.totals?.total;
  const totalStr = total != null ? ` — ${total} RUB` : "";
  return `Order #${order.id} (${order.status}): ${items}${totalStr}`;
}

function subjectForKind(kind: DomainEventKind): string {
  switch (kind) {
    case "order.created":
      return "New order received";
    case "order.status_changed":
      return "Order status changed";
    case "order.cancelled":
      return "Order cancelled";
    case "order.updated":
      return "Order updated";
    case "cart.created":
      return "New cart created";
    case "cart.updated":
      return "Cart updated";
    case "cart.abandoned":
      return "Cart abandoned";
    case "return.requested":
      return "Return requested";
    case "return.approved":
      return "Return approved";
    case "return.completed":
      return "Return completed";
  }
}

function isOrderEvent(
  kind: DomainEventKind,
): kind is `order.${string}` & DomainEventKind {
  return kind.startsWith("order.");
}

async function notifyAdmin(
  event: DomainEventPayload,
): Promise<void> {
  if (!channels.admin) return;

  const subject = subjectForKind(event.kind);

  if (!isOrderEvent(event.kind) || !event.order) {
    await channels.admin.send(subject, `Event: ${event.kind}`);
    return;
  }

  const body = formatOrderSummary(event.order);
  await channels.admin.send(subject, body);
}

async function notifyCustomer(
  event: DomainEventPayload,
): Promise<void> {
  if (!channels.email) return;
  if (!event.order) return;

  const email = event.order.customer?.email;
  if (!email) return;

  const subject = subjectForKind(event.kind);
  const body = formatOrderSummary(event.order);
  await channels.email.sendTo(email, subject, body);
}

async function notifyTelegram(
  event: DomainEventPayload,
): Promise<void> {
  if (!channels.telegram) return;
  if (!event.order) return;

  const subject = subjectForKind(event.kind);
  const body = formatOrderSummary(event.order);
  await channels.telegram.send(subject, body);
}

export const notificationEmitter: DomainEventHandler = async (
  event: DomainEventPayload,
) => {
  await Promise.allSettled([
    notifyAdmin(event),
    notifyCustomer(event),
    notifyTelegram(event),
  ]);
};
