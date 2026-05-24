# Feature Specification: Twenty CRM Sync

**Feature Branch**: `048-twenty-crm-sync`

**Created**: 2026-05-23

**Status**: Draft — Twenty integration deferred 1-2 months post-launch (decision 2026-05-24)

**Input**: Соединить Soliton (Payload Orders + checkout) с Twenty CRM — open-source CRM, который будет основной системой работы менеджеров со сделками. Покрыть полный жизненный цикл: идентификация контакта/компании, создание сделки, отражение каждого статусного перехода как Activity, авто-создание задач менеджеру.

## Architectural Pattern

⚠ **Read first**: `07-build-specifications/crm-integration-pattern.md` — defines the
capability matrix (per-function delegation), 4-phase rollout, email-policy contract,
and immutability guards. This spec describes the **mechanics** of sync;
the pattern document defines the **boundaries** of what CRM owns vs. what stays
in the service.

**MVP launch state (2026-05-24)**:
- `crmSettings.enabled = false` by default
- Service operates standalone — no Twenty dependency for sales / fulfilment / notifications / returns
- Twenty integration is Phase 1, scheduled for 1-2 months after launch when buyer volume grows
- All hooks and subscribers in this spec remain in code but short-circuit when `enabled=false`

## Контекст и связи

- **Канонический документ жизненного цикла**: `07-build-specifications/order-lifecycle-spec.md §4` (маппинг сущностей и стадий).
- **Integration pattern**: `07-build-specifications/crm-integration-pattern.md` (capability matrix, rollout phases).
- **Зависимости**: спека 047 (`specs/047-delivery-checkout-apiship/spec.md`) предоставляет event emitter (`emitDomainEvent`) и доменные события `order.*` / `shipment.*` — это вход для CRM sync.
- **Twenty**: open-source, GraphQL API, **self-hosted** (решение владельца от 2026-05-23), стандартные объекты `Person`/`Company`/`Opportunity`/`Activity`/`Note`/`Task`. Twenty инстанс поднимается в Docker рядом с нашим Payload-стеком (на отдельном поддомене, например `crm.soliton.ru`).
- **Стек проекта**: Next.js 16 + Payload v3 + PostgreSQL (без Medusa, без MikroORM).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Менеджер видит каждую сделку в Twenty с реальной стадией (Priority: P1)

Менеджер открывает Twenty CRM. На карточке Opportunity видит: стадию (Quote / Negotiation / Won / Won.Closed / Lost), сумму, привязанных Person/Company, дату оплаты, выбранный перевозчик, трек-номер, ссылку на страницу заказа в Soliton, полный таймлайн Activity со всеми событиями жизненного цикла, привязанные Note (счёт PDF, накладную, этикетку).

**Why this priority**: без CRM-карточки менеджеры не смогут вести коммуникацию и аналитику; вся ценность 048.

**Independent Test**: оформить тестовый заказ в Soliton → дойти до paid → открыть Twenty → видеть Opportunity со всеми ключевыми полями и Activity «Payment received» с трек-ссылкой в течение 15 минут.

**Acceptance Scenarios**:

1. **Given** заказ создан, **When** клиент идентифицирован (email + телефон), **Then** в Twenty создаётся/находится `Person` по email; для юрлица — также `Company` по ИНН.
2. **Given** клиент перешёл к оплате, **When** заказ становится `pending_payment`, **Then** создаётся `Opportunity` со ссылками на Person/Company, `stage = Quote`, кастомное поле `externalId = order.id`.
3. **Given** оплата прошла, **When** `orders.status = paid`, **Then** `Opportunity.stage = Won`, `closeDate` фиксируется, Activity «Payment received» создаётся.
4. **Given** webhook ApiShip обновил `shipment.status`, **When** обработан в 047, **Then** в 048 создаётся CRM-job, ставится в очередь, в Twenty создаётся Activity с описанием события, трек-ссылкой и ссылкой на страницу заказа.
5. **Given** Twenty временно недоступен, **When** событие произошло, **Then** заказ оформляется/доставляется без задержек, событие ставится в очередь `crm-sync-jobs` и ретраится до 5 раз с экспоненциальным backoff'ом.

