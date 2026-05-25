# Implementation Plan: Delivery Checkout With ApiShip Integration

**Branch**: `047-delivery-checkout-apiship` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/047-delivery-checkout-apiship/spec.md`

## Summary

Поставить полноценный модуль доставки поверх существующего checkout-флоу 037, заменив фиксированные опции «СДЭК / Boxberry / Почта России / самовывоз / TC» живыми тарифами от ApiShip. Технический подход — портировать ядро Medusa-плагина `@gorgo/medusa-fulfillment-apiship@0.2.1` (MIT) в нашу Next.js + Payload архитектуру: брать сгенерированный typescript-axios клиент к ApiShip OpenAPI, переписывать `apiship-base.ts` под наш `ShippingProvider` интерфейс, заменять Medusa workflows на простые сервисные функции, Mikro-ORM модели — на Payload globals/collections, Medusa admin extension — на наши Payload-формы.

## Technical Context

**Language/Version**: TypeScript 5 (frontend и server-side в одном Next.js приложении), Node.js 20.

**Primary Dependencies**:
- `next@16.2.6`, `react@19.2.4`, `payload@^3.84.1`, `@payloadcms/db-postgres@^3.84.1` — уже в проекте.
- Новые: `axios@^1.13`, `axios-retry@^4.5`, `axios-rate-limit@^1.4` — берём те же версии, что в Medusa-плагине.
- Dev: `@openapitools/openapi-generator-cli@^2.25` — для регенерации клиента из OpenAPI Apiship.
- DaData: REST через axios; SDK не нужен (или опционально `dadata-suggestions@^21` для подсказок на клиенте — server-side proxy всё равно обязателен для secret).
- Яндекс.Карты: лоадер `@yandex/ymaps3-types` (только типы) + ручной script-injection в `<Script src="...">` Next.js. React-обёртки писать сами (~50 строк).
- Карты: **Яндекс.Карты JS API v3** (решение владельца от 2026-05-23). Подключение через скрипт `https://api-maps.yandex.ru/v3/?apikey=<KEY>&lang=ru_RU`. Юридически — баннер «Я.Карты», условия использования по API-договору с Яндексом. ENV: `YANDEX_MAPS_API_KEY`. Подписка тарифа уточняется у Яндекс.Облака.
- Нормализация адресов: **DaData** (решение владельца от 2026-05-23). ENV: `DADATA_API_KEY`, `DADATA_SECRET`. Используется для подсказок при вводе и для нормализации перед отправкой в ApiShip / в Order. Все вызовы — server-side proxy.

**Storage**: PostgreSQL (через Payload). Новый global `apiShipSettings`, расширения `orders` (поля `delivery.*`, группа `shipment`), новая коллекция `shipping-calculations` (кэш), опционально `shipping-logs`.

**Testing**: Playwright для e2e чекаута (sandbox-токен ApiShip + sandbox ЮKassa из 037), Vitest для unit/integration модуля `lib/shipping/apiship`. Контрактные тесты — JSON snapshots для адаптеров `mapToApishipOrderRequest` / `mapToApishipCalculatorRequest`.

**Target Platform**: Linux server (Vercel или собственный сервер с Node 20). Браузеры — современные (актуально для нашей аудитории, тех. требования — отдельной спекой не закрыты).

**Project Type**: web-app (single Next.js приложение `apps/web` с встроенным Payload).

**Performance Goals**:
- Расчёт тарифов p95 ≤ 2 с (с кэшем p95 ≤ 200 мс).
- Webhook обработка p95 ≤ 500 мс.
- 0 потерянных webhook-ов за 30 дней.

**Constraints**:
- Без зависимостей на `@medusajs/*` или `@mikro-orm/*`.
- Полная локализация UI (рус. + англ.) — все строки через `adminLabel`/`adminI18n`.
- Никаких ПДн сверх необходимого; токен ApiShip только на сервере.
- Совместимость с feature flag: если `apiShipSettings.token` пуст, фоллбэк на старые фиксированные варианты из 037.

**Scale/Scope**:
- ~5 страниц/компонентов UI (блок «Доставка» в чекауте, селектор ПВЗ, страница заказа, админ-форма global, кнопка «Создать отправление»).
- ~7 API-роутов (`/api/shipping/{calculate,points,validate-address}`, `/api/admin/shipping/{create,cancel,labels,refresh-tracking}`, `/api/webhooks/apiship`).
- ~10 модулей в `lib/shipping/apiship`.
- ~3 миграции Payload.

## Constitution Check

Этот проект не имеет формальной constitution-файла, но AGENTS.md требует:

