# Implementation Plan: ApiShip — поддержка любого перевозчика (064)

**Branch**: `064-apiship-any-carrier` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/064-apiship-any-carrier/spec.md`

## Summary

Снять жёсткую привязку чекаута и заказа к трём перевозчикам (СДЭК/Boxberry/Почта). Сейчас `POST /api/orders` прогоняет `delivery.method` через `METHOD_WHITELIST`, а блок данных ApiShip (`providerKey`, тип, ПВЗ, адрес, сроки) и стоимость сохраняются только при `method ∈ {cdek, boxberry, russian-post}` — любой другой перевозчик теряет стоимость (`deliveryCost=0`) и данные.

Технический подход: **развязать «канал доставки» (closed) и «перевозчика» (open)**. Вводим закрытое поле `delivery.channel ∈ {pickup, service, own_carrier}` как единственный драйвер поведения; перевозчик хранится в существующем открытом `delivery.providerKey` + новом `delivery.providerName` (человекочитаемое имя). Postgres-enum `enum_orders_delivery_method` конвертируется в `text` (на проде нет реальных заказов → чистая смена схемы без сохранения значений). Бэкенд перестаёт фильтровать перевозчика по списку: для `channel === "service"` сохраняет полный блок ApiShip и стоимость для **любого** `providerKey`. Оба чекаута (card/physical и invoice/legal) шлют `channel` + блок; PDF-счёт, карточка заказа и админка читают `channel` + `providerName` (fallback на код).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20.x (Next.js 16 runtime)

**Primary Dependencies**: Next.js 16 (App Router, RSC), React 19, Payload CMS v3, Drizzle ORM, `@payloadcms/db-postgres`, `pdfkit` (PDF-счёт). Существующие модули: `@/lib/shipping/*` (ApiShip provider + `providerNameFromKey`, спека 047), `@/components/cart/{InvoiceCheckoutForm,PhysicalCheckoutForm}`, `@/components/checkout/ReviewClient`, `@/app/api/invoice/[orderId]/route.ts` (PDF), `@/app/api/orders/route.ts`.

**Storage**: PostgreSQL через Payload v3 (Drizzle adapter). Существующая таблица `orders`, группа `delivery`. Изменения: enum `enum_orders_delivery_method` → `text`; новые колонки `delivery.channel` (text/enum), `delivery.provider_name` (text). Formal migration в `apps/web/src/migrations/` (`payload migrate`, autopush off в prod).

**Testing**: Vitest (`pnpm --filter @soliton/web test`). Целевые unit-тесты на чистый хелпер нормализации канала/перевозчика; интеграция — ручной smoke (quickstart.md). Существующий `handover-validation.test.ts` обновить под новую форму payload.

**Target Platform**: Web (SSR + RSC), prod — Docker на VPS `pdumarket-prod`, деплой `deploy/push.sh` + `payload migrate`.

**Project Type**: Web-application (монорепо `apps/web`).

**Performance Goals**: N/A — не меняет нагрузочный профиль; то же число вызовов ApiShip/БД, что и сейчас.

**Constraints**: На проде **нет реальных заказов** → допустима чистая смена схемы без миграции данных (см. spec Assumptions «Хранилище»). Обратная совместимость старых значений `delivery.method` НЕ требуется.

**Scale/Scope**: ~6 затронутых файлов + 1 миграция + 1 unit-тест. Перевозчиков — открытый набор от ApiShip; каналов — 3 (фиксировано).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Specification-First** — ✅ spec.md + requirements-checklist пройдены; план следует за спекой.
- **II. SEO/Demand** — ✅ N/A: фича затрагивает checkout/order/админку/PDF, публичных индексируемых страниц и schema.org не касается.
- **III. B2B/RFQ first, B2C second** — ✅ FR-010 обязывает поддержать оба сценария: оплата картой (физлицо, `PhysicalCheckoutForm`/`ReviewClient`) и выставление счёта (юрлицо, `InvoiceCheckoutForm`). Оба входят в scope плана.
- **IV. Integrations isolated & observable** — ✅ Логика ApiShip остаётся в `@/lib/shipping/*`; `providerName` берётся из существующего `providerNameFromKey`. Бэкенд не хардкодит перевозчиков. Никаких новых секретов; ошибки маппинга деградируют в fallback-текст без сбоев.
- **V. Analytics & Search Control** — ✅ Шаг выбора доставки уже инструментирован (`shipping_mode_changed` + выбор тарифа несёт `providerKey`/`providerName`). Новый funnel-шаг не вводится — фича устраняет дефект существующего шага. Новых обязательных событий нет; при правке формы сохраняем текущие emit'ы.
- **VI. Maintainable by Codex** — ✅ Явная типизация, закрытый `channel` + открытый `providerKey`/`providerName`, чистый хелпер нормализации, formal migration в репозитории. Без скрытой логики в админ-настройках.
- **VII. Quality gates** — ✅ `pnpm typecheck`/`lint`/`test` + ручной PDF/checkout smoke (quickstart). Миграция безопасна к повтору (idempotent).

**Result: PASS** (no violations; Complexity Tracking не заполняется).

## Project Structure

### Documentation (this feature)

```text
specs/064-apiship-any-carrier/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── orders-delivery-payload.md   # POST /api/orders delivery contract
│   └── invoice-delivery-render.md   # PDF/admin rendering contract
├── checklists/
│   └── requirements.md  # (from /speckit-specify)
└── tasks.md             # /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
apps/web/src/
├── app/
│   ├── api/
│   │   ├── orders/route.ts                      # CHANGE: убрать METHOD_WHITELIST/isApiShipMethod-гейт; ввести channel; сохранять блок+cost для любого providerKey
│   │   └── invoice/[orderId]/route.ts           # CHANGE: isPickup/isOwnCarrier/isService по channel; carrierLabel → providerName-first
│   └── (site)/cart/
│       ├── checkout/physical/review/page.tsx    # CHANGE: orderPayload.delivery — слать channel + полный ApiShip-блок (FR-002/FR-010)
│       └── order/[token]/page.tsx               # CHANGE: показывать providerName/channel вместо сырого method
├── components/cart/
│   └── InvoiceCheckoutForm.tsx                  # CHANGE: слать channel (из shippingMode) + providerName
├── collections/
│   └── Orders.js                                # CHANGE: delivery.channel (select, closed) + delivery.providerName (text); method → text (open)
├── lib/shipping/
│   └── delivery-channel.ts                      # NEW: чистый хелпер normalizeDeliveryChannel + carrier-name resolve (тестируемый)
├── migrations/
│   └── 20260528_064_delivery_channel.ts         # NEW: enum_orders_delivery_method → text; +channel +provider_name
└── lib/shipping/__tests__/
    └── delivery-channel.test.ts                 # NEW: unit-тест хелпера
```

**Structure Decision**: Монорепо `apps/web` (Next.js 16 + Payload v3). Изменения локализованы в shipping/orders/invoice-слое; новый чистый хелпер `delivery-channel.ts` инкапсулирует решение «канал↔перевозчик», чтобы и API, и формы, и PDF использовали одну логику (Principle IV/VI).

## Complexity Tracking

> Конституционных нарушений нет — таблица не заполняется.
