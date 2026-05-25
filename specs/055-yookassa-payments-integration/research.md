# Research: ЮKassa Payments Integration (055, Phase 0)

**Date**: 2026-05-24
**Sources**: yookassa.ru/developers, ФЗ-425 (28.11.2025), existing 047/053 codebase patterns, ЮKassa changelog 2026.
**Goal**: Resolve all NEEDS CLARIFICATION before Phase 1 design. Since /clarify закрыл 12 OQ, эта research-фаза подтверждает только технические решения, не бизнес-правила.

---

## R1 — ЮKassa API authentication & idempotency

**Decision**: HTTP Basic auth `Authorization: Basic base64(shopId:secretKey)`, header `Idempotence-Key: <UUID-or-deterministic-string>` для всех POST'ов.

**Rationale**:
- Уже работает в `apps/web/src/lib/payments/yookassa-refunds.ts` (053).
- ЮKassa orthography: `Idempotence-Key` (без `y` — FR-5591).
- shopId/secretKey — только из env (FR-5598), shop-bound auth.

**Idempotency-key strategy** (FR-5510, FR-5522):
| Операция | Key formula |
|---|---|
| create-payment | `${orderId}:${retryNonce}` (retryNonce — UUID, gen at first call, persist in `Order.payment.idempotenceKey`) |
| capture | `${orderId}:capture` (idempotent — повторный capture одного и того же платежа возвращает текущее состояние) |
| cancel | `${orderId}:cancel` |
| refund | `${returnId}:refund` (already in 053) |

**Alternatives considered**:
- JWT auth — ЮKassa не поддерживает.
- OAuth — overkill для server-server.
- Random UUID на каждый retry — теряет идемпотентность, нет.

---

## R2 — Two-stage capture flow

**Decision**: Поддерживаем оба режима через `paymentSettings.captureMode` (default `two_stage`).

**Flow для two_stage (FR-5520..5524)**:
```
1. POST /v3/payments {capture: false, ...}
   → Response: {id, status: "pending", confirmation_url}
2. Customer на confirmation_url → платит на ЮKassa
3. Webhook payment.waiting_for_capture
   → Handler: emit payment.authorized + проверка stock (MVP: skip) + POST /v3/payments/{id}/capture
4. Webhook payment.succeeded
   → Handler: emit payment.captured + payment.succeeded → Order.status: pending_payment → paid
```

**Flow для one_stage**:
```
1. POST /v3/payments {capture: true, ...}
2. Customer платит
3. Webhook payment.succeeded — финал сразу
```

**TTL of authorization hold**: 7 календарных дней по ЮKassa-документации. После — auto-cancel со стороны ЮKassa, приходит webhook `payment.canceled`.

**Edge case — capture failure (FR-5523a)**:
- ЮKassa 5xx / network timeout НЕ означает «капчер не прошёл». ЮKassa могла принять запрос, но не ответить. Поэтому **retry с тем же `Idempotence-Key=${orderId}:capture`** — это безопасно.
- Backoff: 1 мин → 5 мин → 15 мин → 1 ч → 6 ч → 24 ч (до 7 дней).
- Состояние хранится в `Order.payment.captureAttempts[]`.
- Если на 7-й день всё ещё нет успеха — Order → `cancelled`, ЮKassa auto-release hold.

**Альтернативы**:
- One-stage всегда — отвергнуто Q2 (B2B-товары требуют двухстадийку для inventory-check в будущем).
- Manual capture через admin — out of scope MVP (FR-5520 говорит «всегда auto-capture»).

---

## R3 — Webhook payload structure

**Decision**: Парсим payload как typed union из 5 event types в `contracts/yookassa-webhook-events.ts`.

**Events handled in MVP** (FR-5550):

| Event type | Trigger | Order/Return effect |
|---|---|---|
| `payment.waiting_for_capture` | two_stage auth success | emit `payment.authorized` → trigger capture call |
| `payment.succeeded` | one_stage success ИЛИ two_stage capture success | Order: `pending_payment → paid` (FR-5551) |
| `payment.canceled` | timeout / customer cancelled / 3-DS fail / our cancel | Order: `pending_payment → cancelled|expired` (FR-5552) |
| `refund.succeeded` | refund-request обработан | Return: `refund_pending → refunded` (FR-5553) |
| `refund.canceled` | refund отклонён банком | Return: `refund_pending → refund_failed` (FR-5554) |

