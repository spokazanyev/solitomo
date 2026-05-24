import type { NotificationJobPayload, RenderedMessage } from "../types";
import { customerName, formatPrice, orderPageUrl, siteUrl } from "./helpers";

export function renderT002InvoiceIssued(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const total = formatPrice(order.totals?.total);
  const url = orderPageUrl(order);
  const invoiceUrl = order.publicToken ? siteUrl(`/cart/order/${order.publicToken}/invoice.pdf`) : "";

  return {
    subject: `Счёт по заказу ${order.id}`,
    text: [
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
      .join("\n"),
  };
}
