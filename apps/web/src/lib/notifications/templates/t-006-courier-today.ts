import type { NotificationJobPayload, RenderedMessage } from "../types";
import { customerName, orderPageUrl } from "./helpers";

export function renderT006CourierToday(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const url = orderPageUrl(order);
  const delivery = (order.delivery ?? {}) as Record<string, unknown>;
  const address = typeof delivery.address === "string" ? delivery.address : "";

  return {
    subject: `Курьер выехал к вам с заказом ${order.id}`,
    text: [
      `Здравствуйте, ${name}!`,
      ``,
      `Курьер сегодня доставит ваш заказ${address ? ` по адресу: ${address}` : ""}.`,
      `Пожалуйста, будьте на связи.`,
      ``,
      url ? `Страница заказа: ${url}` : "",
      ``,
      `— Команда Soliton`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
