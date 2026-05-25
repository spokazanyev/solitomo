# Data Model: Cart as a First-Class Entity (052)

## 1. Payload collection `carts`

```ts
// apps/web/src/collections/Carts.ts
import type { CollectionConfig } from "payload";

const Carts: CollectionConfig = {
  slug: "carts",
  labels: { singular: "Корзина", plural: "Корзины" },
  access: {
    // Чтение/правка только из своих API routes (используем local Payload API).
    // Admin через Payload session видит всё.
    read:   ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  admin: {
    group: "Sales",
    useAsTitle: "cartToken",
    defaultColumns: [
      "cartToken", "customerEmail", "itemCount",
      "subtotal", "status", "lastActivityAt", "sourcePage",
    ],
    description: "Корзины покупателей (анонимные и привязанные к email/customer).",
  },
  fields: [
    // -------- Identity --------
    {
      name: "cartToken",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "URL-safe 128-bit random; HTTP-only cookie на клиенте." },
    },

    // -------- Owner (optional) --------
    {
      name: "customerEmail",
      type: "email",
      index: true,
      admin: { description: "Привязка по email из checkout (если введён)." },
    },
    {
      name: "customerId",
      type: "relationship",
      relationTo: "customers", // fwd-ref для 054
      admin: { description: "Заполняется после релиза 054 (Customer Account)." },
    },
    {
      name: "companyId",
      type: "relationship",
      relationTo: "companies", // fwd-ref для 054 (FR-5404)
      admin: { description: "Nullable. Forward-ref для 054 — чтобы 054 не делал миграцию." },
    },

    // -------- Consent --------
    {
      name: "marketingOptIn",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Согласие на маркетинговые рассылки (152-ФЗ). FR-5224a." },
    },

    // -------- Items --------
    {
      name: "items",
      type: "array",
      minRows: 0,
      maxRows: 100,
      fields: [
        { name: "sku",        type: "text", required: true },
        { name: "name",       type: "text", required: true },
        { name: "qty",        type: "number", required: true, min: 1, max: 9999 },
        { name: "priceAtAdd", type: "number", required: false,
          admin: { description: "Snapshot цены на момент добавления; null если RFQ-only." } },
        { name: "addedAt",    type: "date", required: true },
        { name: "productId",  type: "relationship", relationTo: "products" },
        { name: "warning",    type: "select",
          options: ["removed", "price_changed", "stock_low", "none"],
          defaultValue: "none",
          admin: { description: "Выставляется при GET, если каталог изменился." } },
      ],
    },

    // -------- Totals (denormalized for queries) --------
    {
      name: "totals",
      type: "group",
      fields: [
        { name: "itemCount", type: "number", defaultValue: 0,
          admin: { description: "Сумма qty по всем items." } },
        { name: "subtotal",  type: "number", defaultValue: 0,
          admin: { description: "Sum(priceAtAdd*qty) для items с известной ценой." } },
        { name: "knownPriceCount",   type: "number", defaultValue: 0 },
        { name: "unknownPriceCount", type: "number", defaultValue: 0 },
      ],
    },

    // -------- Lifecycle --------
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      options: [
        { label: "Активна",       value: "active" },
        { label: "Покинута",      value: "abandoned" },
        { label: "Конвертирована", value: "converted" },
        { label: "Устарела",      value: "expired" },
        { label: "Слита",         value: "merged" },
      ],
      index: true,
    },
    { name: "convertedToOrderId", type: "relationship", relationTo: "orders",
      admin: { description: "Заполняется когда status=converted." } },
    { name: "mergedIntoId", type: "relationship", relationTo: "carts",
      admin: { description: "US6: target cart при merge'е." } },

    // -------- Timestamps --------
    { name: "lastActivityAt", type: "date", required: true, index: true },
    { name: "abandonedAt",    type: "date" },
    { name: "convertedAt",    type: "date" },
    { name: "expiresAt",      type: "date", required: true, index: true,
      admin: { description: "Вычисляется как lastActivityAt + 30d." } },

    // -------- Attribution --------
    { name: "sourcePage", type: "text",
      admin: { description: "Pathname страницы, где произошёл первый add_to_cart." } },
    {
      name: "utm",
      type: "group",
      fields: [
        { name: "source",   type: "text" },
        { name: "medium",   type: "text" },
        { name: "campaign", type: "text" },
        { name: "term",     type: "text" },
        { name: "content",  type: "text" },
      ],
    },

    // -------- Audit --------
    { name: "userAgent", type: "text", admin: { description: "Маскированный UA первого add'а." } },
    { name: "ipHash",    type: "text", admin: { description: "SHA-256 от IP — для GDPR-friendly counting." } },
  ],
  indexes: [
    // Уникальный
    { fields: ["cartToken"], unique: true },
    // Для поиска по email (US1, US4, GDPR delete)
    { fields: ["customerEmail"] },
    // Для cron carts-cleanup (US5: abandonment)
    { fields: ["status", "lastActivityAt"] },
    // Для cron expiry
    { fields: ["expiresAt"] },
  ],
  hooks: {
    beforeChange: [
      // Recalc totals из items
      // Update lastActivityAt = now() on mutation
      // Update expiresAt = lastActivityAt + 30d
    ],
    afterChange: [
      // Emit domain event: cart.created / cart.updated / cart.abandoned / cart.converted
      // На переходе в abandoned + есть customerEmail → enqueue T-010 (через 049 matrix)
    ],
  },
};

export default Carts;
```

