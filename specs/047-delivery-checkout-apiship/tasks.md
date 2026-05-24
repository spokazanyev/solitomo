---
description: "Task list for 047-delivery-checkout-apiship"
---

# Tasks: Delivery Checkout With ApiShip

**Input**: Design documents from `/specs/047-delivery-checkout-apiship/`

**Prerequisites**: `spec.md`, `plan.md`, `data-model.md`, `contracts/`, `screens.md`, `quickstart.md`

**Tests**: Включены (Vitest + Playwright). Контрактные тесты на маппинги и status-map обязательны.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно делать параллельно (разные файлы, нет зависимостей).
- **[Story]**: US1 / US2 / US3 / US4 / US5 / US6 (email stub) / US7 (closure) / US8 (emitter) / FND.

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] **T001** [FND] Создать ветку `047-delivery-checkout-apiship` (уже сделано) и каталоги в `apps/web/src/lib/shipping/{apiship,fallback}`, `apps/web/src/components/checkout`, `apps/web/src/components/order`, `apps/web/src/components/admin/orders`.
- [ ] **T002** [FND] Добавить в `apps/web/package.json` зависимости `axios@^1.13`, `axios-retry@^4.5`, `axios-rate-limit@^1.4`, опц. `@yandex/ymaps3-types` (типы Яндекс.Карт v3), devDep `@openapitools/openapi-generator-cli@^2.25` и скрипты `shipping:openapi:pull` / `shipping:openapi:gen` (см. `quickstart.md` §3). **Leaflet/react-leaflet НЕ ставим.**
- [ ] **T003** [P] [FND] Настроить ESLint-правило: запрет импорта из `lib/shipping/apiship/client/` и `lib/shipping/apiship/provider.ts` без директивы `"server-only"`.
- [ ] **T004** [FND] Запустить `shipping:openapi:pull` + `shipping:openapi:gen`, закоммитить `openapi/upstream.yaml`, `openapi/SPEC_VERSION.txt`, сгенерированный `client/`.

**Checkpoint**: ENV прописан, клиент сгенерирован, пакеты установлены.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: ни одна US не стартует без этого.

