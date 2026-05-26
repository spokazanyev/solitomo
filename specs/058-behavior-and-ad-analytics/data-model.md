# Phase 1 — Data Model: Behavior & Ad Analytics

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Только данные **v1 (MVP-Lite)**. v1.1/v1.2 модели добавляются в соответствующих фазах.

---

## 1. Расширения существующих коллекций

### 1.1 `Carts` (collections/Carts.ts)

Существующая коллекция (спека 052). Добавляются поля:

| Поле | Тип | Источник | Назначение |
|---|---|---|---|
| `attributionFirstTouch` | `group` | первое заполнение при создании корзины из cookie `_solitomo_attribution` (FR-031) | Хранит first-touch UTM/yclid/gclid/реферер на момент создания корзины. Не перезаписывается. |
| `attributionFirstTouch.utmSource` | `string?` | cookie | utm_source. |
| `attributionFirstTouch.utmMedium` | `string?` | cookie | utm_medium. |
| `attributionFirstTouch.utmCampaign` | `string?` | cookie | utm_campaign. |
| `attributionFirstTouch.utmContent` | `string?` | cookie | utm_content. |
| `attributionFirstTouch.utmTerm` | `string?` | cookie | utm_term. |
| `attributionFirstTouch.yclid` | `string?` | cookie | Я.Директ click ID. |
| `attributionFirstTouch.gclid` | `string?` | cookie | Google Ads click ID. |
| `attributionFirstTouch.openstat` | `string?` | cookie | _openstat. |
| `attributionFirstTouch.from` | `string?` | cookie | from-параметр. |
| `attributionFirstTouch.refererHost` | `string?` | cookie | хост реферера. |
| `attributionFirstTouch.acquisitionChannel` | `string?` (enum) | вычисляется FR-240 | Канал из закрытого списка (`organic_yandex`/`paid_yandex_direct`/...). |
| `attributionFirstTouch.acquisitionQuery` | `string?` (≤200 chars) | FR-242 | Поисковый запрос (только из organic_yandex/google, прошёл PII-filter). |
| `attributionFirstTouch.capturedAt` | `date` | server | Момент первого касания. |
| `ymClientId` | `string?` | передаётся клиентом при создании корзины | `_ym_uid` — для серверных хитов и DSAR. |
| `gaClientId` | `string?` | аналогично | `_ga` — для GA4 server-side (v1.1+). |
| `firstSeenAt` | `date?` | cookie `_solitomo_first_seen` | Cohort анализ — момент первого визита посетителя. |
| `userTypeAtCreation` | `string` (enum: `anonymous`,`customer`,`legal_entity`) | вычисляется в момент создания | Sticky-фиксация классификации B2B/B2C на момент создания корзины. |

**Валидация**:
- Все поля в `attributionFirstTouch` optional (могут быть пустые для direct-visit).
- `acquisitionChannel` — enum-валидация на уровне Payload (drop-down).
- `acquisitionQuery` — text с maxLength 200, после PII-фильтра только.

**Состояния/переходы**: без изменений (state machine из 052 сохраняется); новые поля заполняются только при `created`-событии и не меняются.

---

### 1.2 `Orders` (collections/Orders.js)

Существующая коллекция (спека 047/051). Добавляются поля:

