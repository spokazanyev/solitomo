# Email Templates Contract (056 US4)

**Purpose**: спецификация 4 новых email-шаблонов (T-015, T-109, T-110, T-111) для 049 notification system. Backend 055 эмитит соответствующие domain events; matrix 055 уже маппит kind→template; 056 добавляет renderer-функции и регистрирует их в REGISTRY.

**Pattern**: re-use existing T-001 structure (`helpers.ts` utilities, HTML inline-styles, plaintext fallback). Все 4 шаблона MUST производить `{subject, text, html}` тройку через `RenderedMessage` type.

---

## T-015: Payment Expired (Customer)

**Trigger**: `payment.expired` domain event (055 FR-5552). Customer abandoned checkout, `paymentRetryWindowMin` истёк.

**Subject**: `Заказ {clientNumber} аннулирован — оплата не получена`

**Preheader**: `Корзина сохранена, можно вернуться и оплатить.`

**Body** (HTML structure):

```html
<h1>Заказ {clientNumber} аннулирован</h1>

<p>Здравствуйте, {customerName}!</p>

<p>К сожалению, оплата за заказ <b>{clientNumber}</b> не была получена
в течение {paymentRetryWindowMin} минут. Заказ автоматически аннулирован.</p>

<p>Ваша корзина сохранена. Если у вас возникли сложности с оплатой —
ответьте на это письмо, мы поможем.</p>

<div style="text-align: center; padding: 20px 0">
  <a href="{cartRecoveryUrl}" style="...primary cta...">Вернуться к заказу</a>
</div>

<p style="text-align: center; margin-top: 12px">
  Или <a href="{newCartUrl}">оформить заказ заново</a>
</p>

<p>Total: {formatPrice(order.totals.total)}<br>
Items: {order.items.length} позиций</p>
```

**Data dependencies**:
- `customerName(order)` — из helpers.ts
- `cartRecoveryUrl`: `${BASE_URL}/cart/?recover={Order.cartId}` (uses 052 cart-recovery subscriber которое уже восстанавливает Cart при `order.cancelled`/`order.expired`)
- `newCartUrl`: `${BASE_URL}/cart/`
- `paymentRetryWindowMin`: из `paymentSettings.paymentRetryWindowMin` (либо hardcoded "60" в email)

**CTAs**: оба согласно OQ-6 — primary recovery + secondary new-cart.

**Tone**: empathetic, conversion-oriented, no blame.

---

## T-109: Amount Mismatch (Manager)

**Trigger**: `payment.amount_mismatch` domain event (055 FR-5532a). Webhook прислал amount, не равный `Order.totals.total`.

**Subject**: `⚠️ Несоответствие суммы по {clientNumber}`

**Preheader**: `Платёж получен, но сумма не совпадает с заказом.`

**Body** (HTML structure):

```html
<h1>⚠️ Несоответствие суммы платежа</h1>

<p><b>Order:</b> {clientNumber} (ID {order.id})<br>
<b>Customer:</b> {customerName} ({customer.email})</p>

<table style="width:100%; border:1px solid #f3a; padding:10px">
  <tr><td>Ожидаемая сумма (Order.totals.total)</td><td>{formatPrice(expected)}</td></tr>
  <tr><td>Фактическая сумма (webhook)</td><td>{formatPrice(actual)}</td></tr>
  <tr><td>Разница</td><td style="color:#c00">{formatPrice(actual - expected)}</td></tr>
  <tr><td>YooKassa providerRef</td><td><code>{providerRef}</code></td></tr>
</table>

<p><b>Что делать:</b></p>
<ol>
  <li>Открыть Order в admin и проверить детали</li>
  <li>Открыть ЮKassa ЛК → найти платёж по providerRef</li>
  <li>Решить: refund-партиал, force-accept в админке, либо связаться с customer'ом</li>
</ol>

<div style="text-align: center; padding: 20px 0">
  <a href="{adminOrderUrl}" style="...cta...">Открыть заказ в admin</a>
</div>
```

