# Data Model: ЮKassa Payments Integration (055, Phase 1)

**Date**: 2026-05-24
**Reference**: spec.md FR-5500..5598, research.md R1-R12.

## 1. Payload Global `paymentSettings` (NEW)

**File**: `apps/web/src/globals/PaymentSettings.ts`

**Slug**: `paymentSettings`
**Access**: read=admin+sales, update=admin only. `webhookSecret`-поле `read: () => false` (как `apiShipSettings.webhookSecret`).
**Mutability**: editable runtime, не требует деплоя (FR-5561).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `enabled` | boolean | yes | `true` | FR-5563 — gate всего модуля |
| `captureMode` | select | yes | `two_stage` | `one_stage` \| `two_stage` (Q2) |
| `paymentMethods` | select multi | yes | `["bank_card","sbp"]` | Whitelist: `bank_card`, `sbp`, `yoo_money`, `sberbank` (Q3) |
| `paymentRetryWindowMin` | number | yes | `60` | OQ-4. 5..1440 |
| `webhookSignatureMode` | select | yes | `off` | `off` \| `enforce`. MVP=off (FR-5535) |
| `webhookSecret` | text | no | — | Опционально, для будущего HMAC; `access.read: () => false` |
| `taxSystemCode` | number | yes | `1` | OQ-1, 1..6 (1=ОСН) |
| `defaultVatCode` | number | yes | `12` | OQ-3a, 1..12. **22/122 расчётная** по ФЗ-425 |
| `allowedLegacyVatCodes` | number[] | yes | `[4,6]` | FR-5544d, для refund'ов legacy-заказов 20% |
| `sbpMaxAmount` | number | yes | `1000000` | ₽; ЮKassa-limit |
| `senderCompanyInfo` | group | yes | — | См. подсхему ниже |
| `lastChangedBy` | rel(users) | auto | — | `afterChange` hook, audit |
| `lastChangedAt` | date | auto | — | `afterChange` hook |

### Subgroup `senderCompanyInfo`
| Field | Type | Required | Notes |
|---|---|---|---|
| `inn` | text | yes | 10 или 12 цифр; валидация формата |
| `legalName` | text | yes | «ИП Иванов Иван Иванович» либо «ООО Соликаново» |
| `address` | text | yes | Юр.адрес для receipt's sender |
| `kpp` | text | no | Только для ООО |

**Hooks**:
- `beforeChange`: валидация `taxSystemCode ∈ {1..6}`, `defaultVatCode ∈ {1..12}` (FR-5544a), `webhookSecret.length ≥ 32` если задан.
- `afterChange`: писать `lastChangedBy`, `lastChangedAt`, эмитить аудит-event `paymentSettings.changed` (для будущей integration с audit-log).

**Indexes**: N/A (global).

---

## 2. Payload Collection `paymentEvents` (NEW)

**File**: `apps/web/src/collections/PaymentEvents.ts`

**Slug**: `paymentEvents`
**Access**: read=admin+sales (FR-5571), create=server-only (через webhook handler — `create.access: () => false` для UI), update=`() => false`, delete=cron-prune only.
**Append-only**: hooks блокируют любые `update`/`delete` руками.

| Field | Type | Required | Notes |
|---|---|---|---|
| `eventId` | text | yes | unique. Composite `${object.id}:${event_type}` (R3) |
| `eventType` | select | yes | `payment.waiting_for_capture` \| `payment.succeeded` \| `payment.canceled` \| `refund.succeeded` \| `refund.canceled` \| `payment.refunded` (FR-5550) |
| `providerRef` | text | yes | ЮKassa payment_id / refund_id |
| `order` | rel(orders) | no | nullable (для unknown_payment edge case) |
| `return` | rel(returns) | no | nullable (для refund events) |
| `payload` | json | yes | Сырой webhook body. Truncate >16KB (FR-5570) |
| `truncatedAt` | number | no | Bytes если truncated |
| `receivedAt` | date | yes | timestamp получения (FR-5570) |
| `processedAt` | date | no | timestamp после обработки |
| `result` | select | yes | `success` \| `rejected` \| `duplicate` (FR-5570) |
| `rejectedReason` | select | no | `ip_not_allowed` \| `unknown_payment` \| `unknown_refund` \| `amount_mismatch` \| `currency_mismatch` \| `signature_invalid` \| `internal_error` |
| `sourceIp` | text | yes | IP из cf-connecting-ip / x-real-ip / x-vercel-forwarded-for |
| `duplicateCount` | number | yes | default 0 (FR-5531) |
| `source` | select | yes | default `webhook`; `cron_reconciliation` (R8, FR-5583) |
| `notificationJobId` | text | no | если триггерил 049 |
| `domainEventId` | text | no | если эмитили domain event (для трейсинга) |