- [ ] **T010** [FND] Создать Payload global `apps/web/src/globals/ApiShipSettings.ts` по `data-model.md §1` + блок `lifecycle` (closureWindowDays, stuckThresholdHours, priceMismatchTolerance). Подключить в `payload.config.ts`.
- [ ] **T011** [FND] Создать Payload коллекцию `apps/web/src/collections/ShippingCalculations.ts` по `data-model.md §3`. Подключить.
- [ ] **T012** [P] [FND] Создать Payload коллекцию `apps/web/src/collections/ShippingLogs.ts` по `data-model.md §4`. Подключить.
- [ ] **T013** [FND] Расширить `apps/web/src/collections/Orders.js`: добавить `delivery.*` (snapshot/expires/pickupExpiresAt), `items[].priceSnapshot`, `totals.snapshot*`, новые поля верхнего уровня (`deliveredAt`/`closedAt`/`disputeFlag`), группы `shipment` / `crmRefs` (только schema), расширить `status` (+`completed`,`returned`).
- [ ] **T014** [FND] Сгенерировать миграции Payload (`pnpm payload migrate:create`), закоммитить.
- [ ] **T015** [P] [FND] Создать `apps/web/src/lib/shipping/types.ts` ← копия `contracts/shipping-provider.types.ts`.
- [ ] **T016** [FND] Создать `apps/web/src/lib/shipping/registry.ts` (резолвер провайдера: apiship | fallback) + `apps/web/src/lib/shipping/fallback/provider.ts` (3-4 фикс. опции из текущего 037).
- [ ] **T017** [P] [FND] Создать `apps/web/src/lib/shipping/apiship/settings.ts` (тонкая обёртка над Payload global).
- [ ] **T018** [P] [FND] Создать `apps/web/src/lib/shipping/apiship/logger.ts` (`logRequest` / `logError` пишут в `shipping-logs` с маской ПДн).
- [ ] **T019** [P] [FND] Создать `apps/web/src/lib/shipping/apiship/retry.ts` (порт `executeWithRetry` из плагина) + unit-тесты.
- [ ] **T020** [FND] Создать `apps/web/src/lib/shipping/apiship/cache.ts` ← скопировать из `contracts/shipping-cache.ts`.
- [ ] **T021** [P] [FND] Создать `apps/web/src/lib/shipping/apiship/status-map.ts` + unit-тесты по таблице `contracts/apiship-events.md`.
- [ ] **T022** [FND] Создать `apps/web/src/lib/shipping/apiship/mappers.ts` (порт `getCheapestTariff`, `mapToApishipCalculatorRequest`, `mapToApishipOrderRequest`, plus `toShippingRate`, `toPickupPoints`) + snapshot-тесты.
- [ ] **T023** [FND] Создать `apps/web/src/lib/shipping/apiship/provider.ts` ← скопировать из `contracts/shipping-provider.apiship.ts`, заменить TODO-методы (`cancelShipment`, `getDocument`, `refreshTracking`) на реальные, опираясь на `OrdersApi.cancelOrder` / `OrderDocsApi.getLabels`/`getWaybills` / `OrdersApi.getOrderInfo`.
- [ ] **T024** [P] [FND] Создать `apps/web/src/lib/lifecycle/events.ts` — реализация `emitDomainEvent(event, order, payload)` с регистрацией подписчиков (US8). Простой sync-emitter с try/catch вокруг каждого подписчика.
- [ ] **T025** [P] [FND] Создать `apps/web/src/lib/lifecycle/statusMachine.ts` (запрещённые переходы, валидация).
- [ ] **T026** [P] [FND] Создать `apps/web/src/lib/notifications/stub.ts` — минимальный email-sender (US6), 4 простых шаблона T-001/T-003/T-005/T-008 как строковые функции, прямой вызов одного провайдера (Postmark / Mailgun — выбор владельца).

**Checkpoint**: фундамент готов. US можно стартовать параллельно.

---

## Phase 3: User Story 1 — Реальная стоимость в чекауте (P1) 🎯 MVP

**Goal**: покупатель физлицо видит реальные тарифы ApiShip и сумма пересчитывается.

**Independent Test**: e2e: каталог → корзина → чекаут с адресом «Москва, Тверская 7» → ≥3 тарифа → выбрать → итог обновился → оплата ЮKassa sandbox.

### Tests for US1

- [ ] **T030** [P] [US1] Vitest unit-тесты `lib/shipping/apiship/__tests__/mappers.test.ts` для `toCalculatorRequest` (вход — `CartItem[]` + AddressInput).
- [ ] **T031** [P] [US1] Vitest integration `__tests__/calculate.integration.test.ts` (через httpmock к ApiShip OpenAPI fixture-ам).
- [ ] **T032** [P] [US1] Playwright `e2e/checkout-physical-apiship.spec.ts`.

### Implementation for US1