**Data dependencies**:
- `event.context.payment.expected`, `event.context.payment.actual` (kopecks)
- `event.context.payment.providerRef`
- `adminOrderUrl`: `${BASE_URL}/admin/collections/orders/${order.id}`

**Severity**: HIGH. Email priority: высокий (header `X-Priority: 1` если provider supports).

---

## T-110: Receipt Failed (Manager)

**Trigger**: `payment.receipt_failed` domain event (055 FR-5546). ЮKassa не смогла зарегистрировать чек 54-ФЗ.

**Subject**: `⚠️ Чек 54-ФЗ не выдан по {clientNumber}`

**Preheader**: `Платёж прошёл, но фискальный чек не сформирован.`

**Body**:

```html
<h1>⚠️ Чек 54-ФЗ не выдан</h1>

<p><b>Order:</b> {clientNumber} (ID {order.id}, статус paid)<br>
<b>Customer:</b> {customerName} ({customer.email})<br>
<b>Сумма:</b> {formatPrice(order.totals.total)}<br>
<b>YooKassa providerRef:</b> <code>{providerRef}</code></p>

<p><b>Что произошло:</b> ЮKassa отметила <code>receipt_registration: canceled</code>
в webhook. Чек 54-ФЗ НЕ ушёл в ОФД. Заказ оплачен, но фискальный документ
отсутствует.</p>

<p><b>Что делать:</b></p>
<ol>
  <li>Открыть личный кабинет онлайн-кассы (АТОЛ/Эвотор/Оранж-Дата)</li>
  <li>Проверить статус кассы и наличие ошибок фискализации</li>
  <li>При необходимости — сформировать чек коррекции вручную</li>
  <li>Уведомить customer'а о решении</li>
</ol>

<p style="color:#c00"><b>Срочность:</b> 24 часа. Превышение — штраф ≥10 000 ₽
по 54-ФЗ.</p>

<div style="text-align: center; padding: 20px 0">
  <a href="{adminOrderUrl}" style="...cta...">Открыть заказ в admin</a>
</div>
```

**Severity**: CRITICAL — compliance issue с tight SLA.

---

## T-111: Refund Failed (Manager)

**Trigger**: `return.refund_failed` domain event (055 FR-5554). ЮKassa прислал `refund.canceled` webhook.

**Subject**: `⚠️ Refund failed для {returnNumber}`

**Preheader**: `Возврат не прошёл, нужна ручная обработка.`

**Body**:

```html
<h1>⚠️ Refund failed</h1>

<p><b>Return:</b> {returnNumber} (ID {returnId})<br>
<b>Order:</b> {orderClientNumber} (ID {orderId})<br>
<b>Customer:</b> {customerName} ({customer.email})<br>
<b>Refund amount:</b> {formatPrice(refundAmount / 100)} (в копейках)</p>

<table style="width:100%">
  <tr><td>ЮKassa refund ID</td><td><code>{providerRefundId}</code></td></tr>
  <tr><td>Reason</td><td>{reason}</td></tr>
</table>

<p><b>Что делать:</b></p>
<ol>
  <li>Открыть Return в admin, статус остался <code>received</code> (refund не прошёл)</li>
  <li>Открыть ЮKassa ЛК → возвраты → найти по providerRefundId</li>
  <li>Решить причину (карта закрыта, банк отклонил и т.п.)</li>
  <li>Возможные пути:
    <ul>
      <li>Повторить refund-запрос (admin action)</li>
      <li>Bank-transfer refund если у customer'а юрлицо</li>
      <li>Связаться с customer'ом для уточнения карты</li>
    </ul>
  </li>
</ol>

<div style="text-align: center; padding: 20px 0">
  <a href="{adminReturnUrl}" style="...cta...">Открыть Return в admin</a>
</div>
```

