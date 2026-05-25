# Implementation Plan: Returns & Refunds

**Branch**: `053-returns-and-refunds` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/053-returns-and-refunds/spec.md`

## Summary

Заменить единственный флаг `Order.disputeFlag` полноценной сущностью `Return` с собственным жизненным циклом (`requested → approved → received → refunded`), частичными возвратами по позициям, интеграцией с ЮKassa Refunds API и ApiShip return-shipment, генерацией корректировочного счёта-фактуры (КСФ) для юрлиц и чека коррекции по 54-ФЗ. Архитектурно — новая коллекция `returns`, расширение `Orders` тремя computed-полями, новые API-роуты (public + admin), новые шаблоны email (T-015, T-016) и CRM-события (`return.created`, `return.refunded`).

## Technical Context

**Language/Version**: TypeScript 5, Node 20.

**Primary Dependencies**:

- Из проекта: `next@16`, `payload@^3.84`, `axios@^1.13` (уже стоит для 047).
- Новые: `pdfkit@^0.15` **или** `puppeteer-core@^22` для рендера КСФ (см. движок счёта-фактуры в 037 — используем тот же).
- `zod@^3` для валидации входящих в `/api/returns`.

**Storage**: PostgreSQL через Payload. Новая коллекция `returns`, расширение `orders` (три computed-поля + сохранение `Order.payment.refunds[]`).

**Testing**: Vitest для state machine, маппингов на ЮKassa/ApiShip, генератора КСФ. Playwright e2e — full flow (заказ → delivered → return-форма → одобрение → refund sandbox → T-016 в mailtrap → КСФ в Media).

**Target Platform**: Server-side (Node runtime), Next.js 16 API routes.

**Performance Goals**:

- p95 `POST /api/returns` ≤ 800 мс (включая создание записи и эмит событий).
- p95 «Вернуть деньги» action (вкл. вызов ЮKassa) ≤ 5 с.
- 0 потерянных событий `return.refunded` за 30 дней (через `crm-sync-jobs` retry из 048).

**Constraints**:

- ЮKassa secretKey и ApiShip token — только server-side, маска в логах.
- Все денежные суммы — целые копейки (int), Money-объект; никаких float.
- Атомарность `returnNumber` — sequence или advisory lock (как в 051 для `orderNumber`).
- Идемпотентность всех «опасных» actions (refund, return-shipment) — обязательна.

**Scale/Scope**:

- 1.5–2 спринта.
- ~4 публичные страницы/компонента (форма return, экран благодарности, страница `/policies/returns/`, баннер на `/cart/order/[token]/`).
- ~7 API-роутов (public POST/GET + admin approve/reject/received/refund/cancel + cron).
- ~10 модулей в `lib/`.
- 1 новая коллекция + расширение Orders + новые миграции.

## Constitution Check

AGENTS.md требует:

1. **High-risk изменения** (платёжная интеграция, налоговые документы) → перед прод-релизом блок «Возвраты / ЮKassa» проверен и подписан владельцем; добавляем review-step в `tasks.md`.
2. **Никаких секретов на клиент** — выполняется (server-only routes).
3. **SDD/Speckit** — этот набор файлов и есть подтверждение.
4. **Логирование в AdminChangeLog** для всех ручных actions (approve/reject/refund) — заложено в FR-5333.
5. **Уважение к legal/tax compliance** — выделено отдельным блоком в spec (FR-5336..5340).

Отклонений нет.

## Project Structure

```text
apps/web/src/
├── collections/
│   ├── Returns.ts                            # NEW — основная коллекция
│   └── Orders.js                             # MODIFIED — computed + payment.refunds[]
├── app/
│   ├── cart/order/[token]/
│   │   ├── page.tsx                          # MODIFIED — баннер «Оформить возврат»
│   │   └── return/
│   │       ├── page.tsx                      # NEW — публичная форма
│   │       └── success/page.tsx              # NEW — экран благодарности
│   ├── policies/returns/page.tsx             # NEW — статичная политика
│   └── api/
│       ├── returns/route.ts                  # NEW — public POST + GET
│       ├── admin/returns/[id]/
│       │   ├── approve/route.ts
│       │   ├── reject/route.ts
│       │   ├── received/route.ts
│       │   ├── refund/route.ts
│       │   ├── cancel/route.ts
│       │   ├── create-return-shipment/route.ts
│       │   └── regenerate-credit-memo/route.ts
│       ├── webhooks/apiship/route.ts         # MODIFIED — обработка return-order webhook
│       └── cron/returns/
│           ├── auto-reminder-manager/route.ts
│           └── overdue-refund-alert/route.ts   # ст. 22 — 10 дней
├── lib/
│   ├── returns/
│   │   ├── state-machine.ts                  # NEW — переходы + валидация
│   │   ├── number-generator.ts               # NEW — RT-YYYY-NNNN (sequence)
│   │   ├── refund-calculator.ts              # NEW — суммы из snapshot
│   │   ├── events.ts                         # NEW — emit return.* events
│   │   └── policies.ts                       # NEW — невозвратные товары, окна
│   ├── payments/
│   │   └── yookassa-refunds.ts               # NEW — REST POST /v3/refunds
│   ├── shipping/apiship/
│   │   └── return-orders.ts                  # NEW — createReturnShipment
│   ├── documents/
│   │   ├── credit-memo.ts                    # NEW — генератор КСФ PDF
│   │   ├── credit-memo-number.ts             # NEW — CM-YYYY-NNNN sequence
│   │   └── return-application.ts             # NEW — PDF заявления на возврат
│   ├── fiscal/
│   │   └── correction-receipt.ts             # NEW — stub чека коррекции 54-ФЗ
│   ├── notifications/
│   │   ├── matrix.ts                         # MODIFIED — +T-015, T-016
│   │   └── templates/
│   │       ├── T-015-return-approved.tsx     # NEW
│   │       ├── T-015-return-rejected.tsx     # NEW
│   │       └── T-016-return-refunded.tsx     # NEW
│   └── crm/
│       └── matrix.ts                         # MODIFIED — return.* events
└── components/
    ├── return/
    │   ├── ReturnForm.tsx                    # NEW — клиентская форма
    │   ├── ReturnableItemRow.tsx             # NEW — одна строка позиции
    │   ├── ReasonSelect.tsx                  # NEW
    │   └── RefundMethodSelect.tsx            # NEW
    ├── order/
    │   └── ReturnButton.tsx                  # NEW — баннер на странице заказа
    └── admin/returns/
        ├── ReturnActionsPanel.tsx            # NEW — Approve/Reject/Refund
        ├── ReturnTimelinePanel.tsx           # NEW — read-only history
        └── ReturnAnalyticsBanner.tsx         # NEW — US6
