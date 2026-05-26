# Contract: Analytics Events (dataLayer push schema)

**Spec**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

Контракт всех событий, которые v1 добавляет в `window.dataLayer.push(...)` и (для конверсий с серверным дублем) отправляет через серверный hit. **Это типизированный source of truth для smoke-теста** (см. [weekly-report-cli.md](weekly-report-cli.md) и R8 в research.md).

## Общий envelope

Каждое событие — объект с обязательными полями:

```typescript
type AnalyticsEventBase = {
  event: AnalyticsEventName,     // discriminator
  // Visit context (FR-020...FR-024) — добавляются автоматически:
  page_type: PageType,
  cluster?: string,
  user_type: 'anonymous' | 'customer' | 'legal_entity',
  session_started_via?: string,
  env: 'production' | 'staging' | 'development',
}

type PageType =
  | 'home' | 'catalog' | 'category' | 'pdp' | 'knowledge'
  | 'b2b' | 'checkout' | 'account' | 'info' | 'cart' | 'success' | 'other'
```

**PII Filter**: до push'а в `dataLayer` весь payload проходит через `scrubPII()` (R10): email/phone/inn замаскированы, black-list keys удалены.

**Ecommerce dual-format**: для событий из категории «Конверсии» и «Просмотры товара» — параллельно с обычным event push'ится отдельный объект `{ ecommerce: { detail|add|remove|purchase: {...}, products: [...], currencyCode: 'RUB' } }` для встроенного отчёта Метрики (FR-110…FR-115).

---

## Категория 1: Просмотры и навигация

### `page_view` (FR-320)
```typescript
{
  event: 'page_view',
  path: string,                // window.location.pathname
  page_type: PageType,         // из envelope
  cluster?: string,
  is_soft_404?: boolean,       // v1.2; в v1 всегда undefined
  acquisition_channel?: string // если первый hit сессии
}
```
**Когда**: каждый просмотр публичной страницы. Дублирует автоматический Метрика hit, но кладёт явный объект в dataLayer для custom-funnel.

### `category_view` (FR-001)
```typescript
{
  event: 'category_view',
  category_slug: string,
  items_count: number          // сколько товаров на странице
}
```

### `view_item_list` (FR-002)
```typescript
{
  event: 'view_item_list',
  list_id: string,             // 'homepage_featured' | 'catalog_main' | 'category_<slug>' | 'search_results'
  list_name: string,
  items: Array<{
    item_id: string,           // SKU
    item_name: string,
    category?: string,
    position: number,          // 1-based
    price?: number
  }>
}
```

### `view_item` (FR — уже существует)
```typescript
{
  event: 'view_item',
  items: [{
    item_id: string,           // SKU
    item_name: string,
    category?: string,
    brand?: string,
    price?: number
  }],
  currency: 'RUB'
}
```
+ Параллельно: `ecommerce.detail` (FR-110).

### `view_cart` (FR — уже существует)
```typescript
{
  event: 'view_cart',
  items: Array<CartLineItem>,
  value: number,
  currency: 'RUB'
}
```

---

## Категория 2: Каталог-интеракции

### `select_item` (FR-003)
```typescript
{
  event: 'select_item',
  list_id: string,
  position: number,
  item_id: string,
  item_name: string
}
```

### `filter_apply` (FR-005)
```typescript
{
  event: 'filter_apply',
  filter_name: string,         // например 'mounting_type'
  filter_value: string,        // 'rack_19' — non-sensitive only
  category_slug?: string
}
```

### `search` (FR-004, FR-130)
```typescript
{
  event: 'search',
  search_term: string,         // прошёл через PII-filter
  results_count: number
}
```
+ Параметр визита Метрики: `params: { __ymu: 'search', search: { query: search_term } }` для встроенного отчёта «Внутренний поиск».

### `search_no_results` (FR-131)
```typescript
{
  event: 'search_no_results',
  search_term: string
}
```

---

## Категория 3: Конверсии (e-commerce)

### `add_to_cart` (FR — уже существует)
```typescript
{
  event: 'add_to_cart',
  items: [{
    item_id: string,
    item_name: string,
    quantity: number,
    price?: number
  }],
  value?: number,
  currency: 'RUB'
}
```
+ Параллельно: `ecommerce.add`.

