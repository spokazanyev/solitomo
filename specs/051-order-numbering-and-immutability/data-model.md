# Data Model: Order Numbering and Immutability (051)

## 1. Расширение `orders`

Файл: `apps/web/src/collections/Orders.js`.

```js
// NEW fields
{
  name: "clientNumber",
  type: "text",
  unique: true,
  index: true,
  label: { ru: "Номер", en: "Order number" },
  admin: {
    readOnly: true,
    description: {
      ru: "Человекочитаемый номер заказа, формат SO-YYYY-NNNN. Генерируется автоматически.",
      en: "Human-readable order number, format SO-YYYY-NNNN. Auto-generated.",
    },
  },
},
{
  name: "clientNumberReissueReason",
  type: "text",
  label: { ru: "Причина перевыпуска номера", en: "Number reissue reason" },
  admin: {
    description: {
      ru: "Обязательно при ручном изменении clientNumber через admin-роут. ≥10 символов.",
      en: "Required when reissuing number via admin route. ≥10 chars.",
    },
    condition: (data) => Boolean(data?.clientNumberReissueReason),
  },
},
{
  name: "clientNumberHistory",
  type: "array",
  label: { ru: "История перевыпусков номера", en: "Number reissue history" },
  admin: { readOnly: true },
  fields: [
    { name: "oldNumber",   type: "text", required: true },
    { name: "reissuedAt",  type: "date", required: true },
    { name: "reason",      type: "text", required: true },
    { name: "actorEmail",  type: "text" },
  ],
},
```

Обновить `admin.defaultColumns`:

```js
defaultColumns: [
  "clientNumber",  // NEW: вместо "id" первой колонкой
  "type",
  "status",
  "total",
  "customerLabel",
  "createdAt",
],
```

## 2. PG Sequences (per-year)

```sql
-- Создаётся миграцией Payload или lazy в generateClientNumber:
CREATE SEQUENCE IF NOT EXISTS order_seq_2026 START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE NO CYCLE;
-- Для 2027 — создаётся первый заказом, попавшим в 2027 (lazy).
```

**Именование**: `order_seq_${year}`, где `year` — компонент `YYYY` из `createdAt` в TZ `Europe/Moscow`.

**Поведение**: `SELECT nextval('order_seq_2026')` возвращает следующее целое атомарно даже при concurrent транзакциях; PG не выдаёт одно и то же значение дважды.

**Format**: возвращённое число форматируется как `String(n).padStart(4, "0")` → `0001..9999`; при `n ≥ 10000` — без padding (`12345`), и итог `SO-2026-12345`.

**Lazy creation**: Sequence создаётся lazy в beforeChange hook: `CREATE SEQUENCE IF NOT EXISTS order_seq_${year} START 1; SELECT nextval(...)`. Backfill не является обязательным для работы hook'а.

## 3. Уникальный индекс

```sql
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_number_unique ON orders(client_number);
```

Гарантирует защиту от дубликатов на уровне БД (защита от багов в generator'е и от ручного перевыпуска).

### Решение по snapshot-полям (C3)

051 замораживает мутабельные поля `items[].price`, `totals.subtotal/vat/total`. Snapshot-поля `items[].priceSnapshot` и `totals.snapshotSubtotal` (из 047 FR-110) — follow-up миграция Orders.js; 051 не зависит от них.

### Derived concept: `wasEverPaid`

Computed as `payment.paidAt != null`. Используется immutability hook вместо status-based проверки. Point-of-no-return = первая оплата. Значение никогда не сбрасывается.

## 4. Список «замороженных» полей при `wasEverPaid = true`

Замороженные поля (согласно lifecycle §13.5):

| Поле                              | Зачем заморожено                           |
|---|---|
| `items[]`                         | Изменение количества/цены позиций ломает учёт. |
| `totals.snapshot*` (`snapshotSubtotal`, `snapshotVat`, `snapshotTotal`) | Зафиксировано платежом. |
| `delivery.priceSnapshot`          | Snapshot цены по 047 FR-107. |
| `customer.email`                  | На него выставлен счёт и UTM.                |
| `clientNumber`                    | Номер заказа зафиксирован после оплаты.      |

**Always-mutable whitelist** (FR-5107, полный список разрешённых полей при `wasEverPaid = true`):

- `internalComment`
- `history[]`
- `notifications[]`
- `crmRefs.*`
- `shipment.*` (создание отправления — норма)
- `delivery.trackNumber`, `delivery.shippedAt`, `delivery.pickupExpiresAt`
- `payment.*` (`providerStatus`, `paidAt`, `amount`, `providerRef`)
- `marketingOptIn`, `messengerOptIn`
- `customer.emailValid` (auto-flip из 049)
- `disputeFlag`
- `closedAt`, `deliveredAt`, `paymentRetryUntil`
- `status` (переходы статусов разрешены)
- `clientNumberReissueReason` (для legit reissue)
- `hasReturns`, `returnsCount`, `totalRefunded`
- `customerId`, `companyId`, `cartId`

## 5. Запись в `admin-change-log`

Используем реальную схему коллекции `AdminChangeLog` (`apps/web/src/collections/AdminChangeLog.js`):

```ts
// Реальные поля AdminChangeLog (не изобретаем новые):
{
  actorType:        // "user" | "system" | "api"
  actorName:        // email или имя системного актора
  targetCollection: // "orders"
  targetId:         // order.id
  targetLabel:      // clientNumber или fallback
  changeType:       // "create" | "update" | "publish" | "archive" | "import"
  diffSummary:      // "client_number_reissue" | "order_mutation_rejected" | ...
  beforeSnapshot:   // JSON snapshot полей до изменения
  afterSnapshot:    // JSON snapshot полей после изменения (или attempted)
}
```

**Использование для 051**:
- При отклонённой мутации: `changeType: "update"`, `targetCollection: "orders"`, `targetId: order.id`, `diffSummary: "order_mutation_rejected"`, `beforeSnapshot` / `afterSnapshot` с дельтой полей.
- При reissue clientNumber: `changeType: "update"`, `diffSummary: "client_number_reissue"`, `beforeSnapshot: { clientNumber: oldValue }`, `afterSnapshot: { clientNumber: newValue }`.

> Если в проекте уже есть `admin-change-log` — используем существующий с реальной схемой; иначе создаём по этим полям.

## 6. ENV

Никаких новых переменных окружения не требуется.

## 7. Миграция Payload

Файл: `apps/web/src/migrations/2026XXXXXX-add-order-client-number.ts`

```ts
export async function up({ payload, req }) {
  // 1. Добавить колонки orders.client_number, orders.client_number_reissue_reason,
  //    orders.client_number_history — это сделает Payload автоматически.
  // 2. Уникальный индекс — Payload создаст из `unique: true`.
  // 3. Sequence создаётся lazy в beforeChange hook (CREATE SEQUENCE IF NOT EXISTS),
  //    поэтому миграция может опционально создать sequence для текущего года:
  const year = new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow", year: "numeric" });
  await payload.db.drizzle.execute(`CREATE SEQUENCE IF NOT EXISTS order_seq_${year} START 1`);
  // Если sequence уже существует — IF NOT EXISTS обеспечивает идемпотентность.
}
```

Backfill — **отдельным шагом** через `apps/web/scripts/backfill-client-numbers.mjs` (не в миграции, чтобы не замедлять деплой и иметь dry-run).
