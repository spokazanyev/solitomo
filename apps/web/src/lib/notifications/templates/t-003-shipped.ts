import type { NotificationJobPayload, RenderedMessage } from "../types";
import { customerName, escapeHtml, orderPageUrl, renderHtmlShell, styles } from "./helpers";

export function renderT003Shipped(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const shipment = (order.shipment ?? {}) as Record<string, unknown>;
  const delivery = (order.delivery ?? {}) as Record<string, unknown>;
  const trackingNumber = typeof shipment.trackingNumber === "string" ? shipment.trackingNumber : "";
  const trackingUrl = typeof shipment.trackingUrl === "string" ? shipment.trackingUrl : "";
  const providerName = typeof delivery.providerName === "string" ? delivery.providerName : "перевозчику";
  const url = orderPageUrl(order);
  const subject = trackingNumber
    ? `Заказ ${order.id} отправлен. Трек: ${trackingNumber}`
    : `Заказ ${order.id} отправлен`;

  const text = [
    `Здравствуйте, ${name}!`,
    ``,
    `Ваш заказ передан в ${providerName}.`,
    trackingNumber ? `Трек-номер: ${trackingNumber}` : "",
    trackingUrl ? `Отследить: ${trackingUrl}` : "",
    ``,
    url ? `Страница заказа: ${url}` : "",
    ``,
    `— Команда Soliton`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}">Заказ ${escapeHtml(order.id)} в пути</h1>`,
    `<p style="${styles.p}">Здравствуйте, ${escapeHtml(name)}!</p>`,
    `<p style="${styles.p}">Ваш заказ передан в <b>${escapeHtml(providerName)}</b>.</p>`,
    trackingNumber
      ? `<p style="${styles.p}">Трек-номер: <b>${escapeHtml(trackingNumber)}</b></p>`
      : "",
    trackingUrl
      ? `<p><a href="${escapeHtml(trackingUrl)}" style="${styles.cta}">Отследить</a></p>`
      : url
        ? `<p><a href="${escapeHtml(url)}" style="${styles.cta}">Страница заказа</a></p>`
        : "",
  ]
    .filter(Boolean)
    .join("");

  return {
    subject,
    text,
    html: renderHtmlShell(bodyHtml, { preheader: trackingNumber ? `Трек: ${trackingNumber}` : "В пути" }),
  };
}
