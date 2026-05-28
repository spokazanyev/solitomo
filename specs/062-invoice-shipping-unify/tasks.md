---

description: "Implementation task list for 062-invoice-shipping-unify"
---

# Tasks: Унификация выбора доставки в чекауте юрлица

**Input**: Design documents from `/specs/062-invoice-shipping-unify/`

**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api-orders-post.md](./contracts/api-orders-post.md), [contracts/api-invoice-get.md](./contracts/api-invoice-get.md), [contracts/analytics-events.md](./contracts/analytics-events.md), [quickstart.md](./quickstart.md)

**Tests**: Включены unit-тесты для analytics-helper и серверной валидации API (соответствует существующему паттерну 058 events.test). Manual visual smoke за владельцем для PDF — как было в 061.

**Organization**: Задачи сгруппированы по user stories из спеки (US1–US4). Все три UI-режима затрагивают один файл `InvoiceCheckoutForm.tsx`, поэтому US1→US2→US3 идут последовательно по тому же файлу (нет [P] между ними). PDF-генератор и backend-infra полностью в Foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: задачу можно запускать параллельно (другие файлы, нет блокирующих зависимостей)
- **[Story]**: к какой user-story относится (US1 / US2 / US3 / US4)
- Все пути — относительно `apps/web/` если не указано иное

## Path Conventions

