---

description: "Task list for feature 061 — Unified Checkout Summary"

---

# Tasks: Унификация сводки заказа в формах checkout

**Input**: Design documents from `/specs/061-unified-checkout-summary/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Включены (Vitest unit tests для нового компонента — см. R8 в research.md и 12 test cases в `contracts/order-summary-card-component.md`).

**Organization**: Задачи сгруппированы по user story из spec.md (US1 = P1, US2 = P2, US3 = P3). MVP = только US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно выполнять параллельно (разные файлы, без зависимостей)
- **[Story]**: метка US1 / US2 / US3 (соответствует user stories из spec.md)
- Все пути — от корня репозитория

## Path Conventions

Пути относительно корня монорепо `/Users/svp/Documents/GitHub/SMB/projects/solitomo-organic-site/`. Весь код фичи живёт в `apps/web/src/components/cart/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Подготовка окружения.

- [X] T001 Убедиться что текущая git-ветка `061-unified-checkout-summary`, dev-сервер `pnpm --filter @soliton/web dev` поднимается без ошибок и `pnpm --filter @soliton/web test` проходит на baseline (все ~493 теста PASS). Это даст эталон для сравнения после изменений.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Минимальный prerequisite — никаких миграций, никаких новых shared-типов; компонент новый и сам по себе изолирован. Этот шаг убеждается что зависимости (RfqCartItem, ConsentCheckbox, lucide-react) доступны для импорта.

**⚠️ CRITICAL**: Никакая user story не начинается, пока Phase 2 не подтверждена.

- [X] T002 Создать пустую папку для unit-тестов компонента: `mkdir -p apps/web/src/components/cart/__tests__/` (если ещё нет). Это необходимо до того как будут писаться test-файлы в US1.

**Checkpoint**: Foundation готова — окружение проверено, папка тестов существует, типы `RfqCartItem` / `ConsentCheckbox` / `LucideIcon` импортируются из существующих модулей без изменений.

---

## Phase 3: User Story 1 — Покупатель видит понятную структуру стоимости (Priority: P1) 🎯 MVP

**Goal**: Создать общий компонент `OrderSummaryCard` и заменить inline `<aside>` блоки в обеих формах. Юр-форма становится визуально идентичной до изменений (эталон). Физ-форма получает заголовок «Заказ», полный список с lineTotal, разделитель, три строки «Товары / Доставка / Итого».

**Independent Test**: открыть `/cart/checkout/invoice/` с 8 позициями → визуально 1-в-1 как на эталонном скрине. Открыть `/cart/checkout/physical/` с теми же 8 позициями и выбранной доставкой → список не обрезан, видны три строки структуры стоимости, заголовок «Заказ».

### Tests for User Story 1 ⚠️

> Тесты пишутся ПЕРЕД реализацией компонента, должны FAIL до его создания.

- [X] T003 [P] [US1] В файле `apps/web/src/components/cart/__tests__/OrderSummaryCard.test.tsx` написать тесты **T01–T07** из `contracts/order-summary-card-component.md`: (T01) рендер юр-режима с заголовком «Заказ»; (T02) физ-режим с платной доставкой — три строки; (T03) физ-режим с `deliveryCost===null` — подсказка про выбор; (T04) физ-режим с `deliveryCost===0` — «Самовывоз — бесплатно»; (T05) позиции «по запросу»; (T06) `knownCount===0` → итог «По запросу»; (T07) список из 20 позиций рендерится полностью. Запустить `pnpm --filter @soliton/web test OrderSummaryCard` — все 7 тестов должны FAIL.

### Implementation for User Story 1

- [X] T004 [US1] Создать `apps/web/src/components/cart/OrderSummaryCard.tsx` — React Client Component с `"use client"`. Реализовать строго по контракту в `contracts/order-summary-card-component.md`: props `OrderSummaryCardProps`, DOM-структура `<aside h-fit rounded-2xl border lg:sticky lg:top-4>`, заголовок «Заказ», список с grid `[1fr_auto]`, разделитель, режим юр (одна строка «Итого») и режим физ (три строки Товары/Доставка/Итого), error block, ConsentCheckbox, кнопка с loading-state, ctaHint. Никаких `pushEvent` импортов. Запустить тесты T003 — должны PASS.

