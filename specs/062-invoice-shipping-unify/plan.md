# Implementation Plan: Унификация выбора доставки в чекауте юрлица

**Branch**: `062-invoice-shipping-unify` | **Date**: 2026-05-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/062-invoice-shipping-unify/spec.md`

## Summary

Цель — заменить примитивный hardcoded `<select>` в [InvoiceCheckoutForm.tsx](../../apps/web/src/components/cart/InvoiceCheckoutForm.tsx) на полнофункциональный 3-режимный выбор доставки, переиспользующий уже отлаженный механизм из физлицового чекаута (047): `AddressForm` с DaData + `DeliveryBlock` с ApiShip-тарифами и `PointSelector`. Дополнительно — учёт B2B-специфики: режим «Транспортной компанией покупателя» с обязательным `handoverNote` (название ТК, договор, контакт), режим «Самовывоз» с авто-предзаполнением получателя из реквизитов.

PDF-счёт ([invoice/[orderId]/route.ts](../../apps/web/src/app/api/invoice/[orderId]/route.ts)) дополняется блоком «Примечания» для режимов `pickup` и `own_carrier`; для ApiShip-тарифов сохраняется существующее поведение строки «Доставка». Серверный API ([/api/orders/route.ts](../../apps/web/src/app/api/orders/route.ts)) принимает новое поле `delivery.handoverNote`, расширяет whitelist enum-значений, проксирует ApiShip-поля (как у физлица), и валидирует обязательность `handoverNote` для `pickup`/`own_carrier`.

В рамках унификации терминологии (см. clarif Q5) выполняется однократная idempotent data-migration `delivery.method = 'tc' → 'own_carrier'` через [apps/web/src/migrations/](../../apps/web/src/migrations/), а Payload-схема [Orders.js](../../apps/web/src/collections/Orders.js) обновляется: enum-option `tc → own_carrier`, новое опциональное поле `handoverNote` (textarea, ≤1000 символов, остаётся редактируемым после `paid` — исключение из 051 immutability, см. clarif Q3).

Аналитика 058 расширяется одним новым событием `shipping_mode_changed` с параметром `mode ∈ {pickup, apiship, own_carrier}` и `checkout_type='legal'`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime)

**Primary Dependencies**: Next.js 16 (App Router, RSC), React 19, Payload CMS v3, Drizzle ORM, `@payloadcms/db-postgres`, `pdfkit` (для PDF-генерации), `libphonenumber-js`, `lucide-react`. Уже существующие модули: `@/components/checkout/{AddressForm,DeliveryBlock,PointSelector,DadataSuggestInput,PhoneInput}`, `@/components/cart/OrderSummaryCard`, `@/lib/shipping/*` (ApiShip provider от 047), `@/lib/consent/make-consent-record` (от 057), `@/lib/analytics/{events,data-layer}` (от 058), `@/lib/company/get-company-contacts` (для адреса склада).

**Storage**: PostgreSQL через Payload v3 (Drizzle adapter). Существующая таблица `orders` — добавляется одно опциональное поле `delivery.handoverNote` (textarea, ≤1000 символов) + миграция значения enum `delivery.method`: `tc → own_carrier`. Никаких новых таблиц.

**Testing**: Vitest для unit-тестов utility-функций (нормализация `delivery.method`, валидация `handoverNote`); React Testing Library для компонента `InvoiceCheckoutForm` (smoke-тест трёх режимов и валидации кнопки); manual visual smoke на двух итоговых PDF-счетах (ApiShip / own_carrier+pickup) — за владельцем.

**Target Platform**: Browser (UI чекаута) + Node.js серверный runtime (Next.js API routes + Payload). Поддерживаемые браузеры — современные desktop + mobile (как у текущего чекаута, 046-mobile-friendly-refresh).

**Project Type**: Web application — Next.js monorepo (`apps/web/`). НЕ соответствует placeholder-шаблону `backend/frontend/` из CLAUDE.md — реальный layout `apps/web/src/{components,app,lib,collections,migrations}`.

**Performance Goals**:
- ApiShip-расчёт стоимости — наследуется от 047 (debounce 400ms, p95 ≤ 2 сек до показа тарифов).
- PDF-генерация счёта — ≤ 500 мс на стороне сервера (наследуется от текущего pdfkit-pipeline).
- Submit формы (`POST /api/orders`) — p95 ≤ 800 мс (как у физлица).

**Constraints**:
- Backward compat: legacy-заказы с `method='tc'` должны рендериться корректно до прохождения миграции (FR-062-51).
- Иммутабельность 051 НЕ блокирует `handoverNote` — этого требует операционная гибкость (исключение, FR-062-61).
- Никаких изменений API ApiShip (`/api/shipping/calculate`), payment-flow (055), CRM-sync (048), email-шаблонов (049, T-002-invoice).
- Адрес склада берётся из `getCompanyContacts()` (поле `actualAddress`, fallback на `legalAddress`, fallback на «уточнит менеджер»).

**Scale/Scope**:
- Затрагивается 1 форма (`InvoiceCheckoutForm`), 1 API-эндпоинт (`/api/orders`), 1 PDF-генератор (`/api/invoice/[orderId]`), 1 Payload-коллекция (`Orders`), 1 миграция.
- Affected LOC по предварительной оценке: ~400 строк (UI), ~80 строк (API + миграция), ~30 строк (PDF).
- Влияет на 100% B2B-чекаутов после релиза (нет feature-flag — изменение поведения).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Обоснование |
|---------|--------|-------------|
| **I. Specification-First Development** | ✅ Pass | Спека `spec.md` готова, прошла `/speckit-clarify` (5 принятых решений). Этот `plan.md` — следующий обязательный шаг. |
| **II. SEO And Demand Are Product Requirements** | ✅ Pass (N/A) | Изменения только в авторизованной зоне чекаута (`/cart/checkout/invoice/` — `robots: noindex, nofollow`, FR из 056). Никакого SEO-impact, JSON-LD на форме не используется. |
| **III. B2B/RFQ First, B2C Checkout Second** | ✅ Pass (alignment) | Эта фича прямо усиливает B2B-flow: даёт корпоративному закупщику онлайн-расчёт и явный режим «своя ТК по договору» — типичную B2B-потребность. Физлицовый flow не меняется. |
| **IV. Integrations Must Be Isolated And Observable** | ✅ Pass | Используем существующий провайдер `@/lib/shipping/*` (047) через `/api/shipping/calculate` — изоляция сохранена. Никаких прямых вызовов ApiShip-SDK из UI. Webhook handlers не затронуты. |
| **V. Analytics And Search Control Are Required** | ✅ Pass | Добавлено событие `shipping_mode_changed` (FR-062-40), сохранено `add_shipping_info`/`checkout_step_shipping`/`checkout_step_payment_method` (058). DataLayer-параметры специфицированы (см. contracts/analytics-events.md в Phase 1). |
| **VI. Code Must Stay Maintainable By Codex** | ✅ Pass | Code-first: типизированные поля в Payload-схеме, обновление spec/plan/tasks. Нет admin-only-настроек, поведение реконструируется из репозитория. handoverNote — обычное `textarea` поле, не custom-component. |
| **VII. Quality Gates Before Release** | ⚠ Conditional Pass | Smoke-тест 3 режимов + 2 типов PDF — manual за владельцем. Unit-тесты на serialize/normalize `delivery`. Миграция тестируется на staging-DB. Регрессионная проверка: existing-orders PDF без визуальных изменений (SC-062-06). |

**Дополнительные технические ограничения проекта**:
- `pnpm typecheck` и `pnpm lint` обязаны проходить на ветке перед merge.
- `pnpm --filter @soliton/web test` проходит на новых unit-тестах.
- Миграция запускается через `payload migrate` (autopush выключен в production, см. CLAUDE.md по 060).

**Violations**: нет. Все принципы либо удовлетворены, либо N/A для этой фичи.

### Post-design re-check (после Phase 1)

После генерации [research.md](./research.md), [data-model.md](./data-model.md), `contracts/*`, [quickstart.md](./quickstart.md):

| Принцип | Re-check | Notes |
|---------|----------|-------|
| I. Spec-First | ✅ | Все артефакты на месте: spec/plan/research/data-model/contracts/quickstart. |
| II. SEO/Demand | ✅ N/A | Подтверждено: чекаут `noindex,nofollow`. |
| III. B2B/RFQ First | ✅ | Усилен: 3 явных B2B-режима, операционная гибкость через handoverNote. |
| IV. Integrations Isolated | ✅ | `@/lib/shipping/*` остаётся единственной точкой ApiShip. |
| V. Analytics Required | ✅ | [contracts/analytics-events.md](./contracts/analytics-events.md) полный: schema, PII-check, GA4 + Метрика mapping. |
| VI. Maintainable by Codex | ✅ | data-model, contracts, quickstart — всё в репозитории. Никаких admin-only решений. |
| VII. Quality Gates | ✅ | quickstart.md содержит UI + API + admin + PDF smoke. Unit-тесты на validation. Pre-merge baseline check для миграции. |

**Final verdict**: 0 violations, можно идти на `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/062-invoice-shipping-unify/
├── plan.md                          # Этот файл
├── research.md                      # Phase 0: research-выводы (Q1-Q5 уже разрешены в spec.md → плюс технические вопросы)
├── data-model.md                    # Phase 1: схема изменений Order.delivery + миграция enum
├── quickstart.md                    # Phase 1: dev-smoke сценарий (3 режима + 3 PDF)
├── contracts/
│   ├── api-orders-post.md           # Расширение POST /api/orders (новый handoverNote, normalized method)
│   ├── api-invoice-get.md           # Расширение GET /api/invoice/[orderId] (блок «Примечания» в PDF)
│   └── analytics-events.md          # Новое событие shipping_mode_changed (DataLayer schema)
├── checklists/
│   └── requirements.md              # Готово после /speckit-specify + /speckit-clarify
└── tasks.md                         # Phase 2 output (создаётся /speckit-tasks)
```

### Source Code (repository root)

Реальный layout проекта — Next.js + Payload CMS monorepo, **НЕ** placeholder `backend/frontend/` из шаблона.

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── (site)/cart/checkout/invoice/
│   │   │   └── page.tsx                          # без изменений (только обёртка)
│   │   └── api/
│   │       ├── orders/route.ts                   # ИЗМЕНЯЕМ: enum whitelist, handoverNote, serverside validation
│   │       └── invoice/[orderId]/route.ts        # ИЗМЕНЯЕМ: блок «Примечания» для pickup/own_carrier, скрытие строки «Доставка»
│   ├── components/
│   │   ├── cart/
│   │   │   ├── InvoiceCheckoutForm.tsx           # ОСНОВНЫЕ ИЗМЕНЕНИЯ: 3 radio-режима + DeliveryBlock в режиме ApiShip
│   │   │   └── OrderSummaryCard.tsx              # без изменений (используем существующий showDeliveryLine prop)
│   │   └── checkout/
│   │       ├── AddressForm.tsx                   # переиспользуем как есть
│   │       ├── DeliveryBlock.tsx                 # переиспользуем как есть
│   │       └── PointSelector.tsx                 # переиспользуем как есть
│   ├── collections/
│   │   └── Orders.js                             # ИЗМЕНЯЕМ: delivery.handoverNote + enum rename tc→own_carrier + immutability exception
│   ├── lib/
│   │   ├── analytics/
│   │   │   └── events.ts                         # ИЗМЕНЯЕМ: добавить trackShippingModeChanged
│   │   ├── company/
│   │   │   └── get-company-contacts.ts           # без изменений (используется как есть)
│   │   └── lifecycle/
│   │       ├── immutability.ts                   # без изменений (R1: frozen-set approach уже разрешает handoverNote)
│   │       └── events.ts                         # ИЗМЕНЯЕМ: новый event-type `delivery_note_updated` (R2)
│   └── migrations/
│       └── 20260527_rename_method_tc_to_own_carrier.ts   # НОВЫЙ: idempotent rename
└── tests/                                        # Vitest unit + integration
    └── checkout/
        └── invoice-shipping-modes.test.ts        # НОВЫЙ: 3 режима + валидация + serialize
```

**Structure Decision**: Используется реальный layout `apps/web/`. Никаких новых директорий не создаётся — все изменения локализованы в существующих модулях. Никаких новых пакетов в монорепо. Никакого выноса в shared-packages — `InvoiceCheckoutForm` остаётся feature-specific, переиспользуется только публичный API `<DeliveryBlock>` и `<AddressForm>`.

## Complexity Tracking

> Нет нарушений конституции. Этот раздел не заполняется.

Все архитектурные решения соответствуют принципам:
- Изоляция интеграций (IV): провайдер ApiShip за `/lib/shipping/*`, никаких прямых вызовов.
- Maintainability (VI): стандартные Payload-поля + публичные React-компоненты + Vitest. Нет «магических» паттернов.
- Quality gates (VII): unit-тесты на serialize/normalize, manual smoke на UI и PDF.

**Особое замечание по 051 immutability exception**:
- FR-062-61 (handoverNote редактируется после `paid`) — официально документированное исключение из immutability-guard.
- **Реализация не требует правок `immutability.ts`**: guard использует frozen-set approach (`FROZEN_FIELDS` ⊂ Order). Поскольку `delivery.handoverNote` не в этом списке, оно автоматически разрешено к редактированию после `paid` (см. [research.md R1](./research.md#r1)).
- Все изменения логируются через существующий `Order.history.array` (actor email + timestamp + previous/new value) — audit-trail сохраняется (см. [research.md R2](./research.md#r2)).
- Это **не** нарушение конституции, потому что операционная необходимость задокументирована (Q3 clarif → FR-062-61) и затрагивает только нефинансовое поле.
