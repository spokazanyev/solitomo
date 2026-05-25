import type { NotificationJobPayload, RenderedMessage } from "../types";
import { customerName, formatDate, orderPageUrl } from "./helpers";

export function renderT004AtPoint(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const delivery = (order.delivery ?? {}) as Record<string, unknown>;
  const pointAddress = typeof delivery.pointAddress === "string" ? delivery.pointAddress : "—";
  const pickupExpiresAt = typeof delivery.pickupExpiresAt === "string" ? delivery.pickupExpiresAt : undefined;
  const url = orderPageUrl(order);

  return {
    subject: `Заказ ${order.id} прибыл в пункт выдачи`,
    text: [
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
      .join("\n"),
  };
}
