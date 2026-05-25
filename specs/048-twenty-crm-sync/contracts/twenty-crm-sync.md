# Twenty CRM Sync — Контракт интеграции

**Feature**: 047-delivery-checkout-apiship (минимальный slice) → spec.md FR-1201..FR-1208

**Полная спека**: будет в `specs/048-twenty-crm-sync/` (двунаправленная синхронизация, workflows, dashboards).

**Canonical lifecycle**: `07-build-specifications/order-lifecycle-spec.md §4`.

## Способ интеграции

- **API**: Twenty GraphQL endpoint `${TWENTY_API_URL}/graphql`.
- **Auth**: header `Authorization: Bearer ${TWENTY_API_KEY}`.
- **Workspace**: header `X-Workspace-Id: ${TWENTY_WORKSPACE_ID}` (если cloud multi-workspace).
- **Транспорт**: HTTPS, content-type `application/json`.
- **Очередь**: Payload collection `crm-sync-jobs` + Vercel Cron (или встроенный Payload scheduler) каждые 60 с.

## Используемые сущности Twenty

- `Person` (стандартная) — контакт.
- `Company` (стандартная) — юрлицо.
- `Opportunity` (стандартная) — сделка.
- `Note` (стандартная) — заметки/документы.
- `Task` (стандартная) — задачи менеджеру.
- `Activity` / `Timeline` — события на Opportunity.

## Кастомные поля (создаются при онбординге Twenty, миграция через API)

На `Opportunity`:

| Key                | Type     | Назначение                                          |
|---|---|---|
| `externalId`       | TEXT     | `Order.id` из Soliton (уникальный)                  |
| `externalToken`    | TEXT     | `Order.publicToken`                                 |
| `shippingProvider` | TEXT     | `Order.delivery.providerKey` ("cdek", "boxberry")   |
| `shippingCost`     | CURRENCY | `Order.delivery.cost`                                |
| `trackingNumber`   | TEXT     | `Order.shipment.trackingNumber`                      |
| `trackingUrl`      | URL      | `Order.shipment.trackingUrl`                         |
| `shippingAddress`  | TEXT     | `Order.delivery.address` (длинный)                   |
| `fulfillmentStage` | SELECT   | Sub-stage: New / Quote / Paid / In fulfillment / In transit / Delivered / Closed / Returned |
| `orderUrl`         | URL      | `https://soliton.ru/cart/order/{publicToken}/`       |

На `Company`:

| Key       | Type | Назначение           |
|---|---|---|
| `taxId`   | TEXT | ИНН                  |
| `kpp`     | TEXT | КПП                  |
| `ogrn`    | TEXT | ОГРН                 |
| `legalAddress` | TEXT | Юр. адрес       |

## Маппинг операций → GraphQL

### Создать или найти Person по email

```graphql
mutation findOrCreatePerson($email: String!, $data: PersonCreateInput!) {
  upsertPerson(where: { email: $email }, update: $data, create: $data) {
    id email name { firstName lastName } phones
  }
}
```

Аргументы:

```ts
{
  email: order.customer.email,
  data: {
    name: { firstName: ..., lastName: ... },          // split fullName
    emails: [{ email: order.customer.email, isPrimary: true }],
    phones: [{ phoneNumber: order.customer.phone, isPrimary: true }],
  }
}
```

### Создать или найти Company по taxId (для юрлица)

```graphql
mutation upsertCompany($taxId: String!, $data: CompanyCreateInput!) {
  upsertCompany(where: { taxId: $taxId }, update: $data, create: $data) {
    id name taxId
  }
}
```

### Создать или обновить Opportunity по externalId

```graphql
mutation upsertOpportunity($externalId: String!, $data: OpportunityInput!) {
  upsertOpportunity(where: { externalId: $externalId }, update: $data, create: $data) {
    id name amount stage externalId
  }
}
```

