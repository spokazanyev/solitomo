---
description: "Task list for 053-returns-and-refunds"
---

# Tasks: Returns & Refunds

**Input**: Design documents from `/specs/053-returns-and-refunds/`

**Prerequisites**: `spec.md`, `plan.md`, `data-model.md`, `contracts/returns-api.openapi.yaml`

**Tests**: Включены (Vitest для state machine, mappers, генератора КСФ; Playwright e2e — full flow от заказа до refund).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно делать параллельно (разные файлы, нет зависимостей).
- **[Story]**: US1 / US2 / US3 / US4 / US5 / US6 / FND.

---

## Phase 1: Foundational (Setup + State Machine + Schemas)

**⚠️ CRITICAL**: ни одна US не стартует без этого.

- [ ] **T001** [FND] Создать ветку `053-returns-and-refunds` (если ещё не) и каталоги:
  - `apps/web/src/lib/returns/`
  - `apps/web/src/lib/payments/` (если нет)
  - `apps/web/src/lib/documents/`
  - `apps/web/src/lib/fiscal/`
  - `apps/web/src/components/return/`
  - `apps/web/src/components/admin/returns/`
  - `apps/web/src/app/api/admin/returns/[id]/`
  - `apps/web/src/app/cart/order/[token]/return/`

- [ ] **T002** [FND] Создать миграцию PostgreSQL: sequence `returns_year_2026_seq` (и шаблон для следующих лет). Файл `apps/web/src/migrations/2026XXX-returns-sequences.ts`.

- [ ] **T003** [FND] Создать миграцию: sequence `credit_memos_year_2026_seq`. Тот же файл или отдельный.

- [ ] **T004** [FND] Создать `apps/web/src/lib/returns/state-machine.ts` со всеми `ALLOWED_TRANSITIONS`, `TERMINAL`, `assertTransition` (см. `data-model.md §4`). + unit-тесты `__tests__/state-machine.test.ts` на все переходы (positive + negative).

- [ ] **T005** [P] [FND] Создать `apps/web/src/lib/returns/number-generator.ts` — функция `generateReturnNumber()` использует `nextval('returns_year_NNNN_seq')` через Payload `db.execute` или direct `pg`. Idempotent guard: при повторном вызове в beforeChange не перегенерирует.

- [ ] **T006** [P] [FND] Создать `apps/web/src/lib/documents/credit-memo-number.ts` — аналогично, для `CM-YYYY-NNNN`.

- [ ] **T007** [FND] Создать Payload collection `apps/web/src/collections/Returns.ts` по `data-model.md §1`. Подключить в `payload.config.ts`.

- [ ] **T008** [FND] Расширить `apps/web/src/collections/Orders.js`: добавить `hasReturns`, `returnsCount`, `totalRefunded` (read-only), и `payment.refunds[]` array. Сгенерировать миграцию.

- [ ] **T009** [P] [FND] Создать Payload collection `apps/web/src/collections/FiscalCorrections.ts` по `data-model.md §3`. Подключить.

- [ ] **T010** [FND] Создать `apps/web/src/lib/returns/events.ts` — функция `emitReturnEvent(event, returnDoc, order)`; внутри вызывает существующий `emitDomainEvent` (из 047). События: `return.created`, `return.approved`, `return.rejected`, `return.received`, `return.refunded`, `return.cancelled`, `return.overdue`.

- [ ] **T011** [P] [FND] Создать `apps/web/src/lib/returns/policies.ts` — функции:
  - `isWithinShortWindow(deliveredAt: Date): boolean` (7 дней, ст. 26.1).
  - `isWithinExtendedWindow(deliveredAt: Date): boolean` (3 месяца, без письменной памятки).
  - `isNonReturnableSku(product): boolean` (по перечню ПП РФ № 2463 — пока stub).
  - `computeRefundAmount(returnItems, orderSnapshot): number` (в копейках).

