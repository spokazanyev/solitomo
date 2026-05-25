# Data Model: 057 ЮKassa Buyer-Info Compliance

**Phase 1** — структура коллекций и embedded групп.

## 1. Новая коллекция: `static-pages`

**Назначение:** хранение редактируемого Owner'ом контента для buyer-info страниц `/info/*` и (опционально) других статических разделов.

**Slug:** `static-pages`
**Plural label:** «Статические страницы»
**Versioning:** включено (`drafts: true, maxPerDoc: 50`) — для юр-документов нужна история редакций (FR-5741)

### Поля

| Field | Type | Constraints | Description |
|---|---|---|---|
| `slug` | `text` | required, unique, indexed, pattern `^[a-z0-9-]+$` | Slug страницы (например, `offer`, `pd-policy`, `payment`) |
| `section` | `select` | required, options: `info` / `company` / `other`, default `info` | Логическая группа |
| `title` | `text` | required, max 200 | Заголовок страницы (`<h1>` + `<title>`) |
| `subtitle` | `text` | optional, max 300 | Подзаголовок (опционально) |
| `body` | `richText` (lexical) | required | Основной контент. Поддерживает заголовки H2-H4, списки, ссылки, таблицы |
| `category` | `select` | options: `policy` / `info` / `faq`, default `info` | Для юр-документов (`policy`) включаются поля version/effectiveFrom |
| `version` | `text` | conditional required when `category=policy`, pattern `^\d{4}-\d{2}-\d{2}-v\d+$` | Версия юр-документа (например, `2026-05-25-v1`) |
| `effectiveFrom` | `date` | conditional required when `category=policy` | Дата вступления в силу |
| `seoTitle` | `text` | optional, max 200 | Override для `<title>`. Если пусто — берётся `title` |
| `seoDescription` | `text` | optional, max 200 | Meta description |
| `indexingPolicy` | `select` | options: `index` / `noindex`, default `index` | robots meta tag |
| `status` | `select` | required, options: `draft` / `published`, default `draft` | Видимость на публичной части |
| `updatedAt` / `createdAt` | `date` | auto | Стандартные timestamps |

### Hooks

- **`beforeChange`**: 
  - Если `category=policy` и нет `version`/`effectiveFrom` — throw ValidationError
  - Если меняется `body` или `version` юр-документа — auto-increment `version` (если Owner не указал явно)
- **`afterChange`** (опционально): инвалидация in-memory кэша `static-pages` если есть

### Access control

- **read**: `() => true` (публичные страницы)
- **create/update/delete**: только аутентифицированные пользователи Payload (`req.user`)
- **read для status=draft**: только `req.user` (черновики не показываются гостям)

### Версионирование

- Каждое изменение через админ-панель → создаётся новая версия в `_static_pages_v` (Payload built-in)
- При публикации (status=draft → published) — фиксируется как latest published
- API `static-pages` отдаёт **только** latest published, если запрос НЕ от админа

### Indexes

- `slug` (unique btree) — для быстрого lookup по URL
- `section` (btree) — для list-views в админке
- `status` (btree) — фильтрация published на публичной выдаче

---

## 2. Embedded group `consent` (для 4 коллекций)

**Назначение:** факт согласия пользователя на обработку ПДн + публичную оферту при выполнении действия (создание заказа, корзины, RFQ, регистрация клиента).

**Применяется в коллекциях:**
- `Orders` (через `Orders.js`)
- `Carts` (через `Carts.ts`)
- `Customers` (через `Customers.ts`)
- `RfqRequests` (через `RfqRequests.ts`)

### Структура группы

```typescript
{
  name: "consent",
  type: "group",
  label: adminLabel("Согласие на обработку ПДн", "Consent (PDPA)"),
  admin: { readOnly: true, description: "Заполняется автоматически при создании. Зафиксировано в соответствии с 152-ФЗ." },
  fields: [
    {
      name: "consentedAt",
      type: "date",
      admin: { readOnly: true, description: "Timestamp ISO 8601 момента согласия" },
    },
    {
      name: "policyVersionPrivacy",
      type: "text",
      admin: { readOnly: true, description: "Версия политики конфиденциальности (например, 2026-05-25-v1)" },
    },
    {
      name: "policyVersionOffer",
      type: "text",
      admin: { readOnly: true, description: "Версия публичной оферты" },
    },
    {
      name: "ipHash",
      type: "text",
      admin: { readOnly: true, description: "SHA-256 от IP (PII protection — паттерн 052)" },
    },
    {
      name: "userAgent",
      type: "text",
      admin: { readOnly: true, description: "User-Agent (≤200 chars), опционально" },
      maxLength: 200,
    },
  ],
}
```