- [ ] **T033** [US1] Создать роут `apps/web/src/app/api/shipping/calculate/route.ts` по `contracts/shipping-api.openapi.yaml` (POST). Внутри: `registry.resolve()` → `provider.calculate()`. Кэш-ключ строится из `cartId+addressHash+items[].sku/qty`.
- [ ] **T034** [P] [US1] Создать роут `apps/web/src/app/api/shipping/validate-address/route.ts` (server-side proxy к **DaData Suggest + Clean API**, FR-1303). Кэш по нормализованной строке (FR-1307).
- [ ] **T034a** [P] [US1] Создать `apps/web/src/lib/dadata/client.ts` (REST через axios; маска secret).
- [ ] **T035** [P] [US1] Компонент `apps/web/src/components/checkout/AddressForm.tsx` (поля адреса с **DaData-подсказками** через `/api/shipping/validate-address?suggest=1`, debounce 300 мс).
- [ ] **T036** [P] [US1] Компонент `apps/web/src/components/checkout/DeliveryRateCard.tsx` (одна карточка тарифа: иконка провайдера, цена, срок, бейдж).
- [ ] **T037** [US1] Компонент `apps/web/src/components/checkout/DeliveryRateList.tsx` (список, состояние loading/empty/error).
- [ ] **T038** [US1] Компонент `apps/web/src/components/checkout/DeliveryBlock.tsx` (объединяет адрес + список + summary, см. `screens.md` S1).
- [ ] **T039** [US1] Компонент `apps/web/src/components/checkout/DeliverySummary.tsx` (правая колонка, see S3).
- [ ] **T040** [US1] Вставить `<DeliveryBlock>` и `<DeliverySummary>` в `apps/web/src/app/cart/checkout-physical/page.tsx`. Заблокировать кнопку «Оплатить» пока `delivery.cost === undefined`.
- [ ] **T041** [US1] Передать выбранный тариф в payload заказа при создании (`apps/web/src/app/api/checkout/...`, существующий из 037 — найти место создания `Order` и записать поля `delivery.provider/providerKey/tariffId/deliveryType/pickupType/cost/etaMinDays/etaMaxDays/selectedAt`).
- [ ] **T042** [US1] Добавить fallback-блок `S6` при пустом списке или ошибке (компонент `DeliveryFallbackBlock`).
- [ ] **T043** [US1] Создать роут `apps/web/src/app/api/checkout/finalize-shipping/route.ts` (FR-107/108). Логика: re-calc, сравнить с `previousCost`, если delta ≤ tolerance → snapshot, else 409.
- [ ] **T044** [US1] Создать страницу `apps/web/src/app/cart/checkout-physical/review/page.tsx` (экран S10). Аналогичная страница для legal.
- [ ] **T045** [US1] Компонент `apps/web/src/components/checkout/PriceMismatchModal.tsx` (экран S11) + интеграция с finalize-shipping.
- [ ] **T046** [US1] При сабмите review → сохранить `Order.delivery.priceSnapshot`, `items[].priceSnapshot`, `totals.snapshot*`, передать total в ЮKassa.

**Checkpoint US1**: чекаут показывает реальные тарифы, snapshot фиксируется на review, оплата идёт по snapshot.

---

## Phase 4: User Story 2 — Выбор ПВЗ (P1)

**Goal**: для тарифов `*topoint` покупатель выбирает ПВЗ в модалке (список + карта).

**Independent Test**: выбрать тариф `doortopoint` → открыть селектор → выбрать ПВЗ в Москве → возврат в чекаут с указанным адресом ПВЗ.

### Tests for US2

- [ ] **T050** [P] [US2] Vitest `__tests__/points.test.ts` (mappers `toPickupPoints`).
- [ ] **T051** [P] [US2] Playwright `e2e/checkout-pickup-point.spec.ts`.

### Implementation for US2

- [ ] **T052** [US2] Создать `apps/web/src/lib/shipping/apiship/points.ts` (`getPoints`, `getPointAddresses`).
- [ ] **T053** [US2] Создать роут `apps/web/src/app/api/shipping/points/route.ts` по контракту.
- [ ] **T054** [P] [US2] Компонент `PointSelectorList.tsx` (левая колонка, виртуализация при ≥200 пунктах).
- [ ] **T055** [P] [US2] Компонент `PointSelectorMap.tsx` (**Яндекс.Карты v3 JS API** через `<Script src="...">` + `ymaps3.ready`, FR-1301/1302; кластеризация маркеров через `ymaps3.YMapMarker` + clusterer; обязательный баннер «© Я.Карты»).
- [ ] **T056** [US2] Компонент `PointSelector.tsx` (модалка, синхронизация выбора между списком и картой, см. `screens.md` S2).
- [ ] **T057** [US2] Подключить кнопку «Выбрать пункт выдачи» в `DeliveryRateCard` (только если `pickupType === 2`).
- [ ] **T058** [US2] Сохранение `pointId` / `pointAddress` / `providerKey` обратно в state чекаута и в `Order.delivery`.
- [ ] **T059** [US2] Граничный кейс: пустой список ПВЗ → текст «В радиусе нет пунктов выбранного провайдера, попробуйте другой тариф».