**Payload schema** (упрощённо, из ЮKassa docs):
```json
{
  "type": "notification",
  "event": "payment.succeeded",
  "object": {
    "id": "2dbdbeb6-000f-5000-9000-0e6d4eb52a3d",
    "status": "succeeded",
    "amount": { "value": "100.00", "currency": "RUB" },
    "paid": true,
    "captured_at": "2026-05-24T...",
    "payment_method": { "type": "bank_card", "card": {...} },
    "receipt_registration": "succeeded",
    "metadata": { "orderId": "..." }
  }
}
```

**Note**: ЮKassa **не** документирует уникальный `event.id` в payload; уникальность сейчас извлекается через `object.id + event` композит. **TODO research-pending**: проверить с changelog 2026 — возможно появился `event.id`. Если нет — composite key `(object.id, event)`.

**Alternatives**: GraphQL push (ЮKassa не поддерживает), polling-only (медленно, expensive).

---

## R4 — Receipt 54-ФЗ объект (НДС 22%)

**Decision**: Формируем `receipt`-объект на стороне сервиса, ЮKassa-касса в auto-mode фискализирует.

**Структура (FR-5540..5546, актуально на 2026-05)**:
```json
{
  "customer": { "email": "user@example.com" /* fallback to phone — FR-5544b */ },
  "items": [
    {
      "description": "Блок розеток XYZ-32A",
      "quantity": "2.00",
      "amount": { "value": "12000.00", "currency": "RUB" },
      "vat_code": 12,            // 22/122 расчётная (NEW, ФЗ-425)
      "payment_subject": "commodity",
      "payment_mode": "full_prepayment"
    },
    {
      "description": "Доставка СДЭК до ПВЗ Москва",
      "quantity": "1.00",
      "amount": { "value": "650.00", "currency": "RUB" },
      "vat_code": 12,
      "payment_subject": "service",
      "payment_mode": "full_prepayment"
    }
  ],
  "tax_system_code": 1  // ОСН (OQ-1)
}
```

**Новые vat_code в 2026**:
- `11` = 22% (включаемая) — если цена БЕЗ НДС
- `12` = 22/122 (расчётная) — если цена ВКЛЮЧАЕТ НДС ← **наш default** (OQ-3a)
- Legacy `4` (20/120) и `6` (20%) — только для refund'ов по импортированным заказам (FR-5544d, маловероятно у нас)

**Receipt registration status в webhook**:
- ЮKassa возвращает `receipt_registration` в payload `payment.succeeded`:
  - `pending` — чек ещё формируется
  - `succeeded` — чек зарегистрирован в ОФД
  - `canceled` — ошибка фискализации (кассу нужно проверить)
- Маппинг → `Order.payment.receiptStatus` (FR-5545).
- При `canceled` — Order **не** меняем статус (FR-5546), но шлём алёрт менеджеру через 049.

**VAT snapshot for refunds (FR-5544c)**:
- `Order.payment.vatCodeApplied` сохраняется в момент `payment.succeeded`.
- При refund через 053: `createRefund({...receipt: buildRefundReceipt(order, return, order.payment.vatCodeApplied)})` — использует snapshot, не текущий `defaultVatCode`.
- Это страхует на будущие изменения ставки (например, если в 2028 НДС поднимут до 24%).

**Alternatives considered**:
- Manual mode (мы шлём чеки сами в ОФД) — overkill, требует своей онлайн-кассы. ЮKassa auto-mode — стандарт.
- Без `receipt` — нарушение 54-ФЗ, штраф ≥ 10K ₽/операция.

---

## R5 — PCI-DSS scope verification

**Decision**: Сервис **не входит в PCI-DSS scope** благодаря redirect-flow.