---

### User Story 2 — Кастомные поля Opportunity заводятся одной миграцией (Priority: P1)

Перед первым запуском администратор запускает `pnpm crm:migrate-fields` — скрипт через GraphQL Twenty создаёт все нужные кастомные поля на Opportunity / Company / Person (см. `contracts/twenty-fields.md`). Идемпотентно: повторный запуск не создаёт дубликатов, обновляет описания.

**Why this priority**: без этих полей маппинг данных в Twenty не работает; без миграции — невозможный ручной онбординг.

**Independent Test**: запустить скрипт на свежем workspace Twenty → все 12 кастомных полей появляются; повторный запуск завершается успехом без изменений.

**Acceptance Scenarios**:

1. **Given** пустой workspace, **When** запущен `crm:migrate-fields`, **Then** созданы все поля из `contracts/twenty-fields.md`.
2. **Given** workspace с уже существующими полями, **When** запущен скрипт, **Then** dry-run показывает «no changes», `--apply` — то же самое.
3. **Given** в Twenty переименовали поле вручную, **When** запущен скрипт, **Then** скрипт сообщает о несоответствии и предлагает ручной разрезолв.

---

### User Story 3 — Менеджер может из Payload перейти в карточку Twenty (Priority: P2)

В Payload Admin на карточке заказа есть блок «CRM (Twenty)» с readonly-полями: Opportunity ID, Person ID, Company ID, статусом последней синхронизации, кнопками «Открыть в Twenty» (deep link) и «Принудительно синхронизировать» (создаёт job вне очереди).

**Why this priority**: ускоряет переключение между системами, снимает «куда смотреть».

**Independent Test**: на синхронизированном заказе кликнуть «Открыть в Twenty» → открывается правильная Opportunity.

**Acceptance Scenarios**:

1. **Given** заказ синхронизирован, **When** менеджер кликает «Открыть в Twenty», **Then** новая вкладка открывает `${TWENTY_API_URL}/objects/opportunities/{opportunityId}`.
2. **Given** заказ не синхронизирован (job failed), **When** менеджер кликает «Принудительно синхронизировать», **Then** новая job создаётся с `attempt=0`, бейдж показывает «in queue».

---

### User Story 4 — Менеджер видит автозадачи на ключевых этапах (Priority: P2)

Twenty создаёт `Task` менеджеру на:

- `Opportunity.stage = Won` без shipment в течение 4 часов → «Создать отправление в ApiShip», dueAt = +4h от перехода.
- `Opportunity.fulfillmentStage = Delivered` и прошло 13 дней → «Подготовиться к закрытию сделки», dueAt = +1d.
- `Opportunity.stage = Lost` → «Связаться с клиентом, узнать причину», dueAt = +24h.

**Why this priority**: формализует ручные шаги менеджера; без них теряется регламент.

**Independent Test**: тестовый paid заказ через 4 часа без отправления → в Twenty появилась Task «Создать отправление» с правильным `dueAt`.

**Acceptance Scenarios**:

1. **Given** заказ `paid` без `shipment.providerOrderId` дольше 4 часов, **When** cron сработал, **Then** в Twenty создаётся Task у назначенного assignee (поле из `crmSettings.defaultAssignee`).
2. **Given** менеджер закрыл Task в Twenty, **When** статус Task → done, **Then** при следующем cron мы не создаём новую (de-dup по `externalId = order.id+taskKey`).

---

### User Story 5 — Twenty → Soliton sync (двунаправленность, P3, фаза 2)

При изменении `Opportunity.stage` в Twenty менеджером (например, `Lost`) — webhook от Twenty приходит на `/api/webhooks/twenty`, валидируется по подписи, мы переводим `Order.status` соответственно (с защитой от обратных переходов).

**Why this priority**: удобно для менеджеров, но не критично для MVP. Уведомления клиенту в этом случае идут только из 049.

**Independent Test**: в Twenty перевести Opportunity в Lost → в Payload Order.status становится cancelled, в `AdminChangeLog` запись.

**Acceptance Scenarios**:

