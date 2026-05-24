# Data Model: Delivery Checkout With ApiShip

**Feature**: 047-delivery-checkout-apiship

**Owner**: Soliton platform team

## Сводка

Меняются/появляются (в этой спеке 047):

1. **Payload Global `apiShipSettings`** (новый) — настройки интеграции и отправителя; включая `closureWindowDays`, `stuckThresholdHours`, `priceMismatchTolerance`.
2. **Payload Collection `orders`** (расширение) — расширяется группа `delivery` (snapshot, expires), `items[]` (priceSnapshot), `totals` (snapshot), добавляются группы `shipment`, `crmRefs` (только schema!), `deliveredAt`, `closedAt`, `disputeFlag`, новые значения `status`.
3. **Payload Collection `shipping-calculations`** (новая) — кэш расчётов тарифов.
4. **Payload Collection `shipping-logs`** (новая, опционально) — аудит запросов/ответов ApiShip.

**Что вынесено в другие спеки** (есть только заглушки в Order для совместимости):

- `crmSettings` global, `crm-sync-jobs` collection, заполнение `crmRefs` → **048-twenty-crm-sync**.
- `notificationsSettings` global, `notification-jobs` collection, `Order.notifications[]`, `smsOptIn`/`marketingOptIn` → **049-customer-notifications**.

## 1. Payload Global: `apiShipSettings`

Файл реализации: `apps/web/src/globals/ApiShipSettings.ts`.

```ts
// упрощённая схема — полная в src/globals/ApiShipSettings.ts
const ApiShipSettings = {
  slug: "apiship-settings",
  label: { ru: "Доставка / ApiShip", en: "Delivery / ApiShip" },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "enabled", type: "checkbox", defaultValue: false },
    { name: "isTest", type: "checkbox", defaultValue: true },
    { name: "token", type: "text", required: true,
      admin: { description: "Хранится только на сервере; не выводится клиенту." } },
    { name: "webhookSecret", type: "text",
      admin: { description: "Секрет для HMAC-проверки webhook." } },

    { type: "group", name: "sender", label: "Отправитель по умолчанию", fields: [
      { name: "countryCode", type: "text", defaultValue: "RU" },     // ISO 3166-1 alpha-2
      { name: "addressString", type: "textarea", required: true },   // полный адрес одной строкой
      { name: "contactName", type: "text", required: true },
      { name: "phone", type: "text", required: true },
    ]},

    { type: "group", name: "defaults", label: "Параметры по умолчанию", fields: [
      { name: "length",  type: "number", defaultValue: 30 },         // см
      { name: "width",   type: "number", defaultValue: 20 },
      { name: "height",  type: "number", defaultValue: 15 },
      { name: "weight",  type: "number", defaultValue: 1500 },       // граммы
      { name: "deliveryCostVat", type: "select",
        defaultValue: "20",
        options: [
          { label: "Без НДС", value: "-1" },
          { label: "0%",  value: "0" },
          { label: "5%",  value: "5" },
          { label: "7%",  value: "7" },
          { label: "10%", value: "10" },
          { label: "20%", value: "20" },
          { label: "22%", value: "22" },
        ]
      },
      { name: "isCod", type: "checkbox", defaultValue: false,
        label: "Использовать наложенный платёж" },
    ]},

    { name: "connectionsMap", type: "array", label: "Карта складов",
      labels: { singular: "Соответствие", plural: "Соответствия" },
      fields: [
        { name: "stockLocationId", type: "text", required: true,
          admin: { description: "Локальный id склада" } },
        { name: "apiShipConnectionId", type: "text", required: true,
          admin: { description: "id подключения в ApiShip" } },
      ],
    },

    { name: "disabledProviders", type: "array", label: "Отключённые провайдеры",
      fields: [{ name: "providerKey", type: "text" }],
    },

    { name: "allowedDeliveryTypes", type: "select", hasMany: true,
      defaultValue: ["doortodoor", "doortopoint", "pointtodoor", "pointtopoint"],
      options: [
        { label: "От двери до двери", value: "doortodoor" },
        { label: "От двери до ПВЗ",   value: "doortopoint" },
        { label: "От ПВЗ до двери",   value: "pointtodoor" },
        { label: "От ПВЗ до ПВЗ",     value: "pointtopoint" },
      ],
    },

    { name: "connectionStatus", type: "group", admin: { readOnly: true }, fields: [
      { name: "lastCheckedAt", type: "date" },
      { name: "ok", type: "checkbox" },
      { name: "message", type: "text" },
    ]},

    // ---- Яндекс.Карты (FR-1301/1302)
    { type: "group", name: "yandexMaps", label: "Яндекс.Карты", fields: [
      { name: "apiKey", type: "text", required: true,
        admin: { description: "API-ключ Яндекс.Карт v3. Маскируется в UI." } },
      { name: "tariffPlan", type: "select",
        options: ["free","basic","commercial"], defaultValue: "free" },
    ]},

    // ---- DaData (FR-1303/1304/1307)
    { type: "group", name: "dadata", label: "DaData", fields: [
      { name: "apiKey", type: "text", required: true,
        admin: { description: "DaData API key. Маскируется в UI." } },
      { name: "secret", type: "text", required: true,
        admin: { description: "DaData Secret (только server-side). Маскируется в UI." } },
      { name: "tariffPlan", type: "select",
        options: ["free","starter","business"], defaultValue: "free" },
      { name: "cacheTtlDays", type: "number", defaultValue: 30,
        admin: { description: "Сколько хранить кэш нормализованных адресов." } },
    ]},

    // ---- Закрытие сделки и алерты (FR-9xx / FR-10xx / FR-111)
    { type: "group", name: "lifecycle", label: "Жизненный цикл", fields: [
      { name: "closureWindowDays", type: "number", defaultValue: 14,
        admin: { description: "Через сколько дней после delivered заказ переходит в completed" } },
      { name: "paymentRetryWindowMin", type: "number", defaultValue: 30,
        admin: { description: "Сколько минут Order остаётся в pending_payment после failed/cancel платёжной сессии (FR-111)" } },
      { name: "invoiceExpiresDays", type: "number", defaultValue: 5,
        admin: { description: "Через сколько дней awaiting_payment счёт → expired" } },
      { name: "stuckThresholdHours", type: "group", fields: [
        { name: "paid",       type: "number", defaultValue: 48 },
        { name: "fulfilling", type: "number", defaultValue: 48 },
        { name: "shipped",    type: "number", defaultValue: 72 },
        { name: "atPoint",    type: "number", defaultValue: 96 },
      ]},
      { name: "priceMismatchTolerance", type: "group", fields: [
        { name: "percent",   type: "number", defaultValue: 5 },
        { name: "absoluteR", type: "number", defaultValue: 100 },
      ]},
    ]},
  ],
  hooks: {
    afterChange: [
      // запись в AdminChangeLog: changed by, before/after diff
    ],
  },
};
```

