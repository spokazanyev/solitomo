/**
 * T-109: Amount mismatch alert manager email (056 US4, FR-5641).
 *
 * Triggered by `payment.amount_mismatch` domain event (055 FR-5532a).
 * Manager-facing, HIGH severity (X-Priority: 1 если provider supports).
 *
 * Contract: specs/056-yookassa-frontend-integration/contracts/email-templates.md §T-109.
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

export function renderT109AmountMismatch(
  payload: NotificationJobPayload,
): RenderedMessage {
  const order = payload.order;
  const clientNumber = order.clientNumber ?? String(order.id);
  const customerEmail = order.customer?.email ?? "—";
  const customerLabel = `${customerName(order)} (${escapeHtml(customerEmail)})`;
  const expected = order.totals?.total;

  // event.message может содержать `expected={kopecks},actual={kopecks},providerRef={...}`
  // если 055 webhook handler заполняет (см. payment.amount_mismatch emit)
  const eventMessage = payload.event.message ?? "";
  const actualMatch = /actual=(\d+)/.exec(eventMessage);
  const providerRefMatch = /providerRef=([^,\s]+)/.exec(eventMessage);
  const actualKopecks = actualMatch ? Number(actualMatch[1]) : null;
  const providerRef = providerRefMatch ? providerRefMatch[1] : null;
  const actualRub = actualKopecks != null ? actualKopecks / 100 : null;

  const adminUrl = adminOrderUrl(String(order.id));

  const subject = `⚠️ Несоответствие суммы по ${clientNumber}`;
  const preheader = "Платёж получен, но сумма не совпадает с заказом.";

  const text = [
    `⚠️ Несоответствие суммы платежа`,
    ``,
    `Заказ: ${clientNumber} (ID ${order.id})`,
    `Customer: ${customerName(order)} <${customerEmail}>`,
    ``,
    `Ожидаемая сумма: ${formatPrice(expected)}`,
    actualRub != null ? `Фактическая (webhook): ${formatPrice(actualRub)}` : "Фактическая: см. PaymentEvents",
    expected != null && actualRub != null
      ? `Разница: ${formatPrice(actualRub - expected)}`
      : "",
    providerRef ? `YooKassa providerRef: ${providerRef}` : "",
    ``,
    `Что делать:`,
    `1. Открыть Order в admin: ${adminUrl}`,
    `2. Открыть ЮKassa ЛК, найти платёж по providerRef`,
    `3. Решить: refund-партиал, force-accept, либо связаться с customer'ом`,
  ]
    .filter(Boolean)
    .join("\n");

  const rows = [
    `<tr><td style="padding:6px;border:1px solid #ddd">Ожидаемая сумма</td><td style="padding:6px;border:1px solid #ddd"><b>${escapeHtml(formatPrice(expected))}</b></td></tr>`,
    actualRub != null
      ? `<tr><td style="padding:6px;border:1px solid #ddd">Фактическая (webhook)</td><td style="padding:6px;border:1px solid #ddd"><b style="color:#c00">${escapeHtml(formatPrice(actualRub))}</b></td></tr>`
      : "",
    expected != null && actualRub != null
      ? `<tr><td style="padding:6px;border:1px solid #ddd">Разница</td><td style="padding:6px;border:1px solid #ddd; color:#c00">${escapeHtml(formatPrice(actualRub - expected))}</td></tr>`
      : "",
    providerRef
      ? `<tr><td style="padding:6px;border:1px solid #ddd">YooKassa providerRef</td><td style="padding:6px;border:1px solid #ddd"><code>${escapeHtml(providerRef)}</code></td></tr>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const bodyHtml = [
    `<h1 style="${styles.h1}; color:#c00">⚠️ Несоответствие суммы платежа</h1>`,
    `<p style="${styles.p}"><b>Order:</b> ${escapeHtml(clientNumber)} (ID ${escapeHtml(String(order.id))})<br><b>Customer:</b> ${customerLabel}</p>`,
    `<table style="width:100%; border-collapse:collapse; margin:16px 0">${rows}</table>`,
    `<p style="${styles.p}"><b>Что делать:</b></p>`,
    `<ol style="${styles.p}"><li>Открыть Order в admin (ссылка ниже)</li><li>Открыть ЮKassa ЛК → найти платёж по providerRef</li><li>Решить: refund-партиал, force-accept, либо связаться с customer'ом</li></ol>`,
    `<p style="text-align:center; padding:20px 0"><a href="${escapeHtml(adminUrl)}" style="${styles.cta}">Открыть заказ в admin</a></p>`,
  ].join("");

  return {
    subject,
    text,
    html: renderHtmlShell(bodyHtml, { preheader }),
  };
}
