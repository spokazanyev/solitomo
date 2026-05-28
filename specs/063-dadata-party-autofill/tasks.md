---
description: "Task list for DaData Party Autofill (063)"
---

# Tasks: DaData Party Autofill (063)

**Input**: Design documents from `/specs/063-dadata-party-autofill/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Включены целевые unit-тесты (`isValidInn`, `partyToRequisites`) — явно заданы в plan.md (Testing) и контрактах. Полноценный TDD-suite не запрашивался; интеграция проверяется ручным smoke (quickstart.md).

**Organization**: Задачи сгруппированы по user story (US1/US2/US3) для независимой поставки.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно выполнять параллельно (другой файл, нет зависимостей от незавершённых задач)
- **[Story]**: к какой user story относится задача
- Все пути — от корня репозитория

## Path Conventions

Монорепо Next.js + Payload: код в `apps/web/src/`. Тесты — рядом, в `__tests__/` (Vitest).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Подготовка окружения. Новых npm-зависимостей и миграций БД нет (см. plan.md).

- [X] T001 Проверить, что DaData сконфигурирован (`DADATA_API_KEY` в env или `ApiShipSettings.dadata.apiKey`) и что `suggest/party` доступен на текущем тарифе «Подсказки» (Token-only, без X-Secret) — research.md R1. Зафиксировать достаточность дневного лимита для B2B-трафика (Assumption спеки).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Общие изменения, нужные нескольким историям. Один общий файл `events.ts` правится один раз, чтобы избежать конфликтов между US1 и US2.

**⚠️ CRITICAL**: Должно быть завершено до начала работы над US1/US2.

- [X] T002 Добавить в `apps/web/src/lib/analytics/events.ts` три имени события в union `AnalyticsEventName` (`company_suggest_shown`, `company_selected`, `company_status_warning`) и три typed-helper: `trackCompanySuggestShown({ formType, resultsCount })`, `trackCompanySelected({ formType, hasKpp, hasLegalAddress })`, `trackCompanyStatusWarning({ formType, status })`. Payload без сырых ИНН/наименования (research.md R6).

**Checkpoint**: Аналитический слой готов — можно начинать истории.

---

## Phase 3: User Story 1 — Автозаполнение по названию или ИНН (Priority: P1) 🎯 MVP

**Goal**: Клиент вводит название или ИНН в едином поле, выбирает организацию из списка, и поля `companyName, inn, kpp, ogrn, legalAddress` заполняются автоматически.

**Independent Test**: На чекауте юрлица ввести реальное название (и отдельно ИНН) → появляется список (название + ИНН в строке) → выбор заполняет 5 полей корректно; у ИП КПП пустой без ошибки.

### Implementation for User Story 1

- [X] T003 [US1] В `apps/web/src/lib/dadata/client.ts` добавить `SUGGEST_PARTY_URL`, типы `DadataPartyData`/`DadataPartySuggestion` (data-model.md §1) и `suggestParty(query, count=7)`: `getClient(false)` (Token-only), try/catch → `[]` при ошибке (зеркало `suggestFio`), фильтр `branch_type !== "BRANCH"` (только головная, research.md R4).
- [X] T004 [US1] Создать `apps/web/src/lib/dadata/party-normalize.ts` с `partyToRequisites(data: DadataPartyData): CompanyRequisites` (data-model.md §2): маппинг 5 полей + `status` + `isRisky = status ∈ {LIQUIDATING,LIQUIDATED,BANKRUPT}`; отсутствующие поля → `""` (FR-006). Зависит от T003 (импорт типа).
- [X] T005 [P] [US1] Unit-тест `apps/web/src/lib/dadata/__tests__/party-normalize.test.ts`: маппинг полного юрлица, ИП без КПП, отсутствующий адрес/ОГРН, `isRisky` для каждого статуса. Зависит от T004.
- [X] T006 [US1] Создать `apps/web/src/app/api/dadata/party/route.ts` (зеркало `fio/route.ts`, contracts/dadata-party-api.md): `runtime="nodejs"`, `dynamic="force-dynamic"`, body `{query,count?}`, `count` зажат в [1..10], пустой query → `{suggestions:[]}`, вызывает `suggestParty`. Зависит от T003.
- [X] T007 [US1] Создать `apps/web/src/components/checkout/CompanySuggestInput.tsx` (contracts/company-suggest-input.md): debounce 300 мс, запрос при `query.trim().length>=3`, fetch `/api/dadata/party`, двухстрочные строки (название + ИНН/адрес — FR-003), `onMouseDown`-pick → `onSelect(partyToRequisites(data))`, эмит `trackCompanySuggestShown` при непустом списке, БЕЗ `data-yandex-metrika-mask` (FR-016). Зависит от T002, T004, T006.
- [X] T008 [US1] Интегрировать `CompanySuggestInput` в `apps/web/src/components/cart/InvoiceCheckoutForm.tsx`: разместить в блоке «Реквизиты юрлица»; `onSelect(req)` безусловно вызывает все 5 setters (overwrite-on-reselect, R8/Q2) + `setCompanyStatus(req.status)` + сброс `innValidationFiredRef` + `trackCompanySelected`. 5 полей остаются редактируемыми (FR-005). Зависит от T007.

**Checkpoint**: US1 функциональна и тестируема независимо — поиск, список, автозаполнение 5 полей. MVP.

---

## Phase 4: User Story 2 — Контроль ИНН и предупреждение о статусе (Priority: P2)

**Goal**: Локальная проверка контрольной суммы ИНН (10/12) блокирует отправку при некорректном ИНН; рисковый статус контрагента (ликвидация/банкротство) показывает предупреждение, не блокируя оформление.

**Independent Test**: Ввести ИНН с неверной контрольной цифрой → ошибка + кнопка неактивна; исправить → ошибка исчезает. Выбрать ликвидированную/банкротную организацию → предупреждение, кнопка активна.

### Implementation for User Story 2

- [X] T009 [P] [US2] Создать `apps/web/src/lib/dadata/inn.ts` с `isValidInn(inn): boolean` — контрольная сумма 10/12 по алгоритму ФНС (contracts/inn-validation.md); вне длин 10/12 → `false`. Независим от US1.
- [X] T010 [P] [US2] Unit-тест `apps/web/src/lib/dadata/__tests__/inn.test.ts` по тест-кейсам из contracts/inn-validation.md (валидные 10/12, неверная контрольная, 9/11 цифр, не-цифры, пусто). Зависит от T009.
- [X] T011 [US2] В `InvoiceCheckoutForm.tsx`: заменить гейт `/^[0-9]{10,12}$/` в `baseLegalReady` на `isValidInn(inn.trim())` (FR-007); добавить UI-ошибку под полем ИНН только при длине 10/12 и `isValidInn===false` (FR-008); обновить `handleInnBlur` (errorCode `inn_checksum` при неверной сумме). Зависит от T009, T008 (тот же файл — после US1).
- [X] T012 [US2] В `InvoiceCheckoutForm.tsx`: блок-предупреждение (`role="alert"`) рядом с реквизитами при `companyStatus ∈ {LIQUIDATING,LIQUIDATED,BANKRUPT}` (FR-009), кнопка остаётся активной; эмит `trackCompanyStatusWarning`. `REORGANIZING`/`ACTIVE` — без предупреждения. Зависит от T008, T002 (тот же файл — после T011).

**Checkpoint**: US1 + US2 работают независимо; некорректный ИНН не отправляется, рисковый статус виден.

---

## Phase 5: User Story 3 — Ручной ввод как запасной путь (Priority: P3)

**Goal**: При отсутствии организации в базе, недоступности сервиса или исчерпании лимита клиент заполняет реквизиты вручную и оформляет заказ без блокировки.

**Independent Test**: Ввести запрос без совпадений → пустой список → ручной ввод 5 полей → заказ отправляется. Убрать `DADATA_API_KEY` → поле работает как текст, чекаут проходит.

### Implementation for User Story 3

- [X] T013 [US3] Подтвердить и при необходимости упрочнить мягкую деградацию: `suggestParty`/route возвращают `[]` при ошибке/несконфигурированном DaData (FR-012), `CompanySuggestInput` при пустом списке работает как обычное поле и не кидает ошибок (FR-010). Затрагивает `client.ts` (T003), `party/route.ts` (T006), `CompanySuggestInput.tsx` (T007).
- [X] T014 [US3] В `InvoiceCheckoutForm.tsx`: убедиться, что очистка поля подсказок НЕ сбрасывает ранее заполненные/отредактированные значения 5 полей (US3 AC3) — поле подсказок и поля реквизитов держат независимый state. Зависит от T008 (тот же файл — после US2-задач).

**Checkpoint**: Все три истории независимо функциональны; ручной путь не деградирует.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 [P] Прогнать `pnpm typecheck` и `pnpm lint` (из корня) — strict-режим без ошибок.
- [X] T016 [P] Прогнать `pnpm --filter @soliton/web test` — `inn.test.ts` + `party-normalize.test.ts` зелёные.
- [X] T017 Ручной smoke по `quickstart.md` (6 сценариев): автозаполнение по названию/ИНН, checksum-блок, предупреждение о статусе, ручной fallback, перевыбор. Проверить в Network, что запрос идёт на `/api/dadata/party` без `Authorization` в браузере (FR-011).
- [X] T018 [P] С `NEXT_PUBLIC_ANALYTICS_DEBUG=true` проверить в `window.dataLayer`: `company_suggest_shown` (results_count), `company_selected` (has_kpp/has_legal_address), `company_status_warning` (status); payload без сырых ИНН/наименования (R6).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей.
- **Foundational (Phase 2)**: после Setup; блокирует истории (общий `events.ts`).
- **US1 (Phase 3)**: после Foundational.
- **US2 (Phase 4)**: checksum-часть (T009/T010) независима и может идти параллельно US1; форменные задачи (T011/T012) зависят от US1 (T008) и идут после.
- **US3 (Phase 5)**: после US1 (деградация её пути); T014 — после US2 (тот же файл).
- **Polish (Phase 6)**: после нужных историй.

### Within Each User Story

- US1: T003 → T004 → (T005 ∥ T006) → T007 → T008.
- US2: T009 → T010 (тест); T011 и T012 — последовательно (один файл), после T008.
- US3: T013 (lib/route/component); T014 — после форменных задач.

### Same-file constraint (НЕ параллелить)

`apps/web/src/components/cart/InvoiceCheckoutForm.tsx` правится в T008 → T011 → T012 → T014 — строго последовательно, в этом порядке.

### Parallel Opportunities

- T005 ∥ T006 (тест нормализации ∥ route — разные файлы).
- T009/T010 (US2 checksum) ∥ весь US1 — независимая ветка.
- T015/T016/T018 — параллельно в Polish.

---

## Parallel Example: старт после Foundational

```bash
# Ветка A (US1): T003 → T004 → T006/T007 → T008
# Ветка B (US2 checksum, параллельно A):
Task: "Создать isValidInn в apps/web/src/lib/dadata/inn.ts"          # T009
Task: "Unit-тест apps/web/src/lib/dadata/__tests__/inn.test.ts"      # T010
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1).
2. **STOP & VALIDATE**: автозаполнение реквизитов одной подсказкой работает (SC-001). Демо-готово.

### Incremental Delivery

1. Setup + Foundational → база.
2. US1 → независимый тест → демо (MVP, автозаполнение).
3. US2 → контроль ИНН + предупреждение → тест → демо.
4. US3 → гарантия ручного пути → тест.
5. Polish → typecheck/lint/test/smoke.

---

## Notes

- [P] = разные файлы, нет зависимостей от незавершённых задач.
- Схема БД и npm-зависимости не меняются.
- Токен DaData только на сервере (FR-011); проверяется в T017.
- Коммитить после каждой задачи или логической группы.
