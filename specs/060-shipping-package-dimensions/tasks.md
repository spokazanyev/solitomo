---

description: "Task list for feature 060 — Shipping Package Dimensions"

---

# Tasks: Учёт реального веса и габаритов товаров при расчёте доставки

**Input**: Design documents from `/specs/060-shipping-package-dimensions/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Включены (Vitest unit tests на маппер — см. R9 в research.md и contracts/mappers-internal-contract.md).

**Organization**: Задачи сгруппированы по user story из spec.md (US1 = P1, US2 = P2, US3 = P3), каждая story независимо тестируется и доставляет инкремент ценности.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно выполнять параллельно (разные файлы, без зависимостей)
- **[Story]**: метка задачи — US1 / US2 / US3 (соответствует user stories из spec.md)
- Все пути — абсолютные от корня репозитория

## Path Conventions

Все пути — относительно корня монорепо `/Users/svp/Documents/GitHub/SMB/projects/solitomo-organic-site/`. Основной код фичи живёт в `apps/web/` (Next.js + Payload CMS app).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Подготовка окружения и ветки.

- [X] T001 Убедиться что текущая git-ветка `060-shipping-package-dimensions`, dev-сервер `pnpm --filter @soliton/web dev` поднимается без ошибок и БД Postgres локально доступна. Если нужно, выполнить `pnpm install` от корня.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Расширение схемы данных и типов — фундамент для всех user stories. Без этого ни US1, ни US2, ни US3 невозможны.

**⚠️ CRITICAL**: Никакая user story не начинается, пока Phase 2 не завершена.

- [X] T002 Расширить коллекцию `Products` в `apps/web/src/collections/Catalog.js`: добавить опциональную group-секцию `physicalPackaging` с 4 number-полями (`weightGrams`, `lengthMm`, `widthMm`, `heightMm`) и встроенной min/max валидацией (см. `contracts/product-physical-fields.md`). Лейблы — двуязычные через существующий `adminLabel(...)`. Группа не required, поля внутри не required.

- [X] T003 Запустить локально `pnpm --filter @soliton/web dev` — Payload в dev делает auto-push схемы. Убедиться, что Postgres получил 4 новые колонки `physical_packaging_*` в таблицах `products` и `_products_v` (`psql $DATABASE_URI -c "\d products"`).

- [X] T004 Сгенерировать formal migration файл через `cd apps/web && pnpm exec payload migrate:create add_product_physical`. Результат — файл `apps/web/src/migrations/YYYYMMDDHHMMSS_add_product_physical.ts` с `up` (CREATE COLUMN) и `down` (DROP COLUMN) для prod-деплоя. Закоммитить файл миграции.

- [X] T005 Запустить `pnpm --filter @soliton/web generate:types` — обновится `apps/web/src/payload-types.ts`. Проверить что у типа `Product` появилось поле `physicalPackaging?: { weightGrams?: number | null; lengthMm?: number | null; ... }`.

- [X] T006 [P] Обновить TypeScript-интерфейс `CartItemForShipping` в `apps/web/src/lib/shipping/types.ts`: переименовать поля `weight/length/width/height` на `weightGrams/lengthMm/widthMm/heightMm` (с JSDoc-комментариями про единицы измерения). Также проверить — если есть отдельный `OrderItemForShipment` тип, применить аналогичное переименование. Сделать в одном коммите.

**Checkpoint**: Foundation готов — БД содержит новые колонки, типы синхронизированы, все user stories теперь разблокированы.

---

## Phase 3: User Story 1 — Покупатель видит реалистичную стоимость доставки (Priority: P1) 🎯 MVP

**Goal**: При расчёте доставки система использует реальные физические параметры товара из каталога (если заполнены), иначе дефолты. Для qty>1 каждая единица = отдельное место в запросе к ApiShip.

**Independent Test**: Залить в админке физпараметры для тестового товара (например, 8 кг, 1500×100×100 мм). Сделать `POST /api/shipping/calculate` с одной единицей этого товара → стоимость доставки должна быть заметно выше дефолтного расчёта. Для qty=5 — кратно больше qty=1. Для товара без physical — расчёт идентичен dev'у до фичи.

### Tests for User Story 1 ⚠️

> Тесты пишутся ПЕРЕД реализацией, должны FAIL до изменений в mapper'е.

- [X] T007 [P] [US1] В файле `apps/web/src/lib/shipping/apiship/__tests__/mappers.test.ts` добавить группу `describe('toCalculatorRequest — physical packaging (060)')` с 4 test cases по C1–C5 из `contracts/mappers-internal-contract.md`: (a) qty=5 → places.length===5, все одинаковые; (b) item с physical → place использует реальные значения; (c) per-axis fallback (weightGrams есть, lengthMm нет → length из defaults); (d) clamp dimensions to min 1 cm; (e) cost — per-place, не sum*qty.

- [X] T008 [P] [US1] В том же файле добавить группу `describe('toOrderRequest — quantity expansion (060)')` с тестами O1–O5: places.length === Σ quantity, top-level `order.weight` = сумма всех places, конверсия mm→cm. Запустить `pnpm --filter @soliton/web test mappers` — все новые тесты должны FAIL.

### Implementation for User Story 1

- [X] T009 [US1] Переработать `toCalculatorRequest` в `apps/web/src/lib/shipping/apiship/mappers.ts`: заменить `items.map(...)` на `items.flatMap(...)` с экспансией по `item.quantity`. Внутри использовать per-axis fallback на `settings.defaults.weight/length/width/height`. Конверсия mm→cm через `Math.max(1, Math.round(mm/10))`. `cost` per-place = `item.price` (не `item.price * item.quantity`). Запустить тесты T007 — должны PASS.

- [X] T010 [US1] Переработать `toOrderRequest` в том же файле: аналогичная flatMap-экспансия по `order.items[i].quantity`, формирование `places[]` массива длиной Σ quantity. Top-level `order.weight` = сумма весов всех мест. Каждый `place.items[0].quantity` = 1, `place.items[0].weight = item.weightGrams ?? defaults.weight`. Запустить тесты T008 — должны PASS.

- [X] T011 [US1] Добавить enrichment-блок в `apps/web/src/app/api/shipping/calculate/route.ts`: после валидации body, перед `provider.calculate()` сделать `payload.find({collection:'products', where:{sku:{in: skus}}, depth: 0, limit: 100})`, построить `Map<sku, physicalPackaging>` и подмешать поля weightGrams/lengthMm/widthMm/heightMm в `body.items` перед передачей в провайдер. См. блок кода в `contracts/shipping-calculate-request.md`. Если товар не найден в БД (удалён, опечатка в SKU) — оставить поля undefined → fallback на defaults в маппере.

- [X] T012 [US1] Добавить симметричный enrichment в `ApiShipProvider.createShipment` в `apps/web/src/lib/shipping/apiship/provider.ts` (либо в wrapper-функции, если она есть выше по call chain). Lookup `payload.find` по SKU из `order.items`, подмешать physical-параметры в `order.items` перед вызовом `toOrderRequest(...)`. Логировать warning если SKU не найден (через `logRequest("createShipment.lookup-miss", {sku})`). Это требование FR-008 — реальная отправка использует те же физпараметры что и показанная клиенту стоимость.

- [X] T013 [US1] Проверить inline в браузере dev-сервера: открыть `http://localhost:3000/admin`, выбрать тестовый товар, заполнить `physicalPackaging` (8000 г, 1500×100×100 мм), сохранить. В новой вкладке `curl POST /api/shipping/calculate` с этим SKU и qty=1 в Москву (Тверская, индекс 115172) — ответ rates[].cost должен быть выше чем для того же товара без physical. Если ОК — US1 готов.