Замечания:

- `token` маскируется в UI (значение видно только тому, кто только что ввёл; при следующем открытии — `••••1234`); это требует кастомного Payload field-компонента (см. примеры в `apps/web/src/collections/admin-components.js`).
- `webhookSecret` — то же.
- `enabled = false` → провайдер `apiship` не активен, чекаут уходит на fallback.

> **`crmSettings` global** перенесён в спеку 048-twenty-crm-sync. В 047 от него нужна только schema `Order.crmRefs`.

## 2. Расширение коллекции `orders`

Изменения в `apps/web/src/collections/Orders.js`.

### 2.1. Группа `delivery` — расширяется

Существующие поля сохраняются, добавляются:

```ts
{
  type: "group",
  name: "delivery",
  fields: [
    // СОХРАНЯЕМ:
    { name: "method", type: "select", /* options: pickup | cdek | boxberry | russian-post | tc */ },
    { name: "address", type: "textarea" },
    { name: "city", type: "text" },
    { name: "cost", type: "number" },
    { name: "trackNumber", type: "text" },
    { name: "shippedAt", type: "date" },

    // НОВЫЕ:
    { name: "provider", type: "select",
      defaultValue: "fallback",
      options: [
        { label: "ApiShip", value: "apiship" },
        { label: "Старые опции (fallback)", value: "fallback" },
      ],
    },
    { name: "providerKey", type: "text",
      label: "Код службы у провайдера",
      admin: { description: "cdek | boxberry | russianpost | yandex | ..." } },
    { name: "tariffId", type: "number" },
    { name: "deliveryType", type: "select",
      options: [
        { label: "До двери", value: "1" },
        { label: "До ПВЗ",   value: "2" },
      ],
    },
    { name: "pickupType", type: "select",
      options: [
        { label: "От двери", value: "1" },
        { label: "От ПВЗ",   value: "2" },
      ],
    },
    { name: "pointId", type: "text", label: "ID ПВЗ" },
    { name: "pointAddress", type: "text", label: "Адрес ПВЗ" },
    { name: "etaMinDays", type: "number" },
    { name: "etaMaxDays", type: "number" },
    { name: "selectedAt", type: "date",
      admin: { readOnly: true } },
    { name: "addressNormalized", type: "json",
      admin: { description: "Нормализованный адрес (DaData/ручная)" } },

    // FR-107..FR-110 — snapshot цены доставки
    { name: "priceSnapshot", type: "group",
      admin: { readOnly: true, description: "Фиксируется на шаге Review (S10)." },
      fields: [
        { name: "cost",            type: "number" },
        { name: "currency",        type: "text", defaultValue: "RUB" },
        { name: "capturedAt",      type: "date" },
        { name: "sourceCacheKey",  type: "text" },
        { name: "refreshCheckAt",  type: "date" },
      ],
    },
    { name: "pickupExpiresAt", type: "date",
      admin: { description: "Срок бесплатного хранения в ПВЗ (если применимо). FR-409." } },
  ],
}
```