### Семантика

- Группа `consent` **может быть пустой** для старых записей (созданных до релиза 057). Это нормально — фактический согласие зафиксирован другими способами (отправка счёта, фактическая оплата)
- При создании новой записи через формы 057+ группа **всегда заполнена** (валидация на API-уровне)
- Группа **никогда не редактируется** через админ-панель (readOnly)
- При GDPR delete сущности — группа удаляется вместе с ней (паттерн каскада)

### DB-схема (PostgreSQL после Drizzle-push)

Для каждой коллекции добавляются колонки:
```
{collection}_consent_consented_at      TIMESTAMP WITH TIME ZONE NULL
{collection}_consent_policy_version_privacy   VARCHAR NULL
{collection}_consent_policy_version_offer     VARCHAR NULL
{collection}_consent_ip_hash           VARCHAR NULL
{collection}_consent_user_agent        VARCHAR NULL
```

(Конкретные имена: `orders_consent_*`, `carts_consent_*`, `customers_consent_*`, `rfq_requests_consent_*`)

---

## 3. Расширение `CompanyContacts` (нет изменений в схеме)

**Source of truth:** `00-source-data/company/contacts.json` уже содержит все нужные поля после commit `1f2dd13`:
- `legalName`, `legalNameFull`, `inn`, `kpp`, `ogrn`, `okpo`, `okonh`
- `legalAddress`, `actualAddress`
- `director` { fullName, position, since }
- `banking` { bankName, bik, correspondentAccount, settlementAccount }
- `vatPolicy`, `okvedMain`

**Утилита** `getCompanyContacts()` (apps/web/src/lib/company/get-company-contacts.ts) **уже возвращает** все эти поля → схема не меняется.

**Расширение интерфейсов** (если потребуется новые getters):
```typescript
// Уже есть в lib/company/get-company-contacts.ts:
export function getPrimaryPhone(): CompanyPhone | null
export function getPrimaryEmail(): CompanyEmail | null

// Опциональные новые (если удобно):
export function getBankingDetails(): CompanyBanking | null
export function getDirector(): CompanyDirector | null
```

---

## 4. Seed-данные `static-pages`

**Назначение:** при первом запуске или ручном вызове seed-скрипта создать 9 страниц с черновым контентом (из `contracts/content-templates/*.md`).

**Slugs к созданию:**

| slug | section | category | version | indexingPolicy | content source |
|---|---|---|---|---|---|
| `payment` | info | info | — | index | `content-templates/payment.md` |
| `delivery` | info | info | — | index | `content-templates/delivery.md` |
| `return` | info | info | — | index | `content-templates/return.md` |
| `warranty` | info | info | — | index | `content-templates/warranty.md` |
| `offer` | info | policy | `2026-05-25-v1` | index | `content-templates/offer.md` |
| `privacy` | info | policy | `2026-05-25-v1` | index | `content-templates/privacy.md` |
| `pd-policy` | info | policy | `2026-05-25-v1` | index | `content-templates/pd-policy.md` |
| `terms` | info | policy | `2026-05-25-v1` | index | `content-templates/terms.md` |
| `faq` | info | faq | — | index | `content-templates/faq.md` |

**Idempotent:** seed-скрипт проверяет существование slug перед `payload.create`. Не пересоздаёт.

**Запуск:**
- В dev: `pnpm --filter @soliton/web seed:static-pages`
- В CI/деплое: ручной вызов после первого деплоя 057
- При повторном запуске — no-op (idempotent)

---

## 5. SEO-registry — новые routes

**Файл:** `apps/web/src/lib/seo/seo-registry.ts`

**Тип расширяется:**
```typescript
type Section = "main" | "catalog" | "solutions" | "company" | "knowledge" | "b2b" | "documents" | "info";
```

