---
description: "Task list for v1 (MVP-Lite) of Behavior & Ad Analytics"
---

# Tasks: Behavior & Ad Analytics — v1 (MVP-Lite)

**Input**: Design documents from `/specs/058-behavior-and-ad-analytics/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: smoke-test slot 1 (jsdom/vitest) — обязателен в v1 (FR-290 slot 1 + FR-291). Тестовые задачи включены.

**Scope**: только v1 (MVP-Lite) согласно `## Scope Phases` в spec.md. Задачи для v1.1 (Webmaster/GSC integration, retry-очередь, HTML-admin-page, Playwright e2e, auto-deploy annotations и т.д.) и v1.2 — будут сгенерированы в отдельных tasks-файлах в соответствующих фазах. Здесь — НЕТ.

**Organization**: задачи сгруппированы по user story для независимой реализации и тестирования.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно запускать параллельно (разные файлы, нет зависимости от незавершённых задач)
- **[Story]**: к какой user story относится задача (US1/US2/US3/US4/US5/US6/US7/US8)
- Все пути — абсолютные от корня репозитория (`apps/web/...`, `06-reports/...`)

## Path Conventions

Реальная структура согласно plan.md §Project Structure:
- **Web app monorepo**: `apps/web/src/...`
- **Reports artifacts**: `06-reports/analytics/...` (корень проекта)
- **Build specs**: `07-build-specifications/...` (корень проекта)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: подготовка окружения, env-переменные, новая структура файлов аналитики.

- [ ] T001 Создать структуру директорий новых модулей: `apps/web/src/lib/analytics/tests/`, `apps/web/src/components/analytics/`, `apps/web/src/components/phone/`, `apps/web/src/lib/annotations/`, `apps/web/scripts/tests/`, `06-reports/analytics/`.
- [ ] T002 Добавить в `apps/web/.env.example` новые переменные (см. quickstart.md §«ENV-переменные»): `YM_API_TOKEN`, `YM_COUNTER_ID` (дополнение к существующему `NEXT_PUBLIC_YANDEX_METRIKA_ID`), оставить заглушку для будущего `ADMIN_ALERT_CHANNEL`.
- [ ] T003 [P] Добавить npm-скрипты в `apps/web/package.json`: `test:analytics:unit` → `vitest run apps/web/src/lib/analytics/tests`, `test:analytics:smoke` → alias на `test:analytics:unit`, `report:analytics:weekly` → `node scripts/report-analytics-weekly.mjs`, `seed:analytics-settings` → `payload seed:analytics-settings`.
- [ ] T004 [P] Создать пустые placeholder-файлы для будущих артефактов: `06-reports/analytics/.gitkeep`.
- [ ] T088 Provenить инвентаризацию форм для FR-014 conditional-cut: проверить наличие в `apps/web/src/components/**/*Form.tsx` пяти форм (RfqForm, PhysicalCheckoutForm, LegalCheckoutForm, callback-форма, invoice-request, quick-order, file-upload); результат записать в `06-reports/analytics/forms-inventory.md` со столбцами `form_name | exists (yes/no/partial) | file_path | events_to_implement`. Этот файл — ground truth для conditional-задач (T031, T063, T065) и для FR-014 семантики «реализовать события только для существующих форм». [Resolves F5, added 2026-05-26]

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: ядро инфраструктуры, без которого ни одна US не может быть реализована.

**⚠️ CRITICAL**: ни одна US-фаза не начинается, пока Phase 2 не завершена.

### Payload Schema Extensions

- [ ] T005 [P] Расширить `apps/web/src/collections/Carts.ts` полями `attributionFirstTouch` (group из 13 полей: utmSource, utmMedium, utmCampaign, utmContent, utmTerm, yclid, gclid, openstat, from, refererHost, acquisitionChannel, acquisitionQuery, capturedAt), `ymClientId`, `gaClientId`, `firstSeenAt`, `userTypeAtCreation` (enum). См. data-model.md §1.1.
- [ ] T006 [P] Расширить `apps/web/src/collections/Orders.js` полями `attributionFirstTouch` (group), `ymClientId`, `firstSeenAt`, `timeToPurchaseDays`, `visitCountToPurchase`, `userTypeAtConversion`, `serverHitStatus` (group: purchaseHitSentAt, purchaseHitStatus enum, purchaseHitError). См. data-model.md §1.2.
- [ ] T007 [P] Расширить `apps/web/src/collections/Customers.ts` полями `firstSeenAt`, `ymClientId`, `dsarLog` (array). См. data-model.md §1.3.
- [ ] T008 [P] Создать `apps/web/src/collections/Annotations.ts` со всеми полями из data-model.md §2.1; добавить в `payload.config.ts` массив collections; настроить indexes на `occurredAt DESC` и `(type, occurredAt)`.
- [ ] T009 [P] Создать `apps/web/src/globals/AnalyticsSettings.ts` со всеми полями из data-model.md §3.1; добавить в `payload.config.ts` массив globals.
- [ ] T010 Сгенерировать TypeScript-типы Payload после всех schema-изменений: `pnpm --filter @soliton/web generate:types`.
- [ ] T011 Создать seed-скрипт `apps/web/scripts/seed-analytics-settings.mjs` с дефолтными значениями (referrerPatterns по R4 research.md, qualifiedVisit thresholds, brandKeywords `['soliton','солитон']`, пустые goals/retargetingSegments, activation все `true`). Регистрация Payload command `seed:analytics-settings` в `payload.config.ts`.

### Core Analytics Library

