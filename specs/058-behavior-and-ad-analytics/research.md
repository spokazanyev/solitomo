# Phase 0 — Research: Behavior & Ad Analytics

**Дата**: 2026-05-25 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Все NEEDS CLARIFICATION из Technical Context разрешены через `/speckit-clarify` Session 2026-05-25 (5 Q→A). Здесь — рассмотрение best practices для ключевых интеграций v1.

---

## R1. dataLayer-формат: единый event-стиль vs ecommerce-объект Метрики

**Decision**: Двойная отправка — обычные событийные push'ы (для GA4 + кастомных воронок) + параллельный `ecommerce`-объект (для встроенного отчёта «Электронная коммерция» Метрики). Совместный `transaction_id` гарантирует отсутствие дублей.

**Rationale**:
- Метрика встроенный e-commerce dashboard требует именно объект `ecommerce.detail/add/remove/purchase` с операторными ключами (FR-110…FR-115). Без него отчёт «Электронная коммерция» пустой.
- GA4 принимает события как `event:'add_to_cart', items:[...]` (стандартный GA4 ecommerce).
- В нашем стеке `events.ts` уже использует `pushEvent(event, payload)` — это формат GA4. Дополняем data-layer-объектом для Метрики.

**Alternatives considered**:
- Только event-формат → теряется встроенный отчёт Метрики (Категория 2 в первом ревью).
- Только ecommerce-объект → ломает совместимость с GA4, теряются кастомные ивенты вроде `rfq_open`, `qualified_visit`.

---

## R2. Атрибуция: cookie-стратегия для UTM/yclid/gclid

**Decision**: First-party cookie `_solitomo_attribution` (Lax, Secure, 365 дней) хранит первое непустое касание в JSON: `{utm_source, utm_medium, utm_campaign, utm_content, utm_term, yclid, gclid, _openstat, from, captured_at, referrer_host}`. Перезаписывается только если: (а) cookie отсутствует, (б) новый визит содержит yclid/gclid (явный paid-touch перезаписывает organic). При создании Cart значение копируется в `cart.attributionFirstTouch`. При конверсии Cart → Order значение копируется как-есть (FR-031, FR-032).

**Rationale**:
- Стандартная индустриальная практика last-paid-overrides-organic для атрибуции.
- 365 дней — чтобы пережить долгий B2B-цикл.
- First-party — критично для Safari/ITP (см. R7).

**Alternatives considered**:
- Last-touch (каждый визит перезаписывает) — Метрика и так считает last-touch у себя; в Order дублирует то же самое.
- First-touch абсолютный (никогда не перезаписывается) — органика 6 месяцев назад заслонит платный клик сегодня; нарушает требования рекламной атрибуции.
- LocalStorage вместо cookie — не передаётся серверу, не подойдёт для копирования в Order.

---

## R3. Server-side Metrika hit: формат и доставка

**Decision**: HTTP GET на `https://mc.yandex.ru/watch/<counter_id>` с query-string параметрами: `cnt-class=7` (для серверных хитов), `page-url=<encoded>`, `ut=noindex`, `params=<base64-json>`, `ymid=<client_id_if_known>`. Для конверсий — Measurement Protocol альтернативно через `https://mc.yandex.ru/collect/...`. Idempotency через `transaction_id` (FR-114), отправка только при наличии consent на момент исходной конверсии.

**Rationale**:
- Yandex документирует это как способ отправки server-side hit'ов; cnt-class=7 не учитывается в общем счёте визитов, но фиксирует goal-completion.
- `client_id` берётся из cookie `_ym_uid`, который должен быть передан в API endpoint при создании заказа.
- В v1 — fire-and-forget с try/catch и логированием в Sentry/console; retry-очередь (FR-310) откладывается до v1.1.

**Alternatives considered**:
- Logs API Метрики (server-side ingest) — overkill, требует отдельного аккаунта.
- Очередь сразу в v1 — оверинжиниринг при нулевом трафике (см. Категория 2 в reverse-ревью).

