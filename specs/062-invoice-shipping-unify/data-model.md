# Data Model: Унификация выбора доставки в чекауте юрлица

**Branch**: `062-invoice-shipping-unify` | **Phase**: 1 — Design | **Date**: 2026-05-27

---

## 1. Изменения в коллекции `orders`

### 1.1. `delivery.handoverNote` — новое поле

**Назначение**: свободный текст-комментарий о способе передачи груза. Используется для режимов `pickup` (контактное лицо получателя) и `own_carrier` (название ТК, договор, контакт).

| Атрибут | Значение |
|---------|----------|
| Имя | `handoverNote` |
| Размещение | `Order.delivery.handoverNote` (вложен в существующую группу `delivery`) |
| Payload-тип | `textarea` |
| Required | `false` (опциональное на уровне схемы; UI и серверная валидация делают обязательным для `pickup`/`own_carrier`) |
| Lower bound (server) | 10 символов для `own_carrier`, 5 символов для `pickup` (после trim) |
| Upper bound | 1000 символов (UI + server) |
| Default | `null` |
| Editable after paid | **Да** (FR-062-61, исключение из 051 — реализуется автоматически через frozen-set approach, см. [research.md R1](./research.md#r1)) |
| Admin label | `adminLabel("Примечание к отгрузке", "Handover note")` |
| Validation hook | `validate: (val) => val == null || (typeof val === "string" && val.length <= 1000)` |

**Payload-определение** (добавляется в [Orders.js:135-203](../../apps/web/src/collections/Orders.js#L135-L203) рядом с другими `delivery.*` полями):

```js
{
  name: "handoverNote",
  type: "textarea",
  label: adminLabel("Примечание к отгрузке", "Handover note"),
  admin: {
    description: adminLabel(
      "Для самовывоза — контактное лицо получателя. Для отправки ТК покупателя — реквизиты ТК и договора. До 1000 символов. Поле остаётся редактируемым после оплаты.",
      "For pickup — receiver contact. For own carrier — carrier name, contract, contact. Up to 1000 chars. Stays editable after paid."
    ),
  },
  validate: (val) =>
    val == null || (typeof val === "string" && val.length <= 1000) ||
    "Maximum 1000 characters",
},
```

---

### 1.2. `delivery.method` — переименование enum-option `tc → own_carrier`

**Состояние до**:

```js
options: [
  { label: "Самовывоз", value: "pickup" },
  { label: "СДЭК", value: "cdek" },
  { label: "Boxberry", value: "boxberry" },
  { label: "Почта России", value: "russian-post" },
  { label: "Транспортной компанией (по запросу)", value: "tc" },  // ← старое
]
```

**Состояние после**:

```js
options: [
  { label: "Самовывоз", value: "pickup" },
  { label: "СДЭК", value: "cdek" },
  { label: "Boxberry", value: "boxberry" },
  { label: "Почта России", value: "russian-post" },
  { label: "Транспортной компанией покупателя", value: "own_carrier" },  // ← новое
  // Note: значение `tc` сохраняется как hidden legacy в БД-enum до отдельной миграции (R3 step B)
]
```

**Backward compat**:
- Старые записи с `method='tc'` мигрируются в `method='own_carrier'` через миграцию (см. §3).
- PDF-рендер на этапе legacy-периода толерантен к обоим значениям (FR-062-51, см. [contracts/api-invoice-get.md](./contracts/api-invoice-get.md)).

---

### 1.3. Сводная схема `Order.delivery` после изменений

```text
Order
└── delivery (group, без изменений в layout)
    ├── method: enum {pickup, cdek, boxberry, russian-post, own_carrier, tc(legacy)}     [изменено]
    ├── address: textarea
    ├── city: text
    ├── cost: number
    ├── handoverNote: textarea (≤1000, optional)                                          [НОВОЕ]
    ├── trackNumber: text
    ├── shippedAt: date
    ├── provider: enum {apiship, fallback}
    ├── providerKey: text
    ├── tariffId: number
    ├── deliveryType: enum {1, 2}
    ├── pickupType: enum {1, 2}
    ├── pointId: text
    ├── pointAddress: text
    ├── etaMinDays: number
    ├── etaMaxDays: number
    ├── selectedAt: date
    ├── addressNormalized: json
    ├── priceSnapshot: group { cost, currency, capturedAt, sourceCacheKey, refreshCheckAt }
    └── pickupExpiresAt: date
```

---

## 2. Frozen-fields (051 immutability)

**Без изменений.**

`FROZEN_FIELDS` в [immutability.ts:40-58](../../apps/web/src/lib/lifecycle/immutability.ts#L40-L58) не меняется. Поле `delivery.handoverNote` НЕ входит в frozen-set, значит автоматически редактируется после `paid` (R1).

**Audit-log** (R2): при изменении `handoverNote` через admin-UI или API — `Orders.beforeChange` hook добавляет запись в `Order.history`:

```js
{
  at: new Date().toISOString(),
  status: "delivery_note_updated",  // существующий event-type из 051 lifecycle
  reason: "manual edit",
  actorEmail: req.user?.email ?? "system",
}
```

Реализация: расширение [Orders.js beforeChange hook] — добавить case для `delivery.handoverNote` старое/новое значение, push в `history`. Существующая инфраструктура `@/lib/lifecycle/events.ts` `emitOrderEvent()` принимает custom event-types.

---

## 3. Миграция: `delivery_method='tc' → 'own_carrier'`

**Файл**: `apps/web/src/migrations/20260527_rename_method_tc_to_own_carrier.ts`

### Up migration

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Step 1: Add new enum value (idempotent via IF NOT EXISTS)
    ALTER TYPE "public"."enum_orders_delivery_method" ADD VALUE IF NOT EXISTS 'own_carrier';
  `);

  // Step 2: Migrate existing rows (idempotent via WHERE)
  // Note: ALTER TYPE ADD VALUE commits before data migration, so this works.
  await db.execute(sql`
    UPDATE "orders" SET "delivery_method" = 'own_carrier' WHERE "delivery_method" = 'tc';
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverse: own_carrier → tc (assumes 'tc' still in enum)
  await db.execute(sql`
    UPDATE "orders" SET "delivery_method" = 'tc' WHERE "delivery_method" = 'own_carrier';
  `);
  // Note: we don't DROP VALUE 'own_carrier' here — Postgres doesn't support it.
  // Manual cleanup via type-recreate if needed (left as deferred task).
}
```

### Idempotency

- `ADD VALUE IF NOT EXISTS` — повторный прогон no-op.
- `UPDATE ... WHERE delivery_method = 'tc'` — после первого прогона `tc`-строк не осталось, повторный `UPDATE` no-op.

### Pre-merge check

В quickstart.md: получить baseline `SELECT COUNT(*) FROM orders WHERE delivery_method='tc';` на staging — записать как контрольный показатель для проверки миграции.

### Deferred (R3 шаг B)

Удаление значения `tc` из enum-типа Postgres — отдельная задача через 2-3 месяца после релиза. Записывается в `07-build-specifications/deferred-content-track.md`:

```text
- [DEFERRED-062-A] Финальная очистка enum_orders_delivery_method: удалить значение 'tc'
  через type-recreate (см. specs/062.../research.md#r3 step B). Когда: после 2-3 месяцев
  наблюдения, что в новых заказах 'tc' не появляется.
```

---

## 4. Никаких изменений в других коллекциях

- **`carts`** — корзина уже хранит items, без `delivery.method`. Doesn't touch.
- **`customers`** — нет связи с этим feature.
- **`returns`** — `delivery.handoverNote` не участвует в возврате; refund-flow без изменений.
- **`payment_events`** — нет влияния.

---

## 5. Влияние на типы (Payload generated types)

После Payload-schema update необходимо запустить:

```bash
pnpm --filter @soliton/web generate:types
```

Это перегенерирует [apps/web/src/payload-types.ts] (или эквивалент), добавив:
- `Order.delivery.handoverNote?: string | null;`
- `Order.delivery.method?: "pickup" | "cdek" | "boxberry" | "russian-post" | "own_carrier" | "tc";`

`tc` остаётся в типах как валидное legacy-значение для read-path. Write-path в новых формах никогда не записывает `tc`.

---

## 6. Affected indexes

Нет новых индексов. `delivery.handoverNote` — свободный text, не индексируется.