## 2. Расширение `orders` collection

В `apps/web/src/collections/Orders.js` добавить:

```ts
{
  name: "cartId",
  type: "relationship",
  relationTo: "carts",
  required: false, // legacy orders могут быть без cart'а
  admin: { description: "Cart, из которого создан заказ (для funnel-аналитики)." },
  index: true,
}
```

## 3. State machine

```text
                  [cart.created]
                       │
                       ▼
                   ┌────────┐
                   │ active │◄──────────────┐
                   └────┬───┘               │
        (60min idle)    │                   │ (PATCH /api/cart — клиент вернулся)
                        ▼                   │
                   ┌──────────┐             │
                   │abandoned │─────────────┘
                   └────┬─────┘
                        │ (checkout finalized — POST /api/checkout)
                        │
       active────────┐  │  ┌────────abandoned
                     │  │  │
                     ▼  ▼  ▼
                  ┌───────────┐
                  │ converted │──(Order.cancelled/expired before paid, 24h)──► active
                  └───────────┘
                                                                    
       any non-converted ──(lastActivity > 30d)──► expired
       expired         ───(lastActivity > 90d)──► HARD DELETE
                                                                    
       active|abandoned ──(US6 login merge, after 054)──► merged
                                                                    
Терминальные: merged, hard-deleted.
converted — условно терминальный: допускает возврат в active при отмене/истечении Order до оплаты (FR-5223a).
expired — почти терминальный, но допускает ручное восстановление admin'ом до hard-delete.
```

**Transition matrix** (`from → to`, allowed):

| from / to  | active | abandoned | converted | expired | merged |
|------------|:------:|:---------:|:---------:|:-------:|:------:|
| active     | self   | ✅         | ✅         | ✅       | ✅      |
| abandoned  | ✅      | self      | ✅         | ✅       | ✅      |
| converted  | cond*  | ✗         | self      | ✗       | ✗      |
| expired    | admin* | ✗         | ✗         | self    | ✗      |
| merged     | ✗      | ✗         | ✗         | ✗       | self   |

*expired → active разрешено только admin-action.
*converted → active (cond): разрешено при `Order.status ∈ {cancelled, expired}` AND `Order.payment.paidAt IS NULL`, в пределах 24h после конверсии. При `Order.returned` (053) — НЕ восстанавливать. (FR-5223a)

## 4. Indexes

| Index | Цель | Type |
|---|---|---|
| `cartToken` | API lookup by token | unique btree |
| `customerEmail` | Admin search, GDPR delete по email | btree |
| `(status, lastActivityAt)` | Cron abandonment scan | composite btree |
| `expiresAt` | Cron expiry scan | btree |
| Orders.`cartId` | Funnel join `orders ⨝ carts` | btree |

## 5. Restore links (signed tokens)

Прямая URL `/cart/restore/{cartToken}/` НЕ безопасна (token может попасть в HTTP referer
от внешних доменов после клика). Решение: подписанные короткоживущие links.

```ts
// в email-шаблоне T-010 — ссылка вида:
// https://pdumarket.ru/cart/restore/[shortToken]?sig=[hmac]&exp=[unix]

// shortToken — это не cartToken, а HMAC(cartToken + exp, RESTORE_SECRET).slice(0, 16)
// Сервер /cart/restore/[shortToken] проверяет sig + exp, находит cartToken через
// lookup table cart_restore_tokens (или recompute), ставит cookie, redirect на /cart/.
```