```ts
{
  externalId: order.id,
  data: {
    name: `${customer.label} — ${order.id}`,
    amount: { amountMicros: order.totals.total * 1_000_000, currencyCode: "RUB" },
    closeDate: order.payment?.paidAt ?? null,
    stage: stageMap[order.status],          // см. crmSettings.stageMap
    fulfillmentStage: fulfillmentSubMap[order.status],
    shippingProvider: order.delivery.providerKey,
    shippingCost: { amountMicros: order.delivery.cost * 1_000_000, currencyCode: "RUB" },
    trackingNumber: order.shipment?.trackingNumber,
    trackingUrl: order.shipment?.trackingUrl,
    shippingAddress: formatAddress(order.delivery),
    orderUrl: `https://soliton.ru/cart/order/${order.publicToken}/`,
    pointOfContactId: personId,
    companyId: companyId ?? null,
  }
}
```

### Создать Activity на Opportunity

```graphql
mutation createActivity($input: ActivityCreateInput!) {
  createActivity(data: $input) {
    id title type body createdAt
  }
}
```

```ts
{
  type: "Note",                                     // или "Email", "Call"
  title: humanLabel(event),                         // "Payment received"
  body: renderActivityBody(event, order),           // markdown
  activityTargets: { create: [{ opportunityId }] },
  createdAt: event.at,
}
```

Шаблоны заголовков Activity:

| Soliton event           | Title в Twenty                    |
|---|---|
| `order.created.legal`   | "Invoice issued: {invoiceNumber}" |
| `order.paid`            | "Payment received: {total} ₽"     |
| `shipment.created`      | "Shipped via {providerName} · {trackingNumber}" |
| `shipment.in_transit`   | "In transit"                       |
| `shipment.at_point`     | "Arrived at point: {pointAddress}" |
| `shipment.courier_today`| "Courier today {expectedFrom}–{expectedTo}" |
| `shipment.delivered`    | "Delivered"                        |
| `order.completed`       | "Closed"                           |
| `order.cancelled`       | "Cancelled: {reason}"              |
| `shipment.error`        | "⚠ Error: {message}"               |

### Создать Task менеджеру

```graphql
mutation createTask($input: TaskCreateInput!) {
  createTask(data: $input) { id title dueAt status }
}
```

Когда:
- `Opportunity.stage = Won` и нет shipment → Task «Создать отправление в ApiShip», dueAt = +24h.
- `Opportunity.stage = Won.Delivered` и прошло 13 дней → Task «Подготовиться к закрытию сделки», dueAt = +1d.

### Создать Note с документом

```graphql
mutation createNote($input: NoteCreateInput!) {
  createNote(data: $input) { id title body }
}
```

Когда:
- Сгенерирован счёт PDF → Note с `body` = ссылка на PDF + краткое описание.
- Получена этикетка ApiShip → Note с ссылкой `label_url`.

## Event-flow

```text
Soliton event              CRM sync job (queued)        Twenty operations
─────────────────────────────────────────────────────────────────────────────
order.identified      →    sync_person                  upsertPerson [+ upsertCompany для B2B]
order.created         →    sync_opportunity             upsertOpportunity (stage=Quote)
order.invoice_issued  →    sync_activity + sync_note    createActivity + createNote (PDF)
order.paid            →    sync_opportunity_stage       upsertOpportunity (stage=Won, closeDate)
                           sync_activity                createActivity ("Payment received")
                           sync_task                    createTask ("Create shipment")
shipment.created      →    sync_opportunity_tracking    upsertOpportunity (trackingNumber, trackingUrl)
                           sync_activity                createActivity ("Shipped …")
shipment.in_transit   →    sync_activity                createActivity ("In transit")
shipment.at_point     →    sync_activity                createActivity ("Arrived at point")
shipment.delivered    →    sync_opportunity_substage    upsertOpportunity (fulfillmentStage=Delivered)
                           sync_activity                createActivity ("Delivered")
order.completed       →    sync_opportunity_close       upsertOpportunity (stage=Won.Closed)
                           sync_activity                createActivity ("Closed")
order.cancelled       →    sync_opportunity_lost        upsertOpportunity (stage=Lost)
                           sync_activity                createActivity ("Cancelled: …")
```

## Retry policy

- `maxAttempts = 5` (из `crmSettings.retry.maxAttempts`).
- Экспоненциальный backoff: `delay = baseDelaySec * 2^(attempt-1) * jitter(0.5..1.5)`.
- При HTTP 4xx (кроме 429) → `status=failed` без ретрая, errorMessage детально логируется.
- При HTTP 429 / 5xx / network error → следующая попытка через `delay`.
- После `maxAttempts` без успеха → `status=failed`, алерт в `AdminChangeLog` для владельца.

## Идемпотентность

- Все upsert-операции по уникальному внешнему ключу (`externalId`, `email`, `taxId`).
- Activity дедуплицируется по комбинации `opportunityId + (orderId + eventType + eventAt-truncated-to-second)` через body-метаданные или внешний log в Payload.
- Один `crm-sync-jobs.jobId` обрабатывается строго один раз.

## Безопасность

- API-ключ Twenty — только server-side, никогда не выводится в client bundle.
- Логирование запросов в `shipping-logs` (или отдельная `crm-logs`) с маской: email → `***@domain`, телефон → последние 4 цифры, токен → удалить.
- При получении 401/403 от Twenty — алерт владельцу (FR-1004 расширяется).

## Out of scope для 047 (переходит в 048)

- Webhook Twenty → Soliton (двунаправленная синхронизация).
- Bulk-импорт исторических заказов.
- Управление workflows из Soliton (создаются вручную в Twenty UI).
- Кастомные dashboards.
- Custom objects (свои таблицы) в Twenty.

## Connection check (для S7 ApiShipSettings / CrmSettings)

```graphql
query connectionCheck {
  currentWorkspace { id displayName }
  currentUser     { id email }
}
```

Используется кнопкой «Проверить соединение» в Payload Admin.
