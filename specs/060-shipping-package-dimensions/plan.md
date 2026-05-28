# Implementation Plan: Учёт реального веса и габаритов товаров при расчёте доставки

**Branch**: `060-shipping-package-dimensions` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/060-shipping-package-dimensions/spec.md`

## Summary

Заменить дефолтные (1.5 кг, 30×20×15 см, qty игнорируется) физические параметры посылок в расчёте доставки реальными значениями, заданными для каждого товара в каталоге. Технический подход: расширить Payload-коллекцию `products` опциональной группой `physicalPackaging` (масса в граммах + 3 измерения в миллиметрах) с валидацией; протянуть эти поля через cart-snapshot и `/api/shipping/calculate` в `apiship/mappers.ts` где placeholder-логика `items.map → places[]` заменяется на `flatMap` с экспансией по `quantity`; дефолтные значения из `apiship-settings.defaults` остаются как fallback на уровне маппера. Та же экспансия и тот же источник истины применяется в `toOrderRequest` (создание waybill после оплаты) — расчёт и реальная отгрузка не должны расходиться.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime)

**Primary Dependencies**: Next.js 16 (App Router + RSC), React 19, Payload CMS v3, Drizzle ORM, @payloadcms/db-postgres, Vitest для тестов

**Storage**: PostgreSQL через Payload v3 (Drizzle adapter). Новые опциональные колонки в существующей таблице `products` через formal migration в `apps/web/src/migrations/` — на проде используется `payload migrate` (autopush выключен в production).

**Testing**: Vitest для unit-тестов мапперов (`apps/web/src/lib/shipping/apiship/__tests__/mappers.test.ts` уже существует). Integration smoke-test через `pnpm --filter @soliton/web test` + ручная проверка в админке Payload и через POST /api/shipping/calculate.

**Target Platform**: Linux server (Docker, deploy через `deploy/push.sh` на TimeWeb VPS pdumarket.ru)

**Project Type**: Web application monorepo. Single Next.js app (`apps/web/`) + Payload CMS интегрирован как часть того же приложения.

**Performance Goals**:
- Расчёт доставки в чекауте: ответ /api/shipping/calculate за 1–3 секунды (зависит от ApiShip API, ~700ms сетевой round-trip + наш middleware). Не должно вырасти после изменений.
- Сохранение товара в админке: операция уровня PUT в Payload — мгновенно (≤500ms).
- Cache-hit на cart с уже посчитанной доставкой: ≤50ms (Drizzle SELECT по уникальному ключу).

**Constraints**:
- **Не сломать существующие 66 товаров** без физических параметров — поля strictly optional; runtime-fallback на дефолты из `apiship-settings`.
- **Не сломать существующие заказы** (есть production-данные в коллекциях `orders`, `carts`) — миграция только ADD COLUMN, никаких alter существующих.
- **Не увеличить нагрузку на ApiShip** — экспансия по quantity делает массив `places` длиннее, но это легитимная нагрузка (СДЭК всё равно ждёт массив мест). Кеш расчёта уже хеширует items с quantity и physical.
- **Production push schema**: dev делает auto-push, prod использует formal migration (см. `deploy/push.sh` step 5c: `payload migrate`).

**Scale/Scope**:
- 66 опубликованных товаров в каталоге сейчас (растёт по мере импортов).
- Средняя корзина — 1–3 SKU, qty 1–5. Pathological cases (10+ qty, 5+ SKU) поддерживаются, но не оптимизируются.
- 4 файла изменяются: 1 collection schema, 1 type definitions, 2 frontend форм checkout, 1 mapper, 1 migration. Около 100–200 строк изменений.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Specification-First Development — ✅ PASS
Спецификация записана в `spec.md`, прошла quality checklist без NEEDS CLARIFICATION. План создаётся на её основе через формальный workflow.

### II. SEO And Demand Are Product Requirements — ✅ PASS (N/A)
Фича не затрагивает публичные страницы, метаданные, sitemap, JSON-LD, URL-структуру. Изменения только в admin-CMS (карточка товара) и в backend-логике расчёта доставки.

### III. B2B/RFQ First, B2C Checkout Second — ✅ PASS
RFQ-flow физические параметры товаров не использует (запросы коммерческого предложения идут через ручную работу менеджера). Фича улучшает B2C checkout, но не ослабляет B2B: оба flow идут через одну и ту же коллекцию `products`, новые поля опциональны, RFQ продолжает работать без них.

### IV. Integrations Must Be Isolated And Observable — ✅ PASS
Интеграция с ApiShip уже изолирована в `apps/web/src/lib/shipping/apiship/` через `ApiShipProvider`. Все изменения вносятся внутри этого модуля (mappers.ts) — UI-код, формы checkout, и API-routes не знают деталей формирования `places` для перевозчика.

Логирование расчётов уже работает через `logRequest` / `logError` в `apiship/logger.ts` — будет видна полная картина запроса с реальными размерами.

### V. Analytics And Search Control Are Required — ✅ PASS (N/A)
Фича не добавляет новые конверсионные события и не меняет существующие. Стоимость доставки уже отражается в `ecommerce.purchase` событии (через `shipping` поле data layer) — после фичи будет реалистичнее, но событие то же.

### VI. Code Must Stay Maintainable By Codex — ✅ PASS
- Новые поля имеют typed contract в Payload collection + автогенерация в `payload-types.ts` + ручной TS-type в `CartItemForShipping`. Все изменения через типизированные интерфейсы, без скрытой бизнес-логики.
- Migration в `src/migrations/` — переиграть/откатить можно стандартным `payload migrate:down`.
- Дефолтные значения остаются в `apiship-settings` global — единственный источник fallback-значений, не размазан по коду.

### VII. Quality Gates Before Release — ✅ PASS
- Unit-тест mapper'а (`mappers.test.ts`): расширяется случаями quantity expansion + fallback на дефолты + смешанные корзины.
- Smoke-test: ручная проверка в админке (заполнение поля → расчёт в checkout) + автоматическая через E2E если есть.
- Type-check (`pnpm typecheck`) и lint (`pnpm lint`) обязательны.
- Secrets не задействованы — никаких новых API ключей.

### Result: ALL GATES PASS — переход к Phase 0 разрешён.

## Project Structure

### Documentation (this feature)

```text
specs/060-shipping-package-dimensions/
├── plan.md                  # This file
├── spec.md                  # Feature specification (done)
├── research.md              # Phase 0 output (this command creates it)
├── data-model.md            # Phase 1 output
├── quickstart.md            # Phase 1 output
├── contracts/               # Phase 1 output
│   ├── product-physical-fields.md
│   ├── shipping-calculate-request.md
│   └── mappers-internal-contract.md
├── checklists/
│   └── requirements.md      # done (specify phase)
└── tasks.md                 # Phase 2 output (NOT created by this command)
```

### Source Code (repository root)

Project is a single Next.js + Payload monorepo. Real layout:

```text
apps/web/
├── src/
│   ├── collections/
│   │   └── Catalog.js                              # ← добавить группу physicalPackaging
│   ├── migrations/
│   │   └── YYYYMMDDHHMMSS_add_product_physical.ts  # ← новый файл
│   ├── lib/
│   │   └── shipping/
│   │       ├── types.ts                            # ← расширить CartItemForShipping
│   │       └── apiship/
│   │           ├── mappers.ts                      # ← quantity expansion + real dims
│   │           └── __tests__/
│   │               └── mappers.test.ts             # ← новые test cases
│   ├── components/
│   │   ├── cart/
│   │   │   └── PhysicalCheckoutForm.tsx            # ← items.map → включить physical
│   │   └── checkout/
│   │       ├── CheckoutShippingClient.tsx          # ← items.map → включить physical
│   │       └── DeliveryBlock.tsx                   # ← extend CartItem interface
│   └── payload-types.ts                            # autogen (pnpm generate:types)
└── tests/
    └── (если будут integration tests)

