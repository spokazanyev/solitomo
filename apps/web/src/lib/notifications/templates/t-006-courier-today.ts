import type { NotificationJobPayload, RenderedMessage } from "../types";
import {
  customerName,
  escapeHtml,
  orderPageUrl,
  preferencesPageUrl,
  renderHtmlShell,
  styles,
} from "./helpers";

export function renderT006CourierToday(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const url = orderPageUrl(order);
  const delivery = (order.delivery ?? {}) as Record<string, unknown>;
  const address = typeof delivery.address === "string" ? delivery.address : "";
  const unsubscribe = preferencesPageUrl(order);
  const subject = `Курьер выехал к вам с заказом ${order.id}`;

  const text = [
    `Здравствуйте, ${name}!`,
    ``,
    `Курьер сегодня доставит ваш заказ${address ? ` по адресу: ${address}` : ""}.`,
    `Пожалуйста, будьте на связи.`,
    ``,
    url ? `Страница заказа: ${url}` : "",
    ``,
    `— Команда Soliton`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}">Курьер уже в пути</h1>`,
    `<p style="${styles.p}">Здравствуйте, ${escapeHtml(name)}!</p>`,
    `<p style="${styles.p}">Курьер сегодня доставит ваш заказ <b>${escapeHtml(order.id)}</b>${address ? ` по адресу: <b>${escapeHtml(address)}</b>` : ""}.</p>`,
    `<p style="${styles.p}">Пожалуйста, будьте на связи.</p>`,
    url
      ? `<p><a href="${escapeHtml(url)}" style="${styles.cta}">Страница заказа</a></p>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return {
    subject,
    text,
    html: renderHtmlShell(bodyHtml, {
      preheader: "Курьер уже едет к вам",
      unsubscribeUrl: unsubscribe || undefined,
    }),
    listUnsubscribeUrl: unsubscribe || undefined,
  };
}