| Поле | Тип | Источник | Назначение |
|---|---|---|---|
| `attributionFirstTouch` | `group` | копируется из `cart.attributionFirstTouch` при конверсии Cart → Order (FR-032) | Точная копия first-touch корзины. Не редактируется. |
| (структура та же, что в Carts) | | | |
| `ymClientId` | `string?` | копируется из Cart | Нужен для серверного хита `purchase` (FR-040). |
| `firstSeenAt` | `date?` | копируется из Cart | Источник для FR-182 (`time_to_purchase_days`). |
| `timeToPurchaseDays` | `number?` | вычисляется при `paid`-событии: `(paidAt - firstSeenAt) / 86400000` (FR-182) | Длительность B2B-цикла. |
| `visitCountToPurchase` | `number?` | передаётся клиентом из cookie `_solitomo_visit_count` или вычисляется через визиты Метрики (v1.1) | Сколько визитов потребовалось до конверсии. |
| `userTypeAtConversion` | `string` (enum) | копируется из Cart на момент перехода в Order | Sticky-фиксация B2B/B2C на момент конверсии. |
| `serverHitStatus` | `group` | заполняется после отправки серверного хита Метрики (FR-040) | Аудит серверной отправки. |
| `serverHitStatus.purchaseHitSentAt` | `date?` | server | Момент отправки. |
| `serverHitStatus.purchaseHitStatus` | `enum: 'pending', 'sent', 'failed', 'skipped_no_consent'` | server | Состояние. |
| `serverHitStatus.purchaseHitError` | `string?` | server | Текст ошибки если failed. |
| `serverHitStatus.offlineConversionStatus` | `enum: 'pending', 'sent', 'failed', 'skipped_no_yclid', 'skipped_no_consent'` | заполняется после отправки offline-conversion в Я.Метрику (FR-033, FR-034) | Аудит offline-conversion для Я.Директ оптимизации. Дополняет purchaseHitStatus — это разные механизмы. |
| `serverHitStatus.offlineConversionSentAt` | `date?` | server | Момент отправки offline-conversion. |
| `serverHitStatus.offlineConversionError` | `string?` | server | Текст ошибки если failed. |

**Hooks**:
- `afterChange` (status `paid`): trigger server-side hit (если consent на момент создания Order был `accepted`) — FR-040.
- `afterChange` (status `paid`): trigger offline-conversion в Я.Метрику если есть `yclid` или `client_id` (FR-033, FR-034); запускается параллельно с server-hit, независимо.
- `afterChange` (status `paid`): вычислить `timeToPurchaseDays`.

**Состояния/переходы**: state-machine 051 сохраняется. Поля аналитики — read-once при transitions.

---

### 1.3 `Customers` (collections/Customers.ts)

Существующая коллекция (спека 054). Добавляются поля:

| Поле | Тип | Источник | Назначение |
|---|---|---|---|
| `firstSeenAt` | `date?` | при первом логине устанавливается как `min(cookie._solitomo_first_seen, existing customer.firstSeenAt, currentTime)` (Clarification Q5) | Cohort точность для авторизованных. |
| `ymClientId` | `string?` | первый передаётся клиентом при логине; не меняется при последующих | Привязка `_ym_uid` к Customer; используется в DSAR-runbook (R13). |
| `companyId` | `relationship to Companies` | существующее (054) | Используется для hybrid `user_type=legal_entity` правила (Q1). |
| `dsarLog` | `array` (1 элемент = DSAR-запрос) | заполняется по runbook | Аудит DSAR. |
| `dsarLog[].requestedAt` | `date` | DSAR | |
| `dsarLog[].type` | `enum: 'access', 'delete'` | DSAR | |
| `dsarLog[].status` | `enum: 'pending', 'completed', 'rejected'` | DSAR | |
| `dsarLog[].completedAt` | `date?` | DSAR | |
| `dsarLog[].completedBy` | `relationship to Users` | DSAR | |

**Hooks**:
- `afterLogin`: записать `firstSeenAt` если null, `ymClientId` если null.

---

## 2. Новые коллекции

### 2.1 `Annotations` (collections/Annotations.ts) — NEW

Используется для FR-160…FR-162 и в weekly-report. v1 — все аннотации ручные через Payload Admin.

| Поле | Тип | Required | Назначение |
|---|---|---|---|
| `id` | `string` | auto | Payload primary key. |
| `type` | `enum: 'deploy', 'campaign', 'incident', 'manual'` | yes | Тип аннотации. |
| `occurredAt` | `date` | yes | Дата/время события. |
| `title` | `string` (≤120 chars) | yes | Короткое описание. |
| `description` | `textarea` (≤2000 chars) | no | Развёрнутый контекст. |
| `gitRef` | `string?` | conditional (required if type=deploy) | Коммит/тег. |
| `prUrl` | `string?` | no | Ссылка на PR. |
| `environment` | `enum: 'production', 'staging'` (default `production`) | yes | Окружение. |
| `createdBy` | `relationship to Users` | auto | Audit log. |