1. **Given** валидный webhook от Twenty, **When** stage → Lost, **Then** Order.status → cancelled (если ещё не отгружен) или флаг `pendingCancellationFromCrm = true` (если уже отгружен — менеджер решает).
2. **Given** невалидная подпись, **When** запрос пришёл, **Then** 401, AdminChangeLog запись.

---

### Edge Cases

- **Юрлицо без email** (только companyName + телефон): `upsertPerson` не сработает по email — fallback на upsert по phone; если phone тоже пуст, в Twenty создаётся placeholder Person с пометкой `needsEnrichment`.
- **Дубликат компании по разному написанию названия с тем же ИНН**: дедупликация по ИНН (FR-4802b).
- **Изменение email клиента в Payload** после синхронизации: не пересоздаём Person, обновляем email через `updatePerson`.
- **ИНН отсутствует или невалидный** для юрлица: создаём Company без taxId, менеджер докручивает вручную, в `crmRefs.lastSyncError` помечаем.
- **Twenty rate limit (429)**: уважаем `Retry-After`, переносим job с задержкой не меньше Retry-After.
- **Twenty schema migration in flight**: если кастомное поле не найдено — alerts владельцу, job помещается в `quarantined` state.
- **Soliton отменил заказ → Twenty показывает Won**: при переходе `Order.status → cancelled` мы обновляем Opportunity.stage = Lost (reason: «cancelled by Soliton»).
- **Privacy DSR (запрос на удаление ПДн)**: см. FR-4807a — каскадное удаление в Twenty по email/phone.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-4801**: System MUST для каждого `Order` после идентификации клиента находить/создавать в Twenty `Person` (по email); для юрлица — также `Company` (по ИНН).
- **FR-4802**: System MUST для каждого `Order` создавать в Twenty `Opportunity` со связями `Person`/`Company` и кастомным полем `externalId = order.id`.
- **FR-4802a**: System MUST использовать `upsert` (а не `create`) для всех сущностей по уникальному внешнему ключу.
- **FR-4802b**: System MUST дедуплицировать Company по `taxId` (ИНН) — приоритетнее, чем по `name`.
- **FR-4803**: System MUST маппить `orders.status → Opportunity.stage` по таблице из `order-lifecycle-spec.md §2.3`; обратные переходы блокируются.
- **FR-4804**: System MUST на каждое доменное событие из 047 (`order.identified`, `order.created`, `order.invoice_issued`, `order.paid`, `shipment.created`, `shipment.in_transit`, `shipment.at_point`, `shipment.courier_today`, `shipment.delivered`, `shipment.returned`, `shipment.error`, `order.cancelled`, `order.completed`, `order.stuck`, `order.expired`) и из 053 (`return.created`, `return.approved`, `return.refunded`, `order.returned`) создавать в Twenty `Activity` на соответствующем Opportunity.
- **FR-4805**: System MUST ставить CRM-операции в очередь `crm-sync-jobs` и ретраить до 5 раз с экспоненциальным backoff'ом; провал не блокирует основной флоу.
- **FR-4805a**: System MUST уважать HTTP 429 `Retry-After` от Twenty.
- **FR-4806**: System MUST хранить в `Order.crmRefs { opportunityId, personId, companyId, lastSyncedAt, lastSyncStatus, lastSyncError }`.
- **FR-4807**: System MUST не отправлять в Twenty ПДн сверх необходимого (email, имя, телефон; для юрлица — название, ИНН, КПП).
- **FR-4807a**: System MUST поддерживать каскадное удаление по запросу субъекта ПДн: удалить Person + связанные Opportunity в Twenty.
- **FR-4808**: System MUST хранить токен Twenty в env `TWENTY_API_KEY` и в Payload global `crmSettings`; токен маскируется в UI Payload (custom field component).
- **FR-4809**: System MUST автоматически создавать `Task` менеджеру на правилах из US4 (FR-4809a/b/c — см. raw rules выше).
- **FR-4810** (US5, фаза 2): System MUST принимать webhook от Twenty на `POST /api/webhooks/twenty` с HMAC-валидацией и обновлять Order.status согласно маппингу.
- **FR-4811**: System MUST предоставлять CLI-скрипт `pnpm crm:migrate-fields` для онбординга кастомных полей в Twenty workspace.
- **FR-4812**: System MUST логировать все исходящие GraphQL-запросы (с маской ПДн) в коллекцию `shipping-logs` или отдельную `crm-logs`.
- **FR-4813**: System MUST маппить `return.refunded` (полный возврат) в `Opportunity.stage = Won.Refunded`, частичный возврат — в `Won.PartialRefund`. System MUST создавать `Activity` запись для каждого `return.*` события (053).

