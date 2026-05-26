import type { NotificationJobPayload, RenderedMessage } from "../types";
import {
  customerName,
  escapeHtml,
  formatDate,
  orderPageUrl,
  preferencesPageUrl,
  renderHtmlShell,
  styles,
} from "./helpers";

export function renderT004AtPoint(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const delivery = (order.delivery ?? {}) as Record<string, unknown>;
  const pointAddress =
    typeof delivery.pointAddress === "string" ? delivery.pointAddress : "—";
  const pickupExpiresAt =
    typeof delivery.pickupExpiresAt === "string" ? delivery.pickupExpiresAt : undefined;
  const url = orderPageUrl(order);
  const unsubscribe = preferencesPageUrl(order);
  const subject = `Заказ ${order.id} прибыл в пункт выдачи`;

  const text = [
    `Здравствуйте, ${name}!`,
    ``,
    `Ваш заказ прибыл в пункт выдачи:`,
    pointAddress,
    pickupExpiresAt ? `Срок хранения до: ${formatDate(pickupExpiresAt)}` : "",
    ``,
    url ? `Страница заказа: ${url}` : "",
    ``,
    `— Команда Soliton`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}">Заказ ${escapeHtml(order.id)} в пункте выдачи</h1>`,
    `<p style="${styles.p}">Здравствуйте, ${escapeHtml(name)}!</p>`,
    `<p style="${styles.p}">Ваш заказ ждёт вас в пункте выдачи:</p>`,
    `<p style="${styles.p}"><b>${escapeHtml(pointAddress)}</b></p>`,
    pickupExpiresAt
      ? `<p style="${styles.p}">Срок хранения до: <b>${escapeHtml(formatDate(pickupExpiresAt))}</b></p>`
      : "",
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
      preheader: "Заберите заказ из пункта выдачи",
      unsubscribeUrl: unsubscribe || undefined,
    }),
    listUnsubscribeUrl: unsubscribe || undefined,
  };
}