- [ ] T012 [P] Создать `apps/web/src/lib/analytics/env-marker.ts`: экспорт функции `getEnvironment(): 'production' | 'staging' | 'development'` на основе `process.env.NODE_ENV` + опционально `NEXT_PUBLIC_DEPLOYMENT_ENV`; экспорт hook'а для middleware.
- [ ] T013 [P] Создать `apps/web/src/lib/analytics/pii-filter.ts`: экспорт `scrubPII(payload)` по алгоритму из research.md §R10 (regex маски email/phone/inn, black-list keys, depth-≤5 recursion, counter для debug). Без зависимостей.
- [ ] T014 [P] Создать `apps/web/src/lib/analytics/attribution.ts`: функции `readAttributionCookie()`, `writeAttributionCookie(touch)`, `classifyReferrer(host, settings)` (использует AnalyticsSettings.referrerPatterns), `extractSearchQuery(referer)` с PII-фильтром (R14), `isBrandQuery(query, brandKeywords)`.
- [ ] T015 [P] Создать `apps/web/src/lib/analytics/visit-context.ts` (Server Component utility): `getVisitContext(headers, payload, customer?)` возвращает `{ pageType, cluster, userType, sessionStartedVia, env }`. Hybrid `user_type=legal_entity` по Clarification Q1: cookie `_solitomo_legal_entity_flag` OR `customer.companyId`.
- [ ] T016 [P] Создать `apps/web/src/lib/analytics/customer-link.ts`: client-side функции `setMetrikaUserID(customerId)` и `clearMetrikaUserID()` через `ym(counterId, 'setUserID', value)`. NO-OP без window/без счётчика.
- [ ] T017 Расширить существующий `apps/web/src/lib/analytics/events.ts`: добавить ~25 новых event-helper-функций согласно `contracts/analytics-events.md` (все категории 1-9). Каждая функция вызывает `scrubPII()` перед push'ем. Каждая принимает event-payload + automatically прикрепляет visit-context из React Context.
- [ ] T018 Расширить существующий `apps/web/src/lib/analytics/data-layer.ts`: добавить функцию `pushEcommerceObject(operation: 'detail'|'add'|'remove'|'purchase', products, actionField?)` для нативного формата Метрики (FR-110-115). Использовать общий `transaction_id` для дедупликации (FR-114).
- [ ] T019 Расширить `apps/web/src/components/analytics/AnalyticsScripts.tsx`: при наличии авторизованного `customer` вызывать `setMetrikaUserID(customer.id)`; в `ym(counterId, 'init', {...})` добавить опции `accurateTrackBounce: true`, `webvisor: true`, `defer: true`, `useFirstPartyCookies: true` (R7).
- [ ] T020 [P] Создать `apps/web/src/components/analytics/AnalyticsContextProvider.tsx`: React Context провайдер, оборачивает RSC-вычисленный visit-context, предоставляет его client-side событиям. Интеграция в `apps/web/src/app/(site)/layout.tsx`.
- [ ] T021 [P] Создать `apps/web/src/lib/analytics/consent-banner-events.ts`: event-helpers `trackConsentBannerShown()`, `trackConsentAccepted()`, `trackConsentDeclined()`. Буферизация в cookie до момента инициализации Метрики (R: spec FR-280).
- [ ] T022 Расширить существующий `apps/web/src/components/consent/CookieConsentBanner.tsx`: вызывать `trackConsentBannerShown()` при первом mount, `trackConsentAccepted()` / `trackConsentDeclined()` при выборе. Не блокировать рендеринг события.

### Middleware и server-side

- [ ] T023 Расширить `apps/web/src/middleware.ts`: добавить header `X-Env: ${getEnvironment()}` ко всем response'ам; при первом hit в визите — set cookie `_solitomo_attribution` если отсутствует ИЛИ если новый touch содержит yclid/gclid (paid override); set cookie `_solitomo_first_seen` если отсутствует; инкремент `_solitomo_visit_count`.

### Test Infrastructure

- [ ] T024 [P] Создать `apps/web/vitest.config.ts` (если ещё нет): jsdom environment, тестовая директория `src/lib/analytics/tests`, coverage опции.
- [ ] T025 [P] Создать `apps/web/src/lib/analytics/tests/test-helpers.ts`: функция `assertEventShape(event, schema)` с zod- или manual-валидацией; helper `getDataLayerPush(eventName)`; reset-helper для очистки `window.dataLayer` между тестами.

**Checkpoint**: фундамент готов — все US-фазы могут стартовать (US1, US3, US7 параллельно после Phase 2; US2 и US8 параллельно; US5 после данных US1/US2; US4 завязан на US2; US6 параллельно).

---

## Phase 3: User Story 1 — Воронка покупки (Priority: P1) 🎯 MVP CORE

**Goal**: владелец видит каждый шаг воронки `Главная → Каталог → PDP → Cart → Checkout-steps → Payment → Purchase` с drop-off rate.

**Independent Test**: happy-path в инкогнито с принятым consent → все события визуально появляются в console; через 30 мин в Метрика реальное-время видны hits с этими событиями; через 24h — корректная воронка по составной цели.

### Event Implementations