**Indexes**:
- unique `eventId`
- composite (`order`, `receivedAt`) для UI Order timeline (US6)
- (`return`, `receivedAt`) для UI Return timeline
- (`receivedAt`) для cron-prune (90 дней)

**Retention** (FR-5572):
- Cron `payments-expire` чистит записи старше 90 дней (`receivedAt < now - 90d`).
- Аrchive в S3 — out of scope MVP (TODO).

**Admin UI**:
- В list view: `receivedAt`, `eventType`, `providerRef`, `result`, `rejectedReason`.
- Filter: result, eventType, дата.
- На странице Order — related list (FR-5571).

---

## 3. `Orders.payment` extensions

**File**: `apps/web/src/collections/Orders.js` (existing — extend `payment` group).

### Existing fields (НЕ меняем)
- `method` (card | invoice)
- `providerStatus` (none | pending | succeeded | canceled) — **расширим селект значениями `authorized` для two-stage** (см. ниже)
- `providerRef`
- `paidAt`
- `amount`
- `refunds[]` (053)
- `payerBankDetails` (053)

### NEW fields (055)

| Field | Type | Notes |
|---|---|---|
| `providerStatus` (extended) | select | Добавить значение `authorized` (для `waiting_for_capture`). Final: `none|pending|authorized|succeeded|canceled` |
| `capturedAt` | date | FR-5524 |
| `idempotenceKey` | text | UUID, gen at first create-payment, persist (FR-5510) |
| `confirmationUrl` | text | URL для редиректа на ЮKassa |
| `confirmationType` | select | `redirect` \| `qr` \| `embedded` |
| `paymentMethodSnapshot` | group | См. подсхему (OQ-6) |
| `captureAttempts` | array | См. подсхему (FR-5523a) |
| `receiptStatus` | select | `pending` \| `succeeded` \| `canceled` (FR-5545) |
| `vatCodeApplied` | number | snapshot VAT при `payment.succeeded` (FR-5544c) |

### Subgroup `paymentMethodSnapshot`

```ts
{
  type: select          // bank_card | sbp | yoo_money | sberbank
  title: text           // human-readable: "Visa •••• 1234" или "СБП Сбербанк"
  card?: {
    first6: text
    last4: text
    expiryMonth: text   // "12"
    expiryYear: text    // "27"
    cardType: select    // visa | mastercard | mir | jcb | unionpay
    issuerCountry: text // ISO-alpha2, "RU"
    issuerName: text    // "Сбербанк"
  }
  sbp?: {
    bankId: text        // ID банка от ЮKassa
    bankName: text      // "Сбербанк Онлайн"
  }
  yooMoney?: {
    accountNumber: text  // masked: "4100...XXXX"
  }
  sberbank?: {
    phone: text         // masked: "+7***XXXX"
  }
}
```

**Access**: `read: ({ req }) => req.user || isCustomerSession(req)` (показываем в `/me/orders`).

### Subgroup `captureAttempts` (array)

```ts
{
  attemptedAt: date     // required
  error: text           // required, "5xx Bad Gateway" etc.
  errorCode: text       // optional, ЮKassa error code if any
  nextRetryAt: date     // required if не последний
  exhausted: boolean    // true если final attempt
}
```

**Hooks для Orders.js (055-specific)**:

1. **`beforeChange` (extend 051 immutability guard)**:
   - Если `wasEverPaid && status === "paid"` — frozen fields включают NEW: `paidAt`, `capturedAt`, `amount`, `paymentMethodSnapshot`, `vatCodeApplied`, `idempotenceKey`.
   - НЕ frozen (можно менять после paid): `providerStatus` (для refund tracking), `refunds[]`, `captureAttempts[]` (исторический), `confirmationUrl` (можно убрать).
   - Гарантия immutability через 051-mechanism, не дублируем guard.

2. **`afterChange` (extend 047/051)**:
   - Если `previousDoc.status !== "paid" && doc.status === "paid"` — эмитить `order.paid` (уже было в 047, но теперь триггерится через webhook).

**Indexes**:
- `payment.providerRef` (для webhook lookup, FR-5534) — добавить
- `payment.idempotenceKey` (для retry dedup, FR-5510) — добавить
- composite (`status`, `payment.createdAt`) — для cron-expire query

---

## 4. Domain events (typed)

**File**: `apps/web/src/lib/lifecycle/domain-events.ts` (existing — extend union).

### New event types (payment family)