- [ ] **T012** [FND] Реализовать хуки в `Returns.ts`:
  - `beforeChange`:
    - На create — вызов `generateReturnNumber()`, заполнение `orderNumberSnapshot`, snapshot позиций из Order, `requestedAt = now()`, начальный `status = requested`.
    - На update — `assertTransition(previous.status, data.status, data.statusReason)`, заполнение соответствующего `*At`, push в `history[]`.
  - `afterChange`:
    - На create — `emitReturnEvent("return.created", ...)`, обновить Order.computed.
    - На update (status changed) — `emitReturnEvent`, обновить Order.computed, при `refunded` + `legal` → trigger `generateCreditMemo`, при `refunded` → queue fiscal correction.

### Cross-spec patches (CRITICAL — блокеры имплементации)

- [ ] **T058** [FND] PATCH `status-machine.ts`: расширить `ALLOWED['completed']` значениями `['completed', 'delivered', 'returned']` под условием `reopenAuthorized=true`. + unit tests (positive case `completed → delivered` под `reopenAuthorized + disputeFlag = true`). См. FR-5316a.

- [ ] **T059** [FND] PATCH 051 spec.md FR-5107 whitelist: добавить `hasReturns, returnsCount, totalRefunded, payment.refunds[]` в whitelist always-mutable полей. + регрессионный тест в `Orders.beforeChange`. См. FR-5316b.

- [ ] **T060** [FND] PATCH 049 `notification-events.md`: добавить events `return.created/approved/rejected/refunded/overdue` + templates T-011 (customer-approved), T-012 (customer-rejected), T-013 (customer-refunded), T-014 (customer-order-returned), T-106 (manager-return-created), T-107 (manager-refunded), T-108 (manager-overdue). См. FR-5322a.

- [ ] **T061** [FND] PATCH 048 spec/contracts: добавить `return.*` events в FR-4804; стадии `Won.Refunded` / `Won.PartialRefund`; custom fields Opportunity: `returnsCount`, `totalRefunded`, `lastReturnNumber`. Запустить `pnpm crm:migrate-fields`. См. FR-5321a.

- [ ] **T062** [FND] Extend `DomainEventKind` в `apps/web/src/lib/lifecycle/events.ts`: добавить `return.created`, `return.approved`, `return.rejected`, `return.received`, `return.refunded`, `return.cancelled`, `return.overdue` + `ReturnSnapshot` тип. Обновить subscribers. См. FR-5301a.

### Additional test tasks

- [ ] **T063** [P] [FND] Race test для `RT-YYYY-NNNN` atomicity: `Promise.all` 5 concurrent creates — все должны получить уникальные номера. См. FR-5302.

- [ ] **T064** [P] [FND] Test rollback `completed → delivered` under `reopenAuthorized` — полный сценарий. Зависит от T058. См. FR-5316.

- [ ] **T065** [P] [US3] Test `Sum(refundAmount) ≤ Order.totals.total` validation: попытка превысить → error + admin escalation. См. FR-5308b.

**Checkpoint**: foundation готов. US можно стартовать параллельно.

---

## Phase 2: US1 + US2 — Публичная форма + admin approve (P1)

**Goal**: клиент оформляет возврат, менеджер одобряет/отклоняет.

### Tests for US1 + US2

- [ ] **T013** [P] [US1] Vitest `__tests__/policies.test.ts` — окна 7д / 3мес, refund amount.
- [ ] **T014** [P] [US1] Vitest `__tests__/returns-api.test.ts` (integration) — POST /api/returns создаёт запись, дедуп rate-limit.
- [ ] **T015** [P] [US1+US2] Playwright `e2e/return-flow.spec.ts` — full happy path до approve.

### Implementation

- [ ] **T016** [US1] Создать `apps/web/src/app/api/returns/route.ts`:
  - `POST` — body validation через zod (см. `contracts/returns-api.openapi.yaml`), резолв Order по `orderToken`, создаёт Return со `createdVia = customer-public`. Rate-limit: ≤3/час на токен.
  - `GET ?orderToken=...` — список Return по заказу (для UI повторного оформления).

