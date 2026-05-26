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

export function renderT007PickupReminder(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const delivery = (order.delivery ?? {}) as Record<string, unknown>;
  const pointAddress =
    typeof delivery.pointAddress === "string" ? delivery.pointAddress : "—";
  const pickupExpiresAt =
    typeof delivery.pickupExpiresAt === "string" ? delivery.pickupExpiresAt : undefined;
  const url = orderPageUrl(order);
  const unsubscribe = preferencesPageUrl(order);
  const subject = `Напоминание: заказ ${order.id} ждёт вас в ПВЗ`;

  const text = [
    `Здравствуйте, ${name}!`,
    ``,
    `Это напоминание: ваш заказ всё ещё ждёт вас в пункте выдачи.`,
    ``,
    `Адрес: ${pointAddress}`,
    pickupExpiresAt ? `Срок хранения истекает: ${formatDate(pickupExpiresAt)}` : "",
    ``,
    `Если вы не заберёте заказ до конца срока, он будет возвращён отправителю.`,
    ``,
    url ? `Страница заказа: ${url}` : "",
    ``,
    `— Команда Soliton`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}">Ваш заказ ещё в ПВЗ</h1>`,
    `<p style="${styles.p}">Здравствуйте, ${escapeHtml(name)}!</p>`,
    `<p style="${styles.p}">Напоминаем: ваш заказ <b>${escapeHtml(order.id)}</b> ждёт вас в пункте выдачи.</p>`,
    `<p style="${styles.p}"><b>${escapeHtml(pointAddress)}</b></p>`,
    pickupExpiresAt
      ? `<p style="${styles.p}">⚠️ Срок хранения истекает: <b>${escapeHtml(formatDate(pickupExpiresAt))}</b>. После этой даты заказ будет возвращён отправителю.</p>`
      : `<p style="${styles.p}">Если вы не заберёте заказ до конца срока хранения, он будет возвращён отправителю.</p>`,
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
      preheader: "Заберите заказ — срок хранения заканчивается",
      unsubscribeUrl: unsubscribe || undefined,
    }),
    listUnsubscribeUrl: unsubscribe || undefined,
  };
}