```

## Integration Points

### 1. ЮKassa Refunds API

- Эндпоинт: `POST https://api.yookassa.ru/v3/refunds`
- Auth: HTTP Basic (shopId : secretKey) из `paymentsSettings` (037).
- Headers: `Idempotence-Key: <return.id>:refund`, `Content-Type: application/json`.
- Body: `{ amount: { value: "5000.00", currency: "RUB" }, payment_id: "<order.payment.providerPaymentId>", description: "Возврат RT-2026-0001" }`.
- Response: `{ id, status: "succeeded"|"canceled"|"pending", amount, payment_id, ... }`.
- Polling: при `status: pending` — ставим job в `payment-refund-polls` (раз в 30 сек, до 10 попыток); чаще всего ЮKassa завершает за секунды.
- Документация: https://yookassa.ru/developers/api#create_refund

### 2. ApiShip Return Orders

- Расширение `ShippingProvider` интерфейса из 047:
  ```ts
  interface ShippingProvider {
    // ... existing
    createReturnShipment(input: {
      originalProviderOrderId: string;
      items: Array<{ sku: string; qty: number; weight: number }>;
      pickupAddress: AddressInput;
      receiverAddress: AddressInput; // склад
    }): Promise<{ providerOrderId: string; labelUrl: string }>;
  }
  ```
- В ApiShip это `OrdersApi.createReturnOrder` (если есть в OpenAPI v0.4.x). Если эндпоинта нет — fallback: создаём обычный `OrdersApi.addOrder` с обратным маршрутом и тегом `isReturn: true`.

### 3. CRM Sync (через 048)