### 2.1b. Расширение `items[]` и `totals` — snapshot

```ts
// items[].priceSnapshot — добавляем поле в существующий items[]:
{ name: "priceSnapshot", type: "group", admin: { readOnly: true }, fields: [
  { name: "unit",     type: "number" },
  { name: "lineTotal",type: "number" },
  { name: "vatRate",  type: "text" },
  { name: "capturedAt", type: "date" },
]}

// totals — добавляем snapshot:
{ name: "totals", type: "group", fields: [
  // ...существующие subtotal/vat/deliveryCost/total
  { name: "snapshotAt", type: "date", admin: { readOnly: true } },
  { name: "snapshotSubtotal", type: "number" },
  { name: "snapshotVat",      type: "number" },
  { name: "snapshotDeliveryCost", type: "number" },
  { name: "snapshotTotal",    type: "number" },
]}
```

### 2.1c. Новые значения `status` (FR-901)

К существующим (`new`, `pending_payment`, `awaiting_payment`, `paid`, `fulfilling`, `shipped`, `delivered`, `cancelled`, `expired`) добавляются:

```ts
{ label: "Закрыт",  value: "completed" },
{ label: "Возврат", value: "returned" },
```

### 2.1d. Новые поля верхнего уровня

```ts
{ name: "deliveredAt",     type: "date", admin: { readOnly: true } },
{ name: "closedAt",        type: "date", admin: { readOnly: true } },
{ name: "disputeFlag",     type: "checkbox", defaultValue: false,
  admin: { description: "Включается менеджером для блокировки автозакрытия." } },
{ name: "paymentRetryUntil", type: "date", admin: { readOnly: true,
  description: "now() + paymentRetryWindowMin при failed/cancel платёжной сессии (FR-111)" } },
// smsOptIn / marketingOptIn — добавляются в 049-customer-notifications.

// FR-113: multi-recipient для юрлиц
// расширение customer group:
{ name: "secondaryEmails", type: "array",
  admin: { description: "Дополнительные получатели транзакционных email (бухгалтерия, закупка)" },
  fields: [
    { name: "email", type: "email", required: true },
    { name: "role",  type: "select",
      options: ["accounting","procurement","manager","other"] },
  ]
}
```

### 2.2. Новая группа `shipment`