**Обоснование**:
- Customer вводит данные карты на странице ЮKassa (PCI Level-1 certified).
- Сервис получает только `payment_method.card.first6/last4/expiry/brand` через webhook — это **non-sensitive masked data**, PCI-DSS разрешает хранить (см. PCI DSS Requirement 3.3).
- `PAN`, `CVV2/CVC2`, magnetic stripe — никогда не проходят через нашу инфраструктуру.

**Что нам делать (FR-5595..5598)**:
1. **Никогда** не логировать full PAN (даже если кто-то случайно передаст).
2. **Не сохранять** `card.token` от ЮKassa в Payload без шифрования — но это не требуется для one-time charges; saved-cards отложены до Phase 2.
3. `Order.payment.paymentMethodSnapshot.card.last4` — **OK для хранения** в plain text (это уже masked).

**Alternatives**:
- Server-to-server без redirect (поднимает scope до PCI Level-1) — отвергнуто, сложность не оправдана.
- Tokenization — Phase 2 для saved cards.

---

## R6 — IP-allowlist CIDR matching

**Decision**: Whitelist CIDR из ЮKassa docs, проверка в webhook-handler через manual CIDR-matcher.

**Источник истины (FR-5530)** — `https://yookassa.ru/developers/using-api/webhooks#ip`:
```
185.71.76.0/27
185.71.77.0/27
77.75.153.0/25
77.75.154.128/25
77.75.156.11/32
77.75.156.35/32
2a02:5180::/32
```

**IP extraction (наш стек)**:
```ts
const candidates = [
  req.headers.get("cf-connecting-ip"),         // Cloudflare
  req.headers.get("x-vercel-forwarded-for"),   // Vercel
  req.headers.get("x-real-ip"),
];
const realIp = candidates.find(Boolean)?.split(",")[0]?.trim();
```