1. **High-risk изменения требуют explicit owner confirmation** — настройки доставки и платежей в этом списке. → Перед прод-релизом блок `apiShipSettings` должен быть проверен и подписан владельцем; добавляем в плане шаг review.
2. **Не выводить секреты на клиент** — выполняется через server-only routes.
3. **Соблюдать SDD/Speckit workflow** — эта спека и её файлы (`plan.md`, `data-model.md`, `contracts/`, `tasks.md`) и есть подтверждение.
4. **Логирование в `AdminChangeLog`** для изменений админ-настроек — заложено в FR-503.

Никаких отклонений от constitution не зафиксировано → «Complexity Tracking» не заполняется.

## Borrowed From Medusa Plugin — Что Реально Тянем

Источник: `gorgojs/medusa-plugins@7aa21a2` MIT, `packages/medusa-fulfillment-apiship`.

| Плагин (Medusa) | У нас (Next.js + Payload) | Изменения |
|---|---|---|
| `openapi/upstream.yaml` (свежий OpenAPI Apiship) | `apps/web/src/lib/shipping/apiship/openapi/upstream.yaml` | без изменений, регенерация через `pnpm openapi:gen` |
| `src/lib/apiship-client/` (typescript-axios) | `apps/web/src/lib/shipping/apiship/client/` | без изменений |
| `core/apiship-base.ts:calculatePrice` | `lib/shipping/apiship/provider.ts:calculate()` | вход — наш `CalculationInput`, выход — `ShippingRate[]` |
| `core/apiship-base.ts:executeWithRetry` | `lib/shipping/apiship/retry.ts` | вынесем как чистую функцию |
| `core/apiship-base.ts:waitForOrderInfo` + `waitForLabelUrl` | `lib/shipping/apiship/provider.ts:waitForOrderInfo()`, `waitForLabel()` | без существенных изменений |
| `core/apiship-base.ts:createFulfillment` | `lib/shipping/apiship/provider.ts:createShipment()` | вход — наш `Order`, выход — `ShipmentResult` |
| `core/apiship-base.ts:cancelFulfillment`, `getShipmentDocuments`, `getFulfillmentDocuments` | соответствующие методы `provider.ts` | без существенных изменений |
| `services/apiship.ts:getFulfillmentOptions` | `lib/shipping/apiship/options.ts:getShippingOptions()` | 4 типа, перевод лейблов через `adminLabel` |
| `utils/getCheapestTariff` | `lib/shipping/apiship/mappers.ts:pickCheapestTariff()` | без изменений |
| `utils/mapToApishipCalculatorRequest` | `lib/shipping/apiship/mappers.ts:toCalculatorRequest()` | принимает наш `Cart` |
| `utils/mapToApishipOrderRequest` | `lib/shipping/apiship/mappers.ts:toOrderRequest()` | принимает наш `Order` |
| `workflows/get-calculation` + `save-calculation` | `lib/shipping/apiship/cache.ts` | Payload collection `shipping-calculations` с TTL |
| `workflows/get-point-addresses` | `lib/shipping/apiship/points.ts:getPointAddresses()` | без особенностей |
| `api/store/apiship/[shipping_option_id]/calculate/route.ts` | `apps/web/src/app/api/shipping/calculate/route.ts` | App Router, Payload session check |
| `api/store/apiship/points/route.ts` | `apps/web/src/app/api/shipping/points/route.ts` | App Router |
| `modules/apiship/services/apiship-settings-service.ts` | Payload global `apiShipSettings` (apps/web/src/globals/ApiShipSettings.ts) | замена на Payload |
| `package.json:scripts.openapi:gen / openapi:pull` | `apps/web/package.json` | портируем без правок |

Не берём:
- `admin/` (Medusa Admin extension) — у нас Payload Admin.
- `index.ts` (декларация Medusa plugin module) — не нужна.
- `vite-env.d.ts` — не нужна.

## Project Structure

### Documentation (this feature)