**Checkpoint US2**: ПВЗ выбирается, в Order попадают корректные поля.

---

## Phase 5: User Story 3 — Создание отправления (P1)

**Goal**: менеджер на оплаченном заказе нажимает «Создать отправление» → в течение ≤30 с в заказе появляются `trackingNumber` + ссылки на этикетку и накладную.

### Tests for US3

- [ ] **T060** [P] [US3] Vitest `__tests__/mappers.order.test.ts` (`toOrderRequest`, snapshot).
- [ ] **T061** [P] [US3] Vitest integration `__tests__/create-shipment.integration.test.ts` (httpmock).

### Implementation for US3

- [ ] **T062** [US3] Реализовать `provider.cancelShipment`, `provider.getDocument`, `provider.refreshTracking` в `lib/shipping/apiship/provider.ts` (поля: `providerOrderId` берётся из Payload Order).
- [ ] **T063** [US3] Создать `apps/web/src/app/api/admin/shipping/create/route.ts` (POST, проверка Payload session, поиск Order, валидация условий — `status===paid`, `shipment.status in {none, error, pending_label}`, вызов `provider.createShipment`, апдейт Order).
- [ ] **T064** [P] [US3] Создать `apps/web/src/app/api/admin/shipping/cancel/route.ts`.
- [ ] **T065** [P] [US3] Создать `apps/web/src/app/api/admin/shipping/labels/route.ts`.
- [ ] **T066** [P] [US3] Создать `apps/web/src/app/api/admin/shipping/refresh-tracking/route.ts`.
- [ ] **T067** [US3] Кастомный Payload-компонент `apps/web/src/components/admin/orders/CreateShipmentButton.tsx` (кнопка в карточке заказа).
- [ ] **T068** [US3] Кастомный Payload-компонент `apps/web/src/components/admin/orders/ShipmentInfoPanel.tsx` (readonly блок с кнопками «Этикетка / Накладная / Обновить / Отменить», см. S5).
- [ ] **T069** [US3] Подключить компоненты в `apps/web/src/collections/Orders.js` через `admin.components.RowLabel/BeforeFields`.

**Checkpoint US3**: оплаченный заказ → клик → отправление в ApiShip + этикетка.

---

## Phase 6: User Story 5 — Админ-настройки ApiShip (P2)

(`US5` идёт раньше `US4`, потому что без настроек webhook не запустишь.)

### Tests for US5

- [ ] **T070** [P] [US5] Vitest `__tests__/settings.test.ts` (загрузка/маскировка).
- [ ] **T071** [P] [US5] Playwright `e2e/admin-apiship-settings.spec.ts` (логин в Payload, изменение настроек, лог в AdminChangeLog).

### Implementation for US5

- [ ] **T072** [US5] Кастомные field-компоненты для маскированного ввода `token` и `webhookSecret`.
- [ ] **T073** [US5] Кнопка «Проверить соединение» (вызывает `provider.isReady()` на бэке, обновляет `connectionStatus`).
- [ ] **T074** [US5] Хук `afterChange` для `ApiShipSettings` → запись diff в `AdminChangeLog`.

**Checkpoint US5**: можно сменить токен, проверить соединение, увидеть аудит.

---

## Phase 7: User Story 4 — Webhook и таймлайн статусов (P2)

### Tests for US4

