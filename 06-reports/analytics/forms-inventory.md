# Forms Inventory — спека 058, T088

**Дата**: 2026-05-26
**Назначение**: Ground truth для conditional-разметки FR-014 («события для форм, которые реально существуют»). Без этого файла conditional-задачи T031/T063/T065 не могут принимать решения.

## Реально существующие формы

| Form | Файл | Статус | Что трекать (по contracts/analytics-events.md) |
|---|---|---|---|
| **RfqForm** | `src/components/RfqForm.tsx` | ✅ EXISTS (уже трекает) | `rfq_open`, `rfq_submit`, +`form_field_error`, +`inn_validation_*` |
| **PhysicalCheckoutForm** | `src/components/cart/PhysicalCheckoutForm.tsx` | ✅ EXISTS (уже трекает payment_intent, add_payment_info) | +`checkout_step_*` (1-5), +`form_field_error` |
| **InvoiceCheckoutForm** | `src/components/cart/InvoiceCheckoutForm.tsx` | ✅ EXISTS (уже трекает invoice_requested, add_shipping_info) | +`checkout_step_*`, +`inn_validation_*`, +`form_field_error` |
| **CartView** | `src/components/cart/CartView.tsx` | ✅ EXISTS (уже трекает view_cart, begin_checkout) | +`remove_from_cart` (с ecommerce.remove FR-110) |
| **RfqCart** | `src/components/rfq/RfqCart.tsx` | ✅ EXISTS (уже трекает add_to_rfq) | +`remove_from_cart`, +`view_cart` |
| **ReviewForm** | `src/components/order/ReviewForm.tsx` | ⚠️ EXISTS, но НЕТ analytics | Возможно `checkout_step_review`, `checkout_cta_pay_clicked` |
| **AddressForm** | `src/components/checkout/AddressForm.tsx` | ⚠️ EXISTS, но НЕТ analytics | Часть checkout — может быть step_shipping helper |
| **RackParametersForm** | `src/components/solutions/RackParametersForm.tsx` | ⚠️ EXISTS, без analytics | Solution-configurator, отдельная семантика (не FR-014) |
| **PreferencesForm** | `src/components/notifications/PreferencesForm.tsx` | ⚠️ EXISTS, без analytics | Customer-account preferences, не B2C/B2B покупка |

## FR-014 conditional cut

FR-014 перечисляет 5 форм для events:
- `quick_order_submit` — ❌ **NO FORM** (нет «быстрого заказа» на сайте сегодня)
- `company_form_submit` — ❌ **NO FORM** (отдельной компанийской формы нет; ИНН/КПП — внутри checkout-legal)
- `invoice_request_submit` — ✅ **EXISTS** как `invoice_requested` event в InvoiceCheckoutForm
- `callback_request_submit` — ❌ **NO FORM** (callback виджет не реализован)
- `file_upload` — ❌ **NO FILE UPLOAD** (RfqForm не имеет attachment field в v1)

**Cut в v1**: события `quick_order_submit`, `company_form_submit`, `callback_request_submit`, `file_upload` НЕ реализуются — соответствующих форм нет. Реализуются вместе с появлением форм (отдельные feature-tasks вне 058).

## События для реализации в текущем v1

### Новая разметка (Phase 3 US1):

1. **`form_field_error`** в RfqForm + PhysicalCheckoutForm + InvoiceCheckoutForm — на каждый validation-fail (без значения поля).
2. **`inn_validation_success/failed`** в InvoiceCheckoutForm (поле ИНН).
3. **`checkout_step_contact/shipping/payment_method/review/cta_pay_clicked`** в PhysicalCheckoutForm и InvoiceCheckoutForm.
4. **`remove_from_cart`** (с ecommerce.remove dual-push) в CartView + RfqCart.

### Уже размечено (verified в коде):

- `rfq_open`, `rfq_submit` — RfqForm
- `add_to_rfq` — RfqCart (B2B-specific; не путать с `add_to_cart`)
- `view_cart` — CartView
- `begin_checkout` — CartView (трижды для физ/юр/quote)
- `add_payment_info`, `payment_intent` — PhysicalCheckoutForm
- `add_shipping_info`, `invoice_requested` — InvoiceCheckoutForm
- `purchase` + `ecommerce.purchase` — PaymentReturnClient via `pushPurchaseEvent` (Phase 12 enhanced)

## Privacy notes

Все формы выше **содержат PII** (email, phone, ФИО, ИНН, address). Согласно FR-060, поля с PII должны быть помечены `data-yandex-metrika-mask="true"` (или CSS-class) чтобы Webvisor НЕ записывал значения. Это **отдельный gap** — требует прохода по всем формам.

**TODO для Phase 10 (US6 Privacy)**: добавить data-mask атрибуты на все PII-поля во всех формах списка выше.

## Decision Log

- 2026-05-26: created по T088 (post-analyze remediation для F5).
- v1 cut'ы зафиксированы в этом документе для будущих audit'ов.
