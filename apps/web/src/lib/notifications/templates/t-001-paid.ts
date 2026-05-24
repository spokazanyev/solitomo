import type { NotificationJobPayload, RenderedMessage } from "../types";
import { customerName, escapeHtml, formatPrice, orderPageUrl, renderHtmlShell, styles } from "./helpers";

export function renderT001Paid(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const total = formatPrice(order.totals?.total);
  const url = orderPageUrl(order);
  const subject = `Заказ ${order.id} оплачен`;

  const text = [
    `Здравствуйте, ${name}!`,
    ``,
    `Мы получили вашу оплату на сумму ${total}.`,
    ``,
    `Следующий шаг: мы передадим заказ в службу доставки в течение 1 рабочего дня`,
    `и пришлём вам трек-номер.`,
    ``,
    url ? `Страница заказа: ${url}` : "",
    ``,
    `— Команда Soliton`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}">Спасибо за заказ ${escapeHtml(order.id)}</h1>`,
    `<p style="${styles.p}">Здравствуйте, ${escapeHtml(name)}!</p>`,
    `<p style="${styles.p}">Мы получили вашу оплату на сумму <b>${escapeHtml(total)}</b>.</p>`,
    `<p style="${styles.p}">Следующий шаг: мы передадим заказ в службу доставки в течение 1 рабочего дня и пришлём вам трек-номер.</p>`,
    url
      ? `<p><a href="${escapeHtml(url)}" style="${styles.cta}">Страница заказа</a></p>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return {
    subject,
    text,
    html: renderHtmlShell(bodyHtml, { preheader: `Оплата получена: ${total}` }),
  };
}