- [ ] T026 [P] [US1] Расширить `apps/web/src/components/product/ProductListing.tsx`: отправлять `view_item_list` при render списка (см. contracts/analytics-events.md §Категория 1); параметры — `list_id`, `list_name`, `items[]` с `position`.
- [ ] T027 [P] [US1] Расширить `apps/web/src/components/product/ProductCard.tsx`: при клике — `select_item` event с `position` и `list_id`.
- [ ] T028 [P] [US1] Расширить `apps/web/src/components/product/ProductDetail.tsx`: при mount — `view_item` event + `ecommerce.detail` dual-push (FR-110); параметры товара полные (sku, name, category, brand, price).
- [ ] T029 [P] [US1] Расширить `apps/web/src/components/rfq/RfqCart.tsx`: добавить событие `remove_from_cart` при удалении (FR-010) + `ecommerce.remove`.
- [ ] T030 [US1] Расширить `apps/web/src/components/checkout/PhysicalCheckoutForm.tsx`: события `checkout_step_contact` (step_index=1), `checkout_step_shipping` (step_index=2) при показе/первом фокусе блока; `add_shipping_info` при выборе.
- [ ] T031 [US1] Расширить `apps/web/src/components/checkout/LegalCheckoutForm.tsx`: те же step-events для checkout_type='legal'; дополнительно `inn_validation_success`/`inn_validation_failed` (FR-192) при validation ИНН.
- [ ] T032 [US1] Расширить `apps/web/src/components/checkout/ReviewClient.tsx`: события `checkout_step_payment_method` (step_index=3), `add_payment_info` при выборе метода; `checkout_step_review` (step_index=4) при показе сводки; `checkout_cta_pay_clicked` (step_index=5) при клике на кнопку оплаты до редиректа.
- [ ] T033 [US1] Расширить `apps/web/src/components/payment/PaymentReturnClient.tsx`: при успехе — `purchase` event с `transaction_id = order.clientNumber` + `ecommerce.purchase` (FR-110, FR-114); при failure — `payment_failed` с правильным `reason` (expired/cancelled_by_user/payment_method_declined/webhook_timeout).
- [ ] T034 [US1] Расширить `apps/web/src/components/checkout/RetryPaymentButton.tsx`: событие `payment_retry` с `transaction_id` и `attempt_number`.

### Tests (jsdom smoke)

- [ ] T035 [P] [US1] Создать `apps/web/src/lib/analytics/tests/funnel-events.test.ts`: тест-кейс для каждого funnel event (view_item, view_item_list, select_item, add_to_cart, view_cart, remove_from_cart, begin_checkout, все checkout_step_*, payment_*, purchase). Использовать assertEventShape; проверять отсутствие PII; проверять ecommerce dual-push для конверсионных событий.

**Checkpoint US1**: воронка работает end-to-end в браузере + smoke-test зелёный → US1 deployable as MVP.

---

## Phase 4: User Story 2 — Реклама и атрибуция (Priority: P1) 🎯 MVP CORE

**Goal**: при покупке через `?yclid=...` в Order сохранены метки, server-side hit отправлен, в Метрике через 24h виден yclid в offline-conversion.

**Independent Test**: открыть сайт с `?utm_source=test&utm_campaign=launch&yclid=TESTCLICK123`, оплатить тестовый Order; в Payload Admin — Order.attributionFirstTouch заполнен; Order.serverHitStatus.purchaseHitStatus='sent'; через 24h в Метрика-отчёте «Источники» виден этот yclid.

### Attribution Pipeline

- [ ] T036 [P] [US2] Создать `apps/web/src/lib/analytics/server-tracker.ts`: функция `sendServerPurchase(order)` строит URL для Метрика Measurement Protocol по спецификации в `contracts/server-hit-endpoint.md` §«Metrika Measurement Protocol»; timeout 1.5s; fire-and-forget с try/catch и логированием ошибок (FR-044).
- [ ] T037 [US2] Создать `apps/web/src/app/api/analytics/server-hit/route.ts` (Next.js Route Handler): POST endpoint по контракту `contracts/server-hit-endpoint.md`; проверки consent (FR-043), kill-switch `AnalyticsSettings.activation.serverHitsEnabled`, idempotency через `Order.serverHitStatus.purchaseHitStatus !== 'sent'`. Auth: same-origin или CRON_SECRET header.
- [ ] T038 [US2] Расширить Payload Cart-hook `afterChange` (`apps/web/src/collections/Carts.ts`): при создании корзины (operation='create') — копировать `_solitomo_attribution` cookie value в `cart.attributionFirstTouch`; копировать `_ym_uid` в `cart.ymClientId`; копировать `_solitomo_first_seen` в `cart.firstSeenAt`; вычислять `cart.userTypeAtCreation` через `getVisitContext()`-helper.
- [ ] T039 [US2] Расширить Payload Order-hook `afterChange` (`apps/web/src/collections/Orders.js`): при создании Order — копировать `attributionFirstTouch`, `ymClientId`, `firstSeenAt`, `userTypeAtConversion` из связанной Cart.
- [ ] T040 [US2] Расширить Payload Order-hook `afterChange` (`apps/web/src/collections/Orders.js`): при переходе статуса в `paid` — вызвать internal `POST /api/analytics/server-hit` (через Payload local fetch) с body согласно contract; обновить `Order.serverHitStatus`.
- [ ] T089 [P] [US2] Создать `apps/web/src/lib/analytics/offline-conversions.ts` с функцией `sendOfflineConversion(order)` (FR-033, FR-034). Использует Yandex.Metrika Offline Conversions API endpoint `POST https://api-metrika.yandex.net/management/v1/counter/<id>/offline_conversions/upload` с auth по `YM_API_TOKEN` (env). Payload CSV-формат с колонками `UserId,Target,DateTime,Price,Currency,yclid` (или `ClientId` если yclid отсутствует — FR-034). Idempotency через `transaction_id` (Метрика дедуплицирует). Respects consent (FR-043) и kill-switch `AnalyticsSettings.activation.serverHitsEnabled`. Это **дополняет** server-hit (FR-040, T036) — server-hit для adblock-resilience, offline-conversion для Я.Директ оптимизации ставок post-факт. [Resolves F4, added 2026-05-26]
- [ ] T090 [US2] Расширить Payload Order-hook `afterChange` (расширение T040): после успешной отправки server-hit ИЛИ независимо при переходе статуса в `paid` — вызвать `sendOfflineConversion(order)` (T089). Записать результат в новый sub-field `Order.serverHitStatus.offlineConversionStatus` (enum: `pending`/`sent`/`failed`/`skipped_no_yclid`/`skipped_no_consent`) и `offlineConversionSentAt`. Если у Order ни `yclid`, ни `client_id` — статус `skipped_no_yclid`, не error. [Resolves F4, added 2026-05-26]