Расширяем `crm-sync-matrix.ts` следующими правилами:

| Event             | Twenty action                                                                |
|-------------------|------------------------------------------------------------------------------|
| `return.created`  | Activity на `Opportunity` с типом `Return requested`, custom-field `returnNumber`. |
| `return.approved` | Activity «Return approved», Note с инструкцией.                              |
| `return.refunded` | Activity «Refund issued» + переход `Opportunity.stage`: при полном возврате → `Won.Refunded`. |
| `return.rejected` | Activity «Return rejected» + Note с обоснованием.                            |

Кастомные поля Twenty Opportunity (миграция через 048 `crm-migrate-fields.mjs`):

- `returnsCount: number`
- `totalRefunded: number` (в рублях)
- `lastReturnNumber: string`

**Обратный переход**: `Won.Refunded → Won` при cancel/reject Return — не автоматический. Баннер менеджеру: 'Return reverted — проверьте стадию Opportunity'.

### 4. Notifications (через 049)

Регистрируем в `notification-matrix.ts`:

| Event             | Channel | Template               | Recipient        |
|-------------------|---------|------------------------|------------------|
| `return.created`  | email   | T-014-return-received  | manager          |
| `return.approved` | email   | T-015-return-approved  | customer         |
| `return.rejected` | email   | T-015-return-rejected  | customer         |
| `return.refunded` | email   | T-016-return-refunded  | customer + manager |
| `return.overdue`  | email   | T-017-overdue-refund   | manager + customer |

### 5. Fiscal (54-ФЗ)

В MVP — **stub-модуль** `lib/fiscal/correction-receipt.ts`:

- На событие `return.refunded` ставится job в очередь `fiscal-jobs` (новая коллекция или ре-юз `notification-jobs` с типом `fiscal`).
- Job создаёт запись в `fiscal-corrections` collection (read-only для админа: дата, сумма, позиции, статус `pending_manual`) + email менеджеру.
- SLA на ручное пробитие = 24 часа (требование 54-ФЗ — «в день расчёта»). При отсутствии `status=issued` за 24 ч — escalate владельцу.
- Менеджер вручную проводит чек коррекции в подключённой ККТ (Атол / Эвотор) — отдельный спец (050+ или follow-up).
- Конкретного коннектора нет — но «след» в системе остаётся, чтобы при последующем переходе на real-time ККТ-коннектор все pending-чеки можно было обработать.
- Коннектор к ККТ — out-of-scope follow-up.

## State Machine

```text
              ┌──────────────────┐
              │   requested      │   ← создаётся через POST /api/returns
              └──────┬───────────┘
                     │ approve              cancel (client/timeout)
              ┌──────▼───────────┐         ┌──────────────┐
              │   approved       │────────►│ cancelled    │
              └──────┬───────────┘         └──────────────┘
                     │ received (manual or webhook)
              ┌──────▼───────────┐
              │   received       │
              └──────┬───────────┘
                     │ refund (YooKassa or manual)
              ┌──────▼───────────┐
              │   refunded       │  ← terminal
              └──────────────────┘

  Любой не-terminal → rejected (с обязательным statusReason)
```

Реализация — `lib/returns/state-machine.ts`, набор разрешённых переходов как Set<`from:to`>; в `Returns.beforeChange` валидация.

## Sequence Diagram — Полный refund flow

```text
Client                Soliton                YooKassa             ApiShip            Twenty
  │                      │                      │                    │                  │
  │ POST /api/returns    │                      │                    │                  │
  ├─────────────────────►│                      │                    │                  │
  │                      │ create Return (requested)                 │                  │
  │                      │ emit return.created                       │                  │
  │                      │──────────────────────────────────────────►│ (Activity)       │
  │ 200 { returnNumber } │                                                              │
  │◄─────────────────────┤                                                              │
  │                      │                                                              │
  │                      │  [Manager Admin Approve action]                              │
  │                      │ status = approved                                            │
  │                      │ emit return.approved → email T-015                          │
  │                      │                                                              │
  │                      │  [Manager Admin "Received" action]                           │
  │                      │ status = received                                            │
  │                      │                                                              │
  │                      │  [Manager Admin "Refund" action]                             │
  │                      │ POST /v3/refunds (Idempotence-Key=return.id:refund)          │
  │                      ├─────────────────────►│                                       │
  │                      │ { id, status: succeeded, amount }                            │
  │                      │◄─────────────────────┤                                       │
  │                      │ status = refunded, refundProviderRef = id                    │
  │                      │ emit return.refunded                                         │
  │                      │ → email T-016                                                │
  │                      │ → CRM Activity «Refund issued»                               │
  │                      │ → fiscal job (correction receipt)                            │
  │                      │ → if Order.type=legal → generateCreditMemo PDF               │
```

