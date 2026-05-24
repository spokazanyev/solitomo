import type { NotificationJobPayload, RenderedMessage } from "../types";
import { customerName, escapeHtml, orderPageUrl, renderHtmlShell, styles } from "./helpers";

export function renderT005Delivered(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const url = orderPageUrl(order);
  const subject = `Заказ ${order.id} доставлен`;

  const text = [
    `Здравствуйте, ${name}!`,
    ``,
    `Спасибо! Ваш заказ доставлен.`,
    `Сохраните чек, который пришёл вам при оплате.`,
    ``,
    `Если что-то не так, у вас есть 14 дней, чтобы оформить возврат.`,
    url ? `\nСтраница заказа: ${url}` : "",
    ``,
    `— Команда Soliton`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}">Заказ ${escapeHtml(order.id)} доставлен</h1>`,
    `<p style="${styles.p}">Здравствуйте, ${escapeHtml(name)}!</p>`,
    `<p style="${styles.p}">Спасибо! Ваш заказ доставлен. Сохраните чек, который пришёл вам при оплате.</p>`,
    `<p style="${styles.p}">Если что-то не так, у вас есть <b>14 дней</b>, чтобы оформить возврат.</p>`,
    url
      ? `<p><a href="${escapeHtml(url)}" style="${styles.cta}">Страница заказа</a></p>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return {
    subject,
    text,
    html: renderHtmlShell(bodyHtml, { preheader: "Заказ доставлен" }),
  };
}