---

## R4. Реферер-классификация: host-патерны и приоритеты

**Decision**: Хранение host-патернов в `AnalyticsSettings` Payload Global как `referrerPatterns: [{ channel: 'organic_yandex', hostPatterns: ['*.yandex.*'], priority: 10 }, ...]`. Логика классификации (`lib/analytics/attribution.ts:classifyReferrer(host)`) — линейная итерация по приоритетам. Дефолтный seed-набор для launch:

```yaml
- organic_yandex:   ['yandex.ru', 'yandex.by', 'ya.ru', 'yandex.kz', 'yandex.uz']
- organic_google:   ['google.com', 'google.ru', 'google.*']
- organic_images_yandex: ['yandex.ru/images', 'yandex.*/images*']
- organic_images_google: ['google.*/imgres', 'images.google.*']
- organic_maps_yandex: ['yandex.ru/maps', 'maps.yandex.*']
- organic_maps_google: ['maps.google.*', 'google.com/maps']
- organic_marketplace_yandex_market: ['market.yandex.*']
- organic_ai: [
    'perplexity.ai', 'chatgpt.com', 'chat.openai.com', 'claude.ai',
    'you.com', 'phind.com', 'yandex.ru/search/?*neuro*', 'gigachat.devices.sberbank.ru',
    'copilot.microsoft.com'
  ]
- social: ['vk.com', 't.me', 'telegram.me', 'web.telegram.org', 'ok.ru']
- marketplace_outbound: ['wildberries.ru', 'ozon.ru', 'avito.ru']
- direct: []  # пустой referer
- referral: ['*']  # catch-all
```

**Rationale**:
- В админ-настройках (FR-241), потому что AI-поисковики появляются часто — нужна гибкость без релиза.
- Priority-ordered, чтобы более специфичные паттерны (`yandex.ru/images`) ловились раньше общих (`yandex.ru`).

**Alternatives considered**:
- Захардкоженный список — нарушает FR-241.
- Регулярки вместо glob-паттернов — слишком гибко, легко сломать; glob достаточно.

---

## R5. UserID Метрики для кросс-устройств: что передавать

**Decision**: При инициализации Метрики для авторизованного посетителя вызвать `ym(counterId, 'setUserID', customerId)`. `customerId` — Payload-ID Customer-документа (UUID, не персональные данные). Дополнительно `ym(counterId, 'userParams', { UserID: customerId })` для дублирования (старая практика Метрики). При logout — `ym(counterId, 'setUserID', null)`.

**Rationale**:
- Документировано Яндексом, official API.
- `customerId` opaque, не содержит ПДн — соответствует FR-151.
- При смене customer-аккаунта (logout/login) Метрика корректно переключает атрибуцию визитов.

**Alternatives considered**:
- Передача email как UserID — нарушает 152-ФЗ и FR-151.
- Hash от email/phone — лишняя сложность, customer_id уже стабилен.

---

## R6. Visit context: page_type, cluster, user_type — где вычислять

**Decision**: Single source of truth — Server Component `getVisitContext()` в `lib/analytics/visit-context.ts`, вызывается из RSC при рендере каждой страницы. Возвращает: `{ pageType, cluster, userType, sessionStartedVia, isSoftSeed }`. Контекст передаётся через React Context (`<AnalyticsContextProvider>`) на client side. Каждый client-side event вытягивает контекст из Context и автоматически прикрепляет параметры.

**Rationale**:
- В RSC уже есть доступ к route + Payload-data → правильное место для вычисления `pageType`/`cluster`.
- Один Context провайдер избавляет от prop-drilling параметров через 10 уровней.

**Alternatives considered**:
- Вычислять в каждом event-helper'е — повторение кода, риск рассинхрона.
- Хранить в Zustand/глобальном store — overkill для read-only данных.

---

## R7. Safari/ITP first-party cookies для Метрики