### Configuration

- [ ] T041 [US2] **Manual setup**: в UI Метрики связать счётчик с Я.Директ-аккаунтом (импорт стоимости — FR-300). Задокументировать шаги в `06-reports/analytics/operator-guide.md` (см. T076).

### Tests

- [ ] T042 [P] [US2] Создать `apps/web/src/lib/analytics/tests/server-tracker.test.ts`: mock fetch; проверка корректного URL/params (cnt-class=7, ymid, transaction_id в base64-encoded params); проверка skip при consent_was_given=false; проверка skip при kill-switch=false; проверка timeout 1.5s graceful failure.
- [ ] T043 [P] [US2] Создать `apps/web/src/lib/analytics/tests/attribution.test.ts`: тесты для `readAttributionCookie`, `writeAttributionCookie`, `classifyReferrer` со всеми категориями из R4 (organic_yandex, organic_google, organic_ai, etc.), `extractSearchQuery` (включая PII-фильтрацию).

**Checkpoint US2**: yclid сохраняется в Order, server-hit отправляется. US2 deployable for ad-attribution.

---

## Phase 5: User Story 8 — SEO classification (Priority: P1, partial v1)

**Goal**: SEO-команда в weekly-отчёте видит organic-канал (через ссылки в Webmaster/GSC + классификацию реферера + brand-split).

**Note**: полный auto-import данных Webmaster/GSC — defer до v1.1 (FR-230-235). В v1 — только on-site классификация и ссылки на UI Webmaster/GSC из weekly-отчёта.

**Independent Test**: открыть сайт через клик из Яндекс-выдачи → в Cart.attributionFirstTouch видны `acquisitionChannel='organic_yandex'`, `acquisitionQuery=<поисковая фраза без PII>`, `refererHost='yandex.ru'`. В weekly-отчёте секция «Организический канал» содержит правильные ссылки на UI Webmaster/GSC с pre-filled диапазоном.

- [ ] T044 [P] [US8] Реализовать `classifyReferrer()` в `apps/web/src/lib/analytics/attribution.ts` (расширение T014): glob-pattern matching с приоритетами; читает `referrerPatterns` из AnalyticsSettings.
- [ ] T045 [P] [US8] Реализовать `extractSearchQuery()` (расширение T014): парсит URL referer на `text=` (Яндекс) и `q=` (Google), URL-decode, прогон через PII-фильтр, truncate ≤200 chars.
- [ ] T046 [P] [US8] Реализовать `isBrandQuery(query, keywords)` (расширение T014): case-insensitive substring match; используется в weekly-renderer для brand-split.
- [ ] T047 [US8] Расширить middleware (T023): при заполнении attribution-cookie использовать `classifyReferrer()` для `acquisitionChannel` и `extractSearchQuery()` для `acquisitionQuery`. Хранить в cookie payload.

**Checkpoint US8 (v1)**: реферер классифицируется, brand-split работает. SEO weekly-секция — заполняется в Phase 6 (US5 weekly-report).

---

## Phase 6: User Story 5 — Weekly report MD (Priority: P2, partial v1)

**Goal**: владелец каждый понедельник запускает `pnpm report:analytics:weekly` и получает MD-файл в `06-reports/analytics/YYYY-WW.md` за прошлую полную неделю.

**Note**: HTML-rendering админ-страницы (FR-094) — defer до v1.1. В v1 — только MD-артефакт, читаемый напрямую.

**Independent Test**: запустить скрипт с `--week=<прошлая>`; файл создан; содержит все обязательные секции из FR-091 (v1-scope); ссылки на Webmaster/GSC корректные; повторный запуск без `--force` падает с exit 2.

### CLI Implementation