### Key Entities

- **Payload global `crmSettings`**: `enabled`, `baseUrl`, `apiKey`, `workspaceId`, `mapping.customFields[]`, `stageMap{}`, `retry{}`, `defaultAssignee`, `connectionStatus{}`.
- **Payload collection `crm-sync-jobs`**: `jobId`, `orderId`, `event`, `payload`, `attempt`, `status (queued|in_progress|success|failed|quarantined)`, `lastAttemptAt`, `nextAttemptAt`, `errorMessage`, `twentyRef`.
- **Order.crmRefs** — readonly group на коллекции `orders`.
- **Twenty Opportunity custom fields**: см. `contracts/twenty-fields.md`. Для возвратов (053) нужны дополнительные поля: `returnsCount`, `totalRefunded`, `lastReturnNumber`.

## Success Criteria *(mandatory)*

- **SC-001**: 100% оплаченных заказов отражены в Twenty с корректной стадией Opportunity в течение 15 минут после события.
- **SC-002**: ≤0.5% jobs остаются в `failed` после 5 ретраев за 30 дней наблюдения.
- **SC-003**: 0 утечек токена Twenty в client bundle (проверяется автотестом).
- **SC-004**: ≥90% поручений менеджеру (Tasks) создаются и закрываются в Twenty — отслеживаем через their Task analytics.
- **SC-005**: Время онбординга нового workspace Twenty ≤ 30 минут (через `crm:migrate-fields`).

## Assumptions

- Twenty развёрнут self-host (Docker, отдельный поддомен). До разворачивания инстанса 048 за feature-flag `crmSettings.enabled=false`.
- 047 уже доставляет event emitter с правильной семантикой; если 047 ещё в работе — 048 ждёт.
- Кастомные поля в Twenty доступны по GraphQL без ограничений (self-host — все фичи open-source-релиза).
- Менеджеры в Twenty — это live users с email-аккаунтами; `defaultAssignee` — id одного из них.

## Out Of Scope

- Bulk-импорт исторических заказов (если понадобится — отдельный one-shot скрипт).
- Управление workflows из Soliton (workflows конфигурируются в Twenty UI).
- Custom objects (свои таблицы) в Twenty.
- Двунаправленность Twenty → Soliton (только Person/Company изменения; статусы — в фазе 2 / US5).
- Дашборды и аналитика — в Twenty UI.
- Telegram-боты менеджера — отдельная спека 050.

## Trace To Roadmap & Documents

- `07-build-specifications/order-lifecycle-spec.md §4` — маппинг сущностей.
- `specs/047-delivery-checkout-apiship/spec.md` — event emitter (зависимость).
- `specs/049-customer-notifications/spec.md` — независим, но использует тот же event emitter.

## Open Questions

| # | Вопрос | Кому |
|---|---|---|
| Q1 | ~~Self-host или cloud Twenty~~ | ✅ self-host (2026-05-23) |
| Q2 | Какой email-аккаунт `defaultAssignee` | владелец/менеджмент |
| Q3 | Список кастомных полей финализирован? (см. `contracts/twenty-fields.md`) | владелец/CRM |
| Q4 | Включать ли двунаправленность (US5) в MVP или отложить | менеджмент |
| Q5 | Куда логировать GraphQL-запросы — отдельная `crm-logs` или общая `shipping-logs` | архитектура |
| Q6 | Поддомен self-host Twenty (`crm.soliton.ru` / др.) | владелец/devops |
| Q7 | Email-аккаунт админа Twenty для первого логина | владелец |
