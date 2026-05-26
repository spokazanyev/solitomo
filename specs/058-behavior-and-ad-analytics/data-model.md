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

### 2.0 `AgentProposals` (collections/AgentProposals.ts) — NEW (Agent-driven model, v1)

Используется для FR-380…FR-386 (propose-approve workflow). Центральная коллекция agent-driven model: каждое предложенное изменение Метрика-конфигурации создаётся здесь, ждёт approve оператора.

| Поле | Тип | Required | Назначение |
|---|---|---|---|
| `id` | `string` | auto | Payload primary key. |
| `createdAt` | `date` | auto | Когда создан proposal. |
| `createdBy` | `string` enum (`agent`/`mcp_tool`/`manual`) | yes | Источник создания. `manual` — для оператор-инициированных proposals. |
| `evaluator` | `string` | yes | Имя evaluator'а (e.g. `funnel_drop_off`, `drift_detector`, `missing_goal`). Для filtering и cooldown logic. |
| `type` | `string` enum | yes | `create_goal` / `update_goal` / `soft_disable_goal` / `hard_delete` / `create_filter` / `update_filter` / `update_setting` / `drift_detected` / `create_missing_goal` / `remove_unused_segment` / `adjust_qualified_visit_threshold` / `investigate_funnel_drop` / `update_config_from_drift` / `auto_approve_request` |
| `action` | `string` enum (`create`/`update`/`delete`/`soft-disable`) | yes | Семантическое действие. |
| `targetPath` | `string` | yes | Где в конфигурации/API применяется (e.g. `goals[id=12345].name` или `counterSettings.qualified_visit.min_duration_seconds`). |
| `payload` | `json` | yes | Фактический change (для create — полный object; для update — partial). |
| `reasoning` | `textarea` (≤2000) | yes | LLM-generated human-readable обоснование. |
| `expectedImpact` | `textarea` (≤500) | no | Какие KPI и как изменятся. |
| `evidence` | `json` | yes | Data snapshot, на основании которого создан proposal (например, недельный funnel-data + week-over-week delta). |
| `severity` | `string` enum (`info`/`warning`/`critical`) | yes | UI-presentation hint. |
| `status` | `string` enum | yes | `pending` (default) → `approved`/`rejected` → `executed`/`failed`. |
| `reviewedBy` | `relationship to Users` | no | Кто approve/reject. |
| `reviewedAt` | `date` | no | Когда. |
| `reviewerReason` | `textarea` (≤1000) | no | Optional reason от оператора при reject (или comment при approve). |
| `executedAt` | `date` | no | Когда API-вызов выполнен. |
| `executionResult` | `json` | no | Response от Yandex.Metrika API (для audit). Без секретов. |
| `cooldownUntil` | `date` | no | До какого момента этот evaluator не создаёт повторный proposal по тому же targetPath (anti-spam, default 7 days). |

**Индексы**: `(status, createdAt DESC)` — для admin-страницы; `(evaluator, targetPath, cooldownUntil)` — для cooldown-check; `(executedAt)` — для audit.

**Validation**:
- `payload` must match `type`-specific schema (валидируется через zod в Payload field-validate hook).
- `status` transitions enforced: pending → approved/rejected; approved → executed/failed; rejected — terminal; executed — terminal; failed может вернуться в pending через retry.
- `hard_delete` type требует `payload.confirmation_flag === true` (двойное подтверждение через UI).

**Hooks**:
- `afterChange` (status → approved): trigger `executeProposal(proposal)` через job-queue / immediate fetch.
- `afterChange` (status → any): запись в `AdminChangeLog`.

**Access**:
- `read`: admin + analytics-operator роли.
- `create`: system (agent через service-token); admin (для manual proposals).
- `update`: только status + reviewedBy + reviewedAt + reviewerReason + executedAt + executionResult — никакие другие поля не редактируются.
- `delete`: admin only (для cleanup; обычно — soft).

---

### 2.0a `AgentExecutionLog` (collections/AgentExecutionLog.ts) — NEW (Agent-driven model, v1)

Audit-log всех API-вызовов агента (FR-375). Compliance, debugging, smoke-test invariant (FR-396).