- [ ] **T017** [P] [US1] Компонент `apps/web/src/components/return/ReturnableItemRow.tsx` — одна строка позиции (чекбокс + qty input ограничен `qtyAvailableForReturn`).

- [ ] **T018** [P] [US1] Компонент `apps/web/src/components/return/ReasonSelect.tsx`, `RefundMethodSelect.tsx`.

- [ ] **T019** [US1] Компонент `apps/web/src/components/return/ReturnForm.tsx` — собирает поля, валидирует, шлёт `POST /api/returns`, при успехе редиректит на `/cart/order/[token]/return/success/`.

- [ ] **T020** [US1] Страница `apps/web/src/app/cart/order/[token]/return/page.tsx` — резолв Order по token, проверка `status ∈ {delivered, completed}`, рендер `ReturnForm` с предзаполнением.

- [ ] **T021** [US1] Страница `apps/web/src/app/cart/order/[token]/return/success/page.tsx` — экран с номером RT, инструкцией, ссылкой на PDF заявления.

- [ ] **T022** [P] [US1] Расширить `apps/web/src/app/cart/order/[token]/page.tsx` — добавить компонент `ReturnButton` (баннер «Оформить возврат») при `status ∈ {delivered, completed}`.

- [ ] **T023** [P] [US1] `[needs-content]` Создать статическую страницу `apps/web/src/app/policies/returns/page.tsx` — условия возврата (ст. 26.1, перечень ПП 2463, реквизиты). TODO для юриста владельца: структура страницы `/policies/returns/`. Тег `owner-review-required`.

- [ ] **T024** [US2] Admin actions API:
  - `apps/web/src/app/api/admin/returns/[id]/approve/route.ts` — POST, проверяет auth, валидирует переход, обновляет статус, эмитит event.
  - `.../reject/route.ts` — POST, обязательный `statusReason`.
  - `.../cancel/route.ts` — POST.

- [ ] **T025** [US2] Компонент `apps/web/src/components/admin/returns/ReturnActionsPanel.tsx` — кнопки Approve/Reject/Cancel/Received/Refund. Регистрируется как Payload custom view в Returns collection.

- [ ] **T026** [P] [US2] Компонент `apps/web/src/components/admin/returns/ReturnTimelinePanel.tsx` — read-only history из `history[]`.

- [ ] **T027** [US2] В `apps/web/src/lib/notifications/matrix.ts` зарегистрировать правила:
  - `return.created` → `T-014-return-received` (manager).
  - `return.approved` → `T-015-return-approved` (customer).
  - `return.rejected` → `T-015-return-rejected` (customer).

- [ ] **T028** [P] [US2] Создать шаблоны email:
  - `apps/web/src/lib/notifications/templates/T-014-return-received.tsx`
  - `apps/web/src/lib/notifications/templates/T-015-return-approved.tsx` (с адресом склада, инструкцией, ссылкой на PDF заявления)
  - `apps/web/src/lib/notifications/templates/T-015-return-rejected.tsx` (с обоснованием).

**Checkpoint US1+US2**: клиент оформляет, менеджер одобряет, клиент получает инструкцию email.

---

## Phase 3: US3 — ЮKassa Refund + чек коррекции 54-ФЗ (P1)

### Tests for US3

- [ ] **T029** [P] [US3] Vitest `__tests__/yookassa-refunds.test.ts` — mock axios, проверяем body, headers (Idempotence-Key), маппинг ответа.
- [ ] **T030** [P] [US3] Vitest integration — full refund flow с моком ЮKassa.

### Implementation

- [ ] **T031** [US3] Создать `apps/web/src/lib/payments/yookassa-refunds.ts`:
  ```ts
  export async function createRefund(input: {
    paymentId: string;
    amount: number;      // копейки
    description: string;
    idempotencyKey: string;
  }): Promise<{ id: string; status: "succeeded"|"pending"|"canceled"; amount: number; }>
  ```
  REST POST `https://api.yookassa.ru/v3/refunds`, basic auth из `paymentsSettings`, headers `Idempotence-Key`, маппинг response.