**Checkpoint**: US1 функционально полна. Покупатель видит реалистичные цены доставки, реальная отправка использует те же параметры, mapper корректно делит на места по quantity. P1-ценность доставлена.

---

## Phase 4: User Story 2 — Администратор заполняет физпараметры через UI (Priority: P2)

**Goal**: Контент-менеджер видит секцию «Физические параметры упаковки» в карточке товара с понятными подсказками, валидацией диапазонов, и индикатором незаполненности в списке товаров.

**Independent Test**: Зайти в `/admin/collections/products`, увидеть колонку с эмодзи-индикатором ✓/⚠ для каждого товара. Открыть карточку товара без физпараметров — увидеть секцию с подсказкой. Попытаться ввести `weightGrams: -10` или `300000` — увидеть inline-ошибку валидации, save заблокирован.

### Implementation for User Story 2

- [X] T014 [P] [US2] Создать custom Cell-компонент `apps/web/src/admin/cells/PhysicalPackagingStatus.tsx` (client component). Реализация по примеру в `contracts/product-physical-fields.md`: проверка filled = все 4 поля непустые, возвращает `<span>✓</span>` или `<span>⚠</span>` с tooltip-описанием. Цвет ⚠ — `#d97706` (янтарный) для привлечения внимания.

- [X] T015 [US2] В `apps/web/src/collections/Catalog.js` в `admin` блоке Products: (a) добавить `physicalPackaging` в `defaultColumns` (между `status` и `primaryCategory`); (b) зарегистрировать кастомный Cell через `admin.components.cells.physicalPackaging` (путь к T014 компоненту). Перезапустить dev-сервер — в админ-списке появится новая колонка с ✓/⚠.