**Decision**: В Метрика UI включить опцию «первичные cookie» (Counter Settings → Privacy → "Use first-party cookies"). DNS-настройка: `mc.<домен_сайта>` CNAME на `mc.yandex.ru`. После этого cookie `_ym_*` ставятся на основном домене сайта. Дополнительно — `init` опция Метрики `useFirstPartyCookies: true` (если в SDK так называется; ровно: `webvisor: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, ut: 'noindex', defer: true`).

**Rationale**:
- Apple ITP блокирует third-party cookies через 24 часа на Safari/iOS. First-party решают это.
- ITP не блокирует визит, но без cookie каждый возврат считается новым визитёром → искажение когорт и атрибуции.

**Alternatives considered**:
- Server-side proxy для всего трафика Метрики — overkill, добавляет SPOF.
- Игнорировать Safari — теряем ~25-30% мобильного трафика в РФ.

---

## R8. Smoke-test (slot 1 — jsdom): архитектура

**Decision**: Vitest tests в `apps/web/src/lib/analytics/tests/`. Подход:
- Каждое событие из `events.ts` имеет соответствующий тест-кейс: вызываем helper → проверяем `window.dataLayer[N]` равно ожидаемому объекту (с обязательными полями) → проверяем `pii-filter` не пропустил ничего.
- Тест-helper `assertEventShape(event, expected)` использует JSON-schema-валидацию (zod или manual): structural correctness + absence of PII (regex против email/phone/INN/comment).
- Goal-mapping artifact `06-reports/analytics/goal-mapping.md` парсится в memory, smoke-тест проверяет, что для каждой строки goal-mapping есть тест-кейс и реальный helper. PR с новым event'ом, не отражённым в goal-mapping, валится.

**Rationale**:
- Vitest уже в проекте, ноль новых зависимостей.
- Jsdom покрывает 80% (FR-290 slot 1).
- Goal-mapping как single source of truth для smoke-теста — самодокументируемая структура.

**Alternatives considered**:
- Jest вместо Vitest — Vitest быстрее и уже в проекте.
- Snapshot-тесты вместо schema-проверки — хрупкие, ложно проваливаются.

---

## R9. Weekly-report CLI: архитектура

**Decision**: Node.js ESM-скрипт `apps/web/scripts/report-analytics-weekly.mjs`. Запускается через `pnpm --filter @soliton/web report:analytics:weekly [--week=YYYY-WW]`. Архитектура:
1. Парсинг аргументов (`--week` — default «прошлая полная»); валидация диапазона.
2. Параллельные fetch'и в API Метрики (через сегменты: визиты, цели, источники, e-commerce, поиск). В v1 — только Метрика; в v1.1 добавятся Webmaster API + GSC.
3. Запросы к Payload через локальный SDK (через `payload.find({collection: 'orders', where: {paidAt: {greater_than: weekStart}}})`): orders, RFQs, attribution-данные.
4. Aggregation: формирование структуры данных недельного отчёта.
5. Сравнение с предыдущей неделей: чтение `06-reports/analytics/YYYY-(WW-1).md`, diff по ключевым показателям.
6. Renderer: применение MD-шаблона из `apps/web/templates/weekly-report.md.hbs` (handlebars или просто template-literal-функция).
7. Запись в `06-reports/analytics/YYYY-WW.md`.

**Rationale**:
- CLI отдельный от Next.js runtime — проще запускать локально и в CI/cron.
- Использует Payload local API напрямую (без HTTP) — нет overhead'а.
- Handlebars-шаблон легко обновлять без правки логики.

**Alternatives considered**:
- Admin-UI endpoint `/api/admin/analytics/report` с триггером кнопкой — добавляется в v1.1 как фронт к этому CLI.
- Хранение отчёта в Payload-коллекции вместо MD — нарушает clarification Q2 (MD — source of truth).

---

## R10. PII-фильтр: что и как чистить

