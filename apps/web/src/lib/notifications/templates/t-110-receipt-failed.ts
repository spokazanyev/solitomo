/**
 * T-110: Receipt failed alert manager email (056 US4, FR-5642).
 *
 * Triggered by `payment.receipt_failed` event (055 FR-5546). ЮKassa receipt_registration=canceled.
 * Manager-facing, CRITICAL severity — 24-hour SLA by 54-ФЗ.
 *
 * Contract: specs/056-yookassa-frontend-integration/contracts/email-templates.md §T-110.
 */

import type { NotificationJobPayload, RenderedMessage } from "../types";
import {
  adminOrderUrl,
  customerName,
  escapeHtml,
  formatPrice,
  renderHtmlShell,
  styles,
} from "./helpers";

export function renderT110ReceiptFailed(
  payload: NotificationJobPayload,
): RenderedMessage {
  const order = payload.order;
  const clientNumber = order.clientNumber ?? String(order.id);
  const customerEmail = order.customer?.email ?? "—";
  const total = formatPrice(order.totals?.total);
  const adminUrl = adminOrderUrl(String(order.id));

  // providerRef в event.message если 055 заполняет
  const eventMessage = payload.event.message ?? "";
  const providerRefMatch = /providerRef=([^,\s]+)/.exec(eventMessage);
  const providerRef = providerRefMatch ? providerRefMatch[1] : null;

  const subject = `⚠️ Чек 54-ФЗ не выдан по ${clientNumber}`;
  const preheader = "Платёж прошёл, но фискальный чек не сформирован.";

  const text = [
    `⚠️ Чек 54-ФЗ не выдан`,
    ``,
    `Заказ: ${clientNumber} (ID ${order.id}, статус paid)`,
    `Customer: ${customerName(order)} <${customerEmail}>`,
    `Сумма: ${total}`,
    providerRef ? `YooKassa providerRef: ${providerRef}` : "",
    ``,
    `Что произошло:`,
    `ЮKassa отметила receipt_registration: canceled в webhook.`,
    `Чек 54-ФЗ НЕ ушёл в ОФД. Заказ оплачен, фискальный документ отсутствует.`,
    ``,
    `Что делать:`,
    `1. Открыть личный кабинет онлайн-кассы (АТОЛ/Эвотор/Оранж-Дата)`,
    `2. Проверить статус кассы и ошибки фискализации`,
    `3. При необходимости — сформировать чек коррекции вручную`,
    `4. Уведомить customer'а о решении`,
    ``,
    `⚡ Срочность: 24 часа. Превышение — штраф ≥10 000 ₽ по 54-ФЗ.`,
    ``,
    `Открыть заказ в admin: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}; color:#c00">⚠️ Чек 54-ФЗ не выдан</h1>`,
    `<p style="${styles.p}"><b>Order:</b> ${escapeHtml(clientNumber)} (ID ${escapeHtml(String(order.id))}, статус <b>paid</b>)<br><b>Customer:</b> ${escapeHtml(customerName(order))} &lt;${escapeHtml(customerEmail)}&gt;<br><b>Сумма:</b> ${escapeHtml(total)}${providerRef ? `<br><b>YooKassa providerRef:</b> <code>${escapeHtml(providerRef)}</code>` : ""}</p>`,
    `<p style="${styles.p}"><b>Что произошло:</b> ЮKassa отметила <code>receipt_registration: canceled</code> в webhook. Чек 54-ФЗ НЕ ушёл в ОФД. Заказ оплачен, фискальный документ отсутствует.</p>`,
    `<p style="${styles.p}"><b>Что делать:</b></p>`,
    `<ol style="${styles.p}"><li>Открыть личный кабинет онлайн-кассы (АТОЛ/Эвотор/Оранж-Дата)</li><li>Проверить статус кассы и наличие ошибок фискализации</li><li>При необходимости — сформировать чек коррекции вручную</li><li>Уведомить customer'а о решении</li></ol>`,
    `<p style="${styles.p}; color:#c00; font-weight:bold; padding:12px; background:#fff5f5; border-left:3px solid #c00">⚡ Срочность: 24 часа. Превышение — штраф ≥10 000 ₽ по 54-ФЗ.</p>`,
    `<p style="text-align:center; padding:20px 0"><a href="${escapeHtml(adminUrl)}" style="${styles.cta}">Открыть заказ в admin</a></p>`,
  ].join("");

  return {
    subject,
    text,
    html: renderHtmlShell(bodyHtml, { preheader }),
  };
}
