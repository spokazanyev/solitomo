# Implementation Plan: Behavior & Ad Analytics

**Branch**: `058-behavior-and-ad-analytics` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/058-behavior-and-ad-analytics/spec.md`

## Summary

Сквозная аналитика поведения и эффективности рекламы. Основной инструмент — Яндекс.Метрика, GA4 — secondary. Реализация **поэтапная** (см. `## Scope Phases` в spec.md): v1 (MVP-Lite) даёт недельный MD-отчёт, отвечающий на 4 главных вопроса бизнеса (где провалы воронки / какая реклама окупается / что чинить в SEO / не нарушаем ли закон); v1.1 добавляет автоинтеграцию Webmaster/GSC, retry-очередь, HTML-админ-страницу, Playwright-слой smoke-теста; v1.2 — оптимизация под существенный трафик.

**Технический подход v1**:
- Расширение существующих модулей `apps/web/src/lib/analytics/*` (loader, events, data-layer из спеки 057): добавление новых event-helpers (~30 функций), параметры визита, attribution-cookie, server-side tracker (только для `purchase`).
- Расширение Payload-коллекций: новые поля в `Carts`, `Orders`, `Customers` (UTM/yclid/first_seen_at/legal-entity-flag/time_to_purchase_days), новая Global `AnalyticsSettings`, новая коллекция `Annotations` (для ручных и будущих авто-аннотаций).
- Расширение существующих компонентов: `<ConsentBanner>` (события accept/decline), `<PhoneNumber>` (call-tracking ready), формы (form_field_error), checkout (step-events).
- Скрипт `pnpm report:analytics:weekly` — Node-CLI, тащит данные из API Метрики, генерирует MD в `06-reports/analytics/YYYY-WW.md`.
- Smoke-тест `pnpm test:analytics:unit` — vitest+jsdom, валидирует структуру `dataLayer` push'ей и отсутствие ПДн.
- Operator-guide и DSAR-runbook — MD-артефакты в `06-reports/analytics/`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20.x runtime (Next.js 16 default).

**Primary Dependencies**:
- Next.js 16 (App Router, RSC), React 19 — public site + админ-routes.
- Payload CMS v3 (admin, collections, hooks, audit log).
- Drizzle ORM + PostgreSQL — через `@payloadcms/db-postgres`.
- Tailwind CSS — UI.
- `vitest` 2.x + `jsdom` — unit-тесты и jsdom-слой smoke-теста (уже в dev-deps).
- Существующий `lib/analytics/{cookie-consent,analytics-loader,events,data-layer}.ts` из спеки 057.

**Storage**: PostgreSQL через Payload v3. Новые поля на существующих коллекциях (`Carts`, `Orders`, `Customers`), новая коллекция `Annotations`, новая Global `AnalyticsSettings`. Никаких отдельных аналитических БД — Метрика хранит исторические данные у себя.

**Testing**:
- v1 — `vitest run` (юнит + jsdom-слой smoke-теста).
- v1.1 — добавится Playwright (отдельный `playwright.config.ts`, `e2e/` директория).

**Target Platform**: web (production deploy — публичный сайт на Next.js, hosted; admin-route защищён Payload).

**Project Type**: web (фронт + бэк в одном Next.js монорепо `apps/web`).

**Performance Goals**:
- Event push в `dataLayer` — <5 ms на 95-м перцентиле (не должно увеличивать TTI).
- Серверный хит в Метрику — fire-and-forget, не блокирует основную операцию; sync-timeout не больше 1.5 s (затем фоновое продолжение в v1.1 retry-очереди).
- Weekly-report script — формирование за <60 s при нормальной доступности API Метрики.
- Smoke-test (jsdom) — полный прогон <30 s в CI.

