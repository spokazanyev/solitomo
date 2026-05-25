# UI Events Contract (056)

**Purpose**: dataLayer / analytics events emitted by frontend (056). For GA4 + Yandex Metrica integration + future Twenty CRM Activity.

---

## 1. `purchase` event (GA4-compliant)

**When**: customer reaches success-state on `/payment/return/[orderId]` for the first time. **Fire-once** (anti-double-fire через `useRef` guard).

**Payload**:
```ts
{
  event: "purchase",
  transaction_id: "SO-2026-0042",   // Order.clientNumber
  value: 12000,                      // Order.totals.total (rubles)
  currency: "RUB",
  payment_type: "bank_card",         // Order.payment.paymentMethodSnapshot.type
  items: [
    {
      item_id: "PDU-XYZ-32A",        // Order.items[i].sku
      item_name: "Блок розеток XYZ-32A", // Order.items[i].title
      price: 6000,
      quantity: 2,
    },
    // ...
  ],
}
```

**Receivers**:
- GA4 (via gtag): тривиально, schema matches GA4 ecommerce event
- Yandex Metrica: автоматически собирает dataLayer events с `event: "purchase"` если настроено
- Future Twenty CRM: backend `payment.succeeded` event уже содержит utm — client-side эти данные дублируются для cross-validation

**Why client-side**: backend `payment.succeeded` domain-event (055 FR-5599) — server-side analytics. Client-side dataLayer — для session-replay tools (Hotjar и т.п.), heatmaps, и client-side conversion tracking.

---

## 2. `payment_intent` event (funnel measurement)

**When**: customer clicks «Оплатить» на `/cart/checkout/physical/review/` или `/cart/order/{token}/retry-payment/`. Fire **per-click** (multiple-fire OK для funnel analysis).

**Payload**:
```ts
{
  event: "payment_intent",
  order_id: 12345,                  // Order.id (numeric PG)
  value: 12000,
  currency: "RUB",
}
```

**Why**: GA4 funnel `begin_checkout → add_payment_info → purchase` — `payment_intent` фиксирует transition между `add_payment_info` и `purchase`. Помогает identify drop-off на ЮKassa-странице.

---

## 3. Events NOT emitted client-side

| Event | Reason | Where it's emitted instead |
|---|---|---|
| `payment_failed` | Out of scope MVP; backend `payment.canceled` event sufficient | 055 domain event |
| `refund_initiated` | 053 backend territory | 053 emit |
| `cart_abandoned` | 052 backend territory | 052 cart-cleanup cron |
| Email-open / email-click | Unisender Go provider tracks server-side | 049 |

---

## 4. PII safety

**Never include in dataLayer**:
- `customer.email`, `customer.phone`
- `payment.paymentMethodSnapshot.card.first6` (PCI scope grey area; safer to omit)
- `Order.publicToken` (security token, similar to magic-link)
- Customer name (PII per 152-ФЗ if combined with email/phone)

**OK to include**:
- `Order.clientNumber` (SO-NNNN — public-safe)
- `Order.totals.total` (price)
- `Order.items[].sku` / `title` (product catalog data, public)
- `payment_type` (card/sbp — not PII)

---

## 5. Integration with existing analytics (027)

Project уже имеет 027 спека («analytics verification»). 056 events **не конфликтуют** — они дополняют existing event stream (page_view, view_item, add_to_cart, begin_checkout). Final funnel в GA4:

```
view_item → add_to_cart → begin_checkout → add_payment_info → payment_intent → purchase
```

`payment_intent` — наше event, остальные — existing.

---

## 6. Testing checklist

При `/speckit-implement` US1:
- [ ] dataLayer `purchase` event fires ровно ОДИН РАЗ при success-state reached
- [ ] При page refresh на success-state — event НЕ повторяется (через sessionStorage flag либо useRef + initialStatus check)
- [ ] dataLayer events валидны через Tag Assistant (Chrome extension)
- [ ] Yandex Metrica «Цели» (если настроены) триггерятся

---

**End of ui-events.md.**
