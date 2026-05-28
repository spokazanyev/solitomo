---
description: "Task list for ApiShip — поддержка любого перевозчика (064)"
---

# Tasks: ApiShip — поддержка любого перевозчика (064)

**Input**: Design documents from `/specs/064-apiship-any-carrier/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Включены целевые unit-тесты (`delivery-channel.ts`) — явно заданы в plan.md (Testing) и research.md (R7); плюс обновление существующего `handover-validation.test.ts` под новую форму payload. Полноценный TDD-suite не запрашивался; интеграция проверяется ручным smoke (quickstart.md).

**Organization**: Задачи сгруппированы по user story (US1/US2) для независимой поставки. На проде нет реальных заказов → миграция без backfill, обратной совместимости старых значений не требуется.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно выполнять параллельно (другой файл, нет зависимостей от незавершённых задач)
- **[Story]**: к какой user story относится задача
- Все пути — от корня репозитория

## Path Conventions

Монорепо Next.js + Payload: код в `apps/web/src/`. Тесты — рядом, в `__tests__/` (Vitest). Миграции — в `apps/web/src/migrations/`, регистрируются в `migrations/index.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Подготовка окружения. Новых npm-зависимостей нет; ApiShip-rate уже несёт `providerName` (`mappers.ts`).

- [X] T001 Подтвердить готовность окружения: миграции применяются через `pnpm --filter @soliton/web migrate` (autopush off в prod), Vitest доступен (`pnpm --filter @soliton/web test`), новых npm-зависимостей не требуется (plan.md Technical Context). Зафиксировать, что `ShippingRate.providerName` уже заполняется в `apps/web/src/lib/shipping/apiship/mappers.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Схема БД + чистый хелпер канала — нужны и US1 (запись), и US2 (чтение/рендер). Должно быть завершено до начала US1/US2.

**⚠️ CRITICAL**: Никакая работа над историями не начинается до завершения этой фазы.

- [X] T002 Создать миграцию `apps/web/src/migrations/20260528_064_delivery_channel.ts` (data-model.md §1, research.md R3): `up` — `ALTER COLUMN delivery_method TYPE text`, `DROP TYPE IF EXISTS enum_orders_delivery_method`, `ADD COLUMN IF NOT EXISTS delivery_channel text`, `ADD COLUMN IF NOT EXISTS delivery_provider_name text`; idempotent; `down` — best-effort (drop новых колонок). Backfill НЕ нужен (нет данных).
- [X] T003 Зарегистрировать новую миграцию в `apps/web/src/migrations/index.ts` (import + запись в массив `migrations` после `20260528_add_invoice_footer_note`). Зависит от T002.
- [X] T004 Обновить группу `delivery` в `apps/web/src/collections/Orders.js` (data-model.md §1): добавить `channel` (`select`, опции `pickup`/`service`/`own_carrier`), добавить `providerName` (`text`); изменить `method` с `select` (enum-опции) на `type: "text"` (открытое, транзитный алиас). Зависит от T002.
- [X] T005 Перегенерировать типы Payload: `pnpm --filter @soliton/web generate:types` — `payload-types.ts` отражает `delivery.channel`/`delivery.providerName`/`method:text`. Зависит от T004.
- [X] T006 [P] Экспортировать `providerNameFromKey` из `apps/web/src/lib/shipping/apiship/mappers.ts` (сейчас приватная) для переиспользования хелпером (Principle VI — без дубля карты). Независимо от схемы.
- [X] T007 Создать `apps/web/src/lib/shipping/delivery-channel.ts` (data-model.md §2): тип `DeliveryChannel`, `normalizeDeliveryChannel(input)` (валидация присланного channel + вывод из полей как страховка, R5), `resolveProviderName(providerName, providerKey)` (имя → `providerNameFromKey(key)` → key → «служба доставки», FR-006). Зависит от T006.
- [X] T008 [P] Unit-тест `apps/web/src/lib/shipping/__tests__/delivery-channel.test.ts` по таблице правил из data-model.md §2: service-перевозчик вне трёх прежних, ПВЗ/курьер, pickup, own_carrier, пустой/`unknown` providerKey, отсутствующий channel (вывод). Зависит от T007.

**Checkpoint**: Схема и хелпер готовы — можно начинать истории.

---

## Phase 3: User Story 1 — Клиент оформляет заказ с любым доступным перевозчиком (Priority: P1) 🎯 MVP

**Goal**: Любой перевозчик ApiShip (не только СДЭК/Boxberry/Почта) оформляется со стоимостью (не 0) и полными данными доставки — в обоих чекаутах (карта/физлицо и счёт/юрлицо).

**Independent Test**: На чекауте выбрать перевозчика вне прежнего набора (напр. Деловые Линии), оформить заказ и убедиться, что сохранены: стоимость (>0), `providerKey`/`providerName`, тип (ПВЗ/курьер), адрес ПВЗ или доставки, сроки. Контракт: `contracts/orders-delivery-payload.md`.

### Implementation for User Story 1

- [X] T009 [US1] Переписать обработку доставки в `apps/web/src/app/api/orders/route.ts` (contracts/orders-delivery-payload.md, data-model.md §3): удалить `METHOD_WHITELIST`, `isApiShipMethod`-по-списку-3, soft-map `tc→own_carrier`; `channel = normalizeDeliveryChannel(body.delivery)`; `isService = channel === "service"`; `deliveryCost = isService ? Math.max(0, cost) : 0` (FR-004); для `service` сохранять полный блок ApiShip + `providerName = resolveProviderName(...)`; `delivery.method = channel` (алиас); валидацию `handoverNote` (pickup ≥5 / own_carrier ≥10 / ≤1000) переключить с `method` на `channel`. Зависит от T007, T004.
- [X] T010 [P] [US1] В `apps/web/src/components/cart/InvoiceCheckoutForm.tsx` (contracts/orders-delivery-payload.md «Frontend obligations»): в режиме `apiship` слать `channel: "service"` + `providerName: rate.providerName` (сохранить `providerKey` и блок); режим own_carrier → `channel: "own_carrier"`; pickup → `channel: "pickup"`. Заменить отправку `method: rate.providerKey` на `channel`. Зависит от T004 (типы — после T005).
- [X] T011 [P] [US1] В `apps/web/src/app/(site)/cart/checkout/physical/review/page.tsx` расширить `orderPayload.delivery`: слать `channel: "service"` + полный блок ApiShip из `draft.rate` (`providerKey, providerName, tariffId, deliveryType, pickupType, pointId, pointAddress, cost, etaMinDays, etaMaxDays, addressNormalized`) — сейчас шлётся только `method/address/city/cost`, из-за чего блок терялся даже для cdek (FR-002/FR-010). Зависит от T004.
- [X] T012 [US1] Обновить `apps/web/src/app/api/orders/__tests__/handover-validation.test.ts` под новую форму payload: использовать `channel` вместо `method`-маппинга `tc→own_carrier`; сохранить проверки handoverNote (pickup/own_carrier) и что для service `deliveryCost` не обнуляется. Зависит от T009.

**Checkpoint**: US1 функциональна и тестируема независимо — любой перевозчик оформляется с сохранением данных в обоих чекаутах. MVP.

---

## Phase 4: User Story 2 — Корректное отображение перевозчика и доставки в счёте и админке (Priority: P2)

**Goal**: PDF-счёт, карточка заказа и `me/orders` показывают имя службы (или код-fallback), тип (ПВЗ/курьер) и адрес для любого перевозчика; pickup/own_carrier — прежний блок без перевозчика.

**Independent Test**: Для заказа с произвольным перевозчиком открыть PDF-счёт и карточку — видны корректные служба/тип/адрес; для неизвестного кода — запасной текст без ошибок. Контракт: `contracts/invoice-delivery-render.md`. (Тестируется на заказе из US1 либо созданном в админке.)

### Implementation for User Story 2

- [X] T013 [US2] В `apps/web/src/app/api/invoice/[orderId]/route.ts` (contracts/invoice-delivery-render.md): выводить `isPickup`/`isOwnCarrier`/`isService` из `o.delivery.channel` (страховочный нормалайз при отсутствии); `carrierLabel` — приоритет `providerName` → `providerKey` → «служба доставки» (убрать зависимость от `CARRIER_LABELS`-карты как основного пути); рендерить блок «Доставка» (служба/тип/адрес ПВЗ или доставки/срок) для любого `service`; pickup/own_carrier — прежний блок «Примечания»/склад. Зависит от T004 (channel/providerName в схеме).
- [X] T014 [P] [US2] В `apps/web/src/app/(site)/cart/order/[token]/page.tsx` заменить вывод `{o.delivery?.method}` на человекочитаемое: `providerName` для `service`, понятная подпись канала для `pickup`/`own_carrier`. Зависит от T004.
- [X] T015 [P] [US2] В `apps/web/src/app/api/customers/me/orders/route.ts` добавить `channel` и `providerName` в объект delivery ответа (поле `method` остаётся алиасом — shape не ломается). Зависит от T004.

**Checkpoint**: US1 + US2 работают независимо; любой перевозчик корректно сохраняется и отображается.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T016 [P] Прогнать `pnpm typecheck` и `pnpm lint` (из корня) — strict-режим без ошибок.
- [X] T017 [P] Прогнать `pnpm --filter @soliton/web test` — `delivery-channel.test.ts` + обновлённый `handover-validation.test.ts` зелёные.
- [ ] T018 Ручной smoke по `quickstart.md` (S1–S7): заказ с перевозчиком вне трёх прежних от юрлица (S1) и физлица (S3), ПВЗ vs курьер (S2), PDF/карточка (S4), неизвестный/пустой код (S5), pickup/own_carrier (S6), denylist (S7).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей.
- **Foundational (Phase 2)**: после Setup; блокирует истории (схема + хелпер — общие).
- **US1 (Phase 3)**: после Foundational.
- **US2 (Phase 4)**: после Foundational; для полноценной проверки удобно иметь данные из US1, но US2 независимо тестируема на заказе, созданном в админке.
- **Polish (Phase 5)**: после нужных историй.

### Within Foundational

- T002 → T003 (регистрация миграции) ; T002 → T004 (схема) → T005 (типы).
- T006 (export) → T007 (хелпер) → T008 (тест). T006/T008 помечены [P] относительно ветки схемы.

### Within US1

- T009 (route) — после T007/T004. T010 и T011 — разные файлы, [P], после типов (T005). T012 (тест) — после T009.

### Within US2

- T013 (PDF), T014 (order page), T015 (me/orders) — разные файлы, [P] между собой; все после T004.

### Same-file constraints (НЕ параллелить)

- Каждая задача US1/US2 правит свой отдельный файл — конфликтов нет. `Orders.js` (T004) и `migrations/*` (T002/T003) — в Foundational, до историй.

### Parallel Opportunities

- T006 ∥ ветка схемы (T002→T005).
- T008 (unit-тест хелпера) ∥ после T007.
- US1: T010 ∥ T011 (InvoiceCheckoutForm ∥ physical review page).
- US2: T013 ∥ T014 ∥ T015 (три разных файла-читателя).
- Polish: T016 ∥ T017.
- После Foundational US1 и US2 можно вести параллельно разными исполнителями.

---

## Parallel Example: старт после Foundational

```bash
# US1 (ветка A): T009 → (T010 ∥ T011) → T012
Task: "Send channel+providerName in InvoiceCheckoutForm.tsx"          # T010
Task: "Send channel+full ApiShip block in physical/review/page.tsx"   # T011

# US2 (ветка B, параллельно A):
Task: "Render delivery by channel in invoice/[orderId]/route.ts"      # T013
Task: "Show providerName/channel in cart/order/[token]/page.tsx"      # T014
Task: "Add channel+providerName to me/orders response"                # T015
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1).
2. **STOP & VALIDATE**: любой перевозчик оформляется со стоимостью и данными (SC-001/SC-002) в обоих чекаутах. Демо-готово.

### Incremental Delivery

1. Setup + Foundational → схема + хелпер.
2. US1 → независимый тест → демо (MVP: любой перевозчик оформляется).
3. US2 → отображение в PDF/админке/карточке → тест.
4. Polish → typecheck/lint/test/smoke.

---

## Notes

- [P] = разные файлы, нет зависимостей от незавершённых задач.
- Миграция чистая (enum→text), без сохранения старых значений и без backfill — на проде нет реальных заказов (spec Assumptions «Хранилище»).
- Перевозчик хранится как открытый `providerKey` + `providerName`; канал — закрытый `channel`. `method` остаётся как транзитный алиас канала.
- Создание отправлений (`toOrderRequest`) уже принимает произвольный `providerKey` — вне scope.
- Коммитить после каждой задачи или логической группы.
