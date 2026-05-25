/**
 * T-111: Refund failed alert manager email (056 US4, FR-5643).
 *
 * Triggered by `return.refund_failed` event (055 FR-5554). ЮKassa refund.canceled.
 * Manager-facing, HIGH severity — customer уже ждёт деньги.
 *
 * Contract: specs/056-yookassa-frontend-integration/contracts/email-templates.md §T-111.
 *
 * Note: NotificationJobPayload не содержит returnData snapshot напрямую (только order).
 * Извлекаем return-info из event.message либо order.{disputeFlag/lastReturnId}.
 */

import type { NotificationJobPayload, RenderedMessage } from "../types";
import {
  adminOrderUrl,
  customerName,
  escapeHtml,
  formatPrice,
  renderHtmlShell,
  siteUrl,
  styles,
} from "./helpers";

export function renderT111RefundFailed(
  payload: NotificationJobPayload,
): RenderedMessage {
  const order = payload.order;
  const clientNumber = order.clientNumber ?? String(order.id);
  const customerEmail = order.customer?.email ?? "—";
  const adminOrderHref = adminOrderUrl(String(order.id));

  // Parse return info from event.message
  // 055 emits with eventIdSuffix; structured data in event.context.errorMessage
  const eventMessage = payload.event.message ?? "";
  const returnNumberMatch = /returnNumber=([^,\s]+)/.exec(eventMessage);
  const returnIdMatch = /returnId=([^,\s]+)/.exec(eventMessage);
  const providerRefundMatch = /providerRefundId=([^,\s]+)/.exec(eventMessage);
  const reasonMatch = /reason=(.+?)(?:,|$)/.exec(eventMessage);

  const returnNumber = returnNumberMatch ? returnNumberMatch[1] : "—";
  const returnId = returnIdMatch ? returnIdMatch[1] : null;
  const providerRefundId = providerRefundMatch ? providerRefundMatch[1] : "—";
  const reason = reasonMatch ? reasonMatch[1] : "unknown";

  const adminReturnHref = returnId
    ? siteUrl(`/admin/collections/returns/${encodeURIComponent(returnId)}`)
    : siteUrl("/admin/collections/returns");

  const subject = `⚠️ Refund failed для ${returnNumber}`;
  const preheader = "Возврат не прошёл, нужна ручная обработка.";

  const text = [
    `⚠️ Refund failed`,
    ``,
    `Return: ${returnNumber}${returnId ? ` (ID ${returnId})` : ""}`,
    `Order: ${clientNumber} (ID ${order.id})`,
    `Customer: ${customerName(order)} <${customerEmail}>`,
    `Сумма к возврату: ${formatPrice(order.totals?.total)}`,
    ``,
    `YooKassa refund ID: ${providerRefundId}`,
    `Reason: ${reason}`,
    ``,
    `Что делать:`,
    `1. Открыть Return в admin: ${adminReturnHref}`,
    `2. Открыть ЮKassa ЛК → возвраты → найти по providerRefundId`,
    `3. Возможные пути:`,
    `   - Повторить refund (admin action)`,
    `   - Bank-transfer refund (для юрлица)`,
    `   - Связаться с customer'ом для уточнения карты`,
    ``,
    `Открыть Order: ${adminOrderHref}`,
  ].join("\n");

  const rows = [
    `<tr><td style="padding:6px;border:1px solid #ddd">YooKassa refund ID</td><td style="padding:6px;border:1px solid #ddd"><code>${escapeHtml(providerRefundId)}</code></td></tr>`,
    `<tr><td style="padding:6px;border:1px solid #ddd">Reason</td><td style="padding:6px;border:1px solid #ddd">${escapeHtml(reason)}</td></tr>`,
  ].join("");

  const bodyHtml = [
    `<h1 style="${styles.h1}; color:#c00">⚠️ Refund failed</h1>`,
    `<p style="${styles.p}"><b>Return:</b> ${escapeHtml(returnNumber)}${returnId ? ` (ID ${escapeHtml(String(returnId))})` : ""}<br><b>Order:</b> ${escapeHtml(clientNumber)} (ID ${escapeHtml(String(order.id))})<br><b>Customer:</b> ${escapeHtml(customerName(order))} &lt;${escapeHtml(customerEmail)}&gt;</p>`,
    `<table style="width:100%; border-collapse:collapse; margin:16px 0">${rows}</table>`,
    `<p style="${styles.p}"><b>Что делать:</b></p>`,
    `<ol style="${styles.p}"><li>Открыть Return в admin → статус остался <code>received</code> (refund не прошёл)</li><li>Открыть ЮKassa ЛК → возвраты → найти по providerRefundId</li><li>Возможные пути:<ul><li>Повторить refund-запрос (admin action)</li><li>Bank-transfer refund если customer — юрлицо</li><li>Связаться с customer'ом для уточнения карты</li></ul></li></ol>`,
    `<p style="text-align:center; padding:20px 0"><a href="${escapeHtml(adminReturnHref)}" style="${styles.cta}">Открыть Return в admin</a></p>`,
  ].join("");

  return {
    subject,
    text,
    html: renderHtmlShell(bodyHtml, { preheader }),
  };
}
