/**
 * T-015: Payment expired customer email (056 US4, FR-5640).
 *
 * Triggered by `payment.expired` domain event from 055 webhook handler
 * либо cron `payments-expire` (FR-5552, FR-5582).
 *
 * Contract: specs/056-yookassa-frontend-integration/contracts/email-templates.md §T-015.
 * 2 CTAs: primary (recovery via /cart/?recover={cartId}) + secondary (new /cart/).
 */

import type { NotificationJobPayload, RenderedMessage } from "../types";
import {
  customerName,
  escapeHtml,
  formatPrice,
  renderHtmlShell,
  siteUrl,
  styles,
} from "./helpers";

export function renderT015PaymentExpired(
  payload: NotificationJobPayload,
): RenderedMessage {
  const order = payload.order;
  const name = customerName(order);
  const clientNumber = order.clientNumber ?? String(order.id);
  const total = formatPrice(order.totals?.total);
  const itemsCount = order.items?.length ?? 0;

  // Cart-recovery link (OQ-6: оба CTA). OrderSnapshot doesn't expose cartId
  // directly; cast through unknown to read the underlying Payload-shape.
  const cartIdRaw = (order as unknown as { cartId?: string | number | { id?: string | number } }).cartId;
  const cartId =
    typeof cartIdRaw === "string" || typeof cartIdRaw === "number"
      ? cartIdRaw
      : cartIdRaw?.id;
  const recoveryUrl = cartId
    ? siteUrl(`/cart/?recover=${encodeURIComponent(String(cartId))}`)
    : siteUrl("/cart/");
  const newCartUrl = siteUrl("/cart/");

  const subject = `Заказ ${clientNumber} аннулирован — оплата не получена`;
  const preheader = "Корзина сохранена, можно вернуться и оплатить.";

  const text = [
    `Здравствуйте, ${name}!`,
    ``,
    `К сожалению, оплата за заказ ${clientNumber} не получена в течение 60 минут.`,
    `Заказ автоматически аннулирован.`,
    ``,
    total ? `Сумма заказа: ${total}` : "",
    itemsCount > 0 ? `Позиций: ${itemsCount}` : "",
    ``,
    `Ваша корзина сохранена. Если у вас возникли сложности с оплатой —`,
    `ответьте на это письмо, мы поможем.`,
    ``,
    `Вернуться к заказу: ${recoveryUrl}`,
    `Оформить заново: ${newCartUrl}`,
    ``,
    `— Команда Soliton`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}">Заказ ${escapeHtml(clientNumber)} аннулирован</h1>`,
    `<p style="${styles.p}">Здравствуйте, ${escapeHtml(name)}!</p>`,
    `<p style="${styles.p}">К сожалению, оплата за заказ <b>${escapeHtml(clientNumber)}</b> не была получена в течение 60 минут. Заказ автоматически аннулирован, но <b>корзина сохранена</b>.</p>`,
    total
      ? `<p style="${styles.p}">Сумма заказа: <b>${escapeHtml(total)}</b>${itemsCount > 0 ? ` · ${itemsCount} ${itemsCount === 1 ? "позиция" : "позиций"}` : ""}</p>`
      : "",
    `<p style="${styles.p}">Если у вас возникли сложности с оплатой — просто ответьте на это письмо, мы поможем.</p>`,
    `<p style="text-align:center; padding:20px 0"><a href="${escapeHtml(recoveryUrl)}" style="${styles.cta}">Вернуться к заказу</a></p>`,
    `<p style="${styles.p}; text-align:center">Или <a href="${escapeHtml(newCartUrl)}">оформить заново</a></p>`,
  ]
    .filter(Boolean)
    .join("");

  return {
    subject,
    text,
    html: renderHtmlShell(bodyHtml, { preheader }),
  };
}