- [ ] T048 [US5] Создать `apps/web/scripts/report-analytics-weekly.mjs`: ESM-CLI скелет; парсинг опций (`--week`, `--from/--to`, `--dry-run`, `--force`, `--no-prev-diff`) через стандартный `node:util.parseArgs`; проверка env-переменных (YM_COUNTER_ID, YM_API_TOKEN, DATABASE_URI). Exit codes согласно `contracts/weekly-report-cli.md` §«Error handling».
- [ ] T049 [US5] Создать `apps/web/src/lib/analytics/metrika-api-client.ts`: HTTP-клиент для Yandex Metrika API v1 с auth по `YM_API_TOKEN`; функции `getStatData(metrics, dimensions, dateRange, filters?)`, `getEcommerceData(...)`, `getGoalConversions(...)`. См. endpoints в contracts/weekly-report-cli.md §«Метрика API endpoints».
- [ ] T050 [US5] Реализовать data aggregation в `report-analytics-weekly.mjs`: загрузка через Payload local API (`payload.find({collection: 'orders', where: {paidAt: {greater_than_equal: weekStart, less_than_equal: weekEnd}}}`), agregation по структуре `WeeklyReportData` (см. contracts/weekly-report-cli.md §«Data shape»).
- [ ] T051 [US5] Реализовать diff-with-previous-week: чтение `06-reports/analytics/YYYY-(WW-1).md`, парсинг ключевых метрик (через якоря/regex), вычисление % изменений; включение в `WeeklyReportData.funnelDelta` и др.
- [ ] T052 [US5] Создать template-функцию `renderWeeklyReport(data): string` в `apps/web/src/lib/analytics/weekly-report-renderer.ts`: возвращает MD согласно структуре из contracts/weekly-report-cli.md §«MD-Template»; пустые/недоступные секции явно помечены.
- [ ] T053 [US5] Интегрировать `renderWeeklyReport` в CLI + запись в `06-reports/analytics/YYYY-WW.md` (если не `--dry-run`); idempotency check через `fs.existsSync`.

### Section: Organic (v1: links only)

- [ ] T054 [P] [US5] Реализовать в renderer'е секцию «Организический канал»: содержит pre-filled ссылки на Webmaster (`https://webmaster.yandex.ru/site/<host>/searchqueries/?date1=<from>&date2=<to>`) и GSC (`https://search.google.com/search-console/performance/search-analytics?...&start_date=<from>&end_date=<to>`); ссылку на «Диагностика → Ошибки обхода» Webmaster; brand-split по `acquisitionChannel='organic_yandex' OR 'organic_google'` × `isBrandQuery(acquisitionQuery)` из Payload Orders/Carts.

### Tests

- [ ] T055 [P] [US5] Создать `apps/web/scripts/tests/report-analytics-weekly.test.mjs`: mock Метрика API + mock Payload; snapshot-test MD-output для фикстурного input; edge-case: API partial failure → правильная пометка в MD; edge-case: file exists без `--force` → exit 2.

**Checkpoint US5**: weekly-отчёт генерируется, читается человеком. US5 deployable.

---

## Phase 7: User Story 3 — Микро-конверсии (Priority: P2, v1 basics)

**Goal**: маркетолог видит, какие микро-конверсии работают (phone_click, document_download, filter_apply, search), на каких страницах низкая активность.

**Note**: scroll_depth (FR-008), print/copy (FR-018-019/FR-193-194) — defer до v1.1.

**Independent Test**: на тестовых страницах кликнуть на телефон, скачать PDF, применить фильтр, ввести поиск, кликнуть outbound-ссылку — каждое событие появляется в console и в Метрика real-time.

### Event Implementations