- [ ] **T080** [P] [US4] Vitest `__tests__/webhook.test.ts` (валидная подпись, битая подпись, дубликат, out-of-order).
- [ ] **T081** [P] [US4] Playwright `e2e/order-public-page-timeline.spec.ts`.

### Implementation for US4

- [ ] **T082** [US4] Создать `apps/web/src/app/api/webhooks/apiship/route.ts` ← скопировать из `contracts/shipping-webhook.handler.ts`, поправить импорты под `apps/web/src/...`.
- [ ] **T083** [US4] Компонент `apps/web/src/components/order/ShipmentTimeline.tsx` (отображение `shipment.events` в обратном хроно-порядке + кнопка «Отследить»).
- [ ] **T084** [US4] Подключить `<ShipmentTimeline>` в `apps/web/src/app/cart/order/[token]/page.tsx`.
- [ ] **T085** [US4] Email-нотификация «Заказ отправлен» (`apps/web/src/lib/email/templates/shipment-shipped.ts`) — триггер из webhook при `internal_status → in_transit`. Использует существующий email-механизм (если ещё не подключён — отметить как зависимость, временно логируем).
- [ ] **T086** [P] [US4] Email-нотификация «Заказ доставлен» — триггер `internal_status → delivered`.

**Checkpoint US4**: webhook прилетает, таймлайн обновляется, клиент получает email.

---

## Phase 8: User Story 6 — Минимальный email-stub (P1)

**Goal**: на 4 критичных события клиент получает email без полноценной матрицы.

### Tests for US6

- [ ] **T100** [P] [US6] Vitest `lib/notifications/__tests__/stub.test.ts` — рендеринг 4 шаблонов без NaN/undefined.
- [ ] **T101** [P] [US6] Vitest tests на error-handling: если провайдер 5xx — не блокирует основной flow.

### Implementation for US6

- [ ] **T102** [US6] Реализовать 4 шаблона как простые TS-функции в `lib/notifications/stub.ts`: `renderPaidEmail`, `renderShippedEmail`, `renderDeliveredEmail`, `renderCompletedEmail`.
- [ ] **T103** [US6] Реализовать `sendStubEmail(to, subject, html)` — прямой вызов выбранного провайдера (Postmark или Mailgun).
- [ ] **T104** [US6] Подписать stub на `emitDomainEvent`:
  - `order.paid` → T-001
  - `shipment.created` → T-003
  - `shipment.delivered` → T-005
  - `order.completed` → T-008
- [ ] **T105** [P] [US6] ENV: `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM` (документация в quickstart).
- [ ] **T106** [P] [US6] Лог в `AdminChangeLog` для каждого отправленного письма.

**Checkpoint US6**: 4 теста на каждый шаблон проходят; e2e — тестовый заказ → 4 письма приходят.

> После релиза 049 — стираем `lib/notifications/stub.ts`, заменяем на полноценную матрицу из 049.

---

## Phase 9: User Story 7 — Закрытие сделки (P2)

**Goal**: заказ автоматически становится `completed` через `closureWindowDays` после `delivered`; клиент получает `T-008`, Twenty → `Won.Closed`.

### Tests for US7

- [ ] **T120** [P] [US7] Vitest `lib/lifecycle/__tests__/closure.test.ts` — корректно отбирает заказы, уважает `disputeFlag`.
- [ ] **T121** [P] [US7] Playwright `e2e/order-closure.spec.ts` — фейковый заказ с `deliveredAt - 15d` → cron → `completed` + email + CRM.

### Implementation for US7

