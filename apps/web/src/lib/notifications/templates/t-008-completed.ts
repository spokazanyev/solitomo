import type { NotificationJobPayload, RenderedMessage } from "../types";
import {
  customerName,
  escapeHtml,
  orderPageUrl,
  preferencesPageUrl,
  renderHtmlShell,
  reviewPageUrl,
  styles,
} from "./helpers";

/**
 * T-008 — Маркетинговое письмо «оцените покупку».
 * FR-4951: обязана содержать ссылку отписки.
 */
export function renderT008Completed(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const review = reviewPageUrl(order);
  const orderUrl = orderPageUrl(order);
  const unsubscribe = preferencesPageUrl(order);
  const subject = `Как прошла покупка?`;

  const text = [
    `Здравствуйте, ${name}!`,
    ``,
    `Прошло 2 недели с доставки вашего заказа ${order.id}.`,
    `Мы закрываем сделку — спасибо за доверие!`,
    ``,
    review ? `Если не сложно, оцените покупку: ${review}` : "",
    orderUrl ? `Страница заказа: ${orderUrl}` : "",
    ``,
    unsubscribe ? `Не хотите получать маркетинговые письма? Управление подпиской: ${unsubscribe}` : "",
    ``,
    `— Команда Soliton`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}">Как прошла покупка?</h1>`,
    `<p style="${styles.p}">Здравствуйте, ${escapeHtml(name)}!</p>`,
    `<p style="${styles.p}">Прошло 2 недели с доставки вашего заказа <b>${escapeHtml(order.id)}</b>. Мы закрываем сделку — спасибо за доверие!</p>`,
    review
      ? `<p><a href="${escapeHtml(review)}" style="${styles.cta}">Оценить покупку</a></p>`
      : "",
    orderUrl
      ? `<p style="${styles.p}"><a href="${escapeHtml(orderUrl)}">Страница заказа</a></p>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return {
    subject,
    text,
    html: renderHtmlShell(bodyHtml, {
      preheader: `Оцените заказ ${order.id}`,
      unsubscribeUrl: unsubscribe || undefined,
    }),
  };
}