**Constraints**:
- Никаких ПДн в payload событий (FR-062): фильтр на каждой точке отправки.
- `transaction_id` идемпотентен — дедупликация между client/server hit'ами (FR-114).
- Все секреты только в env (FR-100, Q3 clarified): ротация = redeploy.
- Cookie-консент opt-in (наследие 057): без консента — никакой инициализации Метрики/GA4 и никаких серверных хитов (исключение — already-paid Order).
- Storage cookie `_solitomo_first_seen` и attribution-cookie — first-party, SameSite=Lax, Secure, HttpOnly=false (нужны на клиенте для построения event'ов).

**Scale/Scope**:
- v1 launch: ожидаемые ~50-500 уникальных визитов/день, 0-10 заказов/неделя в первый месяц.
- Каталог: 66 SKU (по seed), 11 категорий — стабильно растёт.
- ~95 функциональных требований в spec; **v1 покрывает ~70 FR** (см. `## Scope Phases`).
- Single-developer team (svp); 2-3 недели realistic для полного v1.

## Constitution Check

Проверено против `.specify/memory/constitution.md` v1.1.0:

| Принцип | Соответствие | Заметка |
|---|---|---|
| **I. Specification-First Development** | ✅ Pass | Спека прошла `/specify` → `/clarify` (5 Q→A) → теперь `/plan`. Все необходимые секции заполнены. |
| **II. SEO And Demand Are Product Requirements** | ✅ Pass | US8 и FR-230-262 (отложены до v1.1, но в scope спеки) явно требуют интеграции Webmaster/GSC. v1 покрывает SEO через `cluster`-параметр визита (FR-021), реферер-классификацию (FR-240-242), ссылки на Webmaster/GSC в weekly-отчёте. |
| **III. B2B/RFQ First, B2C Checkout Second** | ✅ Pass | RFQ-воронка отдельная (FR-051, US1.acceptance.2), B2B-сигналы (FR-190-192: price/stock/ИНН) — в v1, hybrid `user_type=legal_entity` (Clarification Q1) корректно отделяет B2B-сегмент. |
| **IV. Integrations Must Be Isolated And Observable** | ✅ Pass | Все внешние интеграции (Метрика API, Webmaster API, GSC API, Я.Директ cost import) обёрнуты в отдельные модули `lib/analytics/*-client.ts`. Логирование в admin audit log (FR-103). Идемпотентность через `transaction_id` (FR-114). |
| **V. Analytics And Search Control Are Required** | ✅ Pass | Эта спека и есть реализация принципа V. События `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, `rfq_submit`, `invoice_request_submit` (если форма есть), `phone_click`, `email_click`, `document_download` — все в v1. |
| **VI. Code Must Stay Maintainable By Codex** | ✅ Pass | TypeScript-strict, event-helpers в типизированных модулях (`lib/analytics/events.ts`), goal-mapping и operator-guide как MD-артефакты в `06-reports/analytics/`. Никаких настроек, влияющих на бизнес-смысл, скрыто в админке — только не-секретные конфиги через Payload Globals (FR-101). |
| **VII. Quality Gates Before Release** | ✅ Pass | Smoke-test (jsdom) на каждом PR, блокирует merge при регрессии (FR-291). Goal-mapping artifact синхронизирован с кодом (FR-292-293). Webvisor исключает ПДн (FR-060). Секреты не в git (FR-100). |

**Gate decision (initial)**: ✅ **PASS — конституция соблюдена**. Никаких violations. Complexity Tracking не требуется.

**Gate decision (post-design, 2026-05-25)**: ✅ **PASS** — после генерации research.md, data-model.md, contracts/, quickstart.md повторная проверка показала: ни один из 7 принципов конституции не нарушен. Decisions из research.md (двойной dataLayer-формат R1, first-party cookies R7, vitest-jsdom для smoke R8, PII-filter R10, MD-source-of-truth R12, DSAR runbook R13) находятся в полном соответствии с принципами IV (изолированные интеграции через `lib/analytics/*` модули), V (analytics required + verifiable through goal-mapping + smoke-test), VI (typed contracts + MD-documentation close to code), VII (smoke-test as quality gate). Никаких новых нарушений.

## Project Structure

### Documentation (this feature)

```text
specs/058-behavior-and-ad-analytics/
├── plan.md                       # этот файл
├── research.md                   # Phase 0 output
├── data-model.md                 # Phase 1 output
├── quickstart.md                 # Phase 1 output
├── contracts/                    # Phase 1 output
│   ├── analytics-events.md       # типизированные event-helpers
│   ├── server-hit-endpoint.md    # POST /api/analytics/server-hit
│   ├── annotations-api.md        # POST /api/analytics/annotations
│   ├── weekly-report-cli.md      # pnpm report:analytics:weekly
│   └── dsar-runbook.md           # 152-ФЗ procedure
├── checklists/
│   └── requirements.md           # уже создан /specify
└── tasks.md                      # Phase 2 (/speckit-tasks output, не из /plan)
```

### Source Code (apps/web — Next.js + Payload monorepo)

Реальная структура apps/web (наследует спеку 057):

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── (site)/                          # публичные страницы (RSC)
│   │   │   └── layout.tsx                   # ▶ расширение: env=production marker + first-party cookie config
│   │   ├── admin/
│   │   │   ├── analytics/                   # 🆕 v1.1: HTML-rendering weekly-отчёта (defer)
│   │   │   └── annotations/                 # 🆕 v1: ручной ввод аннотаций (Payload Custom View)
│   │   └── api/
│   │       ├── analytics/
│   │       │   ├── server-hit/route.ts      # 🆕 v1: серверный дубль purchase (FR-040)
│   │       │   ├── annotations/route.ts     # 🆕 v1: POST аннотации (FR-161)
│   │       │   └── webhook-goal/route.ts    # 🆕 v1.1: Метрика goal-webhook (FR-330)
│   │       └── cron/
│   │           └── analytics-hit-queue/     # 🆕 v1.1: retry для FR-310 (defer)
│   ├── collections/
│   │   ├── Carts.ts                         # ▶ расширение: utm, yclid, gclid, acquisition_channel, acquisition_query, first_seen_at
│   │   ├── Orders.js                        # ▶ расширение: utm copy from Cart, time_to_purchase_days, visit_count_to_purchase
│   │   ├── Customers.ts                     # ▶ расширение: firstSeenAt (для hybrid fallback)
│   │   ├── Annotations.ts                   # 🆕 v1: ручные аннотации деплоев/кампаний/инцидентов
│   │   └── AnalyticsHitQueue.ts             # 🆕 v1.1: retry-очередь (defer)
│   ├── globals/
│   │   └── AnalyticsSettings.ts             # 🆕 v1: не-секретные конфиги (bot-pattern list, referrer-host-patterns, qualified_visit threshold, brand-keywords, soft404-markers, retargeting-segment-IDs)
│   ├── components/
│   │   ├── analytics/
│   │   │   ├── AnalyticsScripts.tsx         # ▶ расширение: UserID для авторизованных (FR-150)
│   │   │   └── ScrollDepthTracker.tsx       # 🆕 v1.1: defer
│   │   ├── checkout/
│   │   │   ├── PhysicalCheckoutForm.tsx     # ▶ расширение: step-events FR-120-125
│   │   │   ├── LegalCheckoutForm.tsx        # ▶ расширение: step-events + INN validation event
│   │   │   └── ReviewClient.tsx             # ▶ расширение: checkout_step_review, cta_pay_clicked
│   │   ├── consent/
│   │   │   └── CookieConsentBanner.tsx      # ▶ расширение: consent_banner_shown, accepted, declined events
│   │   ├── phone/
│   │   │   └── TrackedPhone.tsx             # 🆕 v1: компонент-обёртка для call-tracking ready (FR-140-142)
│   │   ├── product/
│   │   │   ├── ProductCard.tsx              # ▶ расширение: select_item event with position
│   │   │   ├── ProductDetail.tsx            # ▶ расширение: view_item ecommerce + price_view OR price_request_click + stock_status_view
│   │   │   └── ProductListing.tsx           # ▶ расширение: view_item_list (FR-002)
│   │   ├── rfq/
│   │   │   ├── RfqCart.tsx                  # ▶ расширение: remove_from_cart (FR-010)
│   │   │   └── RfqForm.tsx                  # ▶ расширение: form_field_error, INN validation
│   │   └── search/
│   │       └── SiteSearchBar.tsx            # ▶ расширение: search + search_no_results (FR-130-131) — если поиск существует
│   ├── lib/
│   │   ├── analytics/
│   │   │   ├── analytics-loader.ts          # уже есть, без изменений
│   │   │   ├── cookie-consent.ts            # уже есть, без изменений
│   │   │   ├── events.ts                    # ▶ расширение: ~25 новых event-helper'ов
│   │   │   ├── data-layer.ts                # ▶ расширение: ecommerce-объект (FR-110-115)
│   │   │   ├── attribution.ts               # 🆕 v1: read/write UTM cookies, classify referrer
│   │   │   ├── server-tracker.ts            # 🆕 v1: server-side hit для Метрики MP
│   │   │   ├── visit-context.ts             # 🆕 v1: page_type, cluster, user_type вычисление
│   │   │   ├── pii-filter.ts                # 🆕 v1: scrub email/phone/inn из event params
│   │   │   ├── env-marker.ts                # 🆕 v1: production / staging / development tagging
│   │   │   ├── consent-banner-events.ts     # 🆕 v1: events for shown/accepted/declined
│   │   │   ├── customer-link.ts             # 🆕 v1: UserID для авторизованных
│   │   │   └── tests/
│   │   │       ├── events.test.ts           # 🆕 v1: jsdom-слой smoke-теста (FR-290 slot 1)
│   │   │       ├── data-layer.test.ts
│   │   │       ├── attribution.test.ts
│   │   │       ├── pii-filter.test.ts
│   │   │       └── server-tracker.test.ts
│   │   └── annotations/
│   │       └── client.ts                    # 🆕 v1: чтение/запись аннотаций
│   └── middleware.ts                        # ▶ расширение: env-marker headers, env-leakage guard
├── scripts/
│   ├── report-analytics-weekly.mjs          # 🆕 v1: CLI для weekly-отчёта (FR-090)
│   └── test-analytics-smoke.mjs             # 🆕 v1: orchestrator для smoke-тестов
└── e2e/                                     # 🆕 v1.1: Playwright (defer)

# Артефакты в корне проекта
06-reports/analytics/                        # 🆕 v1: канонические артефакты
├── operator-guide.md                        # FR-220 — глоссарий + чек-лист маркетолога
├── goal-mapping.md                          # FR-292 — event → metrika_goal_id → business_meaning
├── dsar-runbook.md                          # FR-350 — 152-ФЗ procedure
├── annotations.md                           # FR-161 — ручные аннотации (если без Payload)
└── YYYY-WW.md                               # FR-092 — weekly-reports по неделям

07-build-specifications/
└── analytics-measurement-spec.md            # ▶ обновляется по итогам 058 (canonical reference)
```

**Structure Decision**: Используется **существующая монорепо-структура `apps/web/`** (Next.js + Payload в одном пакете). Это согласовано со всеми предыдущими спеками 047-057. Никаких новых пакетов или микросервисов — все аналитические модули добавляются как библиотеки внутри `lib/analytics/` и компоненты в `components/analytics/`. Серверные эндпоинты — стандартные Next.js Route Handlers под `app/api/analytics/`. CLI-скрипты — Node.js ESM-модули в `apps/web/scripts/`, запускаются через `pnpm --filter @soliton/web <script>`.

Канонические артефакты документации (operator-guide, goal-mapping, dsar-runbook, weekly-reports) лежат в корне проекта в `06-reports/analytics/` — это согласовано со существующим паттерном (там же `06-reports/audits/`).

## Complexity Tracking

> Заполняется только при наличии нарушений Constitution Check. Нарушений нет — таблица не заполняется.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (нет нарушений) | — | — |