**CIDR-match implementation**: `lib/payments/ip-allowlist.ts` — простая функция без зависимостей (раз CIDR'ов мало). Поддержка IPv4 + IPv6.

**Alternatives**:
- `ipaddr.js` package — рассмотрим если CIDR-list разрастётся.
- Cloudflare-only enforcement — мы на Vercel, не подходит.
- Allow-all + только signature — небезопасно (signature пока не enforced — FR-5535).

---

## R7 — Capture-retry exponential backoff

**Decision**: Cron `payments-expire` поднимает все Orders в `pending_payment` старше threshold, идёт по `captureAttempts[]` чтобы определить next retry.

**State machine для retry**:
```
captureAttempts = [
  { attemptedAt: "2026-05-24T10:00:00Z", error: "network timeout", nextRetryAt: "2026-05-24T10:01:00Z" },
  { attemptedAt: "2026-05-24T10:01:30Z", error: "5xx", nextRetryAt: "2026-05-24T10:06:30Z" },
  ...
]
```

**Backoff sequence**: `[1m, 5m, 15m, 1h, 6h, 24h]`.

**Total max retries**: 6 попыток за ~31 час суммарно — успеваем до 7-дневного hold ЮKassa expire'a.

**После 6 неудач** (на 8-й день hold уже expired у ЮKassa):
- Order → `cancelled`
- emit `payment.canceled` reason=`capture_retries_exhausted`
- alert менеджеру через 049 (с полной историей `captureAttempts`)
- 052 cart-recovery подхватывает

**Alternatives**:
- Линейная задержка — слишком много нагрузки на ЮKassa.
- Без retry, сразу cancel — теряем деньги при transient ошибках (NFR-5502).
- Mega exponential (2^n) — на 6-й попытке уже >7 дней.

---

## R8 — Cron reconciliation patterns

**Decision**: Cron `/api/cron/payments-expire` запускается каждые 5 мин, выполняет 3 функции:
1. **Expire**: Order'ы старше `paymentRetryWindowMin` (60м) в `pending_payment` → GET в ЮKassa, если `canceled` → Order `expired`.
2. **Reconcile**: те же Order'ы, если ЮKassa отвечает `succeeded` → обработать как webhook (потерянный).
3. **Capture retry**: Order'ы с `captureAttempts.length > 0` и `nextRetryAt <= now` → re-call capture с тем же idempotency key.

**Patterns заимствуем из существующего**:
- `pg_try_advisory_lock` (047 closure, 052 carts-cleanup, 053 returns-overdue) — защита от параллельных запусков.
- Batch ≤100 Orders за run (FR-5585), для защиты от lock-timeout'a.
- `CRON_SECRET` header (как все другие cron'ы).

**Vercel cron config** (`vercel.json` или `cron.json`):
```json
{ "path": "/api/cron/payments-expire", "schedule": "*/5 * * * *" }
```

**Alternatives**:
- BullMQ / pg-boss — overkill для 5-минутного cron'a.
- Manual triggering — нечестно перед `pending_payment` orders.

---

## R9 — Cross-spec event contract (053 integration)

**Decision**: 055 exports функцию `applyRefundSucceeded(event)` / `applyRefundCanceled(event)`. 053 repository.ts импортирует и зовёт.

**Module location**: `apps/web/src/lib/returns/repository.ts` (existing, extend).

**Сигнатуры** (см. `contracts/refund-webhook-contract.md`):
```ts
// в lib/returns/repository.ts (existing module, new exports)
export async function applyRefundSucceeded(input: {
  providerRefundId: string;
  succeededAt: Date;
  amount: number;  // kopecks (как 053 хранит)
  receivedEventId: string;
}): Promise<{ returnId: string; orderId: string }>;

export async function applyRefundCanceled(input: {
  providerRefundId: string;
  canceledAt: Date;
  reason: string;
  receivedEventId: string;
}): Promise<{ returnId: string; orderId: string }>;
```

**Контракт**:
- 055 webhook handler НЕ читает/пишет `Returns` напрямую — только через 053-репозиторий (Constitution IV: Integrations Isolated).
- 053-репозиторий применяет state-machine transition, обновляет `Order.payment.refunds[]`, вызывает `maybeMarkOrderReturned()` (already correct после C1 fix).
- 055 эмитит `return.refunded` / `return.refund_failed` доменное событие; 049 шлёт письмо клиенту.

**Тесты**:
- Unit: `lib/returns/repository.test.ts` — happy path + edge cases (unknown providerRefundId, double-webhook, race с manual admin-restore).
- Integration: e2e через test-shop ЮKassa.

**Alternatives**:
- 055 напрямую мутирует `Returns` collection — нарушение isolated principle, отвергнуто.
- Bus с pub-sub — overkill для одной cross-spec точки.

---

## R10 — ЮKassa changelog 2026 (audit)

**Decision**: Согласно `yookassa.ru/developers/using-api/changelog` (на момент 2026-05) подтверждены следующие изменения относительно baseline 053-imp (2026-05-15):

1. **2026-01-01**: Новые vat_code 11/12 (НДС 22%). ✅ Учтено в spec (FR-5544).
2. **2026-01-15**: Расширение `payment_method.type` — добавлен `tinkoff_bank` (Phase 2, не в MVP).
3. **2026-02**: Опциональная поддержка `webhook-signature` HMAC-SHA256 header. ✅ Учтено как `paymentSettings.webhookSignatureMode=enforce` (FR-5535), но в MVP default `off` (IP-allowlist достаточен).
4. **2026-03**: `payment_method.card.issuer_country` теперь возвращается. ✅ Учтено в `paymentMethodSnapshot.card.issuerCountry` (Key Entities §4 spec).
5. **2026-04**: `receipt_registration` теперь включает `pending` state (ранее только `succeeded`/`canceled`). ✅ Учтено в FR-5545.

**Action items на /implement**:
- Перед началом impl ещё раз свериться с changelog (может быть май-update).
- TODO в `quickstart.md`: ссылка на changelog для regular sanity check.

**Alternatives**: skip changelog → риск использовать устаревшие vat_code'ы или формат.

---

## R11 — Existing yookassa-refunds.ts integration

**Decision**: Extend `createRefund()` signature без breaking changes для 053.

**Текущая сигнатура (053)**:
```ts
createRefund(input: { paymentId, amount, description, idempotencyKey })
```

**Новая сигнатура (055)**:
```ts
createRefund(input: {
  paymentId: string;
  amount: number;          // kopecks
  description: string;
  idempotencyKey: string;
  receipt?: ReceiptInput;  // ← NEW, optional для backward-compat
})
```

**Behavior**:
- Если `receipt` передан → отправляем его в ЮKassa (фискальный чек коррекции).
- Если не передан → текущее поведение (053 пока не передаёт, у нас всё ещё работает).
- **После 055 impl**: 053 ОБЯЗАН передавать `receipt` для prod-correctness; временный stub приемлем только в dev.

**Migration plan**:
1. Phase 1 импл: yookassa-refunds.ts принимает opt receipt.
2. 053 repo.ts строит receipt из Order.payment.vatCodeApplied + Return.amount.
3. Test что old behavior без receipt не сломан (unit test).

**Alternatives**:
- New function `createRefundWithReceipt()` — duplication, отвергнуто.
- Полный rewrite 053 → 055 контроллирует всё refund-flow — нарушение isolated 053, отвергнуто.

---

## R12 — Webhook delivery guarantees (ЮKassa side)

**Decision**: ЮKassa гарантирует at-least-once delivery с retry до 7 раз. Сервис обязан быть idempotent.

**Retry pattern ЮKassa**:
- 1-я попытка: ~5 сек после event
- 2-я: +30 сек
- 3-я: +5 мин
- 4-я: +30 мин
- 5-я: +3 ч
- 6-я: +12 ч
- 7-я: +24 ч
- После 7-й попытки — webhook сбрасывается, ЮKassa **не** ретраит больше.

**Наш ответ должен быть**:
- HTTP 200 (любой 2xx) → ЮKassa считает delivered, не ретраит.
- HTTP 4xx → ЮKassa считает permanent failure, не ретраит (опасно — наша 4xx-ошибка убьёт цепочку).
- HTTP 5xx или timeout → retry.

**Implication для FR-5536**: heavy ops (emit domain event, 049 send) делаем после ответа 200 через `waitUntil`. Если 049 упадёт — webhook **уже** ack'ed, мы ОК. PaymentEvents запись делаем синхронно ДО ответа 200.

**Backup if ЮKassa-retry sequence не покрыла**: cron-reconciliation (R8) — каждые 5 мин подбирает потерянные events.

**Alternatives**:
- Process events sync с алёртами на failure — медленно, нарушает NFR-5501.
- Queue (BullMQ) — overkill; webhook handler как async-trigger достаточен.

---

## Сводка решений

| ID | Тема | Решение | FR |
|---|---|---|---|
| R1 | Auth + Idempotency | Basic auth + Idempotence-Key с deterministic patterns | FR-5501, FR-5510, FR-5522, FR-5591 |
| R2 | Two-stage capture | Configurable via `paymentSettings.captureMode`, default two_stage | FR-5503, FR-5520..5524 |
| R3 | Webhook events | 5 typed events в union, typed via Zod-like schemas | FR-5550 |
| R4 | Receipt 54-ФЗ | vat_code=12 (22/122) default, customer email-priority | FR-5540..5546, FR-5544c/d |
| R5 | PCI-DSS | Сервис не входит в scope (redirect-flow) | FR-5595..5598 |
| R6 | IP-allowlist | CIDR-list из ЮKassa docs, manual matcher | FR-5530 |
| R7 | Capture retry | Exp backoff 1m→5m→15m→1h→6h→24h, max 6 попыток | FR-5523a |
| R8 | Cron reconcile | 5-мин cron, 3 функции (expire/reconcile/capture-retry), `pg_try_advisory_lock` | FR-5580..5585 |
| R9 | 053 integration | `applyRefundSucceeded` / `applyRefundCanceled` exported из 053-repo | FR-5553, FR-5554 |
| R10 | Changelog 2026 | Sync с ЮKassa май 2026; vat_code 11/12, webhook-signature opt-in | OQ-3a, FR-5535 |
| R11 | yookassa-refunds extend | Opt `receipt` параметр, backward-compat | FR-5544c |
| R12 | Delivery guarantees | At-least-once, idempotent handler, waitUntil для heavy ops | FR-5531, FR-5536 |

**Все NEEDS CLARIFICATION resolved.** Никаких блокеров для Phase 1 design.

---

**End of research.md.**