| Поле | Тип | Required | Назначение |
|---|---|---|---|
| `id` | `string` | auto | |
| `timestamp` | `date` | yes | Точное время вызова. |
| `endpoint` | `string` | yes | URL-path Метрика API (без host). |
| `method` | `string` enum (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`) | yes | HTTP-method. |
| `requestParams` | `json` | no | Query/body без секретов и без значений PII. |
| `responseStatus` | `number` | yes | HTTP status. |
| `responseBodySummary` | `textarea` (≤1000) | no | Truncated/summarized response для audit (полное body НЕ хранится — too verbose). |
| `durationMs` | `number` | yes | Длительность вызова. |
| `errorMessage` | `string?` | no | Если non-2xx. |
| `proposalId` | `relationship to AgentProposals` | no | Если вызов сделан в результате approved-proposal. |
| `configApplyRunId` | `string?` | no | UUID, общий для всех вызовов одного `apply-config`-прогона. |
| `evaluatorName` | `string?` | no | Если вызов в рамках evaluator (read-only). |
| `userAgent` | `string` | yes | Должен начинаться с `Soliton-AnalyticsAgent/`. |

**Индексы**: `(timestamp DESC)` — chronological view; `(method, proposalId, configApplyRunId)` — для FR-396 smoke-test invariant; `(evaluatorName, timestamp)` — для performance analytics.

**Retention**: 90 дней (cron-job очищает старше). Compliance с 152-ФЗ — audit-данные не содержат PII.

**Validation**:
- `userAgent` MUST match regex `^Soliton-AnalyticsAgent/`.
- При `method ∈ {POST, PUT, PATCH, DELETE}` обязательно один из: `proposalId` или `configApplyRunId` или `evaluatorName='manual_admin'`. Иначе validation fail (это и есть FR-396 enforcement на schema-уровне).

**Access**:
- `read`: admin only.
- `create`: system (agent). Admin создавать запрещено.
- `update`/`delete`: запрещено (immutable audit-log).

---

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

**Дополнение для Agent-driven model (v1)**:

```typescript
{
  // ... все поля выше +

  // Agent runtime config
  agentReview: {
    schedule: string,              // cron-expression; default '0 9 * * *' (09:00 МСК)
    timezone: string,              // default 'Europe/Moscow'
    enabledEvaluators: string[],   // имена evaluator'ов; по умолчанию все 6
    cooldownDays: number,          // default 7
    rateLimit: {
      maxApiCallsPerMinute: number,  // default 100
      backoffOnRateLimit: boolean    // default true
    }
  },

  // Agent kill-switch (расширение activation)
  activation: {
    serverHitsEnabled: boolean,
    webvisorEnabled: boolean,
    qualifiedVisitGoalEnabled: boolean,
    agentEnabled: boolean,           // NEW — kill-switch для всех agent-операций
    agentSchedulerEnabled: boolean   // NEW (v1.1) — отключает только scheduled cron, manual CLI продолжает работать
  }
}
```

**Seed**:
- Default `referrerPatterns` (см. R4).
- Default `qualifiedVisit`: `{ minDurationSeconds: 30, minPageDepth: 2, excludeBounce: true }`.
- Default `brandKeywords`: `['soliton', 'солитон']`.
- Default `goals`: пустой (заполняется ПО ИТОГАМ `metrika:apply-config` агентом, не редактируется руками — см. FR-363).
- Default `retargetingSegments`: пустой (заполняется по итогам `apply-config`).
- Default `activation`: `{ serverHitsEnabled: true, webvisorEnabled: true, qualifiedVisitGoalEnabled: true, agentEnabled: true, agentSchedulerEnabled: false }` (scheduler off в v1, on в v1.1).
- Default `agentReview`: `{ schedule: '0 9 * * *', timezone: 'Europe/Moscow', enabledEvaluators: ['funnel_drop_off','qualified_visit_rate','source_quality','zero_result_searches','roas_deviation','data_quality'], cooldownDays: 7, rateLimit: { maxApiCallsPerMinute: 100, backoffOnRateLimit: true } }`.

---

## 3.2 MetrikaConfigFile (config-as-code) — NEW (Agent-driven model, v1)

Файл `apps/web/config/metrika.config.ts` — single source of truth для Метрика-конфигурации (FR-360). Не Payload-сущность, а **git-tracked TypeScript-объект**, который agent применяет через `metrika:apply-config`.

```typescript
// apps/web/config/metrika.config.ts
export const metrikaConfig: MetrikaConfig = {
  counterId: process.env.YM_COUNTER_ID!,   // attached for clarity, не часть hash-сравнения

  // FR-050: цели Метрики
  goals: [
    {
      name: 'Purchase',                    // unique key для upsert-by-name
      type: 'event',                       // Metrika goal types
      conditions: [{ type: 'event_target', value: 'purchase' }],
      isRetargeting: true,                 // для аудиторий Я.Директа
      enabled: true,
      businessMeaning: 'Успешная оплата заказа',  // sync to goal-mapping.md
      owner: 'svp@heado.ru'
    },
    {
      name: 'RFQ Submit',
      type: 'event',
      conditions: [{ type: 'event_target', value: 'rfq_submit' }],
      enabled: true,
      businessMeaning: 'B2B запрос КП отправлен',
      owner: 'svp@heado.ru'
    },
    // ... все остальные goals из FR-050
  ],

  // FR-051: составные цели (funnel)
  compositeGoals: [
    {
      name: 'Purchase funnel',
      type: 'step',
      steps: [
        { name: 'PDP view', conditions: [...] },
        { name: 'Add to cart', conditions: [...] },
        { name: 'Begin checkout', conditions: [...] },
        // ...
      ],
      enabled: true
    }
  ],

  // FR-200: ретаргетинговые сегменты как Metrika filters
  filters: [
    {
      name: 'Added to cart, not bought, 7d',
      attribution: 'ym:s:lastTrafficSource',
      conditions: [/* фильтр-логика */],
      enabled: true
    }
  ],

  // FR-340, FR-061-063: counter settings
  counterSettings: {
    firstPartyCookies: true,               // FR-340
    webvisor: {
      enabled: true,                       // FR-061
      enabledV2: true,
      formCapturing: 'enabled_with_masks', // FR-060
      urlFilter: '...'
    },
    accurateTrackBounce: true,
    trackLinks: true,
    clickmap: true,
    informer: false                        // не используем
  }
}

// Type-definitions для validation
export type MetrikaConfig = { /* ... */ }
export type MetrikaGoal = { /* ... */ }
// ...
```

**Принципы**:
- **Идентичность объектов через `name`** (не Metrika-ID, который assignется только после create). Это позволяет idempotent upsert: agent ищет goal с name='Purchase' → если есть, update; если нет, create.
- **Запрещено хранить `metrika_id` в config.** ID — output, не input. Они появляются в `goal-mapping.md` после apply.
- **Поле `enabled: false`** = soft-disable (агент при apply вызовет update с `enabled: false`, не hard-delete).
- **Удалить goal из config** = НЕ означает hard-delete в Метрике. Agent при apply сохранит orphan-goal со предупреждением (FR-391: only soft-disable). Hard-delete — через AgentProposal type=`hard_delete`.

**Связь с `goal-mapping.md`**:
- `metrika.config.ts` — input для apply.
- `goal-mapping.md` — output после apply (содержит фактические Metrika-ID, заполняется агентом).
- Они **синхронизируются автоматически** через FR-363; ручное редактирование `goal-mapping.md` оператором ведёт к drift, который detect'ит daily-review (FR-400).

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
- `analytics_settings`: CREATE TABLE (singleton, Payload Global pattern). Включая поля `agent_review` JSONB и `activation.agent_enabled`/`activation.agent_scheduler_enabled`.
- `agent_proposals`: CREATE TABLE (новая, Agent-driven model).
- `agent_execution_log`: CREATE TABLE (новая, Agent-driven model audit-log).

**Стратегия**: одна миграция Payload-generate-types, без data backfill (новые поля nullable). Существующие Cart/Order/Customer останутся с null-значениями новых полей — это допустимо (когорта и атрибуция работают только для записей, созданных после миграции).

---

## 8. Что НЕ добавляется в v1

- `AnalyticsHitQueue` collection (FR-310-312) — v1.1.
- `SearchConsoleQuery`, `IndexCoverageRecord`, `CrawlErrorRecord` — все только в v1.1+ когда подключается Webmaster/GSC API.
- Поле `lastSeenAt` на Customer — не требуется (FR использует `firstSeenAt`).
- Хранение полного transcript Метрика-визитов в БД — не требуется, Метрика держит у себя.