```ts
{
  type: "group",
  name: "shipment",
  label: { ru: "Отправление", en: "Shipment" },
  admin: { description: "Заполняется автоматически после создания заказа в ApiShip." },
  fields: [
    { name: "providerOrderId", type: "text" },     // orderId в ApiShip
    { name: "trackingNumber",  type: "text" },
    { name: "trackingUrl",     type: "text" },
    { name: "labelUrl",        type: "text" },
    { name: "waybillUrl",      type: "text" },

    { name: "status", type: "select",
      defaultValue: "none",
      options: [
        { label: "Не создан", value: "none" },
        { label: "Создаётся", value: "pending" },
        { label: "Создан",    value: "created" },
        { label: "Ожидает этикетки", value: "pending_label" },
        { label: "Передан перевозчику", value: "in_transit" },
        { label: "В ПВЗ",     value: "at_point" },
        { label: "Доставлен", value: "delivered" },
        { label: "Возврат",   value: "returned" },
        { label: "Отменён",   value: "cancelled" },
        { label: "Ошибка",    value: "error" },
      ],
    },

    { name: "events", type: "array",
      fields: [
        { name: "eventId",  type: "text", required: true,
          admin: { description: "Идентификатор события Apiship (для де-дупликации)" } },
        { name: "providerStatus", type: "text" },
        { name: "internalStatus", type: "text" },
        { name: "at",       type: "date", required: true },
        { name: "receivedAt", type: "date",
          admin: { readOnly: true } },
        { name: "message",  type: "text" },
        { name: "raw",      type: "json" },
      ],
    },

    { name: "createdAt",   type: "date", admin: { readOnly: true } },
    { name: "cancelledAt", type: "date", admin: { readOnly: true } },
    { name: "errorMessage", type: "text", admin: { readOnly: true } },
    { name: "lastSyncedAt", type: "date", admin: { readOnly: true } },
  ],
}
```

### 2.3. Группа `notifications[]`

> Описание схемы и реализация — в спеке **049-customer-notifications**. В 047 для минимального email-stub используется простой лог в `AdminChangeLog` (без отдельной коллекции и журнала в Order).

### 2.4. Группа `crmRefs` (только schema, заполнение в 048)

```ts
{
  name: "crmRefs",
  type: "group",
  admin: { description: "Идентификаторы записи в Twenty CRM." },
  fields: [
    { name: "opportunityId", type: "text", admin: { readOnly: true } },
    { name: "personId",      type: "text", admin: { readOnly: true } },
    { name: "companyId",     type: "text", admin: { readOnly: true } },
    { name: "lastSyncedAt",  type: "date", admin: { readOnly: true } },
    { name: "lastSyncStatus",type: "select",
      options: ["queued","in_progress","success","failed"],
      admin: { readOnly: true } },
    { name: "lastSyncError", type: "text", admin: { readOnly: true } },
  ],
}
```

### 2.5. Custom UI для `orders`

- Кнопка «Создать отправление» — кастомный field-компонент в карточке заказа:
  - Виден только если `status ∈ {paid, awaiting_payment+manual_paid, fulfilling}` И `shipment.status ∈ {none, error, pending_label}`.
  - POST `/api/admin/shipping/create`.
- Кнопка «Реоткрыть сделку» — для `status = completed`, единственный способ выйти из него (FR-905).
- Кнопка «Открыть в Twenty» — link на `crmRefs.opportunityId` в Twenty UI.
- Чекбокс «Диспут/возврат» — устанавливает `disputeFlag`, блокирует автозакрытие.

## 3. Новая коллекция `shipping-calculations`

Файл: `apps/web/src/collections/ShippingCalculations.ts`.

```ts
const ShippingCalculations = {
  slug: "shipping-calculations",
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  admin: { hidden: true },
  fields: [
    { name: "key", type: "text", required: true, unique: true,
      // формат: "apiship:calc:{cartId}:{shippingOptionId}"
    },
    { name: "data", type: "json", required: true },
    { name: "expiresAt", type: "date", required: true },
  ],
  indexes: [
    { fields: ["expiresAt"] },
  ],
};
```

TTL: 30 минут (значение в коде). Чистка — cron job или периодическая задача (см. `tasks.md`).

## 4. Опционально: коллекция `shipping-logs`

Файл: `apps/web/src/collections/ShippingLogs.ts`.

```ts
const ShippingLogs = {
  slug: "shipping-logs",
  access: { read: ({ req }) => Boolean(req.user), create: () => false, update: () => false, delete: ({ req }) => Boolean(req.user) },
  admin: { hidden: false, group: "Sales" },
  fields: [
    { name: "direction", type: "select", options: ["out", "in"], required: true },
    { name: "endpoint", type: "text", required: true },         // например "calculator.get" или "webhook.event"
    { name: "method", type: "text" },                           // GET/POST
    { name: "status", type: "number" },                         // HTTP
    { name: "requestId", type: "text" },                        // x-request-id
    { name: "orderId", type: "relationship", relationTo: "orders" },
    { name: "durationMs", type: "number" },
    { name: "request", type: "json", admin: { description: "Замаскированный body" } },
    { name: "response", type: "json", admin: { description: "Замаскированный body" } },
    { name: "error", type: "text" },
    { name: "at", type: "date", required: true },
  ],
};
```