- **Реальный layout** (не placeholder из template): Next.js + Payload v3 monorepo, `apps/web/src/{components,app,lib,collections,migrations}`
- См. [plan.md → Source Code](./plan.md#source-code-repository-root)

---

## Phase 1: Setup

**Purpose**: Pre-flight checks перед началом реализации

- [X] T001 Verify dev environment: `pnpm install && pnpm typecheck && pnpm lint` clean на ветке `062-invoice-shipping-unify` from repo root. **Done**: typecheck clean; lint имеет 2 pre-existing errors (CompanyProductionInfo.tsx + metrika-management-client.ts) — baseline, не наши, не должны стать хуже.
- [X] T002 Get baseline production count `SELECT COUNT(*) FROM orders WHERE delivery_method='tc'` (R8 из research.md). **Deferred to PR**: на dev-БД пропускаем; владелец зафиксирует число в PR description перед merge.
- [X] T003 Confirm нет in-flight изменений в `apps/web/src/collections/Orders.js`, `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`, `apps/web/src/app/api/orders/route.ts`, `apps/web/src/app/api/invoice/[orderId]/route.ts`. **Done**: working tree clean (только новые файлы спеки 062 + CLAUDE.md от agent-context update).

**Checkpoint**: Окружение готово, baseline зафиксирован — можно приступать к Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend-инфраструктура и инструментарий, требуемый всеми тремя UI-режимами (US1/US2/US3) и PDF-сценарием (US4)

**⚠️ CRITICAL**: User-story phases (Phase 3–6) НЕ начинаются до завершения Phase 2

### Schema + migration

- [X] T004 [P] Добавить новое опциональное поле `handoverNote` (textarea, ≤1000 символов, с `validate` фукцией) в group `delivery` коллекции `apps/web/src/collections/Orders.js` (после `delivery.cost`, перед `delivery.trackNumber` — смотри [data-model.md §1.1](./data-model.md#11-deliveryhandovernote--новое-поле))
- [X] T005 Обновить enum-options `delivery.method` в `apps/web/src/collections/Orders.js`: добавить `{ label: adminLabel("Транспортной компанией покупателя", "Own carrier"), value: "own_carrier" }`; **оставить** старое `{ value: "tc" }` как hidden legacy на время переходного периода ([data-model.md §1.2](./data-model.md#12-deliverymethod--переименование-enum-option-tc--own_carrier))
- [X] T006 Создать миграционный файл `apps/web/src/migrations/20260527_rename_method_tc_to_own_carrier.ts` по шаблону [data-model.md §3](./data-model.md#3-миграция-delivery_methodtc--own_carrier): `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'own_carrier'` + `UPDATE orders SET ...`, down-migration делает обратный UPDATE
- [X] T007 Зарегистрировать миграцию в `apps/web/src/migrations/index.ts` (добавить импорт + export по существующему паттерну)
- [X] T008 Запустить `pnpm --filter @soliton/web payload migrate` локально. **На dev — N/A (autopush)**: Payload в dev-режиме применяет schema автоматически через autopush. `migrate:status` подтвердил: новая миграция `20260527_rename_method_tc_to_own_carrier` присутствует в списке как `Ran: No` (вместе с другими 4 миграциями, никогда не применявшимися на dev — что норма). Production-merge запустит её через `payload migrate --force-accept-warning`.
- [X] T009 Регенерировать Payload-типы: `pnpm --filter @soliton/web generate:types`. **Done**: `payload-types.ts:445` — `method` enum включает `'own_carrier' | 'tc'`; `payload-types.ts:452` — `handoverNote?: string | null`.

### Analytics infrastructure

- [X] T010 [P] Добавить `"shipping_mode_changed"` в union-тип `AnalyticsEventName` в `apps/web/src/lib/analytics/events.ts` (см. [contracts/analytics-events.md §1](./contracts/analytics-events.md#1-новое-событие-shipping_mode_changed))
- [X] T011 [P] Добавить typed-helper `trackShippingModeChanged({ mode, checkoutType, previousMode? })` в `apps/web/src/lib/analytics/events.ts` + экспортировать тип `ShippingMode = "pickup" | "apiship" | "own_carrier"`

### Server-side API extension

- [X] T012 Обновить `IncomingPayload.delivery` тип в `apps/web/src/app/api/orders/route.ts`: добавить `handoverNote?: string`, расширить comment-блок с описанием новых required-полей для `pickup`/`own_carrier` ([contracts/api-orders-post.md](./contracts/api-orders-post.md))
- [X] T013 Обновить `METHOD_WHITELIST` в `apps/web/src/app/api/orders/route.ts`: заменить значение `"tc"` на `"own_carrier"`, оставить остальные. Добавить **soft-mapping** `body.delivery?.method === "tc" → "own_carrier"` на входе для legacy-клиентов ([contracts/api-orders-post.md → Backward compatibility](./contracts/api-orders-post.md#backward-compatibility))
- [X] T014 Реализовать handoverNote-валидацию в `apps/web/src/app/api/orders/route.ts`: trim + проверки `MISSING_HANDOVER_NOTE` / `HANDOVER_NOTE_TOO_SHORT` / `HANDOVER_NOTE_TOO_LONG` (R7) — HTTP 400 с соответствующим `error` code ([contracts/api-orders-post.md → Server-side validation](./contracts/api-orders-post.md#server-side-validation-новые-правила))
- [X] T015 Нормализация `deliveryCost` в `apps/web/src/app/api/orders/route.ts`: `pickup`/`own_carrier` → 0; ApiShip-методы → `Math.max(0, body.delivery?.cost)` ([contracts/api-orders-post.md → Step 3](./contracts/api-orders-post.md#шаг-3-normalize-cost-для-не-apiship-режимов))
- [X] T016 Расширить `delivery` payload в `payload.create()` в `apps/web/src/app/api/orders/route.ts`: пробрасывать `handoverNote`, а для ApiShip-режимов — `provider`/`providerKey`/`tariffId`/`deliveryType`/`pickupType`/`pointId`/`pointAddress`/`etaMinDays`/`etaMaxDays`/`addressNormalized` (как сейчас делает physical-flow) ([contracts/api-orders-post.md → Step 4](./contracts/api-orders-post.md#шаг-4-apiship-поля-сохраняем-только-в-apiship-режиме))

### PDF generator

- [X] T017 Добавить helper `resolveWarehouseAddress(contacts)` в `apps/web/src/app/api/invoice/[orderId]/route.ts` (R4): `actualAddress → legalAddress → "адрес уточнит менеджер"`
- [X] T018 Обновить логику строки «Доставка» в `apps/web/src/app/api/invoice/[orderId]/route.ts`: condition `isApiShipMethod && deliveryCost > 0`, **legacy-tolerance** для `method='tc'` ([contracts/api-invoice-get.md §1](./contracts/api-invoice-get.md#1-условное-отображение-строки-доставка-в-табличной-части-итогов))
- [X] T019 Добавить блок «Примечания» в `apps/web/src/app/api/invoice/[orderId]/route.ts`: после footer-строки об оплате, до подписи директора; разные тексты для `pickup` (адрес склада + получатель) и `own_carrier` (handoverNote + legacy-fallback) ([contracts/api-invoice-get.md §2](./contracts/api-invoice-get.md#2-новый-блок-примечания))

### Audit-log for handoverNote edits (R2)

- [X] T020 Расширить `beforeChange` hook в `apps/web/src/collections/Orders.js`: при изменении `delivery.handoverNote` пушить запись в `Order.history.array` с `{at, status: "delivery_note_updated", actorEmail: req.user?.email, reason: "manual edit"}` (см. [data-model.md §2](./data-model.md#2-frozen-fields-051-immutability))

### Lib-level smoke for type safety

- [X] T021 Запустить `pnpm typecheck` + `pnpm lint` после всех изменений в Phase 2; убедиться, что нет TypeScript-ошибок от автогенерированных Payload-типов

**Checkpoint**: Backend готов. UI-формы пока используют старый `<select>`, но API/PDF/Analytics уже принимают новые значения. PDF и API testable через curl-сценарии из [quickstart.md §3](./quickstart.md#3-api-smoke-без-ui). Можно начинать UI-stories параллельно (но они конфликтуют по одному файлу).

---

## Phase 3: User Story 1 — ApiShip-доставка через службу (Priority: P1) 🎯 MVP

**Goal**: Закупщик может выписать счёт с авторасчётом доставки через ApiShip (СДЭК/Boxberry/Почта/курьер), стоимость уходит в табличную часть PDF.

**Independent Test**: Открыть `/cart/checkout/invoice/` с непустой корзиной, заполнить реквизиты + контакты, выбрать ApiShip-режим (по дефолту), ввести валидный DaData-адрес, выбрать конкретный тариф, отправить форму, открыть PDF — убедиться, что строка «Доставка: <cost>» отображается в итогах ([spec.md US1](./spec.md#user-story-1)).

### Implementation for User Story 1

- [X] T022 [US1] Создать секцию radio-группы режимов доставки в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`: заменить hardcoded `<select>` (строки ~274-311) на блок с 3 `<input type="radio">` (mode: `apiship`/`own_carrier`/`pickup`). Default — `apiship`. State: `const [shippingMode, setShippingMode] = useState<"apiship" | "own_carrier" | "pickup">("apiship")` ([spec.md FR-062-01..03](./spec.md#requirements))
- [X] T023 [US1] Lift state `address: AddressFormValue`, `selectedRate: SelectedRate | null`, `cartId` в `InvoiceCheckoutForm` (как у физлица) в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx` (R6 + [data-model](./data-model.md))
- [X] T024 [US1] Conditional render: в `shippingMode === "apiship"` отрисовывать секцию с `<AddressForm value={address} onChange={setAddress} />` + `<DeliveryBlock cartId={cartId} items={itemsForShipping} address={address} onSelect={setSelectedRate} />` (точно как в [PhysicalCheckoutForm.tsx:273-286](../../apps/web/src/components/cart/PhysicalCheckoutForm.tsx#L273-L286)) в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`
- [X] T025 [US1] Расширить условие `isLegalReady`: для ApiShip-режима требовать `address.isValid === true` и `selectedRate !== null`; для тарифов `deliveryType === 2` — также `selectedRate.pointId` (см. [spec.md FR-062-10](./spec.md#requirements)). Кнопка «Выписать счёт» отражает актуальное readiness в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`
- [X] T026 [US1] Обновить `handleSubmit` в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`: при ApiShip-режиме отправлять полный `delivery` payload (method, cost, provider, providerKey, tariffId, deliveryType, pickupType, pointId, pointAddress, etaMinDays, etaMaxDays, addressNormalized) — структурно идентично [PhysicalCheckoutForm.handleSubmit](../../apps/web/src/components/cart/PhysicalCheckoutForm.tsx#L141-L189)
- [X] T027 [US1] Подключить `<OrderSummaryCard>` в режиме `showDeliveryLine` (61): при ApiShip — `showDeliveryLine={true} deliveryCost={selectedRate?.rate.cost ?? null} deliveryLabel={selectedRate?.rate.providerName}`; при других режимах — `showDeliveryLine={false}` (см. [InvoiceCheckoutForm.tsx:314-331](../../apps/web/src/components/cart/InvoiceCheckoutForm.tsx#L314-L331) и [PhysicalCheckoutForm.tsx:289-321](../../apps/web/src/components/cart/PhysicalCheckoutForm.tsx#L289-L321))
- [X] T028 [US1] Подключить analytics: при первом достижении блока доставки добавить `shipping_mode` в payload `checkout_step_shipping` event ([contracts/analytics-events.md §2.1](./contracts/analytics-events.md#21-checkout_step_shipping--расширение-payload)) в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`

**Checkpoint**: ApiShip-режим работает end-to-end. US1 acceptance scenarios 1-4 проходят. Можно тестировать через [quickstart.md §1.3](./quickstart.md#13-сценарий-a--режим-через-службу-доставки-default) + §2.1.

---

## Phase 4: User Story 2 — Своя транспортная компания (Priority: P1)

**Goal**: Закупщик с собственным договором с ТК может выписать счёт без строки «Доставка», но с явным указанием реквизитов ТК в блоке «Примечания» PDF.

**Independent Test**: На той же форме переключить radio на «Транспортной компанией покупателя», заполнить поле уточнения (название ТК + договор + контакт), отправить форму, открыть PDF — убедиться, что строки «Доставка» нет, в блоке «Примечания» отображается заполненный текст ([spec.md US2](./spec.md#user-story-2)).

**Dependency**: Phase 3 (US1) — radio-группа и conditional-render уже на месте; этот phase добавляет конкретное поведение режима `own_carrier`.

### Implementation for User Story 2

- [X] T029 [US2] Добавить state `const [ownCarrierNote, setOwnCarrierNote] = useState("")` в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`
- [X] T030 [US2] Conditional render: в `shippingMode === "own_carrier"` отрисовать секцию с обязательным `<textarea>` «Уточнение по отгрузке (название ТК, договор, контакт)», `maxLength={1000}`, `required`, placeholder с примером — в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`
- [X] T031 [US2] Расширить `isLegalReady`: при `shippingMode === "own_carrier"` требовать `ownCarrierNote.trim().length >= 10` ([spec.md FR-062-10](./spec.md#requirements) + R7) в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`
- [X] T032 [US2] Обновить `handleSubmit` в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`: при `shippingMode === "own_carrier"` отправлять `delivery: { method: "own_carrier", cost: 0, handoverNote: ownCarrierNote.trim() }` (без ApiShip-полей)
- [X] T033 [US2] Silent reset при переключении ИЗ режима `own_carrier` (FR-062-11): не сбрасывать сам `ownCarrierNote` (оставить значение в state, чтобы при возврате текст не потерялся — UX-улучшение поверх spec); сбрасывается только `selectedRate` если уходим из `apiship` в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`

**Checkpoint**: own_carrier-режим работает end-to-end. US2 acceptance scenarios 1-3 проходят. Тест: [quickstart.md §1.4](./quickstart.md#14-сценарий-b--режим-транспортной-компанией-покупателя) + §2.2.

---

## Phase 5: User Story 3 — Самовывоз (Priority: P2)

**Goal**: Закупщик может выписать счёт с режимом самовывоза; в PDF — блок «Примечания» с адресом склада и контактом получателя (авто-предзаполнено из реквизитов).

**Independent Test**: На той же форме переключить radio на «Самовывоз», убедиться, что появилось поле «Кто заберёт» с авто-предзаполненным значением «ФИО, тел. <phone>» из контакта; submit; открыть PDF — убедиться, что есть «Самовывоз со склада: <addr>» и «Получатель: <FIO>» ([spec.md US3](./spec.md#user-story-3) + Q4 clarif).

**Dependency**: Phase 3 (US1) — radio-группа уже на месте; этот phase добавляет поведение режима `pickup`.

### Implementation for User Story 3

- [X] T034 [US3] Добавить state `const [pickupNote, setPickupNote] = useState("")` + флаг `const pickupNoteEditedRef = useRef(false)` для отслеживания ручных правок в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`
- [X] T035 [US3] Реализовать авто-предзаполнение `pickupNote` при выборе режима `pickup`: если `pickupNoteEditedRef.current === false`, формировать строку `${fullName}, тел. ${phone}` (только если оба заполнены, иначе оставить пусто) в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx` (Q4 clarif → [spec.md FR-062-06](./spec.md#requirements))
- [X] T036 [US3] Conditional render: в `shippingMode === "pickup"` отрисовать секцию с обязательным `<textarea>` «Кто заберёт (ФИО + телефон) / комментарий», `value={pickupNote}`, `onChange={e => { pickupNoteEditedRef.current = true; setPickupNote(e.target.value); }}`, `maxLength={1000}` в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`
- [X] T037 [US3] Расширить `isLegalReady`: при `shippingMode === "pickup"` требовать `pickupNote.trim().length >= 5` (R7) в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`
- [X] T038 [US3] Обновить `handleSubmit` в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`: при `shippingMode === "pickup"` отправлять `delivery: { method: "pickup", cost: 0, handoverNote: pickupNote.trim() }`

**Checkpoint**: Pickup-режим работает end-to-end. US3 acceptance scenarios 1-3 проходят. Тест: [quickstart.md §1.5](./quickstart.md#15-сценарий-c--режим-самовывоз) + §2.3.

---

## Phase 6: User Story 4 — Аналитика shipping_mode_changed + PDF QA (Priority: P2)

**Goal**: События `shipping_mode_changed` стреляют при переключении режимов; PDF корректно различает 3 режима; менеджер видит понятный счёт.

**Independent Test**: Прогнать [quickstart.md §1.6 (mode switching)](./quickstart.md#16-сценарий-d--переключение-режимов-silent-reset) + §4 (DataLayer inspection) + §2 (3 PDF visual smoke).

### Implementation for User Story 4

- [X] T039 [US4] Подключить вызов `trackShippingModeChanged({ mode, checkoutType: "legal", previousMode })` при изменении `shippingMode` в radio-группе `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`; **не стрелять** при первоначальном mount с дефолтным режимом ([contracts/analytics-events.md → Trigger](./contracts/analytics-events.md#trigger))
- [X] T040 [US4] Verify silent reset при переключении ApiShip→другой режим: `setSelectedRate(null)` без диалогов, но `address` НЕ сбрасывается (Q2 clarif + R6); добавить `useEffect` или явный handler в radio-onChange в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`
- [ ] T041 [US4] Manual visual smoke: создать 3 тестовых заказа (ApiShip + own_carrier + pickup), сгенерировать 3 PDF через `GET /api/invoice/<orderId>` — проверить структуру каждого по [quickstart.md §2](./quickstart.md#2-pdf-smoke-manual-visual-за-владельцем). Owner-action.
- [ ] T042 [US4] Manual regression smoke: открыть PDF минимум 2 legacy-заказов (созданных до 062) — убедиться, что визуальная регрессия отсутствует ([spec.md SC-062-06](./spec.md#measurable-outcomes), [quickstart.md §2.4-2.5](./quickstart.md#24-regression-legacy-tc-заказ-из-бд-если-есть)). Owner-action.

**Checkpoint**: Все 4 user stories функционируют. Все acceptance scenarios спеки пройдены. Готово к финальной полировке.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Тесты, документация, deferred-items, финальная валидация качества

### Tests

- [X] T043 [P] Unit-тест `trackShippingModeChanged` в `apps/web/src/lib/analytics/__tests__/events.test.ts`: проверить 2 кейса — с `previousMode` и без, payload в DataLayer соответствует [contracts/analytics-events.md → Unit-test](./contracts/analytics-events.md#unit-test-extend-eventstestts)
- [X] T044 [P] Unit-тест handoverNote-валидации в API: создать `apps/web/src/app/api/orders/__tests__/handover-validation.test.ts` (или эквивалент по существующему паттерну), проверить 4 кейса: `own_carrier` без note → 400 MISSING; `own_carrier` с 5 chars → 400 TOO_SHORT; `pickup` с 4 chars → 400 TOO_SHORT; valid case → 201
- [X] T045 [P] Smoke-тест компонента: создать `apps/web/src/components/cart/__tests__/InvoiceCheckoutForm.shipping.test.tsx`, проверить переключение режимов + disabled-состояние кнопки + авто-предзаполнение pickup-note

### Documentation

- [X] T046 Записать deferred-tracker items в `07-build-specifications/deferred-content-track.md`: DEFERRED-062-A (выпилить `tc` из enum через 2-3 месяца), DEFERRED-062-B (удалить soft-mapping через 1-2 месяца), DEFERRED-062-C (настроить goal `shipping_mode_changed` в Метрике), DEFERRED-062-D (CRM-sync `handoverNote` при активации Twenty) — см. [quickstart.md §6](./quickstart.md#6-post-release-deferred-items-checklist)
- [X] T047 Обновить [apps/web/AGENTS.md](../../apps/web/AGENTS.md) — добавить ссылку на спеку 062 в список «Current features» по существующему паттерну (как 060/061)

### Final validation

- [X] T048 Запустить `pnpm typecheck && pnpm lint && pnpm --filter @soliton/web test` from repo root — 0 ошибок, все новые тесты проходят. **Done**: typecheck 0 errors; lint 2 pre-existing errors (baseline, не наши); test 523/523 passed (44 файла, включая новые 16 тестов из T043-T045).
- [ ] T049 Пройти полный quickstart.md end-to-end (§1 UI + §3 API + §4 Analytics + §5 Admin); PDF (§2) — manual за владельцем. **Owner action**: запустить `pnpm dev`, прогнать сценарии в браузере и админке.
- [ ] T050 Открыть PR, в description указать baseline `legacy_tc_count` (из T002) — это контрольный показатель для проверки миграции после merge. **Owner action**: после T049 smoke владелец открывает PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: нет зависимостей; T001/T002/T003 можно делать параллельно
- **Phase 2 (Foundational)**: depends on Phase 1; внутри фазы:
  - T004 || T005 || T006 || T007 || T010 || T011 (параллельные различные файлы)
  - T008 depends on T006 (миграция должна быть зарегистрирована)
  - T009 depends on T004, T005 (схема изменена)
  - T012–T016 depends on T009 (типы Payload должны быть актуальными)
  - T017–T019 — PDF, можно делать параллельно с API-задачами (другой файл)
  - T020 depends on T004 (handoverNote-поле существует)
  - T021 — finale check, последняя задача phase 2
- **Phase 3 (US1)**: depends on Phase 2 complete
- **Phase 4 (US2)**: depends on Phase 3 (radio-группа из T022 должна быть на месте)
- **Phase 5 (US3)**: depends on Phase 3 (та же причина); может быть параллельной к Phase 4 **в теории**, но на практике редактируется один файл `InvoiceCheckoutForm.tsx` — лучше последовательно
- **Phase 6 (US4)**: depends on Phase 3+4+5 complete (для трёх типов заказов)
- **Phase 7 (Polish)**: depends on Phase 2-6 complete

### User Story Dependencies

- **US1 (P1, MVP)**: blocking dependency на Foundational (Phase 2)
- **US2 (P1)**: depends on US1 — расширяет ту же radio-группу в том же файле
- **US3 (P2)**: depends on US1 — то же
- **US4 (P2)**: depends on US1+US2+US3 — обзорный QA для всех трёх режимов

### Parallel Opportunities

В Phase 2 (Foundational):
- T004 [P] + T005 (Orders.js одного файла — НЕ параллельно)
- T006 + T010 + T011 + T017 + T020 — разные файлы, можно параллельно
- T012-T016 (один файл `route.ts`) — НЕ параллельно между собой
- T018-T019 (один файл `route.ts`) — НЕ параллельно между собой

В Phase 7 (Polish):
- T043 + T044 + T045 — разные файлы тестов, [P] (параллельно)

В Phase 1 (Setup):
- T001 + T002 + T003 — независимы (один тестовый прогон + один DB-check + один git-check)

### Within Each User Story

- US1: T022→T023→T024→T025→T026→T027→T028 (последовательно, один файл)
- US2: T029→T030→T031→T032→T033 (последовательно, один файл)
- US3: T034→T035→T036→T037→T038 (последовательно, один файл)
- US4: T039→T040, потом T041 и T042 (manual за владельцем, можно параллельно)

---

## Parallel Example: Phase 2 startup

```bash
# Эти 4 задачи Foundational можно запустить параллельно (разные файлы):
Task: "T006 — создать миграционный файл"
Task: "T010+T011 — расширить events.ts (analytics)"
Task: "T017 — добавить resolveWarehouseAddress в PDF route"
Task: "T020 — расширить Orders.js beforeChange hook"

# T004 + T005 НЕЛЬЗЯ параллельно (один файл Orders.js).
# T008+T009 ждут пока T004-T007 завершены.
```

---

## Implementation Strategy

### MVP Path (US1 ApiShip-only)

1. Phase 1 (Setup) — 3 задачи, ≤10 минут
2. Phase 2 (Foundational) — 18 задач, ≤1 рабочий день
3. Phase 3 (US1) — 7 задач, ≤4 часа
4. **STOP** — проверить US1 acceptance scenarios через [quickstart.md §1.3 + §2.1](./quickstart.md). Это уже работающий MVP-инкремент: ApiShip-доставка для юрлица.
5. Можно деплоить / показать владельцу.

### Incremental Delivery

1. **Foundation ready** (Phase 1+2): backend готов, UI ещё с legacy `<select>`
2. **+ US1 (Phase 3)**: ApiShip-режим в UI → MVP shippable
3. **+ US2 (Phase 4)**: own_carrier-режим → закрывает B2B-кейс «свой договор»
4. **+ US3 (Phase 5)**: pickup-режим с авто-предзаполнением → полнота функциональности
5. **+ US4 (Phase 6)**: analytics + 3-PDF QA → готовность к релизу
6. **Polish (Phase 7)**: тесты, docs, deferred-tracker → release-ready

Каждый шаг добавляет ценность, не ломая предыдущий. Между шагами 2 и 3 (если решим выпускать US1 отдельным релизом) — нужно временно оставить старый `<select>` для не-ApiShip опций; но в нашем плане выпускаем всё одним PR.

### Solo Developer Strategy (рекомендовано)

С одним разработчиком в этом репозитории — последовательный поток по phase order. Параллельность в Phase 2 ограничена только потому, что задачи относительно независимые внутри одного контекста; не пытаться запускать через одновременные агенты, чтобы избежать merge-конфликтов.

Общая оценка: **~2–3 рабочих дня** на всю фичу solo, включая manual smoke.

---

## Notes

- [P] tasks = разные файлы, нет зависимостей
- [Story] label маппит задачу к user-story для трассируемости
- US2/US3/US4 строго зависят от US1 потому что все правят `InvoiceCheckoutForm.tsx` — это **техническая** зависимость, не **функциональная**: каждая user-story по-прежнему независимо тестируема после реализации.
- Foundational phase делает ВСЁ backend-работу (API + PDF + миграция) — после неё UI-stories достаточно «фронтенд-онли»
- Manual PDF smoke (T041, T042) — за владельцем, как было в 061
- Commit-policy: один коммит на phase или на logical group (например, после T020 — коммит «feat(062): foundational backend infra»; после T028 — «feat(062): US1 ApiShip mode UI»; и т.д.)
- Перед merge — все T043-T050 пройдены, baseline записан в PR description (T002+T050)