- [ ] T056 [P] [US3] Расширить `apps/web/src/app/(site)/catalog/[category-slug]/page.tsx` (или соответствующий компонент категории): при render — `category_view` event с `category_slug` и `items_count`.
- [ ] T057 [P] [US3] Расширить компонент каталог-фильтров (`apps/web/src/components/catalog/CategoryFilters.tsx` или подобный): при apply — `filter_apply` event с `filter_name`, `filter_value` (только non-sensitive значения), `category_slug`.
- [ ] T058 [P] [US3] Реализовать global outbound link handler в `apps/web/src/components/site/Footer.tsx` или global layout: при клике на ссылку с external host → `outbound_click` event с `outbound_host`, `outbound_to` (классификация: marketplace/social/other).
- [ ] T059 [P] [US3] Создать `apps/web/src/components/phone/TrackedPhone.tsx`: оборачивает телефонный номер, при mount отправляет `phone_displayed`, при клике — `phone_click`. Принимает `slot` prop (header/footer/contacts/pdp). data-attribute `data-phone-slot="..."` для будущей call-tracking-подмены (FR-142).
- [ ] T060 [US3] Заменить все hard-coded телефонные ссылки на `<TrackedPhone>` в: `apps/web/src/components/site/SiteHeader.tsx`, `apps/web/src/components/site/SiteFooter.tsx`, `apps/web/src/app/(site)/company/contacts/page.tsx`, PDP (если есть «Запросить цену по тел.»).
- [ ] T061 [P] [US3] Добавить email_click event на email-ссылки: расширение footer/contacts/PDP компонентов analogично T060 (можно общим helper'ом `<TrackedEmail>`).
- [ ] T062 [P] [US3] Расширить компонент скачивания PDF (`apps/web/src/components/documents/DocumentLink.tsx` или подобный): при клике — `document_download` event с `document_type`, `filename`, `sku?`.
- [ ] T063 [US3] **Conditional**: если в проекте есть встроенный поиск (`apps/web/src/components/search/SiteSearchBar.tsx` или подобный) — добавить `search` event с `search_term` (PII-filtered) и `results_count`; добавить `search_no_results` если 0 результатов. Если поиска нет — пропустить и задокументировать в operator-guide.md.
- [ ] T064 [P] [US3] Расширить `apps/web/src/components/product/ProductDetail.tsx` (продолжение T028): добавить `price_view` (если цена публична) или `price_request_click` (если кнопка «Запросить цену»); `stock_status_view` с stock_status enum.
- [ ] T065 [P] [US3] Расширить `apps/web/src/components/RfqForm.tsx`: на каждое validation-fail → `form_field_error` event с form_type='rfq', field_name, error_code (без значения поля).

### Tests

- [ ] T066 [P] [US3] Создать `apps/web/src/lib/analytics/tests/micro-conversions.test.ts`: проверка всех событий из Phase 7 — структура, PII-фильтрация, корректные параметры.

**Checkpoint US3**: микро-конверсии разметка работает. US3 deployable.

---

## Phase 8: User Story 4 — Adblock resilience (Priority: P2, v1 partial)

**Goal**: пользователь с adblock прошёл оплату → конверсия видна в Метрике через серверный hit, дедуплицирована по `transaction_id`.

**Note**: основная реализация (server-tracker + endpoint + Order-hook) уже в Phase 4 (US2). Здесь только верификация и документация.

**Independent Test**: в Chrome с uBlock Origin + EasyList/EasyPrivacy пройти happy-path оплату → клиентский `purchase` event заблокирован (Network tab), но Payload Admin → Order.serverHitStatus='sent'; через 5-15 минут в Метрика real-time появилась конверсия.

- [ ] T067 [US4] Расширить smoke-test `funnel-events.test.ts` (T035) — добавить тест-кейс «adblock simulation»: mock window.fetch (Метрика-домен) → throw error → проверка, что Order.serverHitStatus.purchaseHitStatus вызывает endpoint и обновляется в 'sent'.
- [ ] T068 [US4] Добавить в `06-reports/analytics/operator-guide.md` (см. T076) раздел «Как проверить, что серверные хиты работают» с пошаговой инструкцией (включить adblock → выполнить тестовую покупку → проверить Payload-admin → проверить Метрика real-time).

**Checkpoint US4**: adblock resilience верифицирован.

---

## Phase 9: User Story 7 — Cohort data collection (Priority: P3, v1 data only)

**Goal**: собираем данные для будущего когортного анализа: `first_seen_at`, `visit_count_to_purchase`, `time_to_purchase_days`.

**Note**: построение отчёта когорт в weekly (FR-183) — defer до v1.1. В v1 — только сбор данных в Order; владелец смотрит когорты напрямую в UI Метрики.

**Independent Test**: новый инкогнито → главная → закрыть → через 5 минут — главная → PDP → checkout → оплата. В Payload Order.firstSeenAt = время первого визита, Order.timeToPurchaseDays ≈ 0 (округлено), Order.visitCountToPurchase = 2.

- [ ] T069 [P] [US7] Расширить middleware (T023): первичное создание cookie `_solitomo_first_seen` если отсутствует; инкремент cookie `_solitomo_visit_count` при каждом новом визите (определяется session-timeout 30 минут от last hit).
- [ ] T070 [US7] Создать Payload `afterLogin` hook в `apps/web/src/collections/Customers.ts`: при логине Customer — установить `customer.firstSeenAt = min(cookie._solitomo_first_seen, existing customer.firstSeenAt, now)`; установить `customer.ymClientId = cookie._ym_uid` если null. Соответствует Clarification Q5.
- [ ] T071 [US7] Расширить Payload Order `afterChange` hook (T040): при переходе в `paid` — вычислить `order.timeToPurchaseDays = floor((paidAt - order.firstSeenAt) / 86400000)`; скопировать `order.visitCountToPurchase` из cookie `_solitomo_visit_count`.
- [ ] T072 [US7] Создать cookie `_solitomo_legal_entity_flag` (FR-022 hybrid): расширить INN-валидацию в `LegalCheckoutForm` (T031) — при `inn_validation_success` set cookie с `source='inn-form'`; расширить `customer.afterLogin` hook (T070) — если у customer есть companyId, set cookie с `source='company-link'`.

### Tests

- [ ] T073 [P] [US7] Создать `apps/web/src/lib/analytics/tests/cohort-data.test.ts`: тесты на helpers вокруг first_seen_at hybrid логики (cookie-only, customer-only, both, neither).

**Checkpoint US7**: cohort-данные собираются на каждом заказе.

---

## Phase 10: User Story 6 — Privacy & PII (Priority: P3)

**Goal**: ни одно событие не содержит ПДн в payload; Webvisor маскирует поля с ПДн; есть runbook для 152-ФЗ.

**Note**: PII-filter уже создан в Phase 2 (T013) и применяется на каждом событии через events.ts (T017). Здесь добавляются Webvisor-маски, exhaustive tests, и DSAR-runbook.

**Independent Test**: ввести email+phone+inn+ФИО в RfqForm, Webvisor-запись доступна → визуально проверить, что эти поля маскированы; в payload событий (DevTools Network → запросы к mc.yandex.ru) — ни одного известного PII-фрагмента.

- [ ] T074 [US6] Добавить атрибуты `data-yandex-metrika-mask="true"` (или CSS-класс `_metrika-mask`, согласно текущей версии Метрика SDK) на все PII-поля в формах: `RfqForm.tsx` (email, phone, ФИО, ИНН, comment), `PhysicalCheckoutForm.tsx` (address, name, phone, email), `LegalCheckoutForm.tsx` (ИНН, КПП, ОГРН, адрес, ФИО), `CookieConsentBanner.tsx` (если есть какие-либо инпуты).
- [ ] T075 [P] [US6] Расширить `apps/web/src/lib/analytics/tests/pii-filter.test.ts`: exhaustive test-кейсы — email (varied formats), phone (RU/intl), ИНН (10/12 digits), русские ФИО (ложно-положительные — НЕ маскируется по spec), вложенные структуры, длинные строки, edge: empty values, undefined/null. Проверка counter increment в debug-режиме.
- [ ] T076 [US6] Создать `06-reports/analytics/dsar-runbook.md` согласно `contracts/dsar-runbook.md`: 7 разделов (получение, идентификация, извлечение, удаление, edge-кейсы, учёт DSAR, SLA); конкретные API-вызовы к Метрика API, конкретные queries к Payload, шаблоны ответных писем. Проверить, что владелец может прочитать и понять в течение 30 минут (SC-030).

**Checkpoint US6**: PII не утекают; runbook готов.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: финальные deliverables и валидация v1.

### Documentation Artifacts

- [ ] T077 [P] Создать `06-reports/analytics/operator-guide.md` (FR-220): глоссарий всех v1-событий с бизнес-смыслом + где смотреть в Метрике; описание основных воронок (покупка, RFQ); UTM-чек-лист для запуска кампании; чек-лист «как читать недельный отчёт за 30 минут»; инструкция «как проверить серверный hit» (T068); раздел «настройка связки Метрика↔Я.Директ» (T041).
- [ ] T078 [P] Создать `06-reports/analytics/goal-mapping.md` (FR-292): MD-таблица с колонками event_name | metrika_goal_id | ga4_event_name | business_meaning | owner | last_updated. В v1 — заполнить заглушками для всех v1-событий; реальные Goal-ID добавляются после T080 (создание целей в Метрика UI).
- [ ] T079 [P] Обновить канонический документ `07-build-specifications/analytics-measurement-spec.md` — синхронизировать с реальностью v1 (отмечен список реализованных событий, ENV-переменные, ссылки на спеку 058 и goal-mapping.md).

### Manual Setup (post-implementation)

- [ ] T080 **Manual**: в UI Метрики создать цели согласно списку в spec.md FR-050 (rfq_submit, add_to_cart, begin_checkout, purchase, document_download, phone_click, email_click, filter_apply, search, qualified_visit, price_request_click + остальные v1-релевантные); записать Goal-ID в `goal-mapping.md` (T078).
- [ ] T081 **Manual**: в UI Метрики настроить составные цели (FR-051): «Покупка детальная», «RFQ», «Документы», «B2B запрос цены».
- [ ] T082 **Manual**: в UI Метрики создать 3 обязательных сегмента из FR-200 для v1: «Добавил в корзину, не купил», «Юрлицо» (`user_type=legal_entity`), «Совершил ≥1 покупку за 90 дней»; записать Metrika-Segment-ID в `AnalyticsSettings.retargetingSegments`.
- [ ] T083 **Manual**: в UI Метрики включить опцию «первичные cookie» (Counter Settings → Privacy → First-party cookies — R7); настроить DNS CNAME `mc.<домен>` → `mc.yandex.ru` (если домен подключён); валидировать на Safari.

### Validation

- [ ] T084 Запустить `pnpm --filter @soliton/web test:analytics:unit` — все тесты зелёные (≥80% coverage по FR-001…FR-019 + FR-110…FR-125 + FR-280…FR-281 + FR-320).
- [ ] T085 Выполнить полностью quickstart.md (шаги 1-9) на локальном dev-окружении с тестовым счётчиком Метрики → все Acceptance Summary SC из quickstart §«Acceptance Summary» зелёные.
- [ ] T086 Запустить `pnpm --filter @soliton/web report:analytics:weekly --week=<текущая> --dry-run` — MD-output корректный (все секции, нет undefined/NaN); затем без `--dry-run` — файл создан в `06-reports/analytics/`.
- [ ] T087 [P] Обновить root `CLAUDE.md` и `apps/web/AGENTS.md`: добавить карту новых модулей `lib/analytics/{attribution,server-tracker,visit-context,pii-filter,env-marker,customer-link,consent-banner-events}.ts`, новой коллекции `Annotations`, нового Global `AnalyticsSettings`. Указать команды `pnpm test:analytics:unit` и `pnpm report:analytics:weekly`.

**Checkpoint v1 launch**: все 87 задач завершены, smoke-test зелёный, quickstart end-to-end проходит, weekly-отчёт генерируется. Готово к production-deploy.

---

## Dependencies

### Между фазами

```text
Phase 1 (Setup) — нет зависимостей
  └── Phase 2 (Foundational) — блокирующая
        ├── Phase 3 (US1 — Funnel)              [P1] ──┐
        ├── Phase 4 (US2 — Attribution)         [P1] ──┤
        ├── Phase 5 (US8 — SEO classification)  [P1] ──┤ ── эти 3 могут идти в параллель
        │                                              │
        │   (US1 + US2 generate данных для US5)        │
        │           ↓                                  │
        ├── Phase 6 (US5 — Weekly report)       [P2] ──┤
        ├── Phase 7 (US3 — Micro-conversions)   [P2] ──┤
        ├── Phase 8 (US4 — Adblock)             [P2] ──┤ ── завязан на server-tracker из US2
        ├── Phase 9 (US7 — Cohort data)         [P3] ──┤
        └── Phase 10 (US6 — Privacy & PII)      [P3] ──┘
              └── Phase 11 (Polish) — последняя
```

### Внутри фаз — критические зависимости

- **Phase 2**: T010 (generate types) **обязательно** после T005-T009 (schema changes); T017 (events.ts) **обязательно** после T013 (pii-filter) + T020 (AnalyticsContextProvider).
- **Phase 3 (US1)**: T035 (tests) — после всех T026-T034.
- **Phase 4 (US2)**: T040 (Order paid hook) — после T037 (endpoint) и T036 (server-tracker).
- **Phase 6 (US5)**: T053 (CLI integration) — после T048-T052.
- **Phase 11**: T080-T083 (manual setup) после T077-T078 (operator-guide и goal-mapping существуют); T084-T086 (validation) — последними.

---

## Parallel Execution Examples

### Phase 2 (Foundational) — массивная параллелизация:

```text
[P] T005 Carts schema       │
[P] T006 Orders schema      │ ── одновременно (разные файлы collections)
[P] T007 Customers schema   │
[P] T008 Annotations new    │
[P] T009 AnalyticsSettings  │
       ↓ (затем последовательно)
    T010 Generate types

[P] T012 env-marker.ts      │
[P] T013 pii-filter.ts      │ ── одновременно (разные модули, нет depends)
[P] T014 attribution.ts     │
[P] T015 visit-context.ts   │
[P] T016 customer-link.ts   │
[P] T021 consent-banner ev  │
       ↓ (зависят от выше)
    T017 events.ts extend
    T018 data-layer.ts extend
       ↓
    T019 AnalyticsScripts extend
    T020 ContextProvider
       ↓
    T022 CookieConsentBanner extend
    T023 middleware extend

[P] T024 vitest.config      │ ── одновременно
[P] T025 test-helpers       │
```

### Phase 3 (US1) — все компоненты параллельно:

```text
[P] T026 ProductListing     │
[P] T027 ProductCard        │
[P] T028 ProductDetail      │
[P] T029 RfqCart            │ ── разные компоненты, нет depends
[P] T030 PhysicalCheckout   │
[P] T031 LegalCheckout      │
       ↓
    T032 ReviewClient (depends on payment-method выбора)
    T033 PaymentReturnClient
    T034 RetryPaymentButton
       ↓
[P] T035 Smoke-test         │
```

### Полное распараллеливание:

После Phase 2 теоретически можно запустить **Phase 3, 5, 7, 9, 10 в параллель** (5 разных команд / агентов), а Phase 4 запускается параллельно с одним из них (использует server-tracker из Phase 2). Phase 6 ждёт чтобы Phase 3+4 произвели хоть какие-то данные, либо использует mock-data для тестов.

---

## Implementation Strategy

### MVP First (рекомендуемый incremental delivery)

1. **Iteration 1 (~5-7 дней)**: Phase 1 + Phase 2 (T001-T025). После этого фундамент готов.
2. **Iteration 2 (~3-5 дней)**: Phase 3 (US1) только — воронка покупки работает, можно демонстрировать заказчику drop-off по шагам checkout. **Deployable as MVP-α**.
3. **Iteration 3 (~3-4 дня)**: Phase 4 (US2) + Phase 5 (US8) параллельно — атрибуция и SEO-классификация. После: можно запускать первую рекламную кампанию с измерением ROI. **Deployable as MVP-β**.
4. **Iteration 4 (~3-4 дня)**: Phase 6 (US5) — weekly-отчёт. После: владелец получает понедельничный срез. **Deployable as v1-RC1**.
5. **Iteration 5 (~3-4 дня)**: Phase 7-10 (US3, US4, US6, US7) — параллельно. **Deployable as v1-RC2**.
6. **Iteration 6 (~1-2 дня)**: Phase 11 (Polish + manual setup + validation). **Production launch**.

**Total realistic estimate**: ~3-4 недели работы одного разработчика для полного v1.

### Альтернатива: «всё-в-один-релиз»

Все 90 задач за ~4 недели подряд, релиз один. Минус: длинный feedback-loop, дольше до production-launch. Плюс: меньше regression-risk при coordinated rollout.

**Рекомендую первый вариант (incremental)** — спека 058 спроектирована именно под него (см. `## Scope Phases` в spec.md).

---

## Summary

- **Total tasks**: **90** (T001-T087 + T088-T090 добавлены при post-analyze remediation 2026-05-26)
- **By phase**:
  - Phase 1 (Setup): 5 tasks (включая T088 forms-inventory)
  - Phase 2 (Foundational): 21 tasks
  - Phase 3 (US1 Funnel): 10 tasks
  - Phase 4 (US2 Attribution): 10 tasks (включая T089, T090 offline-conversion)
  - Phase 5 (US8 SEO): 4 tasks
  - Phase 6 (US5 Weekly report): 8 tasks
  - Phase 7 (US3 Micro-conversions): 11 tasks
  - Phase 8 (US4 Adblock): 2 tasks (basis в US2)
  - Phase 9 (US7 Cohort): 5 tasks
  - Phase 10 (US6 Privacy): 3 tasks
  - Phase 11 (Polish): 11 tasks
- **Parallel opportunities**: ~26 [P] tasks (могут идти попарно/параллельно)
- **Suggested MVP-α scope**: T001-T035 + T088 (Phase 1+2+3 + forms-inventory) — воронка покупки работает end-to-end
- **Manual setup tasks**: T041, T080-T083 (UI Метрики + DNS) — НЕ автоматизируются
- **Format validation**: ✅ все 90 задач имеют checkbox `- [ ]`, ID, Story-label (где применимо), file path
- **Post-analyze remediation (2026-05-26)**: добавлены T088 (forms inventory для FR-014 conditional, F5), T089-T090 (Yandex Metrika offline-conversion FR-033/FR-034 для US2, F4). См. Clarifications «Session 2026-05-26» в spec.md.
- **NOT in this tasks.md (v1.1/v1.2)**: Webmaster/GSC API integration, retry-очередь, HTML admin-rendering, Playwright e2e, auto-deploy annotations, scroll_depth, print/copy, Я.Директ ROAS auto-import (отличается от offline-conversion!), goal webhook, custom crawl-error logging, ecommerce.impressions, search_refinement, Web Vitals параметры, выходные сегменты (5 из 8).