Маска: `phone` → последние 4 цифры, `email` → `***@domain`, `token`/`secret` → удаляется полностью. TTL — 90 дней.

> **Коллекции `notification-jobs` и `crm-sync-jobs`** — перенесены в спеки 049 и 048 соответственно.

## 5. Маппинг статусов ApiShip → внутренние

Точная таблица в `contracts/apiship-events.md`. Сводно:

| ApiShip status | Internal `shipment.status` | Внутренний `orders.status` (если поднимаем) |
|---|---|---|
| `1` (новый) / `created`        | `created`        | — |
| `2` (на согласовании)          | `created`        | — |
| `3` (передан в службу)         | `in_transit`     | `fulfilling` → `shipped` |
| `4` (принят перевозчиком)      | `in_transit`     | `shipped` |
| `5` (в пути)                   | `in_transit`     | `shipped` |
| `6` (прибыл в ПВЗ)             | `at_point`       | `shipped` |
| `7` (вручён получателю)        | `delivered`      | `delivered` |
| `8` (возврат отправителю)      | `returned`       | (без изменения, ручной триаж) |
| `9` (отменён)                  | `cancelled`      | `cancelled` |
| `error`                        | `error`          | (без изменения) |

Точные коды берутся из ApiShip OpenAPI; таблица обновляется в research-фазе.

## 6. Индексы и миграции

Миграции Payload (через `@payloadcms/db-postgres`) — только в 047:

1. `apiship_settings` global — новая таблица.
2. `orders` — `ALTER TABLE`: `delivery_provider`, `delivery_provider_key`, `delivery_price_snapshot_*`, `delivered_at`, `closed_at`, `dispute_flag`, новые значения `status` (`completed`, `returned`), JSON-блоки `shipment`, `crm_refs` (только schema).
3. `shipping_calculations` — новая таблица + индекс на `expires_at`.
4. (опц.) `shipping_logs` — новая таблица + индекс на `at` и `order_id`.

Миграции `crm_settings`, `crm_sync_jobs`, `notifications_settings`, `notification_jobs`, `smsOptIn`, `marketingOptIn` — в спеках 048 и 049.

## 7. Конфигурационные переменные окружения

```bash
# .env.local — только то, что нужно 047
APISHIP_TOKEN=...                # дублирует Payload global, нужен для скриптов/CI
APISHIP_TEST_MODE=true|false
APISHIP_WEBHOOK_SECRET=...       # дублирует Payload global для проверки на роуте
APISHIP_BASE_URL=https://api.apiship.ru/v1   # переопределяется на api.dev.apiship.ru при isTest=true

# Email-stub (минимальный, FR-408/FR-116). Если пусто — FR-116 dry-run.
EMAIL_PROVIDER=postmark|mailgun  # выбор не сделан (Q1)
EMAIL_API_KEY=                   # пусто = dry-run
EMAIL_FROM="Soliton <orders@soliton.ru>"
EMAIL_SANDBOX=true|false         # если true — сразу dry-run даже при наличии ключа

# Карты — Яндекс.Карты v3 (FR-1301)
YANDEX_MAPS_API_KEY=...

# Нормализация адресов — DaData (FR-1303/1304)
DADATA_API_KEY=...
DADATA_SECRET=...                # только server-side, никогда не выходит на клиент

# Closure / lifecycle
ORDER_CLOSURE_WINDOW_DAYS=14
ORDER_PAYMENT_RETRY_WINDOW_MIN=30
ORDER_INVOICE_EXPIRES_DAYS=5
```

> ENV для **Twenty** — только в 048 (`TWENTY_API_URL`, `TWENTY_API_KEY`, `TWENTY_WORKSPACE_ID`).
> ENV для полноценного email (Mailgun domain, SendPulse, sandbox-host) — только в 049.
> **SMS ENV — не существует** (решение от 2026-05-23, см. order-lifecycle §9).

В рантайме приоритет: `apiShipSettings` (Payload global) → ENV → дефолты. Это позволяет править настройки без передеплоя.

## 8. Обратная совместимость

- Если `apiShipSettings.enabled = false` → старая ветка кода 037 работает как сегодня. Поля `delivery.method/address/city/cost` остаются основными.
- Если `enabled = true` и заказ оплачен/в админке выбран ApiShip → `delivery.provider = "apiship"`, остальные новые поля заполняются.
- Все новые поля nullable, существующие заказы продолжают читаться без проблем.
