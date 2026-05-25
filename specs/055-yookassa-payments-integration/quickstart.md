# Quickstart: ЮKassa Payments (055)

**Цель**: пошагово настроить dev/staging-окружение для разработки и e2e-проверки.

**Audience**: разработчик, владелец shop'а в ЮKassa, бухгалтер (для 54-ФЗ конфигурации).

---

## 1. Prerequisites (owner)

Эти шаги делает **владелец / бухгалтер**, не разработчик:

- [ ] Зарегистрирован магазин в ЮKassa (https://yookassa.ru), shopId выдан.
- [ ] Подключена онлайн-касса (АТОЛ Онлайн / Эвотор / Оранж-Дата / ЮKassa-Касса) к ЮKassa-кабинету для 54-ФЗ.
- [ ] Касса поддерживает **новые ставки НДС 22% (vat_code 11, 12)** — критично с 01.01.2026.
- [ ] Тарифный план **Базовый или выше** — нужен для СБП.
- [ ] Создан **отдельный test-shop (sandbox)** в ЛК ЮKassa для staging (OQ-12).
- [ ] Owner выпустил `webhookSecret` ≥32 символа (опционально, для будущего HMAC).
- [ ] Подтверждены налоговые параметры:
  - `taxSystemCode = 1` (ОСН) ← по умолчанию
  - `defaultVatCode = 12` (22/122 расчётная) ← цены ВКЛЮЧАЮТ НДС
  - `senderCompanyInfo.{inn, legalName, address}` — реквизиты для receipt

---

## 2. Env vars (developer)

**File**: `.env.local` (gitignored, copy from `.env.example` after 055 impl adds entries).

```bash
# === ЮKassa (055) ===

# Prod shop (production deploy only)
YOOKASSA_SHOP_ID="<numeric, from ЛК>"
YOOKASSA_SECRET_KEY="live_<from ЛК>"

# Staging / test-shop (set in staging env)
# YOOKASSA_SHOP_ID="test_<numeric>"
# YOOKASSA_SECRET_KEY="test_<from sandbox ЛК>"

# Cron secret (already exists for other crons — reuse)
CRON_SECRET="<32+ chars random>"

# Trusted proxy (already from 054)
TRUST_PROXY_HEADERS="true"  # if behind Cloudflare/Vercel
```

**DO NOT commit**:
- `.env.local`
- `.env.staging`
- `.env.production`

`paymentSettings.webhookSecret` хранится в Payload (не в env), потому что его удобно ротировать без redeploy.

---

## 3. ЮKassa webhook URL configuration (owner + developer)

В ЛК ЮKassa (Настройки → HTTP-уведомления) добавить URLs:

| Environment | URL | Events |
|---|---|---|
| Production | `https://pdumarket.ru/api/payment/yookassa/webhook` | All: `payment.waiting_for_capture`, `payment.succeeded`, `payment.canceled`, `refund.succeeded`, `refund.canceled` |
| Staging | `https://staging.pdumarket.ru/api/payment/yookassa/webhook` | Same |
| Dev (local) | `https://<ngrok-id>.ngrok.io/api/payment/yookassa/webhook` | Same |

**Местный dev через ngrok**:
```bash
# Terminal 1: start Next.js
pnpm --filter @soliton/web dev

# Terminal 2: tunnel
ngrok http 3000
# → https://abc123.ngrok.io
# → Use as webhook URL in test-shop ЛК
```

**Note**: Ngrok URL **меняется каждый рестарт** на бесплатном плане. После рестарта обновлять URL в ЛК ЮKassa.

---

## 4. Payload admin: paymentSettings (post-init, before first payment)

После того как импл 055 миграция применена, открыть **Payload Admin → Globals → Payment Settings**:

```json
{
  "enabled": true,
  "captureMode": "two_stage",
  "paymentMethods": ["bank_card", "sbp"],
  "paymentRetryWindowMin": 60,
  "webhookSignatureMode": "off",
  "webhookSecret": "<empty for now>",
  "taxSystemCode": 1,
  "defaultVatCode": 12,
  "allowedLegacyVatCodes": [4, 6],
  "sbpMaxAmount": 1000000,
  "senderCompanyInfo": {
    "inn": "<12 digits for ИП>",
    "legalName": "ИП Соликаново Игорь Игоревич",
    "address": "г. Москва, ул. ...",
    "kpp": ""
  }
}
```

---

## 5. End-to-end test recipe (US1 — card payment)

**Prerequisites**: dev-server running, test-shop configured, ngrok webhook URL set.

### Step 1 — Create test Order
```bash
# Through admin: создать Order вручную, либо
# через checkout-flow (US1 037) когда frontend готов
```

### Step 2 — Call create-payment
```bash
curl -X POST http://localhost:3000/api/payment/yookassa/create \
  -H "Content-Type: application/json" \
  -H "Cookie: cart_session=<token>" \
  -d '{"orderId":"<UUID>","retryNonce":"a1b2c3d4-..."}'

# Expected response:
# { "confirmationUrl": "https://yoomoney.ru/checkout/...",
#   "confirmationType": "redirect",
#   "providerRef": "2dbdbeb6-...",
#   "retryNonce": "a1b2c3d4-...",
#   "availableMethods": ["bank_card","sbp"] }
```

### Step 3 — Pay on ЮKassa test-shop
Открыть `confirmationUrl` в браузере. Использовать **тестовую карту**:
- Номер: `5555 5555 5555 4477` (Mastercard)
- Срок: любой будущий
- CVV: любые 3 цифры
- 3DS пароль (если запросит): `12345678`

Другие тестовые сценарии:
- `5555 5555 5555 4444` — успех без 3DS
- `5555 5555 5555 4485` — отказ (insufficient_funds)
- `5555 5555 5555 4493` — отказ 3DS (3ds_failed)

### Step 4 — Wait for webhook (≤5 сек)
- ngrok terminal должен показать `POST /api/payment/yookassa/webhook` 200
- Локальные логи: `[yookassa-webhook] received payment.waiting_for_capture for orderId=...`
- Через 1-2 сек после auth: `[yookassa-webhook] received payment.succeeded for orderId=...`

### Step 5 — Verify Order state
```bash
# Через admin или curl:
curl http://localhost:3000/api/orders/<UUID>/payment-status \
  -H "Cookie: cart_session=<token>"

# Expected:
# { "orderStatus": "paid",
#   "paymentStatus": "succeeded",
#   "paidAt": "2026-05-24T...",
#   "clientNumber": "SO-2026-0042",
#   "retryAvailable": false,
#   "receiptStatus": "pending|succeeded" }
```

### Step 6 — Verify in admin
- Order → `status=paid`, `payment.providerStatus=succeeded`, `paidAt` filled
- Order → `payment.paymentMethodSnapshot.card.last4="4477"`
- Order → `payment.captureAttempts=[]` (capture прошёл с первой попытки)
- Order → `payment.vatCodeApplied=12`
- PaymentEvents → 2 записи: `payment.waiting_for_capture` + `payment.succeeded` (если two_stage)
- NotificationJobs → 2 записи (customer "Оплата получена" + manager "Новый платный заказ")

---

## 6. E2E test — refund (US4)

**Prerequisites**: Order в `paid`, существуют доставленные позиции.

### Step 1 — Create Return
```bash
# Через customer /me/orders или admin
curl -X POST http://localhost:3000/api/returns \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "<order UUID>",
    "items": [{ "sku": "PDU-XYZ", "quantity": 1, "reason": "defect" }]
  }'
# → Returns в `received_back`
```

### Step 2 — Admin approve refund
```bash
curl -X POST http://localhost:3000/api/admin/returns/<return-id>/refund \
  -H "Cookie: payload-token=<admin token>" \
  -H "Idempotency-Key: <UUID>"

# Response: { "providerRefundId": "...", "status": "pending" }
# Returns.status → "refund_pending"
```

### Step 3 — Wait for webhook `refund.succeeded`
- ngrok: `POST /api/payment/yookassa/webhook 200`
- Logs: `[yookassa-webhook] refund.succeeded for refundId=... → applied to returnId=...`

### Step 4 — Verify Return
- Returns.status → `refunded`
- Returns.refundedAt filled
- Order.payment.refunds[0].providerStatus → `succeeded`
- Customer получил email "Возврат произведён"

---

## 7. Edge case checks (manual)

| Scenario | Expected behavior |
|---|---|
| **Replay webhook** — повторный POST с тем же `event_id` | 200 OK, PaymentEvents.duplicateCount++, Order не меняется |
| **IP forge** — webhook с левого IP (нет в allowlist) | 403, PaymentEvents.rejectedReason="ip_not_allowed", Order не меняется |
| **Amount mismatch** — Order.totals.total=10000, webhook amount=9999 | 200 OK (чтобы ЮKassa не ретраил), но Order не меняется, эмит payment.amount_mismatch, alert менеджеру |
| **Customer cancels on ЮKassa page** | webhook payment.canceled → Order: cancelled (если within window) или expired (после) |
| **Customer не вернулся, webhook потерян** | cron-expire через 5 мин → GET /v3/payments → если succeeded → reconcile; если canceled → Order=expired |
| **Capture failure 5xx** | Order остаётся pending_payment, captureAttempts[0] записан, retry в 1 мин |
| **3DS failure** | webhook payment.canceled, reason="3ds_failed" → Order=cancelled |

---

## 8. ЮKassa changelog monitoring

Перед началом каждого implement-цикла свериться с https://yookassa.ru/developers/using-api/changelog:
- Новые vat_code (например, при изменении ставки)
- Новые payment_method.type (tinkoff_bank в Phase 2)
- Webhook payload changes (например, добавление `event.id`)
- Webhook signature mode (когда станет общедоступен)

**Last checked**: 2026-05-24 (на момент написания plan.md). См. research.md R10.

---

## 9. Production launch checklist

Перед prod-релизом — checklist из spec.md §17:

- [ ] `paymentSettings.taxSystemCode=1`, `defaultVatCode=12` подтверждены бухгалтером.
- [ ] Все Products облагаются 22% НДС (A1 verification).
- [ ] Цены в каталоге пересчитаны под 22% НДС (A1a — бизнес-решение принято).
- [ ] Онлайн-касса подключена + auto-mode receipts on + поддерживает vat_code 11/12.
- [ ] Test-shop e2e: US1 (card), US2 (СБП), US4 (refund) — все проходят.
- [ ] Webhook IP-allowlist обновлён на актуальный CIDR-список ЮKassa.
- [ ] `YOOKASSA_SHOP_ID/SECRET_KEY` (prod) в Vercel env.
- [ ] `paymentSettings.webhookSecret` ≥32 chars, generated один раз, не в git.
- [ ] PaymentEvents retention настроен (90 дней).
- [ ] Cron `/api/cron/payments-expire` зарегистрирован в Vercel (каждые 5 минут).
- [ ] CRM-pattern check: `crmSettings.enabled=false` на launch → нет cross-spec activity.
- [ ] 049 notification matrix добавила `payment.*` события.
- [ ] PRs прошли security-review (FR-5530..5534).

---

## 10. Troubleshooting (для /implement и пост-launch)

| Симптом | Куда смотреть |
|---|---|
| Order в `pending_payment` навсегда | `Order.payment.captureAttempts[]`, PaymentEvents для этого Order, ЮKassa ЛК |
| Чек 54-ФЗ не пришёл | `Order.payment.receiptStatus`, ЛК ОФД, проверить онлайн-кассу (FR-5546 алёрт менеджеру) |
| Webhook 403 в PaymentEvents | sourceIp не в allowlist → проверить актуальный CIDR-список ЮKassa, обновить `ip-allowlist.ts` |
| Returns застрял в `refund_pending` | PaymentEvents для refund.* events; если их нет — ЮKassa не отправляет → проверить webhook URL в ЛК |
| Customer заявляет «оплатил, а Order не paid» | GET /v3/payments/{providerRef} в ЛК ЮKassa; если succeeded — cron-reconcile подберёт в ≤5 мин |
| amount_mismatch event | проверить, был ли finalize-shipping (047) после ЮKassa-page open — может быть data race; обновить Order вручную |

---

**End of quickstart.md.**
