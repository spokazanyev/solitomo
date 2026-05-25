import "server-only";

/**
 * Минимальный email-stub для 047 MVP.
 *
 * FR-408: на 4 события (paid, shipped/created, delivered, completed) отправляем шаблонный email.
 * FR-116: если EMAIL_API_KEY пуст или EMAIL_SANDBOX=true → dry-run, только логируем.
 * После релиза 049 этот stub снимается.
 */

import { registerSubscriber, type DomainEventPayload, type DomainEventSubscriber } from "../lifecycle/events";

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function formatPrice(amount: number | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function siteUrl(path: string): string {
  const base = process.env.SITE_URL ?? "https://soliton.ru";
  return `${base.replace(/\/$/, "")}${path}`;
}

export function renderPaidEmail(event: DomainEventPayload): EmailMessage | null {
  const order = event.order;
  const email = order?.customer?.email;
  if (!email || !order) return null;
  const orderLabel = order.clientNumber ?? order.id; // 051: prefer clientNumber
  const orderUrl = order.publicToken ? siteUrl(`/cart/order/${order.publicToken}/`) : "";
  return {
    to: email,
    subject: `[${orderLabel}] Заказ оплачен`,
    text: [
      `Здравствуйте, ${order.customer?.fullName ?? order.customer?.companyName ?? ""}!`,
      ``,
      `Мы получили вашу оплату на сумму ${formatPrice(order.totals?.total)}.`,
      ``,
      `Следующий шаг: мы передадим заказ в службу доставки в течение 1 рабочего дня`,
      `и пришлём вам трек-номер.`,
      ``,
      orderUrl ? `Страница заказа: ${orderUrl}` : "",
      ``,
      `— Команда Soliton`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function renderShippedEmail(event: DomainEventPayload): EmailMessage | null {
  const order = event.order;
  const email = order?.customer?.email;
  if (!email || !order) return null;
  const orderLabel = order.clientNumber ?? order.id; // 051
  const shipment = order.shipment ?? {};
  const trackingNumber = shipment.trackingNumber as string | undefined;
  const trackingUrl = shipment.trackingUrl as string | undefined;
  const providerName = (order.delivery?.providerName as string | undefined) ?? "перевозчику";
  const orderUrl = order.publicToken ? siteUrl(`/cart/order/${order.publicToken}/`) : "";
  return {
    to: email,
    subject: `[${orderLabel}] Заказ отправлен${trackingNumber ? `. Трек: ${trackingNumber}` : ""}`,
    text: [
      `Ваш заказ передан в ${providerName}.`,
      trackingNumber ? `Трек-номер: ${trackingNumber}` : "",
      trackingUrl ? `Отследить: ${trackingUrl}` : "",
      ``,
      orderUrl ? `Страница заказа: ${orderUrl}` : "",
      ``,
      `— Команда Soliton`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function renderDeliveredEmail(event: DomainEventPayload): EmailMessage | null {
  const order = event.order;
  const email = order?.customer?.email;
  if (!email || !order) return null;
  const orderLabel = order.clientNumber ?? order.id; // 051
  const orderUrl = order.publicToken ? siteUrl(`/cart/order/${order.publicToken}/`) : "";
  return {
    to: email,
    subject: `[${orderLabel}] Заказ доставлен`,
    text: [
      `Спасибо! Ваш заказ доставлен.`,
      `Сохраните чек, который пришёл вам при оплате.`,
      ``,
      `Если что-то не так, у вас есть 14 дней, чтобы оформить возврат.`,
      orderUrl ? `\nСтраница заказа: ${orderUrl}` : "",
      ``,
      `— Команда Soliton`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function renderCompletedEmail(event: DomainEventPayload): EmailMessage | null {
  const order = event.order;
  const email = order?.customer?.email;
  if (!email || !order) return null;
  const orderLabel = order.clientNumber ?? order.id; // 051
  const reviewUrl = order.publicToken ? siteUrl(`/cart/order/${order.publicToken}/review/`) : "";
  return {
    to: email,
    subject: `[${orderLabel}] Как прошла покупка?`,
    text: [
      `Прошло 2 недели с доставки вашего заказа ${orderLabel}.`,
      `Мы закрываем сделку — спасибо за доверие!`,
      ``,
      reviewUrl ? `Если не сложно, оцените покупку: ${reviewUrl}` : "",
      ``,
      `— Команда Soliton`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function sendStubEmail(msg: EmailMessage): Promise<{ status: "sent" | "skipped" | "failed"; reason?: string; externalRef?: string }> {
  const apiKey = process.env.EMAIL_API_KEY;
  const sandbox = process.env.EMAIL_SANDBOX === "true";
  if (!apiKey || sandbox) {
    // FR-116: dry-run, только логирование
    // eslint-disable-next-line no-console
    console.info("[email-stub:dry-run]", { to: maskEmail(msg.to), subject: msg.subject });
    return { status: "skipped", reason: !apiKey ? "no_api_key" : "sandbox" };
  }

  const provider = (process.env.EMAIL_PROVIDER ?? "postmark").toLowerCase();
  try {
    if (provider === "postmark") {
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Postmark-Server-Token": apiKey,
        },
        body: JSON.stringify({
          From: process.env.EMAIL_FROM ?? "orders@soliton.ru",
          To: msg.to,
          Subject: msg.subject,
          TextBody: msg.text,
          HtmlBody: msg.html,
          MessageStream: "outbound",
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "unknown");
        return { status: "failed", reason: `postmark ${res.status}: ${errText}` };
      }
      const data = (await res.json().catch(() => ({}))) as { MessageID?: string };
      return { status: "sent", externalRef: data.MessageID };
    }
    if (provider === "mailgun") {
      const domain = process.env.EMAIL_MAILGUN_DOMAIN;
      if (!domain) return { status: "failed", reason: "EMAIL_MAILGUN_DOMAIN missing" };
      const form = new URLSearchParams();
      form.set("from", process.env.EMAIL_FROM ?? "orders@soliton.ru");
      form.set("to", msg.to);
      form.set("subject", msg.subject);
      form.set("text", msg.text);
      if (msg.html) form.set("html", msg.html);
      const auth = Buffer.from(`api:${apiKey}`).toString("base64");
      const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "unknown");
        return { status: "failed", reason: `mailgun ${res.status}: ${errText}` };
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return { status: "sent", externalRef: data.id };
    }
    return { status: "failed", reason: `Unsupported provider: ${provider}` };
  } catch (err) {
    return { status: "failed", reason: (err as Error).message };
  }
}

function maskEmail(email: string): string {
  const [, domain] = email.split("@");
  return domain ? `***@${domain}` : "***";
}

const stubHandler: DomainEventSubscriber = {
  name: "047-email-stub",
  kinds: ["order.paid", "shipment.created", "shipment.delivered", "order.completed"],
  async handle(event) {
    let msg: EmailMessage | null = null;
    if (event.kind === "order.paid") msg = renderPaidEmail(event);
    else if (event.kind === "shipment.created") msg = renderShippedEmail(event);
    else if (event.kind === "shipment.delivered") msg = renderDeliveredEmail(event);
    else if (event.kind === "order.completed") msg = renderCompletedEmail(event);
    if (!msg) return;
    const result = await sendStubEmail(msg);
    // eslint-disable-next-line no-console
    console.info(`[047-email-stub] ${event.kind} → ${result.status}${result.reason ? ` (${result.reason})` : ""}`);
  },
};

let registered = false;
export function registerStubEmailSubscriber(): void {
  if (registered) return;
  registerSubscriber(stubHandler);
  registered = true;
}