**Data dependencies**:
- `event.returnData.{id, returnNumber, orderId, orderClientNumber}`
- `event.context.errorMessage` → reason
- `adminReturnUrl`: `${BASE_URL}/admin/collections/returns/${returnId}`

**Severity**: HIGH. Customer уже ждёт деньги.

---

## Implementation pattern (все 4 templates)

```ts
// Example skeleton for any of T-015/109/110/111
import type { NotificationJobPayload, RenderedMessage } from "../types";
import { customerName, escapeHtml, formatPrice, renderHtmlShell, styles } from "./helpers";

export function renderT015PaymentExpired(payload: NotificationJobPayload): RenderedMessage {
  const order = payload.order;
  if (!order) {
    return { subject: "[no order]", text: "", html: "" };
  }
  const name = customerName(order);
  const subject = `Заказ ${escapeHtml(order.clientNumber ?? order.id)} аннулирован — оплата не получена`;
  const preheader = "Корзина сохранена, можно вернуться и оплатить.";

  const cartRecoveryUrl = order.cartId
    ? `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/cart/?recover=${order.cartId}`
    : `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/cart/`;
  const newCartUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/cart/`;

  const text = [
    `Здравствуйте, ${name}!`,
    ``,
    `Оплата за заказ ${order.clientNumber ?? order.id} не получена в течение 60 минут.`,
    `Заказ автоматически аннулирован, но корзина сохранена.`,
    ``,
    `Вернуться к заказу: ${cartRecoveryUrl}`,
    `Оформить заново: ${newCartUrl}`,
    ``,
    `— Команда Soliton`,
  ].join("\n");

  const bodyHtml = [
    `<h1 style="${styles.h1}">Заказ ${escapeHtml(order.clientNumber ?? order.id)} аннулирован</h1>`,
    `<p style="${styles.p}">Здравствуйте, ${escapeHtml(name)}!</p>`,
    `<p style="${styles.p}">К сожалению, оплата не была получена в течение 60 минут. Заказ аннулирован, но <b>корзина сохранена</b>.</p>`,
    `<p style="text-align:center; padding:20px 0"><a href="${escapeHtml(cartRecoveryUrl)}" style="${styles.cta}">Вернуться к заказу</a></p>`,
    `<p style="${styles.p}; text-align:center">Или <a href="${escapeHtml(newCartUrl)}">оформить заново</a></p>`,
  ].join("");

  return {
    subject,
    text,
    html: renderHtmlShell({ subject, preheader, bodyHtml }),
  };
}
```

---

## REGISTRY update

```ts
// apps/web/src/lib/notifications/templates/index.ts:
import { renderT015PaymentExpired } from "./t-015-payment-expired";
import { renderT109AmountMismatch } from "./t-109-amount-mismatch";
import { renderT110ReceiptFailed } from "./t-110-receipt-failed";
import { renderT111RefundFailed } from "./t-111-refund-failed";

const REGISTRY: Record<string, TemplateRenderer> = {
  // ... existing entries ...
  "T-015": renderT015PaymentExpired,
  "T-109": renderT109AmountMismatch,
  "T-110": renderT110ReceiptFailed,
  "T-111": renderT111RefundFailed,
};
```

---

## Test plan (for /speckit-implement Phase 3)

1. **Unit tests** для каждого renderer'а:
   - happy path: full order + customer → возвращает valid `{subject, text, html}`
   - empty payload: gracefully падает с `[no order]`
   - long names / special chars: правильный HTML-escape

2. **Integration test**:
   - Триггернуть `payment.expired` event через test stub
   - Проверить что NotificationJob создан, `template: "T-015"`, `rendered.text` непустой

3. **Visual QA**:
   - Открыть rendered HTML в Litmus / Mailchimp inbox preview
   - Проверить mobile-friendly (≥ 14px font, touch-friendly buttons)

---

**End of email-templates.md.**