Для MVP можно упростить: использовать `cartToken` напрямую в restore URL, но ограничить
ему доступ через 1) rate-limit, 2) immediate cookie-swap + redirect (URL содержит token
только в первом запросе, дальше — cookie).

**Решение для 052**: используем `cartToken` напрямую в `/cart/restore/[token]/` для MVP.
Подписанные short-tokens — в Out Of Scope (можно добавить в follow-up).

## 6. ENV

```bash
# Конфигурация — большая часть в Payload Global notificationsSettings (уже из 049),
# здесь только то, что нужно server-side для cookie/cron.

CART_TOKEN_COOKIE_NAME=soliton_cart_token       # имя cookie
CART_TOKEN_COOKIE_MAX_AGE=2592000               # 30 дней в секундах
CART_ABANDONMENT_DELAY_MIN=60                   # override из global (default 60)
CART_EXPIRY_DAYS=30
CART_HARD_DELETE_DAYS=90
CART_CLEANUP_CRON_INTERVAL=3600                 # каждый час
CRON_SECRET=...                                 # уже есть, общий для cron эндпоинтов
```

## 7. Domain events

Эмитятся через 047 emitter (`apps/web/src/lib/lifecycle/emitter.ts`):

| Event                  | Trigger                                                     | Payload (минимум) |
|------------------------|-------------------------------------------------------------|---|
| `cart.created`         | POST /api/cart (новая запись)                                | `{cartId, cartToken, sourcePage, utm}` |
| `cart.updated`         | PATCH /api/cart (любое изменение items)                     | `{cartId, itemCount, subtotal}` |
| `cart.identified`      | Первое заполнение `customerEmail`                            | `{cartId, customerEmail}` |
| `cart.abandoned`       | Cron: переход в abandoned                                   | `{cartId, customerEmail?, itemCount, subtotal, abandonedAt}` |
| `cart.recovered`       | Возврат из `abandoned → active` (клиент вернулся)            | `{cartId, customerEmail?, itemCount}` |
| `cart.converted`       | POST /api/checkout с cartToken → Order создан                | `{cartId, orderId, customerEmail}` |
| `cart.expired`         | Cron: переход в expired                                      | `{cartId, expiresAt}` |
| `cart.merged`          | (US6, после 054)                                             | `{cartId, mergedIntoId, customerId}` |
| `cart.hard_deleted`    | Cron / admin GDPR action                                    | `{cartTokenHash}` — без PII |

049's matrix должна получить новое правило:

```
cart.abandoned → email/T-010 → customer (only if customerEmail set AND marketingOptIn)
```

(уже описано в `07-build-specifications/order-lifecycle-spec.md` §3 row `cart.abandoned`).

## 7a. Merge-rules (US6, контракт для 054)

При merge двух корзин по одному SKU применяются следующие правила (FR-5227b):

| Поле | Правило | Пояснение |
|------|---------|-----------|
| `qty` | sum, capped at `max(9999)` | Суммируются; если > 9999, cap |
| `priceAtAdd` | from latest `addedAt` | Берётся из записи с более поздним `addedAt` |
| `name` / `image` / `slug` | from target (Cu) | Target = авторизованная корзина |
| `warning` | reset to `none` | Пересчёт при следующем GET |
| `utm` / `sourcePage` | from target Cu | Атрибуция по авторизованному пользователю |

Сигнатура: `lib/cart/merge.ts::mergeCarts(sourceCart, targetCart): MergedCart`.
Реализуется в 054; в 052 фиксируется контракт и stub.

## 8. Migration plan (DB)

1. Создать миграцию `pnpm payload migrate:create carts-collection` →
   `apps/web/src/migrations/YYYYMMDD_carts_collection.ts`.
2. Миграция добавляет:
   - таблицу `carts` со всеми полями выше;
   - индексы (см. §4);
   - колонку `orders.cart_id` (FK с ON DELETE SET NULL);
   - bootstrap-данные не нужны.
3. Запуск: `pnpm payload migrate` в CI/CD.

## 9. Logging

| Событие | Log fields (только) |
|---|---|
| Create cart | `cartTokenHash=sha256(token).slice(0,12)`, `sourcePage`, `utm`, `userAgent.short` |
| Mutation | `cartTokenHash`, `op=add|update|remove`, `sku`, `qty` |
| Abandonment | `cartTokenHash`, `customerEmailMasked`, `itemCount`, `subtotal` |
| Conversion | `cartTokenHash`, `orderId`, `customerEmailMasked` |

Маска email: `***@domain.ru` (правило из 049 FR-4906).