```text
specs/047-delivery-checkout-apiship/
├── spec.md                  # Feature spec
├── plan.md                  # This file
├── data-model.md            # Payload globals/collections + Order extensions
├── screens.md               # ASCII wireframes + UX flow
├── quickstart.md            # Developer quickstart (env, sandbox, регенерация клиента)
├── tasks.md                 # Task list по US (создаётся /speckit-tasks)
└── contracts/
    ├── shipping-api.openapi.yaml         # Контракты REST на нашей стороне
    ├── apiship-events.md                 # Маппинг провайдерских статусов → внутренние
    ├── shipping-provider.types.ts        # TS-интерфейс ShippingProvider (ядро)
    ├── shipping-provider.apiship.ts      # Скелет реализации ApiShip provider
    ├── shipping-cache.ts                 # Скелет кэша расчётов
    └── shipping-webhook.handler.ts       # Скелет webhook-обработчика
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── shipping/
│   │   │   │   ├── calculate/route.ts          # public: расчёт тарифов
│   │   │   │   ├── points/route.ts             # public: список ПВЗ
│   │   │   │   └── validate-address/route.ts   # public: проверка/нормализация адреса
│   │   │   ├── admin/shipping/
│   │   │   │   ├── create/route.ts             # admin-only: создать отправление
│   │   │   │   ├── cancel/route.ts             # admin-only: отменить
│   │   │   │   ├── labels/route.ts             # admin-only: получить/обновить этикетку
│   │   │   │   └── refresh-tracking/route.ts   # admin-only: pull статусов
│   │   │   └── webhooks/apiship/route.ts       # public (с проверкой подписи): webhook ApiShip
│   │   └── cart/
│   │       ├── checkout-physical/page.tsx      # обновляется: добавлен <DeliveryBlock />
│   │       ├── checkout-legal/page.tsx         # обновляется: добавлен <DeliveryBlock />
│   │       └── order/[token]/page.tsx          # обновляется: таймлайн событий доставки
│   ├── components/
│   │   ├── checkout/
│   │   │   ├── DeliveryBlock.tsx               # выбор тарифа, цена, срок
│   │   │   ├── DeliveryRateList.tsx            # список тарифов
│   │   │   ├── DeliveryRateCard.tsx            # одна карточка тарифа
│   │   │   ├── PointSelector.tsx               # модалка: список + карта ПВЗ
│   │   │   ├── PointSelectorList.tsx           # левая колонка модалки
│   │   │   ├── PointSelectorMap.tsx            # правая колонка модалки (Яндекс.Карты v3)
│   │   │   ├── AddressForm.tsx                 # форма адреса с DaData/манусл-вводом
│   │   │   └── DeliverySummary.tsx             # итог выбора (фикс. на странице)
│   │   ├── order/
│   │   │   └── ShipmentTimeline.tsx            # events на публичной странице заказа
│   │   └── admin/
│   │       └── orders/
│   │           ├── CreateShipmentButton.tsx    # custom field для Orders
│   │           └── ShipmentInfoPanel.tsx       # readonly блок в карточке заказа
│   ├── globals/
│   │   └── ApiShipSettings.ts                  # Payload global с настройками
│   ├── collections/
│   │   ├── Orders.js                           # ИЗМЕНИТЬ: добавить shipment group, расширить delivery
│   │   ├── ShippingCalculations.ts             # НОВАЯ: кэш расчётов
│   │   └── ShippingLogs.ts                     # НОВАЯ (опц.): аудит запросов/ответов
│   ├── lib/
│   │   └── shipping/
│   │       ├── types.ts                        # ShippingProvider, ShippingRate, ShipmentResult и пр.
│   │       ├── registry.ts                     # резолвер провайдера (apiship | fallback)
│   │       ├── fallback/
│   │       │   └── provider.ts                 # старые 3-4 фиксированные опции (для feature flag off)
│   │       └── apiship/
│   │           ├── provider.ts                 # реализация ShippingProvider (порт apiship-base.ts)
│   │           ├── options.ts                  # 4 типа тарифа (door-door и т.д.)
│   │           ├── mappers.ts                  # toCalculatorRequest, toOrderRequest, pickCheapestTariff
│   │           ├── retry.ts                    # executeWithRetry
│   │           ├── cache.ts                    # getCalculation, saveCalculation
│   │           ├── points.ts                   # getPoints, getPointAddresses
│   │           ├── webhook.ts                  # parseSignature, applyEvent
│   │           ├── status-map.ts               # apiship status → internal
│   │           ├── settings.ts                 # тонкая обёртка над Payload global
│   │           ├── client/                     # ВНЕШНЕЕ: typescript-axios из OpenAPI
│   │           │   ├── index.ts
│   │           │   └── ... (генерится)
│   │           └── openapi/
│   │               └── upstream.yaml           # снапшот OpenAPI Apiship
│   └── payload.config.ts                       # ИЗМЕНИТЬ: подключить новые globals/collections
└── package.json                                # ИЗМЕНИТЬ: deps axios/axios-retry/axios-rate-limit/@yandex/ymaps3-types/@openapitools/openapi-generator-cli, scripts openapi:gen, openapi:pull
```

**Structure Decision**: придерживаемся существующего pnpm monorepo single-app, всё новое — внутри `apps/web/src/{lib,components,collections,globals,app}`. Никаких новых пакетов в `apps/`. Это упрощает развёртывание (одно приложение) и не множит границы.