- [ ] **T032** [US3] API route `apps/web/src/app/api/admin/returns/[id]/received/route.ts` — POST: переход `approved → received`.

- [ ] **T033** [US3] API route `apps/web/src/app/api/admin/returns/[id]/refund/route.ts` — POST:
  1. Резолв Return + Order.
  2. Если `refundMethod = card-original` — вызов `yookassa-refunds.createRefund`.
  3. Если `refundMethod = bank-transfer / other` — переход в `refunded` с записью в `manualRefundConfirmation`.
  4. Сохранить `refundProviderRef`, push в `Order.payment.refunds[]`, status → `refunded`, `refundedAt = now()`.
  5. Эмит `return.refunded`.

- [ ] **T034** [P] [US3] Шаблон email `apps/web/src/lib/notifications/templates/T-016-return-refunded.tsx` — для customer и manager.

- [ ] **T035** [P] [US3] Зарегистрировать `return.refunded` в `notification-matrix.ts`.

- [ ] **T036** [US3] Создать `apps/web/src/lib/fiscal/correction-receipt.ts` — функция `queueCorrectionReceipt(returnDoc)`: создаёт запись в `fiscal-corrections` с `status=pending_manual`, эмитит admin-notification «Создайте чек коррекции вручную в ККТ» с deep-link.

- [ ] **T037** [P] [US3] При `Order.payment.providerPaymentId` отсутствует (например, оплата ПП) — `correctionReceiptStatus = not_required` (НДС-плательщик отчитывается через КСФ, а не чек).

- [ ] **T038** [US3] Cron `apps/web/src/app/api/cron/payment-refund-polls/route.ts` — раз в 30 сек проверяет `Return.refundProviderRef WHERE providerStatus=pending`, опрашивает ЮKassa `GET /v3/refunds/{id}`, обновляет.

**Checkpoint US3**: refund в ЮKassa работает, T-016 уходит, fiscal-correction job создаётся.

---

## Phase 4: US4 — ApiShip return-shipment (P2)

### Tests for US4

- [ ] **T039** [P] [US4] Vitest unit — `createReturnShipment` маппит на ApiShip-payload корректно.

### Implementation

- [ ] **T040** [US4] Расширить `apps/web/src/lib/shipping/apiship/provider.ts` — метод `createReturnShipment` (см. `plan.md §Integration Points`). Маппится на `OrdersApi.createReturnOrder` или fallback на ручной addOrder с `isReturn`.

- [ ] **T041** [US4] API route `apps/web/src/app/api/admin/returns/[id]/create-return-shipment/route.ts` — POST, вызывает provider, сохраняет `apiShipReturnOrderId` и `returnLabelUrl`.

- [ ] **T042** [US4] Расширить `apps/web/src/app/api/webhooks/apiship/route.ts` (из 047): если `providerOrderId` есть в `returns.apiShipReturnOrderId`, при событии `delivered` → перевести Return в `received`.

- [ ] **T043** [P] [US4] Шаблон T-015 расширить условным блоком: если `returnLabelUrl` — добавить ссылку на этикетку в email.

**Checkpoint US4**: return через службу доставки оформляется, webhook автоматически переводит в `received`.

---

## Phase 5: US5 — Корректировочный счёт-фактура (P2)

### Tests for US5

- [ ] **T044** [P] [US5] Vitest snapshot-тест на PDF-payload КСФ для тестового заказа `type=legal`.

### Implementation

- [ ] **T045** [US5] Создать `apps/web/src/lib/documents/credit-memo.ts`:
  - `generateCreditMemo(returnDoc, orderDoc): Promise<{ pdfUrl, creditMemoNumber }>`
  - Использует тот же PDF-движок, что счёт-фактура в 037 (pdfkit / puppeteer).
  - Шапка по УПД-1: исходный номер счёта-фактуры, дата, ИНН/КПП сторон.
  - Позиции из `return.items[]` со ставкой НДС из snapshot.
  - Сумма со знаком «—».
  - Уникальный `creditMemoNumber` через `credit-memo-number.ts`.
  - Сохраняет PDF в Payload Media, возвращает URL.