**Decision**: `lib/analytics/pii-filter.ts` экспортирует `scrubPII(payload: Record<string, unknown>): Record<string, unknown>`. Алгоритм:
1. Walk через payload recursively (depth ≤ 5).
2. Для каждого string-value применить regex-маски:
   - email: `[\w._%+-]+@[\w.-]+\.\w{2,}` → `[REDACTED_EMAIL]` + counter increment.
   - phone (RU/intl): `\+?[\d\s\-()]{10,}` → `[REDACTED_PHONE]` (с эвристикой ≥10 цифр).
   - ИНН (10/12 цифр): `\b\d{10}(\d{2})?\b` → `[REDACTED_INN]`.
   - ФИО (rough): пропускаем, т.к. ложноположительные дороже; полагаемся на «никогда не складываем имена в payload».
3. Black-list keys: `comment`, `description`, `task`, `notes`, `message`, `text`, `query_freeform` — целиком вырезаются (set to `undefined`).
4. White-list keys: `search_term` — оставляется, но прогоняется через email/phone regex (логично — поиск может содержать ПДн случайно).
5. В debug-mode (env `NEXT_PUBLIC_ANALYTICS_DEBUG=true`) — log `[pii-redacted] field=X regex=email` для отслеживания утечек в dev.

**Rationale**:
- Multi-layer: regex-маски + black-list keys.
- Counter increment даёт метрику «сколько PII-утечек предотвращено» — это полезный KPI здоровья кода.

**Alternatives considered**:
- ML-классификатор PII — overkill, медленно.
- Только regex без black-list — пропустит `comment: "Иван Иванов хочет PDU"`.

---

## R11. Annotations: ручной ввод vs auto-CI hook

**Decision v1**: Payload-коллекция `Annotations` со схемой `{ type, occurredAt, title, description, gitRef?, prUrl?, createdBy }`. Ввод — через Payload Admin UI (стандартный CRUD). Weekly-report CLI читает annotations за период через `payload.find({collection: 'annotations', where: { occurredAt: { ... }}})`.

**Decision v1.1 (defer)**: GitHub Action / Vercel deploy hook делает POST на `/api/analytics/annotations` с типом `deploy`. Endpoint требует `CRON_SECRET` (как у других cron-эндпоинтов в проекте).

**Rationale**:
- В v1 — нулевая инфраструктура CI-hooks. Owner вводит вручную или через Payload Admin (займёт 30 сек/событие).
- В v1.1 при росте частоты deploy'ов автоматизация имеет смысл.

**Alternatives considered**:
- Markdown-файл `annotations.md` вместо Payload-коллекции — теряется фильтрация по диапазону, неудобный CRUD.

---

## R12. Goal-mapping artifact: формат

**Decision**: Markdown-таблица в `06-reports/analytics/goal-mapping.md`:

```markdown
| event_name | metrika_goal_id | ga4_event_name | business_meaning | owner | last_updated |
|---|---|---|---|---|---|
| purchase | 12345 | purchase | Успешная оплата заказа | svp@... | 2026-05-25 |
| rfq_submit | 12346 | rfq_submit | B2B запрос КП отправлен | svp@... | 2026-05-25 |
...
```

Парсится в smoke-тестах как ground-truth (R8). Обновляется в одном PR с любым изменением event'ов.

**Rationale**:
- Plain MD: легко читается, легко diff'ится, легко парсится.
- Owner column — для accountability при росте команды.

**Alternatives considered**:
- YAML/JSON — менее human-friendly для маркетолога.

---

## R13. DSAR-runbook: процедура удаления

**Decision**: MD-документ `06-reports/analytics/dsar-runbook.md` со следующей структурой:
1. **Получение запроса** — email + verification.
2. **Идентификация субъекта** — найти Customer по email; достать `customer.ymClientId` (если есть; сохраняется при логине Метрика-юзера на сервер).
3. **Извлечение данных**:
   - Метрика: API endpoint `https://api-metrika.yandex.net/management/v1/counter/<id>/visits?date1=<from>&date2=<to>&dimensions=ym:s:userIDHash`.
   - Payload local: визиты, серверные хиты, аннотации.