## Phase 0: Research (что необходимо подтвердить до Phase 1)

Открытые вопросы для `research.md`:

1. **Webhook ApiShip — точный формат подписи**: HMAC заголовок? Подпись по телу или по timestamp+body? Какие IP-листы (для дополнительной фильтрации)? — нужен ответ от менеджера ApiShip или из docs.apiship.ru.
2. ~~**Карты**~~ — закрыто: Яндекс.Карты v3 JS API. Получить ключ у Яндекс.Облака.
3. ~~**DaData**~~ — закрыто: подключаем. Зарегистрировать аккаунт, получить `DADATA_API_KEY` и `DADATA_SECRET`.
4. **VAT на доставку**: 20% или «без НДС» — уточнить у бухгалтерии.
5. **ЮKassa ↔ ApiShip**: подтвердить, что выбранный тариф сохраняется в заказе **до** оплаты и не перерасчитывается на webhook оплаты (требование UX).
6. **Объём заказа vs тарифы**: проверить на 5–10 типовых корзинах PDU 6/12/16/24/32 розетки, что габариты влезают в основные тарифы СДЭК/Boxberry.

Эти пункты идут в `research.md` (создаётся в Phase 0, в этой коммитной серии не пишем — следующий шаг).

## Phase 1: Design Outputs

После research:

- `data-model.md` — Payload globals/collections, расширения `orders`, маппинг статусов.
- `contracts/shipping-api.openapi.yaml` — REST на нашей стороне.
- `contracts/shipping-provider.types.ts` — TS-интерфейс `ShippingProvider`, общий для всех провайдеров.
- `contracts/shipping-provider.apiship.ts` — скелет реализации (готов к копипасте в `lib/shipping/apiship/provider.ts`).
- `contracts/shipping-cache.ts` — заготовка кэша.
- `contracts/shipping-webhook.handler.ts` — заготовка webhook-route.
- `screens.md` — ASCII-вайрфреймы всех экранов.
- `quickstart.md` — как поднять локально с sandbox-токеном.

## Phase 2: Tasks

Создаётся `/speckit-tasks` → `tasks.md`. Группировка по US из spec.md, MVP — US1+US2+US3+US5 (US4 webhook можно слайсом позже, до этого менеджер вручную refresh-tracking).

## Risk & Mitigation

| Риск | Митигация |
|---|---|
| ApiShip API нестабилен / меняет схему | Регенерация клиента из OpenAPI 1 раз в спринт, контрактные тесты на маппинги. |
| Sandbox ApiShip не повторяет прод-поведение (особенно webhook) | Параллельно поднять отдельный «прод-DRY» тест: 1–2 реальных недорогих отправления в тестовый период. |
| Яндекс.Карты квота 25k/день превышена | Серверная фильтрация ПВЗ по `radius_km` ≤15; кэш центра города; кластеризация маркеров; алерт владельцу при approach к лимиту. |
| Yandex.Карты JS API недоступен (блокировка) | Fallback на текстовый список ПВЗ (без карты); сохранение работоспособности селектора. |
| DaData превысил тариф | Кэш ответов на 30 дней по нормализованной строке; fallback на ручной ввод адреса с warning. |
| Утечка токена ApiShip на клиент | Lint-rule на `lib/shipping/apiship/client` — `import "server-only"`. Тест в CI: бандл не содержит `APISHIP_TOKEN`. |
| Лавина запросов на расчёт при наборе адреса | Дебаунс 400 мс на клиенте + кэш на сервере по `cartId+addressHash`. |
| Webhook-флуд / replay | Идемпотентность по `eventId`, проверка подписи, rate limit 100 rpm на эндпоинт. |
| ApiShip упал → чекаут не работает | Feature-flag fallback на старые 3-4 опции; явный баннер «расчёт временно недоступен». |
| ПДн в логах | Маска для phone/email в `shipping-logs`; токены и подписи — никогда. |

## Open Questions → owner

Перед стартом разработки нужно подтверждение владельца по пунктам:

1. ~~Карты~~ ✅ Яндекс.Карты v3.
2. ~~DaData~~ ✅ подключаем.
3. Какой target НДС на доставку (20% / без НДС / отдельно по типу заказа)?
4. Включаем ли с первого дня логирование в `shipping-logs` (TTL 90 дней) — или достаточно `logger`?
5. Какой склад указываем по умолчанию в `defaultSenderSettings` (адрес отправителя)?
6. Тарифный план Яндекс.Карт (есть бесплатный лимит 25k запросов/день) — какой берём.
7. Тариф DaData (есть free до 10k запросов/сутки) — какой берём.

## Complexity Tracking

Не заполняется (нет нарушений constitution).