- [X] T016 [US2] В описании группы `physicalPackaging` (admin.description) использовать пояснительный текст из контракта: «Заполните для точного расчёта стоимости доставки. Если пусто — используются дефолтные значения из настроек ApiShip.». Двуязычно через adminLabel. Если хочется — добавить отдельную description у каждого поля с примером (placeholder).

**Checkpoint**: US2 функционально полна. Админ может удобно заполнять физпараметры, видит индикатор пробелов в списке, валидация работает.

---

## Phase 5: User Story 3 — Партионный заказ учитывается корректно (Priority: P3)

**Goal**: При qty>1 каждая единица товара в корзине формирует отдельное место в запросе перевозчика, стоимость доставки масштабируется кратно количеству.

**Independent Test**: Те же самые проверки что и в US1, но с qty=5. Стоимость должна быть значимо больше чем для qty=1 (минимум ×3.5).

> **Примечание**: основная логика quantity expansion реализована в T009 (US1, mapper flatMap). Phase 5 — это формальная валидация инварианта через тесты и manual smoke. Если US1 готова, US3 чаще всего «уже работает» — но проверка обязательна.

### Implementation for User Story 3

- [X] T017 [P] [US3] В `apps/web/src/lib/shipping/apiship/__tests__/mappers.test.ts` добавить дополнительные test cases на смешанные сценарии: (a) одна корзина с 2 SKU, каждый со своим physical и qty>1 — итог 5 мест с правильными группами параметров; (b) корзина с одним SKU qty=10 — places.length===10 и все идентичны; (c) корзина с одним SKU без physical, qty=3 — 3 идентичных места на defaults. Тесты должны PASS благодаря T009 без дополнительных изменений в mapper'е.

- [X] T018 [US3] Выполнить manual smoke per quickstart.md, шаг 3 (qty=5): через `curl POST /api/shipping/calculate` с qty=5 одного SKU с заполненным physical. Сравнить с тем же запросом qty=1 — cost должен быть ≥ 3.5× (см. spec.md SC-002). Также проверить в логах `shipping_logs` что `places_count: 5`.

**Checkpoint**: Все три user story работают независимо и валидированы.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Финальные проверки качества и подготовка к деплою.

- [X] T019 [P] Запустить `pnpm typecheck` от корня — 0 errors. Если есть ошибки про новые поля — поправить.

- [X] T020 [P] Запустить `pnpm --filter @soliton/web exec eslint src/lib/shipping/apiship src/app/api/shipping/calculate src/collections/Catalog.js src/admin/cells/PhysicalPackagingStatus.tsx` — 0 errors, warnings допустимы.

- [X] T021 [P] Запустить `pnpm --filter @soliton/web test` — все тесты (включая новые из T007, T008, T017) проходят.

- [X] T022 Пройти end-to-end smoke per `quickstart.md` шаги 1–6: заполнить physical для товара через админку → добавить в корзину → проверить расчёт → проверить qty>1 → проверить fallback для товара без physical → проверить кеш-инвалидацию при изменении физпараметров.

- [X] T023 Создать коммит `feat(shipping): учёт реального веса и габаритов товаров в расчёте доставки` с понятным многострочным сообщением (что изменилось в Catalog.js, migration, mapper.ts, route.ts, provider.ts, payload-types.ts, admin Cell, tests).

- [X] T024 Смерджить ветку `060-shipping-package-dimensions` в `main` (`git checkout main && git merge --no-ff 060-shipping-package-dimensions`).

- [X] T025 Задеплоить на прод через `bash deploy/push.sh` (от корня). Скрипт сам применит migration через `payload migrate` (step 5c). Проверить что соприкосновение с проду прошло без ошибок.

- [ ] T026 На проде: попросить администратора заполнить physical-параметры для топ-10 SKU. Через 1 неделю проверить SC-005: доля заказов с доплатой после сортировки упала на ≥70%.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 — без зависимостей, может начаться немедленно.
- **Phase 2 (Foundational)**: T002–T006 — зависят от Phase 1; T003 после T002, T004 после T003, T005 после T002. T006 параллелен T002.
- **Phase 3 (US1, P1)**: T007–T013 — зависят от Phase 2 завершения.
- **Phase 4 (US2, P2)**: T014–T016 — зависят от Phase 2 (нужны колонки и типы).
- **Phase 5 (US3, P3)**: T017–T018 — зависят от Phase 3 (mapper уже изменён в US1).
- **Phase 6 (Polish)**: T019–T026 — зависят от завершения нужных user stories.

