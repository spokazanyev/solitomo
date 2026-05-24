import type { NotificationJobPayload, RenderedMessage } from "../types";
import { formatPrice, orderPageUrl } from "./helpers";

/**
 * Messenger-шаблоны (placeholder для спеки 050).
 *
 * В 049 эти шаблоны рендерятся, но job становится skipped с reason=no_sender_registered,
 * потому что MessengerSender не зарегистрирован. После релиза 050 рендер используется.
 */
type MessengerKind = "paid" | "shipped" | "at_point" | "delivered";

export function renderMessenger(kind: MessengerKind) {
  return function (payload: NotificationJobPayload): RenderedMessage {
    const order = payload.order;
    const url = orderPageUrl(order);
    let text = "";
    switch (kind) {
      case "paid":
        text = `Soliton: оплата по заказу ${order.id} получена (${formatPrice(order.totals?.total)}).${url ? "\n" + url : ""}`;
        break;
      case "shipped": {
        const shipment = (order.shipment ?? {}) as Record<string, unknown>;
        const track = typeof shipment.trackingNumber === "string" ? shipment.trackingNumber : "";
        text = `Soliton: заказ ${order.id} отправлен${track ? `, трек ${track}` : ""}.${url ? "\n" + url : ""}`;
        break;
      }
      case "at_point": {
        const delivery = (order.delivery ?? {}) as Record<string, unknown>;
        const point = typeof delivery.pointAddress === "string" ? delivery.pointAddress : "";
        text = `Soliton: заказ ${order.id} ждёт вас в ПВЗ${point ? ` (${point})` : ""}.${url ? "\n" + url : ""}`;
        break;
      }
      case "delivered":
        text = `Soliton: заказ ${order.id} доставлен. Спасибо!${url ? "\n" + url : ""}`;
        break;
    }
    return {
      subject: `messenger:${kind}`,
      text,
    };
  };
}