### `remove_from_cart` (FR-010)
```typescript
{
  event: 'remove_from_cart',
  items: [{ item_id, item_name, quantity, price? }]
}
```
+ Параллельно: `ecommerce.remove`.

### `begin_checkout` (FR — уже существует)
```typescript
{
  event: 'begin_checkout',
  checkout_type: 'physical' | 'legal' | 'quote',
  value: number,
  currency: 'RUB',
  items: Array<CartLineItem>
}
```

### `purchase` (FR-040, FR-110-115)
```typescript
{
  event: 'purchase',
  transaction_id: string,      // order.clientNumber (SO-YYYY-NNNN)
  value: number,               // revenue без shipping
  currency: 'RUB',
  shipping?: number,
  tax?: number,
  items: Array<{
    item_id, item_name, category, brand, price, quantity
  }>
}
```
+ Параллельно: `ecommerce.purchase` с теми же полями + `actionField.id = transaction_id`.
+ **Server-side hit**: POST `/api/analytics/server-hit` (см. [server-hit-endpoint.md](server-hit-endpoint.md)) с тем же transaction_id.

### `rfq_open`, `rfq_submit` (FR — уже существуют)
```typescript
{
  event: 'rfq_open' | 'rfq_submit',
  tracking_id?: string,        // unique per RFQ submission
  item_count: number,
  value?: number,
  currency: 'RUB'
}
```

---

## Категория 4: Шаги внутри checkout (FR-120-125)

### `checkout_step_contact`, `checkout_step_shipping`, `checkout_step_payment_method`, `checkout_step_review`
```typescript
{
  event: 'checkout_step_contact' | 'checkout_step_shipping' | ...,
  step_index: 1 | 2 | 3 | 4,
  checkout_type: 'physical' | 'legal' | 'quote'
}
```

### `checkout_cta_pay_clicked`
```typescript
{
  event: 'checkout_cta_pay_clicked',
  step_index: 5,
  checkout_type: 'physical' | 'legal' | 'quote',
  value: number,
  currency: 'RUB'
}
```

---

## Категория 5: Платёж и доставка

### `payment_intent` (FR — уже существует)
```typescript
{
  event: 'payment_intent',
  transaction_id: string,
  value: number,
  currency: 'RUB',
  payment_method: string       // 'card', 'sbp', 'invoice'
}
```

### `payment_failed` (FR-016)
```typescript
{
  event: 'payment_failed',
  transaction_id: string,
  reason: 'expired' | 'cancelled_by_user' | 'payment_method_declined' | 'webhook_timeout' | 'unknown'
}
```

### `payment_retry` (FR-016)
```typescript
{
  event: 'payment_retry',
  transaction_id: string,
  attempt_number: number
}
```

### `add_shipping_info`, `shipment_rate_requested`, `shipment_selected` (FR-012, FR-017)
```typescript
{
  event: 'add_shipping_info',
  provider: string,            // 'apiship', 'self', ...
  tariff_id?: string,
  shipping_cost?: number,
  currency: 'RUB'
}
{
  event: 'shipment_rate_requested',
  provider: string,
  destination_region: string   // non-PII
}
{
  event: 'shipment_selected',
  provider: string,
  tariff_id: string,
  shipping_cost: number,
  currency: 'RUB'
}
```

### `add_payment_info` (FR-011)
```typescript
{
  event: 'add_payment_info',
  payment_method: string,
  checkout_type: 'physical' | 'legal' | 'quote'
}
```

---

## Категория 6: Формы (B2B и общие)

> v1 покрывает только реально существующие формы. RFQ и checkout — точно есть. Остальные (`quick_order_submit`, `company_form_submit`, `invoice_request_submit`, `callback_request_submit`, `file_upload`) — реализуются вместе с появлением форм.

### `form_field_error` (FR-015)
```typescript
{
  event: 'form_field_error',
  form_type: 'rfq' | 'checkout_legal' | 'checkout_physical' | string,
  field_name: string,
  error_code: string           // 'required', 'invalid_format', 'inn_invalid', etc. (НЕ значение поля)
}
```