4. **Формирование ответа** — JSON-attachment по email.
5. **Удаление** — Метрика API `DELETE /counter/<id>/visits/<ymUid>` (если поддерживается) или escalation to Yandex support; Payload — soft-delete с retention.
6. **Лог** — запись в `Customers.dsarLog` (new field).

**Rationale**:
- 152-ФЗ требует ответа в 30 дней. Runbook гарантирует execution в течение нескольких часов.

**Alternatives considered**:
- Автоматизированный endpoint — overkill для редкого процесса.

---

## R14. Acquisition_query extraction: безопасность от ПДн

**Decision**: `lib/analytics/attribution.ts:extractSearchQuery(referer): string | null`. Алгоритм:
1. Парсинг URL referer; берём query-param `text` (Яндекс) или `q` (Google, иногда возвращается).
2. URL-decode.
3. Прогон через PII-фильтр (R10): если содержит email/phone/inn — return `null`.
4. Truncate to 200 chars (защита от мусора).
5. Trim, lowercase для нормализации.

**Rationale**:
- ФЗ-152 не считает поисковый запрос ПДн сам по себе, но если в нём ИНН/телефон случайно — это уже ПДн.
- 200 chars достаточно для любого осмысленного запроса.

**Alternatives considered**:
- Не сохранять вообще — теряем ценнейший SEO-сигнал.

---

## R15. Существующие зависимости и что НЕ устанавливаем

**Decision**: v1 использует только то, что **уже в проекте**:
- `vitest` (есть) — smoke-test slot 1.
- `jsdom` (transitively через vitest) — DOM для smoke-теста.
- Payload v3 (есть) — collections и globals.
- Next.js 16 (есть) — routes.

**Не устанавливаем в v1**:
- Playwright — defer до v1.1 (FR-290 slot 2).
- `web-vitals` library — встроенный отчёт Метрики покрывает FR-070/071 в v1 (см. cut в reverse-ревью).
- `recharts`/`chart.js` — defer до v1.1 (HTML admin-rendering, FR-094).
- Yandex Metrika SDK для Node.js — нет официального; используем raw `fetch` к Measurement Protocol (R3).

**Rationale**:
- Zero new dependencies в v1 — снижает риск supply-chain, ускоряет PR review.

---

## R16. Pre-commit / lint hooks для smoke-test

**Decision**: В `package.json` add CI scripts:
- `pnpm test:analytics:unit` → `vitest run apps/web/src/lib/analytics/tests`.
- `pnpm test:analytics:smoke` → alias to `unit` в v1; в v1.1 расширяется до `unit && e2e`.

CI pipeline (GitHub Actions / Vercel build):
1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test` (includes analytics tests)
4. Если `pnpm test:analytics:smoke` падает → block merge / deploy.

**Rationale**:
- Используем стандартный `pnpm test` + наличие analytics-тестов в дереве. Никаких отдельных gate'ов кроме существующих.

---

## Summary

Все ключевые технические решения для v1 зафиксированы. Phase 1 (data-model + contracts + quickstart) опирается на эти решения.

**Открытых NEEDS CLARIFICATION**: 0.

**Откладывается до v1.1 research** (когда подходит фаза):
- Webmaster API authentication flow (OAuth refresh, dailies лимит).
- GSC API service-account JSON format и rotation policy.
- Playwright e2e selectors + happy-path automation.
- Retry-queue backoff timing tuning (по реальным failed-hit метрикам).

---

## R17. Yandex.Metrika Management API — endpoints для agent-управления

**Decision**: Использовать Yandex.Metrika Management API v1 для всех CRUD-операций над счётчиком. Base URL: `https://api-metrika.yandex.net/management/v1/counter/<counterId>/`. Auth через `Authorization: OAuth <YM_AGENT_TOKEN>`.

