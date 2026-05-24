import type { NotificationJobPayload, RenderedMessage } from "../types";
import { customerName, formatDate, orderPageUrl } from "./helpers";

export function renderT007PickupReminder(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const delivery = (order.delivery ?? {}) as Record<string, unknown>;
  const pointAddress = typeof delivery.pointAddress === "string" ? delivery.pointAddress : "—";
  const pickupExpiresAt = typeof delivery.pickupExpiresAt === "string" ? delivery.pickupExpiresAt : undefined;
  const url = orderPageUrl(order);

  return {
    subject: `Напоминание: заказ ${order.id} ждёт вас в ПВЗ`,
    text: [
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
      .join("\n"),
  };
}