deploy/
└── push.sh                                         # без изменений (migrate уже в pipeline)
```

**Structure Decision**: используем существующий monorepo `apps/web/` без новых пакетов или каталогов верхнего уровня. Фича затрагивает 3 слоя одного приложения (Payload collection, lib/shipping mapper, checkout UI), все изменения локализованы в существующих модулях.

## Complexity Tracking

> Constitution Check прошёл без violations. Раздел оставлен пустым — нет компромиссов, требующих обоснования.

## Post-Design Constitution Re-check

*Выполнено после генерации research.md, data-model.md, contracts/, quickstart.md.*

| Принцип | Pre-design | Post-design | Комментарий |
|---|---|---|---|
| I. Spec-First | ✅ | ✅ | Все артефакты на месте: spec, plan, research, data-model, contracts, quickstart, checklist. |
| II. SEO | ✅ N/A | ✅ N/A | Дизайн не вводит публичных URL/страниц. |
| III. B2B/RFQ first | ✅ | ✅ | RFQ-flow подтверждённо не затрагивается (см. R1 — изменения только на Product, читаются только в /api/shipping/calculate B2C-флоу). |
| IV. Integrations isolated | ✅ | ✅ | Все изменения внутри `apps/web/src/lib/shipping/apiship/` + 1 enrichment-блок в `/api/shipping/calculate/route.ts`. Никаких касаний UI-кода checkout. |
| V. Analytics | ✅ N/A | ✅ N/A | `ecommerce.purchase` event поле `shipping` уже отдаёт корректную сумму — теперь будет реалистичнее, событие то же. |
| VI. Maintainable by Codex | ✅ | ✅ | Typed CartItemForShipping, formal migration, unit-tests запланированы. |
| VII. Quality gates | ✅ | ✅ | quickstart.md покрывает manual smoke + 5 unit-test cases scaffold в contracts. |

**Post-design verdict**: ALL GATES PASS. Готов к Phase 2 (`/speckit-tasks`).