## Database Migrations

1. **Collection `returns`** — основная схема (см. `data-model.md §1`).
2. **Sequence `returns_seq_NNNN`** — для атомарного `RT-YYYY-NNNN` (одна последовательность на год).
3. **Sequence `credit_memos_seq_NNNN`** — для `CM-YYYY-NNNN`.
4. **Collection `fiscal-corrections`** (опц.) — журнал чеков коррекции.
5. **Расширение `orders`**:
   - `hasReturns: boolean` (computed via virtual field / hook).
   - `returnsCount: number` (computed).
   - `totalRefunded: number` (computed в копейках).
   - `payment.refunds[]` — array of `{ refundId, providerRefundId, amount, refundedAt, returnId }`.

## Cron Jobs

1. **`returns/auto-reminder-manager`** — раз в 24 ч, выбирает `Return.status = requested AND requestedAt < now() - 24h` → email менеджеру.
2. **`returns/overdue-refund-alert`** — раз в 24 ч, выбирает `Return.status IN (requested, approved, received) AND requestedAt < now() - 10d` → красный баннер + email менеджеру и клиенту (ст. 22 Закона 2300-1).
3. **`returns/auto-cancel-stale`** — раз в 7 дней, выбирает `Return.status = approved AND approvedAt < now() - 30d` (товар так и не пришёл) → переход в `cancelled` с `statusReason = stale_no_item_received`. **Не действует** если истёк 10-day deadline (тогда escalate владельцу, заявка остаётся открытой).
4. **`payment-refund-polls`** (если ЮKassa вернул `pending`) — раз в 30 с, до 10 попыток.

## Risks & Open Questions

| Risk                                                   | Mitigation                                                                     |
|--------------------------------------------------------|--------------------------------------------------------------------------------|
| ApiShip OpenAPI не содержит `createReturnOrder`        | Fallback: ручной order + флаг `isReturn`. Проверить в спеке v0.4.x.            |
| ЮKassa отказывает в refund (карта истекла)             | Графа `refundMethod = bank-transfer` + ручная фиксация менеджером.             |
| Чек коррекции — нет реального ККТ-коннектора в MVP     | Stub-job + ручная обработка менеджером (документировано в админ-карточке).    |
| КСФ-PDF: расхождения с УПД-1 формой ФНС                | Шаблон проверить с бухгалтером владельца перед прод-релизом. MVP scope: PDF УПД-1 (печатная форма) для ручной отправки по email. Обмен через ЭДО (Диадок/СБИС/Такском) — follow-up спека 056+. |
| Concurrent inserts → дубль `RT-YYYY-NNNN`              | Sequence в PG (атомарно) + unique index. См. 051 как референс.                |
| Возврат до фискализации исходной оплаты                | Job чека коррекции ждёт `Order.payment.fiscalReceiptId` — иначе `skipped`.    |

## Phases (high-level)

1. **Phase 1 — Foundational** (T001..T010): коллекция, миграции, state machine, number generator, расширение Orders.
2. **Phase 2 — US1 + US2** (T011..T020): публичная форма, /api/returns, /api/admin/returns/[id]/approve|reject, T-015.
3. **Phase 3 — US3** (T021..T030): ЮKassa Refunds client, action «refund», T-016, fiscal stub job.
4. **Phase 4 — US4** (T031..T035): ApiShip return-shipment, webhook handler.
5. **Phase 5 — US5** (T036..T040): credit-memo PDF, sequence, regenerate-action.
6. **Phase 6 — US6 + polish** (T041..T045): analytics banner, cron jobs, e2e tests, owner review.

Полная декомпозиция — в `tasks.md`.