**Endpoints (v1 scope)**:
- **Goals**: `GET /goals`, `POST /goals`, `GET /goal/{id}`, `PUT /goal/{id}`, `DELETE /goal/{id}` (только через FR-391 explicit-flag). Schema: `{ goal: { name, type, conditions[], is_retargeting? } }`.
- **Filters (segments)**: `GET /filters`, `POST /filters`, `PUT /filter/{id}`. Используется для retargeting-сегментов (FR-200).
- **Counter Settings**: `GET /` (returns full counter object), `PATCH /` (partial update). Settings под `counter.code_options` и `counter.webvisor` keys.
- **Offline Conversions**: `POST /offline_conversions/upload` (CSV body). FR-033/FR-034 + T089.
- **Permissions Validation**: `GET /` с проверкой `counter.permission` — должен быть `edit` для mutating-операций.

**Rate limits**: ~5000 req/day, ~10 req/s burst. FR-393 встроенный rate-limiter защищает.

**Rationale**:
- Официально документировано Яндексом.
- Token-based auth — простой supply chain (FR-100 env).
- Все нужные CRUD-операции покрыты для v1.

**Alternatives considered**:
- Custom scraping UI — fragile, прямо запрещено TOS.
- Прямой DB-access — не существует для cloud-Метрики.

---

## R18. Approval workflow design

**Decision**: Workflow «agent proposes → operator approves → agent executes» через Payload-коллекцию `AgentProposals` (см. data-model.md §2.0). Critical design choices:

1. **Async execution**: на approve agent **не** делает sync API-call внутри admin-request. Вместо этого: `afterChange` hook → enqueue execution job → fast UI response. Job выполняется в background (in-process queue в v1, Payload-jobs в v1.1 при росте volume).
2. **Idempotency**: каждый proposal имеет уникальный `id`; execution-job проверяет `status === 'approved'` перед вызовом API. Двойной approve → ровно один API-вызов.
3. **Cooldown** (FR-383): каждый `(evaluator, targetPath)` пара → 7 дней default. Cooldown в `proposal.cooldownUntil`. Evaluator проверяет перед созданием нового proposal.
4. **Audit-immutability**: после `executed`/`failed` — терминальные состояния. `failed` можно retry через создание **нового** proposal.
5. **UI presentation**: admin-view с filter status (default pending); badge severity; diff-view; reasoning expanded; кнопки Approve/Reject. Reject требует обязательный reason ≤1000 chars; Approve может без.

**Rationale**:
- Async — исключает UI-timeouts.
- Cooldown — anti-spam (без него agent создаст 50 proposals за неделю).
- Immutability — для compliance.

**Alternatives considered**:
- Auto-execute для «low-risk» types — опасно, нарушает FR-384 invariant.
- Sync API-call внутри admin-request — risk of timeouts.

---

## R19. Evaluator algorithms — v1 baseline (threshold-based)

**Decision**: v1 evaluators используют **threshold-based heuristics**, не ML. Простота важнее «умности» на первом этапе. ML-based — defer до v1.2+.

### Evaluator-suite (FR-371, scheduled v1.1 / on-demand v1)

1. **`funnel_drop_off`**: `conversion_rate(day) - conversion_rate(7-day-avg)`. Если `abs(delta) > 20%` AND step has ≥10 entries → `propose_investigate_drop`.
2. **`qualified_visit_rate`**: `qualified_count / total_visits`. Если `<5%` или `>90%` → `propose_adjust_threshold` с конкретными значениями.
3. **`source_quality`**: топ-10 source-каналов вчера vs 7-day-avg. Новый канал >10% или потерянный >50% → `propose_investigate_source_change`.
4. **`zero_result_searches`**: топ-10 запросов с `search_no_results`. Запрос повторяется >5 раз → `propose_consider_new_content_or_redirect`.
5. **`roas_deviation`**: ROAS = revenue/cost per Я.Директ-кампания. Если ROAS<1 за 7 дней (cost data есть) → `propose_review_campaign` (не auto-pause).
6. **`data_quality`**: rate `js_error`/`page_404`/`consent_decline`. Резкое (>50% vs 7-day-avg) изменение → `propose_investigate`.