```ts
type PaymentAuthorized = {
  kind: "payment.authorized";
  payment: { providerRef: string; amount: number; method: PaymentMethodType };
  order: { id: string; clientNumber: string };
  authorizedAt: string;       // ISO
  meta: { eventId: string };  // PaymentEvents.eventId
};

type PaymentCaptured = {
  kind: "payment.captured";
  payment: { providerRef: string; amount: number; capturedAmount: number };
  order: { id: string; clientNumber: string };
  capturedAt: string;
  meta: { eventId: string };
};

type PaymentSucceeded = {
  kind: "payment.succeeded";
  payment: {
    providerRef: string;
    amount: number;
    method: PaymentMethodType;
    receiptStatus: "pending"|"succeeded"|"canceled";
    paymentMethodSnapshot: PaymentMethodSnapshot;
  };
  order: { id: string; clientNumber: string };
  succeededAt: string;
  meta: { eventId: string; utm?: UtmSnapshot };  // utm для analytics (FR-5599)
};

type PaymentCanceled = {
  kind: "payment.canceled";
  payment: { providerRef: string; reason: CancelReason };
  order: { id: string; clientNumber: string };
  canceledAt: string;
  meta: { eventId: string };
};

type CancelReason =
  | "customer_canceled"
  | "3ds_failed"
  | "insufficient_funds"
  | "issuer_declined"
  | "fraud_suspected"
  | "expired"                   // TTL ЮKassa истёк
  | "stock_unavailable"         // our cancel при out-of-stock
  | "capture_retries_exhausted" // 7-дневный hold истёк
  | "manual_cancel"             // admin-action
  | "amount_mismatch"
  | "unknown";

type PaymentExpired = {
  kind: "payment.expired";
  payment: { providerRef: string };
  order: { id: string; clientNumber: string };
  expiredAt: string;
  meta: { eventId: string };
};

type PaymentAmountMismatch = {
  kind: "payment.amount_mismatch";
  payment: { providerRef: string; expected: number; actual: number };
  order: { id: string; clientNumber: string };
  mismatchAt: string;
  meta: { eventId: string };
};

type PaymentReceiptFailed = {
  kind: "payment.receipt_failed";
  payment: { providerRef: string; receiptStatus: "canceled" };
  order: { id: string; clientNumber: string };
  failedAt: string;
  meta: { eventId: string; errorHint?: string };
};
```

### New cross-spec event types (return family — для 053 integration)

```ts
type ReturnRefunded = {
  kind: "return.refunded";
  return: { id: string; clientNumber: string };
  order: { id: string; clientNumber: string };
  refund: { providerRefundId: string; amount: number };  // amount in kopecks
  refundedAt: string;
  meta: { eventId: string };
};

type ReturnRefundFailed = {
  kind: "return.refund_failed";
  return: { id: string; clientNumber: string };
  order: { id: string; clientNumber: string };
  refund: { providerRefundId: string; reason: string };
  failedAt: string;
  meta: { eventId: string };
};
```

### Extended `DomainEventKind` union

```ts
type DomainEventKind =
  | OrderEventKind        // existing
  | ShipmentEventKind     // existing
  | CartEventKind         // existing 052
  | ReturnEventKind       // existing 053
  | CustomerEventKind     // existing 054
  | PaymentEventKind;     // ⭐ NEW (055)

type PaymentEventKind =
  | "payment.authorized"
  | "payment.captured"
  | "payment.succeeded"
  | "payment.canceled"
  | "payment.expired"
  | "payment.amount_mismatch"
  | "payment.receipt_failed";
```

**Subscribers** (existing emitter pattern из 047):
- 049 NotificationsSubscriber — все `payment.*` события → matrix lookup
- 052 CartRecoverySubscriber — `payment.canceled`, `payment.expired` → recover cart (доп. к `order.cancelled`)
- 048 CrmSubscriber — `payment.succeeded` → если `crmSettings.enabled` (default false на launch) → enqueue Twenty sync
- 055 self (для logging) — не нужен; PaymentEvents append-only пишется ДО emit

---

## 5. State machine alignment

### Order.status transitions (только payment-relevant)

```
draft
  └─→ pending_payment (submit checkout, US1 037)

pending_payment
  ├─→ pending_payment (payment.waiting_for_capture; provStatus: pending → authorized; внутренний шаг)
  ├─→ paid          (payment.succeeded; wasEverPaid=true; immutability ON)
  ├─→ cancelled     (payment.canceled within window OR stock_unavailable)
  └─→ expired       (payment.canceled after window OR cron-expire OR capture_retries_exhausted)

awaiting_payment (B2B-инвойс, US2 037)
  └─ paid (manual admin-action) — НЕ через ЮKassa webhook

paid → refunding → refunded  (053 flow, NOT 055)
paid → fulfilling → shipped → delivered → completed
```

### `Order.payment.providerStatus` transitions

```
none → pending (POST /v3/payments создан)
pending → authorized (webhook payment.waiting_for_capture; two_stage only)
authorized → succeeded (webhook payment.succeeded after capture)
pending → succeeded (one_stage: прямо в succeeded)
pending → canceled
authorized → canceled (capture-call inline cancel, либо ЮKassa hold expired)
succeeded — terminal
canceled — terminal
```