**Добавляются 9 routes:**
```typescript
{
  path: "/info/payment/",
  type: "info",
  title: "Способы оплаты — Солитон",
  description: "Оплата заказа PDU банковской картой, СБП, для юрлиц — счёт. Безопасный платёж через ЮKassa. Электронный чек.",
  keywords: ["оплата", "способы оплаты PDU", ...],
  indexingPolicy: "index",
  schemaType: "WebPage",
},
{ path: "/info/delivery/", type: "info", title: "Доставка — Солитон", ... },
{ path: "/info/return/", type: "info", title: "Возврат товара — Солитон", ... },
{ path: "/info/warranty/", type: "info", title: "Гарантия — Солитон", ... },
{ path: "/info/offer/", type: "info", title: "Публичная оферта — Солитон", schemaType: "Article", ... },
{ path: "/info/privacy/", type: "info", title: "Политика конфиденциальности — Солитон", schemaType: "Article", ... },
{ path: "/info/pd-policy/", type: "info", title: "Политика обработки персональных данных — Солитон", schemaType: "Article", ... },
{ path: "/info/terms/", type: "info", title: "Пользовательское соглашение — Солитон", schemaType: "Article", ... },
{ path: "/info/faq/", type: "info", title: "Вопросы и ответы — Солитон", schemaType: "FAQPage", ... },
```

**`getSingleSlugParamsForSection("info")`** — возвращает 9 slugs для `generateStaticParams()` в `/info/[slug]/page.tsx`.

---

## 6. Связи и refactor существующих файлов

| Существующий файл | Изменение |
|---|---|
| `apps/web/src/collections/Orders.js` | + `consent` group в `fields` после `customerId/companyId` |
| `apps/web/src/collections/Carts.ts` | + `consent` group в `fields` (близко к консьюмерским полям) |
| `apps/web/src/collections/Customers.ts` | + `consent` group в `fields` (помечает первое согласие при регистрации) |
| `apps/web/src/collections/RfqRequests.ts` | + `consent` group в `fields` |
| `apps/web/src/collections/index.ts` (если есть) или `payload.config.ts` | + import `StaticPages` |
| `apps/web/src/payload.config.ts` | + StaticPages в массив `collections` |
| `apps/web/src/components/layout/SiteFooter.tsx` | + блок реквизитов + policy-links + payment-logos |
| `apps/web/src/components/layout/SiteHeader.tsx` | + dropdown «Покупателям» |
| `apps/web/src/lib/seo/seo-registry.ts` | + section `info` + 9 routes |
| `apps/web/src/lib/company/get-company-contacts.ts` | (опционально) + helpers `getBankingDetails()`, `getDirector()` |
| `apps/web/src/components/SeoLandingPage.tsx` | conditional rendering `<BankingDetails />` for `/company/contacts/` |

**Новые файлы:** см. plan.md «Source Code» — список ~12 новых файлов в `components/consent/`, `components/company/`, `lib/static-pages/`, `lib/analytics/`, `lib/consent/`, `app/(site)/info/`.

---

## 7. Миграция данных и схемы

**Strategy:** Drizzle push в dev (как в 055/056). В проде — explicit migration.

**Drizzle push** добавит:
- Новая таблица `static_pages` со всеми полями + indexes
- Колонки `*_consent_*` в `orders`, `carts`, `customers`, `rfq_requests`
- Schema-diff будет однозначным (new columns, no rename ambiguity)

**Backfill:** не требуется. Старые записи имеют NULL в `consent.*` — это нормально (см. секцию 2).

**Откат:** если 057 откатывается, новые поля остаются NULL — никаких хвостов.

---

## 8. Глоссарий

| Термин | Описание |
|---|---|
| Buyer-info pages | Страницы `/info/*` (9 шт.) с информацией для покупателя |
| Static-page | Документ в Payload-коллекции `static-pages` |
| Юр-документ | Static-page с `category=policy` (offer, privacy, pd-policy, terms) |
| Policy version | Строка `YYYY-MM-DD-vN` — версия юр-документа в момент согласия пользователя |
| Consent group | Embedded group `consent` в 4 коллекциях |
| Cookie consent | Согласие пользователя на загрузку аналитических cookies (отдельно от 152-ФЗ checkbox) |
| Activation gate | Manual switch `paymentSettings.enabled=true` в админке после модерации ЮKassa |