### `inn_validation_success` / `inn_validation_failed` (FR-192)
```typescript
{
  event: 'inn_validation_success' | 'inn_validation_failed',
  form_type: string,
  error_code?: string          // только для failed; например 'inn_checksum_invalid'
}
```

---

## Категория 7: Контент-интеракции

### `document_download` (FR-006)
```typescript
{
  event: 'document_download',
  document_type: 'datasheet' | 'manual' | 'certificate' | 'invoice' | string,
  filename: string,            // имя файла, без пути
  sku?: string                 // для документов на PDP
}
```

### `phone_click`, `email_click` (FR-007)
```typescript
{
  event: 'phone_click' | 'email_click',
  source_page: string,         // path
  cta_slot: 'header' | 'footer' | 'pdp' | 'contacts' | string
}
```

### `phone_displayed` (FR-141)
```typescript
{
  event: 'phone_displayed',
  displayed_number: string,    // тот номер, что увидел пользователь
  acquisition_channel?: string,
  cta_slot: string
}
```

### `outbound_click` (FR-009)
```typescript
{
  event: 'outbound_click',
  outbound_url: string,
  outbound_host: string,
  outbound_to?: 'marketplace' | 'social' | 'other'
}
```

---

## Категория 8: B2B-сигналы (FR-190-192)

### `price_view` / `price_request_click` (FR-190)
```typescript
{
  event: 'price_view' | 'price_request_click',
  sku: string,
  category_slug?: string
}
```

### `stock_status_view` (FR-191)
```typescript
{
  event: 'stock_status_view',
  sku: string,
  stock_status: 'in_stock' | 'on_order' | 'out_of_stock' | 'unknown'
}
```

---

## Категория 9: Системные

### `consent_banner_shown` / `consent_accepted` / `consent_declined` (FR-280-282)
```typescript
{
  event: 'consent_banner_shown'
}
{
  event: 'consent_accepted',
  consent_categories: ['analytics']   // в v1; v1.2+ возможно ['analytics', 'marketing_retargeting']
}
{
  event: 'consent_declined'
}
```

### `js_error` (FR-170)
```typescript
{
  event: 'js_error',
  error_message: string,       // PII-filtered
  source_file: string,
  line_number: number,
  user_agent_class: 'mobile' | 'desktop' | 'tablet' | 'bot'
}
```

### `page_404` (FR-171)
```typescript
{
  event: 'page_404',
  requested_path: string,
  referrer?: string
}
```

### `error_5xx` (FR-172)
```typescript
{
  event: 'error_5xx',
  status_code: number,
  endpoint: string
}
```

### `qualified_visit` (FR-210)
Вычисляется самой Метрикой через цель с критериями из `AnalyticsSettings.qualifiedVisit`. В `dataLayer` это событие явно НЕ push'ится — порождается на стороне счётчика.

---

## Контракт: PII-filter (`lib/analytics/pii-filter.ts`)

```typescript
function scrubPII(payload: Record<string, unknown>): Record<string, unknown>
```

**Гарантии**:
- На выходе не содержит подстрок, совпадающих с regex `EMAIL`, `PHONE`, `INN` (см. R10).
- Black-list keys (`comment`, `description`, `task`, `notes`, `message`, `text`) — удалены.
- Глубина рекурсии ≤5.
- Не мутирует input.

**Smoke-test**: `apps/web/src/lib/analytics/tests/pii-filter.test.ts` проверяет:
- Все 60+ событий из этого контракта прогоняются через scrubPII — на выходе нет PII.
- Положительные тест-кейсы с известными PII (email, phone, inn) → корректное замаскирование.

---

## Контракт: Goal Mapping (для smoke-test ground truth)

См. `06-reports/analytics/goal-mapping.md` — таблица event_name → metrika_goal_id. Smoke-тест проверяет, что для каждой строки goal-mapping:
1. Существует helper в `events.ts`.
2. Существует тест-кейс в `tests/`.
3. event прошёл через scrubPII.

PR с новым event'ом, не отражённым в goal-mapping, **должен валиться** на CI (FR-292-293).