### User Story Dependencies

- **US1 (P1)**: независима после Phase 2. Может быть выполнена и поставлена как MVP.
- **US2 (P2)**: независима от US1 — UX admin-панели работает даже если enrichment в route не добавлен.
- **US3 (P3)**: технически реализуется как побочный эффект T009 (mapper flatMap в US1). Phase 5 = валидация инварианта.

### Within Each User Story

- Тесты (T007, T008, T017) пишутся ПЕРЕД соответствующей реализацией mapper'а.
- US1: T009 (mapper) → T010 (mapper) → T011 (route enrichment) → T012 (provider lookup) → T013 (manual smoke).
- US2: T014 (Cell) || T015 (config) — могут идти параллельно если делает два человека. T016 в конце.
- US3: T017 (tests) → T018 (smoke).

### Parallel Opportunities

- T006 параллелен с T002–T005 (разные файлы: types.ts vs Catalog.js/migrations).
- T007 || T008 (один и тот же тестовый файл, но разные describe-блоки — можно писать отдельно и коммитить вместе).
- T014 || T015 (Cell-компонент и config-обновление в разных файлах).
- T019 || T020 || T021 (полная независимость проверочных команд).

---

## Parallel Example: User Story 1 implementation

```bash
# Терминал 1 — тесты (написать первыми, должны FAIL):
$ pnpm --filter @soliton/web test mappers --watch
# Параллельно редактировать __tests__/mappers.test.ts (T007 + T008)

# Терминал 2 — mapper:
# Редактировать apps/web/src/lib/shipping/apiship/mappers.ts (T009 + T010)
# Тесты в Терминале 1 должны переключиться с FAIL на PASS

# Терминал 3 — route + provider:
# Редактировать apps/web/src/app/api/shipping/calculate/route.ts (T011)
# Редактировать apps/web/src/lib/shipping/apiship/provider.ts (T012)
# Smoke-test через curl (T013)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ✅ Phase 1 Setup (T001) — окружение готово.
2. ✅ Phase 2 Foundational (T002–T006) — схема и типы.
3. ✅ Phase 3 US1 (T007–T013) — расчёт работает с реальными данными.
4. **STOP & VALIDATE**: проверить US1 в чекауте.
5. **Deploy MVP** — можно уже задеплоить (но желательно добавить admin-UX из US2 чтобы Owner мог заполнить данные).

### Incremental Delivery (рекомендуемый)

1. **MVP slice (бэк ready, ручной UX)**: Phases 1 + 2 + 3 → деплой. Заполнить physical для топ-3 SKU через SQL/прямой admin (поля уже есть из Phase 2, T002).
2. **Admin UX slice**: добавить US2 (T014–T016) → деплой. Контент-менеджер заполняет остальные SKU удобно.
3. **Validation slice**: добавить US3 (T017–T018) — формализация и финальные тесты.
4. **Polish + deploy**: T019–T026 — финальные проверки и обещание SC-005.

### Single-Developer Strategy

Текущий проект — single-developer. Параллелизация ограничена; задачи выполняются последовательно. Но порядок внутри stories важен: тесты до реализации, foundation до US, US1 до US3 (потому что US3 опирается на mapper из US1).

---

## Notes

- **Frontend (PhysicalCheckoutForm, CheckoutShippingClient, DeliveryBlock) НЕ меняется** — фронт продолжает шлать `{sku, quantity, price}`, enrichment делается на сервере.
- **Кеш-логика не меняется** — fingerprint в `provider.ts` уже учитывает physical-поля items. Инвалидация автоматическая.
- **Существующие 66 продуктов** работают без изменений сразу после миграции — поля null = fallback на defaults.
- **Rollback**: миграция down-able. Колонки nullable, можно DROP без потери данных в других полях.
- Commit после каждой задачи или логической группы (например, T002–T006 одним коммитом «foundation», T007–T013 — «US1», и т.д.).
- Verify тесты падают перед реализацией T009/T010.
- Avoid: смешивание изменений US1 и US2 в один коммит, изменения вне scope (например, `apiship-settings.defaults` — не трогаем, остаётся как safety-net).