**Индексы**: `occurredAt DESC`, `(type, occurredAt)` — для weekly-report фильтрации.

**Валидация**:
- `gitRef` обязателен при `type=deploy`.
- `description` обязателен при `type=incident` (нужен root-cause).
- Только аннотации с `environment=production` попадают в weekly-report.

**Access**:
- `read`: admin + editor роли.
- `create`/`update`/`delete`: admin only.

---

## 3. Новые Payload Globals

### 3.1 `AnalyticsSettings` (globals/AnalyticsSettings.ts) — NEW

Не-секретные конфигурации, редактируемые админом без redeploy (Clarification Q3, FR-101).

```typescript
{
  // FR-241: классификация реферера
  referrerPatterns: Array<{
    channel: string,  // enum
    hostPatterns: string[],  // glob-patterns
    priority: number,
    enabled: boolean
  }>,

  // FR-080 (если активируется в v1.2): bot User-Agent patterns
  botUserAgentPatterns: string[],

  // FR-251 (v1.2 defer): Soft-404 markers
  soft404Markers: string[],

  // FR-211: qualified_visit thresholds
  qualifiedVisit: {
    minDurationSeconds: number,  // default 30
    minPageDepth: number,         // default 2
    excludeBounce: boolean        // default true
  },

  // FR-232: brand keywords для split
  brandKeywords: string[],  // ['soliton', 'солитон', ...]

  // FR-050: список целей с Metrika-IDs (синхронизируется руками с UI Метрики)
  goals: Array<{
    eventName: string,
    metrikaGoalId: number,
    ga4EventName: string,
    businessMeaning: string,
    owner: string,
    isPrimary: boolean,  // FR-052
    lastUpdated: Date
  }>,

  // FR-200: список ретаргетинговых сегментов (для v1 — 3, остальные ставятся в v1.1)
  retargetingSegments: Array<{
    name: string,
    metrikaSegmentId: string,
    description: string,
    yandexAudienceId: string,  // если синхронизирован с Я.Аудиториями
    enabled: boolean
  }>,

  // Флаги активации
  activation: {
    serverHitsEnabled: boolean,         // FR-040, kill-switch
    webvisorEnabled: boolean,           // FR-061
    qualifiedVisitGoalEnabled: boolean  // FR-210
  }
}
```

**Hooks**:
- `afterChange`: log to `AdminChangeLog` (FR-103).

**Access**:
- `read`/`update`: admin only.

**Seed**:
- Default `referrerPatterns` (см. R4).
- Default `qualifiedVisit`: `{ minDurationSeconds: 30, minPageDepth: 2, excludeBounce: true }`.
- Default `brandKeywords`: `['soliton', 'солитон']`.
- Default `goals`: пустой (заполняется после создания целей в Метрика UI).
- Default `retargetingSegments`: пустой (заполняется после создания сегментов в Метрика UI).
- Default `activation`: `{ serverHitsEnabled: true, webvisorEnabled: true, qualifiedVisitGoalEnabled: true }`.

---

## 4. Cookies (client-side state)

### 4.1 `_solitomo_attribution`

```typescript
{
  utmSource?: string,
  utmMedium?: string,
  utmCampaign?: string,
  utmContent?: string,
  utmTerm?: string,
  yclid?: string,
  gclid?: string,
  openstat?: string,
  from?: string,
  refererHost?: string,
  acquisitionChannel?: string,
  acquisitionQuery?: string,
  capturedAt: ISO8601
}
```

