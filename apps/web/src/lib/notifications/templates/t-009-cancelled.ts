import type { NotificationJobPayload, RenderedMessage } from "../types";
import {
  customerName,
  escapeHtml,
  orderPageUrl,
  preferencesPageUrl,
  renderHtmlShell,
  styles,
} from "./helpers";

export function renderT009Cancelled(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const url = orderPageUrl(order);
  const reason = payload.event.message ?? "";
  const unsubscribe = preferencesPageUrl(order);
  const subject = `Заказ ${order.id} отменён`;

  const text = [
    `Здравствуйте, ${name}!`,
    ``,
    `Ваш заказ ${order.id} был отменён.`,
    reason ? `Причина: ${reason}` : "",
    ``,
    `Если оплата уже прошла — мы вернём средства в течение 3–10 рабочих дней.`,
    ``,
    url ? `Страница заказа: ${url}` : "",
    ``,
    `— Команда Soliton`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}">Заказ ${escapeHtml(order.id)} отменён</h1>`,
    `<p style="${styles.p}">Здравствуйте, ${escapeHtml(name)}!</p>`,
    `<p style="${styles.p}">Ваш заказ был отменён.</p>`,
    reason
      ? `<p style="${styles.p}">Причина: ${escapeHtml(reason)}</p>`
      : "",
    `<p style="${styles.p}">Если оплата уже прошла — мы вернём средства в течение <b>3–10 рабочих дней</b>.</p>`,
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
      preheader: `Заказ ${order.id} отменён`,
      unsubscribeUrl: unsubscribe || undefined,
    }),
    listUnsubscribeUrl: unsubscribe || undefined,
  };
}