- [ ] **T122** [US7] Реализовать `lib/lifecycle/closure.ts`: запрос `orders WHERE status=delivered AND deliveredAt < now() - closureWindowDays AND disputeFlag=false`, перевод в `completed`.
- [ ] **T123** [US7] Cron job `closure` (Payload scheduler или Vercel Cron), запуск раз в час.
- [ ] **T124** [P] [US7] Hook `Orders.beforeChange` блокирует выход из `completed` без флага `_reopenAuthorized` (FR-905).
- [ ] **T125** [P] [US7] Кастомные кнопки в Payload Admin (S14): «Реоткрыть сделку», «Пометить диспут».
- [ ] **T126** [P] [US7] Эмит события `order.completed` при автопереходе → подключается T103/T108.
- [ ] **T127** [P] [US7] Страница отзыва `apps/web/src/app/cart/order/[token]/review/page.tsx` (S13) + API.

**Checkpoint US7**: тестовый заказ закрывается автоматически, клиент получает письмо, Twenty стадия обновляется.

---

## Phase 10: User Story 8 — Event emitter (P1, инфраструктура)

**Goal**: единая точка эмита доменных событий с подписчиками.

### Tests for US8

- [ ] **T130** [P] [US8] Vitest `lib/lifecycle/__tests__/events.test.ts` — подписчики получают события, исключение в одном не блокирует остальных.
- [ ] **T131** [P] [US8] Vitest tests на payload contract — все обязательные поля присутствуют для каждого типа события.

### Implementation for US8

- [ ] **T132** [US8] Расширить `lib/lifecycle/events.ts` (T024): registry подписчиков, sync-emit с error-isolation.
- [ ] **T133** [US8] Подключить вызов `emitDomainEvent` в местах:
  - `Order.afterChange` → `order.created`, `order.identified`, `order.cancelled`
  - Webhook ЮKassa → `order.paid`
  - Webhook ApiShip → `shipment.created/in_transit/at_point/delivered/error/returned`
  - Cron closure (US7) → `order.completed`
- [ ] **T134** [US8] Зафиксировать payload-формат в `contracts/event-payload.ts` (контракт для 048/049).
- [ ] **T135** [P] [US8] Логирование каждого emit в `AdminChangeLog` (с маской ПДн).

**Checkpoint US8**: подписавшись тестовым логгером, видны все 9 типов событий в правильные моменты.

> 048 (Twenty CRM) и 049 (Customer notifications) подписываются на этот emitter без изменений 047.

---

## Phase N: Polish & Cross-Cutting

- [ ] **T090** [P] Документация для разработчика: `apps/web/src/lib/shipping/README.md` с атрибуцией MIT-плагину.
- [ ] **T091** [P] Cron-задача `purgeExpiredCalculations` (Payload job или Vercel Cron) — раз в час.
- [ ] **T092** [P] Метрики: добавить счётчики `apiship.calculate.duration_ms`, `apiship.webhook.applied`, `apiship.create.duration_ms` (если в проекте есть Sentry/posthog/etc — отметить).
- [ ] **T093** Аудит безопасности: убедиться, что токен ApiShip не попадает в client bundle (Webpack stats).
- [ ] **T094** Smoke-тест с реальным боевым токеном на 1–2 тестовых отправления; ручная сверка статусов.
- [ ] **T095** Обновить `07-build-specifications/document-register.md` (добавить ссылку на 047).
- [ ] **T096** Обновить `07-build-specifications/deferred-content-track.md` (вынести return shipments / courier pickup как 048).
- [ ] **T097** Обновить `AGENTS.md` SPECKIT-блок → ссылка на 047.
- [ ] **T098** [P] Алерт «застрявший заказ»: cron каждые 6 ч; см. FR-1002.
- [ ] **T099** [P] Алерт «недоступность ApiShip API >15 мин» (FR-1004).

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) → Foundational (Phase 2) — блокирует все US.
- US1 (Phase 3) и US2 (Phase 4) можно делать параллельно.
- US3 (Phase 5) — после Phase 2, параллельно с US1/US2.
- US5 (Phase 6) — после Phase 2; нужна до US4 (`webhookSecret`).
- US4 (Phase 7) — после US3 и US5.
- US8 (Phase 10) — emitter — после Phase 2; критичен для US6 и US7 + 048/049 в follow-up.
- US6 (Phase 8) — минимальный email-stub — после US8 (нужен emitter) и Phase 2.
- US7 (Phase 9) — после US4 (delivered event) и US8 (emit для order.completed).
- Polish — после всех US.