- [ ] **T046** [US5] В `Returns.afterChange` при переходе → `refunded` И `Order.type === "legal"` → вызов `generateCreditMemo`. При ошибке — `documentsError`, admin-уведомление.

- [ ] **T047** [P] [US5] API route `apps/web/src/app/api/admin/returns/[id]/regenerate-credit-memo/route.ts` — POST, ручной перегенератор.

- [ ] **T048** [US5] Шаблон T-016 для юрлица расширить ссылкой на КСФ PDF.

- [ ] **T049** [P] [US5] Проверка шаблона УПД с бухгалтером владельца перед prod (review-step, не код).

**Checkpoint US5**: для юрлица автоматически генерируется КСФ, ссылка в email.

---

## Phase 6: US6 — Аналитика + Cron + Polish (P3 + ops)

### Implementation

- [ ] **T050** [US6] Компонент `apps/web/src/components/admin/returns/ReturnAnalyticsBanner.tsx` — три виджета (доля возвратов 30д, средний срок, top-5 SKU). Подключить как Payload custom view выше списка returns.

- [ ] **T051** [P] [ops] Cron `apps/web/src/app/api/cron/returns/auto-reminder-manager/route.ts` — раз в 24 ч, email менеджеру про `requested > 24h`.

- [ ] **T052** [P] [ops] Cron `apps/web/src/app/api/cron/returns/overdue-refund-alert/route.ts` — раз в 24 ч, выбирает Return старше 10 дней без refunded → emit `return.overdue`, шаблон T-017 для клиента + менеджера. Критично для ст. 22 Закона 2300-1.

- [ ] **T053** [P] [ops] Cron `apps/web/src/app/api/cron/returns/auto-cancel-stale/route.ts` — раз в 7 дней, `approved > 30 дней` → cancel со `statusReason = stale_no_item_received`. **Не действует** если истёк 10-day deadline (тогда escalate владельцу, заявка остаётся открытой).

- [ ] **T054** [P] [ops] Документация: пополнить `07-build-specifications/order-lifecycle-spec.md §6` ссылкой на спеку 053.

- [ ] **T055** [ops] CRM-sync (через 048): расширить `apps/web/src/lib/crm/matrix.ts` правилами `return.created`, `return.approved`, `return.rejected`, `return.refunded`. Запустить `pnpm crm:migrate-fields` для новых полей Opportunity (`returnsCount`, `totalRefunded`, `lastReturnNumber`).

- [ ] **T056** [ops] **Owner review-gate** перед production: блок «Возвраты / ЮKassa Refunds / КСФ» проверен и подписан владельцем. AGENTS.md high-risk requirement.

- [ ] **T057** [P] [ops] Playwright e2e: full flow от создания заказа → delivered → return form → approve → received → refund (ЮKassa sandbox) → проверка T-016 в mailtrap → проверка КСФ в Media.

**Checkpoint US6 + ops**: аналитика видна, cron работают, e2e зелёный.

---

## Dependency Graph (high-level)

```text
T001..T012 (FND) ─┬─► T013..T028 (US1+US2)
                  ├─► T029..T038 (US3)
                  ├─► T039..T043 (US4)
                  ├─► T044..T049 (US5)
                  └─► T050..T057 (US6 + ops)
```

US3 зависит от US1+US2 (нужна сама запись Return).
US4 зависит от US2 (action на approved).
US5 зависит от US3 (триггер — переход в refunded).
US6 не зависит от US3..US5, но имеет смысл после.

## Definition of Done

- [ ] Все T001..T057 закрыты.
- [ ] Vitest зелёный (state machine, mappers, policies, yookassa, credit-memo).
- [ ] Playwright e2e зелёный (full flow).
- [ ] AGENTS.md owner review подписан (T056).
- [ ] Шаблон КСФ проверен бухгалтером (T049).
- [ ] Документация в `order-lifecycle-spec.md §6` обновлена.
- [ ] В Twenty workspace появились кастомные поля Opportunity для returns (через T055).
