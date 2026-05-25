---
description: "Task list for 051-order-numbering-and-immutability"
---

# Tasks: Order Numbering and Immutability

## Phase 1: Setup

- [ ] T001 Создать ветку `051-order-numbering-and-immutability`. Подготовить каталог `apps/web/src/lib/lifecycle/` (уже существует из 047) для новых модулей `client-number.ts` и `immutability.ts`.

## Phase 2: Foundational — Schema & Migration

- [ ] T002 В `apps/web/src/collections/Orders.js` добавить поля `clientNumber` (unique, indexed, readOnly) и `clientNumberReissueReason` по `data-model.md §1`. Обновить `admin.defaultColumns` (`clientNumber` первой колонкой).
- [ ] T003 Создать миграцию `apps/web/src/migrations/2026XXXXXX-add-order-client-number.ts` по `data-model.md §7`: добавляет колонку (Payload сделает сам через `pnpm payload migrate:create`) и `CREATE SEQUENCE IF NOT EXISTS order_seq_${currentYear}` для текущего года.
- [ ] T004 Если в проекте ещё нет коллекции `admin-change-log` — создать минимальную по `data-model.md §5` и подключить в `payload.config.ts`.

## Phase 3: US1 — Генерация номера

- [ ] T005 [US1] Реализовать `apps/web/src/lib/lifecycle/client-number.ts` по контракту `contracts/clientNumber-generator.ts`:
  - функция `generateClientNumber(payload, options?)`;
  - выбор year по `Europe/Moscow` TZ из `options.now ?? new Date()`;
  - lazy `CREATE SEQUENCE IF NOT EXISTS order_seq_${year}`;
  - `SELECT nextval('order_seq_${year}')`;
  - format `SO-${year}-${String(n).padStart(4, "0")}` (без padding при n ≥ 10000);
  - retry до 3 раз при unique-constraint конфликте (защита от рассинхрона sequence ↔ table).
- [ ] T006 [US1] Подключить генерацию в `Orders.js` beforeChange (operation=create, при отсутствии `clientNumber`).
- [ ] T007 [US1] Обновить mapper'ы:
  - `apps/web/src/lib/crm/twenty/mappers.ts` — `Opportunity.name = "${clientNumber} — ${customerLabel}"`;
  - `apps/web/src/lib/shipping/apiship/mappers.ts` (или эквивалент) — `OrderRequest.clientNumber = order.clientNumber ?? order.id`.
- [ ] T008 [US1] Подмешать `clientNumber` в email-stub 047 (`apps/web/src/lib/notifications/email-stub.ts` или эквивалент) — `subject = "[${clientNumber}] ${baseSubject}"` для шаблонов `T-001/T-003/T-005/T-008`.
- [ ] T009 [US1] Vitest concurrency-тест: создать параллельно 50 заказов через `Promise.all` → все получают уникальные `clientNumber`, никаких дубликатов.

## Phase 4: US2 — Иммутабельность

- [ ] T010 [US2] Реализовать `apps/web/src/lib/lifecycle/immutability.ts`:
  - функция `checkPaidImmutability(data, originalDoc, operation)`;
  - список замороженных полей из `data-model.md §4`;
  - сравнение с deep-equality (для `items[]` и nested объектов);
  - возврат `{ allowed: boolean, violations: string[] }`.
- [ ] T011 [US2] Подключить в `Orders.js` beforeChange (operation=update, `originalDoc.payment?.paidAt != null` — `wasEverPaid`):
  - если есть violations → throw `ValidationError('items, totals.snapshotTotal: immutable after payment')`;
  - параллельно вызвать `payload.create({ collection: "admin-change-log", data: { changeType: "update", targetCollection: "orders", diffSummary: "order_mutation_rejected", ... } })`.
- [ ] T012 [US2] Vitest unit: 5 кейсов — paid+items, paid+totals.total, paid+priceSnapshot.cost, paid+customer.email, paid+internalComment (last → allowed).
- [ ] T013 [US2] Playwright e2e: оплаченный заказ → POST `/api/orders/${id}` с изменением items → 400 + запись в admin-change-log.

## Phase 5: Backfill

- [ ] T014 [P] Реализовать `apps/web/scripts/backfill-client-numbers.mjs`:
  - читает заказы без `clientNumber` в порядке `createdAt ASC`;
  - группирует по году `createdAt` (TZ Europe/Moscow);
  - для каждого года: `nextval('order_seq_${year}')` или `MAX(NNNN)+1` (fallback);
  - **dry-run по умолчанию**: показывает план «N заказов → SO-2025-0001..SO-2026-0042»;
  - `--apply` записывает в БД;
  - `--year=2025` для ограничения скоупа;
  - идемпотентность: повторный запуск ничего не делает (все заказы уже имеют clientNumber).

## Phase 6: Reissue

- [ ] T015 [P] Создать роут `apps/web/src/app/api/admin/orders/[id]/reissue-number/route.ts`:
  - POST с body `{ reason: string (≥10 chars) }`;
  - server-only, auth check;
  - вызывает `generateClientNumber()`, обновляет заказ, пишет в `admin-change-log` (`kind: "client_number_reissued"`);
  - старый номер → `history[].note`.

## Phase N: Polish & Docs

- [ ] T016 [P] Snapshot-тесты на email subject (49 шаблонов) — все содержат `[SO-YYYY-NNNN]` для шаблонов 001/003/005/008.
- [ ] T017 [P] Обновить `07-build-specifications/order-lifecycle-spec.md`: добавить упоминание `clientNumber` в этапы 6/7/9.
- [ ] T018 [P] Обновить `07-build-specifications/document-register.md`: запись о 051.
- [ ] T019 [P] Обновить `apps/web/AGENTS.md`: добавить ссылку на 051 в список активных фич.

## Phase R: Review Fixes (из REVIEW_NOTES.md)

- [ ] T-NEW-1 Patch 051 FR-5107 whitelist — добавить `hasReturns, returnsCount, totalRefunded, deliveredAt, closedAt, status, customerId, companyId, cartId` в список always-mutable полей.
- [ ] T-NEW-2 Реализовать `wasEverPaid` derived check в immutability hook вместо status-list. Триггер: `payment.paidAt != null`.
- [ ] T-NEW-3 Добавить `clientNumber` в OrderSnapshot (`events.ts`) и `buildOrderSnapshot()`.
- [ ] T-NEW-4 Документировать frozen-fields согласно lifecycle §13.5: `items[]`, `totals.snapshot*`, `delivery.priceSnapshot`, `customer.email`, `clientNumber`.
- [ ] T-NEW-5 Documentation update — обновить AGENTS.md, lifecycle-spec §13.

## Dependencies

- **Hard**: 047 (поля `paid`, `delivery.priceSnapshot`) — уже завершён.
- **Soft**: 048 (Twenty mapper) — если 048 ещё не релизнут, T007 для Twenty mapper делается «когда дойдём».
- **Soft**: 049 (email-stub matrix) — T008 правит существующий stub из 047 / нарождающийся matrix из 049.

## MVP

T002 + T003 + T005 + T006 + T010 + T011 + T014 = минимальный shippable slice (новые заказы получают номер, оплаченные защищены, существующие забэкфилены). T007/T008 — интеграционные правки (мягко зависят от состояния 048/049). T015 — отложить во вторую итерацию, если reissue в реальности не понадобится.
