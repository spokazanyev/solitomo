import type { NotificationJobPayload, RenderedMessage } from "../types";
import { customerName, orderPageUrl } from "./helpers";

export function renderT009Cancelled(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const url = orderPageUrl(order);
  const reason = payload.event.message ?? "";

  return {
    subject: `Заказ ${order.id} отменён`,
    text: [
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
      .join("\n"),
  };
}