**Атрибуты**: `Path=/; Domain=.<root>; Max-Age=31536000; SameSite=Lax; Secure`. Не HttpOnly — нужен JS-доступ для клиентских событий.

**Запись**: при каждом визите проверяется query-string на UTM/yclid/gclid; если cookie пуст ИЛИ новый touch содержит `yclid`/`gclid` (явный paid override) → перезапись.

### 4.2 `_solitomo_first_seen`

```typescript
{ firstSeenAt: ISO8601 }
```

**Атрибуты**: `Max-Age=31536000; SameSite=Lax; Secure`. Записывается один раз и не перезаписывается.

### 4.3 `_solitomo_visit_count`

```typescript
{ count: number }
```

**Атрибуты**: `Max-Age=31536000; SameSite=Lax; Secure`. Инкрементируется на сервере при каждом новом визите (определяется по таймауту 30 минут от last seen — стандарт Метрики).

### 4.4 `_solitomo_consent` (уже существует из 057)

Не меняется в этой спеке — используется как-есть. Источник истины для `consent_accepted`/`consent_declined` событий.

### 4.5 `_solitomo_legal_entity_flag`

```typescript
{ flaggedAt: ISO8601, source: 'inn-form' | 'company-link' }
```

**Атрибуты**: `Max-Age=31536000; SameSite=Lax; Secure`. Sticky-cookie для Clarification Q1 (hybrid `legal_entity`). Устанавливается при первом вводе ИНН в форме ИЛИ при логине пользователя с привязанной Company. Не сбрасывается при logout.

### 4.6 `_ym_*` (Я.Метрика first-party cookies)

Управляется самой Метрикой при включённой опции «первичные cookie» (R7). Не трогаем напрямую.

---

## 5. Сущности уровня payload событий (dataLayer schema)

### 5.1 Event envelope (общий слой)

Каждое событие в `window.dataLayer.push(...)` имеет минимум:

```typescript
{
  event: string,                   // имя события из закрытого списка
  // visit context (FR-020...FR-024):
  page_type: 'home' | 'catalog' | 'category' | 'pdp' | 'knowledge' | 'b2b' | 'checkout' | 'account' | 'info' | 'cart' | 'success' | 'other',
  cluster?: string,                // SEO cluster
  user_type: 'anonymous' | 'customer' | 'legal_entity',
  session_started_via?: string,    // utm_source первого hit'a сессии
  env: 'production' | 'staging' | 'development',
  // event-specific params (после PII-filter):
  ...payload
}
```

### 5.2 Event-specific schemas

См. `contracts/analytics-events.md` для полного перечня — здесь только структурный обзор:

| Категория | События | Обязательные параметры |
|---|---|---|
| Просмотры | `page_view`, `category_view`, `view_item`, `view_item_list`, `view_cart` | `page_type`, `path`; для ecommerce — `items[]` |
| Каталог-интеракции | `select_item`, `filter_apply`, `search`, `search_no_results` | `list_id`/`filter_name`/`search_term` |
| Конверсии | `add_to_cart`, `remove_from_cart`, `begin_checkout`, `purchase`, `rfq_open`, `rfq_submit` | `items[]`, `value?`, `transaction_id` (для `purchase`) |
| Checkout steps | `checkout_step_contact`, `checkout_step_shipping`, `checkout_step_payment_method`, `checkout_step_review`, `checkout_cta_pay_clicked` | `step_index`, `checkout_type` |
| Платёж | `payment_intent`, `payment_failed`, `payment_retry` | `transaction_id`, `payment_method`, `reason?` |
| Доставка | `shipment_rate_requested`, `shipment_selected`, `add_shipping_info` | `provider`, `tariff_id?` |
| Формы | `quick_order_submit`, `company_form_submit`, `invoice_request_submit`, `callback_request_submit`, `file_upload` (conditional на наличие формы), `form_field_error`, `inn_validation_success`, `inn_validation_failed` | `form_type`, `field_name?`, `error_code?` |
| Контент | `document_download`, `phone_click`, `email_click`, `outbound_click`, `phone_displayed` | `document_type`/`sku?`/`displayed_number` |
| B2B-сигналы | `price_view`, `price_request_click`, `stock_status_view` | `sku`, `stock_status?` |
| Системные | `consent_banner_shown`, `consent_accepted`, `consent_declined`, `js_error`, `page_404`, `error_5xx`, `qualified_visit` (вычисляется Метрикой через цель) | `error_message?`/`status_code?` |
| E-commerce native | (отдельный `ecommerce`-объект — FR-110-115) | `ecommerce.detail/add/remove/purchase`, `products[]`, `actionField.id`, `currencyCode` |