### `Return.status` transitions (053, расширены 055)

```
refund_pending → refunded (NEW: webhook refund.succeeded, R9)
refund_pending → refund_failed (NEW: webhook refund.canceled, R9)
```

Остальные 053-transitions не меняются.

---

## 6. Notification matrix entries (049 — для design awareness, реализация в /implement)

| domain event | recipient | template | channel |
|---|---|---|---|
| `payment.succeeded` | customer | "Оплата получена" | email |
| `payment.succeeded` | manager | "Новый платный заказ {clientNumber}" | email |
| `payment.canceled` | customer | "Платёж не прошёл — попробуйте повторить" | email (только если within retry window) |
| `payment.expired` | customer | "Заказ {clientNumber} аннулирован — оплата не получена" | email |
| `payment.amount_mismatch` | manager | "⚠️ Несоответствие суммы по {clientNumber} — проверьте вручную" | email (high-priority) |
| `payment.receipt_failed` | manager | "⚠️ Чек 54-ФЗ не выдан по {clientNumber}" | email |
| `return.refunded` | customer | "Возврат произведён" | email |
| `return.refund_failed` | manager | "⚠️ Refund failed — ручная компенсация" | email |

049 matrix-entry — реализация в /implement; здесь — обзор для consistency check.

---

## 7. Database migration

**Path**: `apps/web/src/migrations/055-yookassa-payments-integration.ts` (или auto-generated через Payload's `payload migrate`).

**DDL**:
1. Create global `paymentSettings`.
2. Create collection `paymentEvents` с индексами (unique eventId, order+receivedAt, return+receivedAt, receivedAt).
3. ALTER Orders.payment:
   - ADD COLUMN `capturedAt`, `idempotenceKey`, `confirmationUrl`, `confirmationType`, `receiptStatus`, `vatCodeApplied`
   - ADD JSON `paymentMethodSnapshot`, `captureAttempts`
   - ALTER `providerStatus` enum: add `authorized`
   - ADD INDEX on `payment.providerRef`, `payment.idempotenceKey`

**Backfill для existing Orders**:
- Существующих paid-orders в проде нет (launch ещё не было) — backfill не нужен.
- Если миграция запускается на test-db с тестовыми данными — оставляем поля NULL, immutability guard их не трогает (НЕ-frozen).

---

## 8. Privacy & compliance

| Поле | PII | Хранение | Доступ |
|---|---|---|---|
| `paymentMethodSnapshot.card.first6/last4` | masked (non-PII per PCI DSS Req 3.3) | как есть | customer (own) + admin |
| `paymentMethodSnapshot.card.issuerCountry/Name` | non-PII | как есть | admin only |
| `paymentMethodSnapshot.sbp.bankName` | non-PII | как есть | customer + admin |
| `paymentMethodSnapshot.yooMoney.accountNumber` | masked | как есть | customer + admin |
| `paymentMethodSnapshot.sberbank.phone` | masked (last 4) | как есть | customer + admin |
| `paymentEvents.payload` | может содержать email | masked в логах (FR-5597), full в PaymentEvents | admin+sales only |
| `paymentEvents.sourceIp` | IP customer'а | как есть, 90д retention | admin+sales |
| `payerBankDetails` (053, B2B) | ИНН/счёт юрлица | encrypted-at-rest не требуется (юр.инфа открыта) | admin only |
| `Order.payment.idempotenceKey` | non-PII (UUID) | как есть | server only |
| `Order.payment.providerRef` | non-PII | как есть | server only |

**GDPR/152-ФЗ** (FR-5400 chain 054):
- `/api/customers/me/delete` (054): при анонимизации Customer — `paymentMethodSnapshot.card` обнуляется (фейк mask `****0000`), `paymentEvents.sourceIp` обнуляется. Финансовая история (Order.payment.amount, paidAt, refunds) **остаётся** — это legal obligation (бухучёт, 5 лет хранения).

---

## 9. Open questions resolved at design

| Q | Resolution |
|---|---|
| Где хранить webhook secret? | `paymentSettings.webhookSecret` (Payload, для runtime-смены). `YOOKASSA_SECRET_KEY` остаётся в env. |
| Один ли `idempotenceKey` для всех retry create-payment? | Да, persist в `Order.payment.idempotenceKey` после первого вызова, FR-5510. |
| Полиморфизм PaymentEvents (order vs return)? | Два nullable rel'a: `order` и `return`; ровно одно заполнено. |
| Где хранить `captureAttempts`? | В `Order.payment.captureAttempts[]` (array). Не отдельная collection — это per-order, не нужно cross-cutting query. |
| Как версионировать changelog ЮKassa? | Documented в research.md R10. На каждом /implement-старте sanity-check changelog. |

---

**End of data-model.md.**
