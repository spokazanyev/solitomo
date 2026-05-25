import type { NotificationJobPayload, RenderedMessage } from "../types";
import { adminOrderUrl, formatPrice } from "./helpers";

function managerHeader(payload: NotificationJobPayload): string {
  const order = payload.order;
  return [
    `Заказ: ${order.id}`,
    `Покупатель: ${order.customer?.companyName ?? order.customer?.fullName ?? "—"}`,
    `Email: ${order.customer?.email ?? "—"}`,
    `Телефон: ${order.customer?.phone ?? "—"}`,
    `Сумма: ${formatPrice(order.totals?.total)}`,
    `Статус: ${order.status}`,
    ``,
    `Карточка в админке: ${adminOrderUrl(order.id)}`,
    payload.order.crmRefs && (payload.order.crmRefs as { opportunityId?: string }).opportunityId
      ? `Twenty CRM Opportunity: ${(payload.order.crmRefs as { opportunityId?: string }).opportunityId}`
      : "",
    ``,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderT101ManagerPaid(payload: NotificationJobPayload): RenderedMessage {
  return {
    subject: `[Soliton] Оплачен заказ ${payload.order.id}`,
    text: `Поступила оплата. Заказ нужно собрать и отправить.\n\n${managerHeader(payload)}`,
  };
}

export function renderT102ManagerInvoice(payload: NotificationJobPayload): RenderedMessage {
  return {
    subject: `[Soliton] Выставлен счёт по заказу ${payload.order.id}`,
    text: `Юрлицу выставлен счёт.\n\n${managerHeader(payload)}`,
  };
}

export function renderT103ManagerError(payload: NotificationJobPayload): RenderedMessage {
  const err = payload.event.message ?? "—";
  return {
    subject: `[Soliton] Ошибка отправления по заказу ${payload.order.id}`,
    text: `Ошибка в отправлении (shipment.error). Нужно вмешательство.\n\nТекст ошибки: ${err}\n\n${managerHeader(payload)}`,
  };
}

export function renderT104ManagerStuck(payload: NotificationJobPayload): RenderedMessage {
  return {
    subject: `[Soliton] Заказ ${payload.order.id} «застрял»`,
    text: `Заказ не меняет статус дольше порога. Нужно проверить вручную.\n\n${managerHeader(payload)}`,
  };
}

export function renderT105ManagerCancelled(payload: NotificationJobPayload): RenderedMessage {
  const reason = payload.event.message ?? "—";
  return {
    subject: `[Soliton] Заказ ${payload.order.id} отменён`,
    text: `Заказ отменён.\nПричина: ${reason}\n\n${managerHeader(payload)}`,
  };
}