---

## 6. Связи и зависимости

```text
Visit (browser session)
  └── _solitomo_attribution (cookie)
  └── _solitomo_first_seen (cookie)
  └── _solitomo_legal_entity_flag (cookie)
  └── _ym_uid (cookie, Метрика)
        └── Cart
              ├── attributionFirstTouch  ◄── copied from cookie at cart creation
              ├── firstSeenAt            ◄── copied from cookie
              ├── ymClientId             ◄── copied from cookie
              ├── userTypeAtCreation     ◄── from hybrid rule
              └── Order
                    ├── attributionFirstTouch  ◄── copied from Cart
                    ├── ymClientId             ◄── copied from Cart
                    ├── firstSeenAt            ◄── copied from Cart
                    ├── timeToPurchaseDays     ◄── computed at paid
                    ├── visitCountToPurchase   ◄── from cookie / Метрика API
                    ├── userTypeAtConversion   ◄── copied from Cart
                    └── serverHitStatus        ◄── filled by server-side tracker

Customer (authenticated)
  ├── firstSeenAt            ◄── min(cookie, existing, currentTime) at first login
  ├── ymClientId             ◄── copied at first login
  ├── companyId (existing)   ◄── used for hybrid legal_entity rule
  └── dsarLog[]              ◄── filled by DSAR runbook

AnalyticsSettings (Global)
  ├── referrerPatterns       ◄── seeded; admin-editable
  ├── goals                  ◄── manually synced with Метрика UI
  ├── retargetingSegments    ◄── manually synced with Метрика UI
  ├── brandKeywords          ◄── seeded; admin-editable
  ├── qualifiedVisit         ◄── seeded; admin-editable
  └── activation flags       ◄── kill-switches

Annotations (collection)
  └── records of deploys/campaigns/incidents (v1 manual via Payload Admin)
```

---

## 7. Миграция БД (Drizzle)

Все изменения — `ALTER TABLE` поверх существующих таблиц:

- `carts`: ADD COLUMN attribution_first_touch_* (10 nullable columns), ym_client_id, ga_client_id, first_seen_at, user_type_at_creation.
- `orders`: ADD COLUMN attribution_first_touch_* (10 nullable columns), ym_client_id, first_seen_at, time_to_purchase_days, visit_count_to_purchase, user_type_at_conversion, server_hit_status_* (3 columns).
- `customers`: ADD COLUMN first_seen_at, ym_client_id, dsar_log JSONB.
- `annotations`: CREATE TABLE (новая).
- `analytics_settings`: CREATE TABLE (singleton, Payload Global pattern).

**Стратегия**: одна миграция Payload-generate-types, без data backfill (новые поля nullable). Существующие Cart/Order/Customer останутся с null-значениями новых полей — это допустимо (когорта и атрибуция работают только для записей, созданных после миграции).

---

## 8. Что НЕ добавляется в v1

- `AnalyticsHitQueue` collection (FR-310-312) — v1.1.
- `SearchConsoleQuery`, `IndexCoverageRecord`, `CrawlErrorRecord` — все только в v1.1+ когда подключается Webmaster/GSC API.
- Поле `lastSeenAt` на Customer — не требуется (FR использует `firstSeenAt`).
- Хранение полного transcript Метрика-визитов в БД — не требуется, Метрика держит у себя.