- [X] T005 [US1] Заменить inline `<aside>` блок (строки ~322–377) в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx` на `<OrderSummaryCard ... />`. Props: `items, total, knownCount, unknownCount, ctaIcon={Receipt}, ctaLabel="Выписать счёт", ctaLoadingLabel="Создаём заказ...", ctaHint="После создания заказа вы получите счёт по email. Заказ начнёт движение после поступления оплаты.", loading={submitting}, disabled={!isLegalReady}, error={error}, consent={consent}, onConsentChange={setConsent}`. `showDeliveryLine` НЕ передавать (юр-форма не показывает строку доставки — FR-009).

- [X] T006 [US1] Заменить inline `<aside>` блок (строки ~305–366) в `apps/web/src/components/cart/PhysicalCheckoutForm.tsx` на `<OrderSummaryCard ... />`. Props те же что T005 плюс: `showDeliveryLine={true}`, `deliveryCost={selectedRate?.rate.cost ?? null}`, `deliveryLabel={selectedRate?.rate.providerKey === "pickup" ? "Самовывоз" : selectedRate?.rate.providerName ?? selectedRate?.rate.providerKey}`, `ctaIcon={CreditCard}`, `ctaLabel="Перейти к оплате"`, `disabled={!isReadyToPay}`, `unknownPaymentWarning={unknownCount > 0 && knownCount > 0 ? \`\${unknownCount} \${unknownCount === 1 ? "позиция" : "позиции"} без цены — оплата картой невозможна, нужен КП.\` : undefined}`. `ctaHint` — пока оставить старый текст, обновим в US3 (T013).

- [ ] T007 [US1] Manual smoke юр-формы per quickstart.md шаг 2: открыть локально `http://localhost:3000/cart/checkout/invoice/` с 3–5 позициями. Сравнить с эталонным скрином (приложен к задаче). Заголовок «Заказ», все позиции с lineTotal, разделитель, «Итого:», ConsentCheckbox, кнопка с Receipt-иконкой, подпись про email-счёт. Если визуально 1-в-1 — US1 эталон-часть готова.

- [ ] T008 [US1] Manual smoke физ-формы per quickstart.md шаги 3–8: проверить пустую корзину (empty-state без sidebar), физ-форму без выбранной доставки (3 строки + подсказка), физ-форму с СДЭК (три строки с реальной ценой доставки), физ-форму с самовывозом («Самовывоз — бесплатно»), позиции «по запросу», длинный список 20+ позиций (без обрезки). Если все 6 сценариев корректны — US1 функциональная часть готова.

**Checkpoint**: US1 функционально полна. Покупатель видит понятную структуру стоимости в обеих формах. P1-ценность доставлена. Без US2 и US3 фича уже работает как MVP.

---

## Phase 4: User Story 2 — Унифицированное согласие и кнопка действия (Priority: P2)

**Goal**: Подтвердить что unified placement ConsentCheckbox + кнопки + loading + error работают одинаково в обеих формах. Технически реализовано в US1 (компонент один) — здесь добавляем тесты-инварианты и проверки изоляции.

**Independent Test**: открыть обе формы → визуальный порядок elements идентичен. Поставить/снять галочку → кнопка корректно меняет disabled. Перехватить сетевой запрос на 500 → ошибка появляется в одинаковом стиле в обеих формах.

### Tests for User Story 2 ⚠️

- [X] T009 [P] [US2] В `apps/web/src/components/cart/__tests__/OrderSummaryCard.test.tsx` добавить тесты **T08–T12** из контракта: (T08) кнопка disabled когда `disabled === true` или `consent === false`; (T09) loading-state показывает Loader2 + ctaLoadingLabel; (T10) error block между «Итого» и ConsentCheckbox; (T11) клик по ConsentCheckbox вызывает `onConsentChange`; (T12) статическая проверка изоляции аналитики — исходник компонента не содержит `pushEvent`, `data-layer`, `trackAddToRfq`. Запустить тесты — должны PASS (компонент уже реализован в US1).

### Implementation for User Story 2

- [X] T010 [US2] Verify визуальный inспектор: открыть обе формы и убедиться что **порядок элементов** идентичный — заголовок → список → итог (или 3 строки) → warning (если есть) → error (если есть) → ConsentCheckbox → кнопка → ctaHint. Отступы идентичные (`mt-3`, `mt-4`, `mt-5`). Это passive verification, code был написан правильно в US1.

- [X] T011 [US2] Verify behavioral test: в `OrderSummaryCard.test.tsx` явный assert что когда `loading === true`, `disabled === false`, `consent === true` — кнопка всё равно disabled (потому что loading). Когда `loading === false`, `disabled === false`, `consent === false` — кнопка disabled (потому что нет согласия). Когда все три false — кнопка enabled и кликается.

**Checkpoint**: US2 функционально полна. Все три источника disabled-state (loading, parent-disabled, consent) работают корректно. ConsentCheckbox toggle прокидывается в parent.

---

## Phase 5: User Story 3 — Обновлённый текст в физ-форме (Priority: P3)

**Goal**: Заменить устаревший текст «После реальной интеграции ЮKassa здесь будет переход на защищённую форму оплаты картой» (Q3 = yes, FR-015) на актуальный.

**Independent Test**: открыть `/cart/checkout/physical/` с непустой корзиной → под кнопкой видна обновлённая подпись. Слова «mock» и «реальная интеграция» отсутствуют.

### Implementation for User Story 3

- [X] T012 [US3] В `apps/web/src/components/cart/PhysicalCheckoutForm.tsx` обновить значение пропа `ctaHint`, передаваемого в `<OrderSummaryCard />` (T006), на: `"После создания заказа перенаправим на защищённую форму оплаты ЮKassa."`. Старый текст про «реальную интеграцию» из исходного файла удалить (если он остался inline где-то ещё).

- [X] T013 [US3] Verify per quickstart.md шаг 4 (конец) — на физ-форме под кнопкой виден новый текст. Grep `pnpm --filter @soliton/web exec grep -r "реальной интеграции\|mock" apps/web/src/components/cart/` → ничего не найдено.

**Checkpoint**: Все три user story функционально полны. Готовы к polish + deploy.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Финальные проверки качества и подготовка к деплою.

- [X] T014 [P] Запустить `pnpm typecheck` от корня → 0 errors.

- [X] T015 [P] Запустить `pnpm --filter @soliton/web exec eslint src/components/cart/OrderSummaryCard.tsx src/components/cart/InvoiceCheckoutForm.tsx src/components/cart/PhysicalCheckoutForm.tsx src/components/cart/__tests__/OrderSummaryCard.test.tsx` → 0 errors, допустимы warnings из стилистических правил.

- [X] T016 [P] Запустить `pnpm --filter @soliton/web test` → все ~493 + новые ~12 = ~505 тестов PASS.

- [X] T017 Пройти end-to-end smoke per quickstart.md шаги 1–12: unit-тесты, юр-форма, физ-форма (пустая, без доставки, с СДЭК, самовывоз, по запросу, 20 позиций), mobile layout (375px), server validation (обход через DevTools), аналитика в GA Debug View, typecheck+lint.

- [X] T018 Создать коммит `feat(checkout): унифицированная сводка заказа OrderSummaryCard` с понятным многострочным сообщением (что было — две разные правые колонки; что стало — общий компонент; какие FR закрыты; ссылка на спеку 061; что НЕ менялось — API/БД/аналитика/левая колонка/RFQ-форма).

- [X] T019 Смерджить ветку `061-unified-checkout-summary` в `main` через `git checkout main && git merge --no-ff 061-unified-checkout-summary`. Если есть конфликты — разрешить (наиболее вероятные — `payload-types.ts` или `.specify/feature.json`, которые могли быть изменены параллельно).

- [X] T020 Задеплоить на прод через `bash deploy/push.sh`. Скрипт сделает rsync + docker build + payload migrate (миграций для 061 нет, но команда run-out безвредно). Smoke-test через curl — `/cart/checkout/physical/` и `/cart/checkout/invoice/` отдают HTTP 200.

- [X] T021 На проде: открыть оба URL в браузере (hard-refresh `Cmd+Shift+R`), добавить через UI 2-3 товара в корзину, пройти до checkout, визуально подтвердить новые тексты и структуру стоимости. GA Debug View должен показать `checkout_step_*` события без регрессий.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 — без зависимостей.
- **Phase 2 (Foundational)**: T002 — после T001.
- **Phase 3 (US1, P1)**: T003–T008 — после Phase 2.
  - T003 (тесты) пишется ПЕРЕД T004 (компонент).
  - T005, T006 (замена в формах) после T004.
  - T007, T008 (manual smoke) после T005/T006.
- **Phase 4 (US2, P2)**: T009–T011 — после Phase 3 (компонент готов).
- **Phase 5 (US3, P3)**: T012–T013 — после T006 (Physical форма уже использует компонент).
- **Phase 6 (Polish)**: T014–T021 — после всех user stories.

### User Story Dependencies

- **US1 (P1)**: независима после Phase 2. Может быть выкачена как MVP без US2/US3.
- **US2 (P2)**: технически реализуется как побочный эффект US1 (компонент один). Phase 4 — формализация и тесты.
- **US3 (P3)**: тривиальный текст-fix. Зависит от T006 (форма должна использовать компонент с пропом `ctaHint`).

### Within Each User Story

- Тесты T03 пишутся до T04 (TDD).
- T04 (компонент) до T05/T06 (использование в формах).
- T05 || T06 (разные файлы — теоретически параллельно, но это всё в одной сессии).
- T07 || T08 (две разные страницы для manual smoke).

### Parallel Opportunities

- T014 || T015 || T016 (typecheck, lint, test — три независимых команды).
- T007 || T008 (два разных URL для manual smoke).

---

## Parallel Example: User Story 1 implementation

```bash
# Терминал 1 — TDD watch:
$ pnpm --filter @soliton/web test OrderSummaryCard --watch

# Терминал 2 — редактирование:
# 1. Написать T003 (test cases T01–T07) — тесты FAIL
# 2. Написать T004 (компонент) — тесты переключатся на PASS
# 3. Заменить inline aside в Invoice (T005) и Physical (T006)

# Терминал 3 — manual smoke:
# pnpm --filter @soliton/web dev
# Открыть /cart/checkout/invoice/ и /cart/checkout/physical/
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ✅ Phase 1 Setup (T001) — окружение готово.
2. ✅ Phase 2 Foundational (T002) — папка тестов создана.
3. ✅ Phase 3 US1 (T003–T008) — компонент создан, обе формы используют его.
4. **STOP & VALIDATE**: visually проверить юр-форму (эталон, не должна меняться) и физ-форму (новая структура стоимости).
5. **Deploy MVP** возможен — фича уже доставляет основную ценность.

### Incremental Delivery (рекомендуемый)

1. **MVP slice**: T001–T008 → деплой. Юр-форма как было, физ-форма с новой структурой стоимости и заголовком «Заказ».
2. **Polish slice**: T009–T013 (US2 + US3) → деплой. Финальные тесты + актуальный ЮKassa-текст.
3. **Verify slice**: T014–T021 — финальные проверки качества + deploy + prod smoke.

### Single-Developer Strategy

Текущий проект — single-developer. Параллелизация ограничена; задачи выполняются последовательно. Но порядок важен: TDD внутри US1 (T003 перед T004), компонент перед использованием в формах, текст-fix (US3) последним.

---

## Notes

- **Frontend изменения только**: `apps/web/src/components/cart/`. Backend (`/api/orders`, аналитика, БД) не трогается.
- **Левая колонка checkout-форм НЕ меняется** — задачи касаются только правой sticky-колонки.
- **RFQ-форма (`/cart/checkout/quote/`) НЕ трогается** (Q4 = no, scope boundary в спеке).
- **Существующие тесты** (~493) должны продолжать проходить.
- **Rollback тривиален**: `git revert <commit-hash> && bash deploy/push.sh`. Миграций БД нет.
- Commit после US1 (можно деплоить отдельно как MVP) или одним коммитом после Polish (если хочется одним релизом всё).
- Avoid: добавление import'а `pushEvent` в `OrderSummaryCard.tsx` (нарушает CT-16); изменение API `POST /api/orders`; правка `RfqCart.tsx` или `ConsentCheckbox.tsx`.