### Parallel Opportunities

- В Phase 2: T015 / T017 / T018 / T019 / T021 — параллельно.
- В Phase 3: тесты (T030–T032) — параллельно. Компоненты UI (T034–T036) — параллельно.
- В Phase 4: тесты + два компонента (List, Map) — параллельно.
- В Phase 5: четыре admin-роута (T063–T066) — параллельно.

---

## Implementation Strategy

### MVP (US1 + US3 + US6 stub + US8 emitter) — минимальный полезный срез

1. Phase 1 + 2.
2. Phase 3 (US1) — реальные тарифы в чекауте + snapshot цены (T043–T046).
3. Phase 5 (US3) — кнопка «Создать отправление».
4. Phase 8 (US6 stub) — 4 email клиенту: `T-001/T-003/T-005/T-008`. **Менеджерские письма (T-101..T-105) — это спека 049**, не 047. До 049 менеджер видит новые заказы в Payload Admin как сегодня.
5. Phase 10 (US8 emitter) — `emitDomainEvent` подключён к всем событиям; даже если 048/049 пока выключены, заказы корректно эмитят события.
6. **Деплой**: оплата картой работает, snapshot цены, отправление создаётся, клиент получает 4 транзакционных письма.
7. **Если email-провайдер ещё не выбран** — `EMAIL_API_KEY` пуст, FR-116 dry-run, писем не уходит, заказы оформляются нормально.

### Incremental delivery

1. MVP (US1 + US3 + US6 stub + US8 emitter) → деплой.
2. US2 (ПВЗ) → деплой.
3. US5 (админ-настройки ApiShip) → деплой.
4. US4 (webhook трекинг + публичная страница заказа с таймлайном) → деплой.
5. US7 (автозакрытие сделки + NPS T-008) → деплой.
6. **Спека 049 (Customer notifications)** — полноценная матрица email/SMS, ПВЗ-напоминания, courier_today, alerts менеджеру; снимает stub в 047.
7. **Спека 048 (Twenty CRM)** — подписка на emitter; визуализация сделок в Twenty.
8. Polish и cleanup.

---

## Trace To Spec

| Task | FR | US |
|---|---|---|
| T010, T072–T074 | FR-501, FR-503 | US5 |
| T020, T030, T033 | FR-101 — FR-106 | US1 |
| T040, T041, T038 | FR-101, FR-103, FR-106 | US1 |
| T043–T046 | FR-107 — FR-110, FR-115 | US1 |
| T052–T058 | FR-201 — FR-203 | US2 |
| T022, T060, T063, T067 | FR-301 — FR-306 | US3 |
| T082, T021 | FR-401 — FR-406 | US4 |
| T083, T084, T085, T086 | FR-405 | US4 |
| T026, T100–T106 | FR-407 — FR-412, FR-116 | US6 (stub) |
| T025, T122–T127 | FR-901 — FR-905 | US7 |
| T024, T132–T135 | FR-407, FR-117 — FR-118, FR-1210 — FR-1211 | US8 (emitter) |
| T099, T067 | FR-1001 — FR-1002 | cross (apiship alerts) |
| T091, T093, T018 | FR-504 — FR-505, FR-601 — FR-603 | cross |
| (новое) T046b | FR-111 — FR-114 | cross (retry payment, multi-recipient, concurrency) |

---

## Notes

- Атрибуция MIT в README модуля обязательна.
- Поля `shipment.status` и `delivery.*` — расширения; они nullable, существующие заказы не ломаются.
- Любые правки `apiShipSettings` пишутся в `AdminChangeLog` (T074).
- Перед прод-релизом — explicit owner confirmation (см. `plan.md → Constitution Check`).
