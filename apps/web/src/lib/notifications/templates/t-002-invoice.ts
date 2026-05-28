import type { NotificationJobPayload, RenderedMessage } from "../types";
import {
  customerName,
  escapeHtml,
  formatPrice,
  orderPageUrl,
  preferencesPageUrl,
  renderHtmlShell,
  siteUrl,
  styles,
} from "./helpers";

export function renderT002InvoiceIssued(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const total = formatPrice(order.totals?.total);
  const url = orderPageUrl(order);
  // 049 fix: реальный PDF-эндпоинт — /api/invoice/[orderId]/, который принимает
  // и publicToken (см. apps/web/src/app/api/invoice/[orderId]/route.ts). Старая
  // ссылка /cart/order/{token}/invoice.pdf указывала на несуществующий route → 404.
  const invoiceUrl = order.publicToken
    ? siteUrl(`/api/invoice/${order.publicToken}/`)
    : "";
  const unsubscribe = preferencesPageUrl(order);
  const subject = `Счёт по заказу ${order.id}`;

  const text = [
    `Здравствуйте, ${name}!`,
    ``,
    `Вам выставлен счёт по заказу ${order.id} на сумму ${total}.`,
    invoiceUrl ? `Скачать счёт: ${invoiceUrl}` : "",
    url ? `Страница заказа: ${url}` : "",
    ``,
    `Срок действия счёта — 5 рабочих дней.`,
    ``,
    `— Команда Soliton`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}">Счёт по заказу ${escapeHtml(order.id)}</h1>`,
    `<p style="${styles.p}">Здравствуйте, ${escapeHtml(name)}!</p>`,
    `<p style="${styles.p}">Вам выставлен счёт на сумму <b>${escapeHtml(total)}</b>. Срок действия — <b>5 рабочих дней</b>.</p>`,
    invoiceUrl
      ? `<p><a href="${escapeHtml(invoiceUrl)}" style="${styles.cta}">Скачать счёт (PDF)</a></p>`
      : "",
    url
      ? `<p style="${styles.p}"><a href="${escapeHtml(url)}">Страница заказа</a></p>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return {
    subject,
    text,
    html: renderHtmlShell(bodyHtml, {
      preheader: `Счёт на ${total} — действует 5 рабочих дней`,
      unsubscribeUrl: unsubscribe || undefined,
    }),
    listUnsubscribeUrl: unsubscribe || undefined,
  };
}