### Structural evaluators (FR-374, weekly)

7. **`drift_detector`** (см. R20): сравнение Metrika current vs config.
8. **`missing_goal`**: события через `events.ts` vs goals в config. Event >20/неделя без goal → `propose_create_missing_goal`.
9. **`unused_segment`**: filter с visit-count=0 за 4 недели → `propose_remove_unused_segment` (soft-disable).
10. **`correlated_events`**: pairs-detection (наивный chi-square). High correlation без composite-goal → `propose_consider_composite_goal`.

**Rationale**:
- Threshold-based: predictable, debuggable, нет training-data.
- 10 evaluators покрывают 80% useful signals.

**Alternatives considered**:
- Изоляционный лес / autoencoders — overkill, требует accumulated history.
- DSL для rules — over-engineering для 10 rules.

---

## R20. Drift detection strategy

**Decision**: Drift = расхождение между `metrika.config.ts` (git-tracked) и реальным state Метрика-счётчика (через Management API GET).

**Algorithm**:
1. Daily-review (FR-370): agent делает `GET /goals`, `GET /filters`, `GET /` (counter settings).
2. Match by `name` field с `metrika.config.ts`.
3. Сравнение полей: `name`, `type`, `conditions`, `is_retargeting`, `enabled`; для settings — каждое поле.
4. Если расхождение found → **один** `AgentProposal` type=`drift_detected` со всем diff'ом (не отдельный proposal на каждое расхождение — anti-spam).
5. **Two operator-actions** (FR-401):
   - **(a) restore-from-config**: API-call приводит Метрику в config-state.
   - **(b) accept-and-update-config**: agent генерирует patch для `metrika.config.ts`, создаёт PR-suggestion в git.

**Edge case**: object в config but not in Metrika (manual hard-delete) → special case `orphan_in_config` proposal с двумя alternatives: recreate via API или remove from config.

**Rationale**:
- Continuous quality-gate (Constitution VII).
- Two-action design — гибкость: иногда manual-изменение legitimate.

**Alternatives considered**:
- Auto-restore без approve — нарушает FR-384.
- Skip drift detection — допускает silent skew code↔runtime.

---

## R21. MCP-server design (v1.2 defer)

**Decision (v1.2)**: Локальный MCP-server `apps/web/mcp-server/analytics-mcp/` (Node.js, stdio для Claude Desktop / SSE для Claude Code). Auth через env `MCP_TOKEN`.

**Tools (v1.2)**:
- **Read-only**: `metrika_get_funnel(date_range)`, `metrika_get_top_queries(period)`, `metrika_list_goals()`, `metrika_get_segments()`, `metrika_get_anomaly_report()`.
- **Propose** (создают `AgentProposal`, **не** mutating): `metrika_propose_goal(goal_spec, reasoning)`, `metrika_propose_filter(spec, reasoning)`, `metrika_propose_setting_change(path, value, reasoning)`.

**Workflow с MCP**:
1. Оператор в Claude Desktop: «Покажи воронку покупки за 7 дней с разбивкой по source».
2. Claude через `metrika_get_funnel` → данные.
3. Видит провал в `organic_yandex` → предлагает: «Создать сегмент для drilldown?».
4. Соглашается → `metrika_propose_filter` → AgentProposal создан.
5. Оператор переходит в `/admin/agent-proposals`, видит, approve.
6. Agent через FR-382 flow выполняет API-mutation.

**Rationale**:
- Естественное расширение agent-driven model.
- Сохранение FR-384 invariant — критично.

**Alternatives considered**:
- Direct API-mutation из MCP — нарушает FR-384.
- Claude Code без MCP — менее удобно для ad-hoc.
