# Tasks: ЮKassa Frontend Integration (056)

**Input**: Design documents from `/specs/056-yookassa-frontend-integration/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Включены OPTIONAL unit tests (паттерн 052/053/054/055). E2E manual через quickstart.md на test-shop ЮKassa.

**Organization**: 6 user stories (US1-US6, 4 P1 + 2 P2). Phase 3 (US4 email templates) идёт раньше Phase 4 (US3 polling page), потому что US4 — самостоятельный «отдельный сервис» (backend-side templates), а US3 зависит от Foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: параллельно (разные файлы, без зависимостей)
- **[Story]**: `US1..US6` (маппинг на spec.md US)
- Все пути — относительно repo root

## Path Conventions

Monorepo Next.js + Payload:
- Pages: `apps/web/src/app/(site)/payment/return/[orderId]/`
- Components: `apps/web/src/components/payment/`, `apps/web/src/components/checkout/`, `apps/web/src/components/cart/`
- Email templates: `apps/web/src/lib/notifications/templates/`
- Backend patch: `apps/web/src/app/api/orders/route.ts`
- Tests: `apps/web/src/components/payment/__tests__/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: env-проверка + создание директорий + stub-файлы для будущих модулей.

- [ ] T001 [P] Создать директорию `apps/web/src/components/payment/` (новый namespace) + создать `__tests__/` поддиректорию
- [ ] T002 [P] Создать директорию `apps/web/src/app/(site)/payment/return/[orderId]/`
- [ ] T003 [P] Verify env vars present: `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_BASE_URL` — все добавлены в 055; проверить + добавить `NEXT_PUBLIC_BASE_URL` если ещё нет

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: shared utilities + types + backend patch — нужны для всех US.

**⚠️ CRITICAL**: НИ один US-task не может стартовать до завершения Phase 2.

- [ ] T004 [P] Создать `apps/web/src/components/payment/types.ts` — TypeScript interfaces (`PaymentReturnState`, `PaymentReturnProps`) по data-model.md §1
- [ ] T005 [P] Создать `apps/web/src/components/payment/payment-polling-config.ts` — constants (`PAYMENT_POLLING_CONFIG`, `TerminalState`) по data-model.md §2
- [ ] T006 [P] Создать `apps/web/src/components/payment/payment-error-strings.ts` — `PAYMENT_ERROR_STRINGS` dictionary + `resolvePaymentError(code)` helper по data-model.md §3
- [ ] T007 [P] Создать `apps/web/src/components/payment/datalayer-events.ts` — `pushPurchaseEvent`, `pushPaymentIntentEvent` helpers по data-model.md §4
- [ ] T008 [US-NEW] **Backend patch** FR-5609: расширить `apps/web/src/app/api/orders/route.ts` — read `customer_session` cookie через `loadCustomerSession()`, если valid → set `Order.customerId` при create. См. research.md R7. Guest-checkout продолжает работать без session.
- [ ] T009 [P] Тесты `apps/web/src/components/payment/__tests__/payment-error-strings.test.ts` — 5+ test cases (known codes, unknown fallback, undefined input)

**Checkpoint**: Foundation готов — utilities, types, backend session-binding. US1-US6 могут стартовать параллельно.

---

## Phase 3: User Story 4 — 4 новых email-template (Priority: P1)

**Goal**: 4 новых email templates рендерятся через 049 emitter и доходят до customer/manager.

**Why first among US**: Backend 055 уже эмитит `payment.expired`, `payment.amount_mismatch`, `payment.receipt_failed`, `return.refund_failed` events. Без templates — NotificationJob.skipped, alerts не доходят. **Самый изолированный US** — можно работать без UI.

**Independent Test**: Триггернуть каждое из 4 событий через emitDomainEvent stub в test, убедиться что email rendered (`{subject, text, html}` непусто) + queued в NotificationJobs.

### Tests for User Story 4

- [ ] T010 [P] [US4] Тесты `apps/web/src/lib/notifications/templates/__tests__/t-015-payment-expired.test.ts` — happy path (full order) + edge (no cartId → fallback на /cart/)
- [ ] T011 [P] [US4] Тесты `t-109-amount-mismatch.test.ts` — render с full payment context + escape для special chars в clientNumber
- [ ] T012 [P] [US4] Тесты `t-110-receipt-failed.test.ts` — render + проверка severity-CSS в HTML
- [ ] T013 [P] [US4] Тесты `t-111-refund-failed.test.ts` — render для return event + correct reason mapping

### Implementation for User Story 4

- [ ] T014 [P] [US4] Реализовать `apps/web/src/lib/notifications/templates/t-015-payment-expired.ts` — customer email "Заказ {clientNumber} аннулирован", 2 CTAs (recovery + new-cart) по contracts/email-templates.md §T-015
- [ ] T015 [P] [US4] Реализовать `t-109-amount-mismatch.ts` — manager email с table (expected/actual/providerRef), severity HIGH по contracts §T-109
- [ ] T016 [P] [US4] Реализовать `t-110-receipt-failed.ts` — manager email с инструкциями по онлайн-кассе, severity CRITICAL (24h SLA) по contracts §T-110
- [ ] T017 [P] [US4] Реализовать `t-111-refund-failed.ts` — manager email с providerRefundId, путями решения по contracts §T-111
- [ ] T018 [US4] Зарегистрировать 4 шаблона в `apps/web/src/lib/notifications/templates/index.ts` REGISTRY map — добавить imports + entries

**Checkpoint**: 4 alerts работают end-to-end. Можно триггернуть webhook на staging и проверить inbox менеджера.

---

## Phase 4: User Story 1 — Физлицо платит картой (Priority: P1) 🎯 MVP

**Goal**: Customer проходит full checkout `/cart/checkout/physical/review/` → ЮKassa → success-page.

**Independent Test**: На test-shop ЮKassa с тестовой картой 5555 5555 5555 4477 пройти полный flow, проверить Order=paid + email T-001 в queue.

### Tests for User Story 1

- [ ] T019 [P] [US1] Тесты `apps/web/src/components/checkout/__tests__/ReviewClient.test.tsx` — happy path (orderId returned → create-payment called → redirect) + 503 error handling
- [ ] T020 [P] [US1] Тесты для new POST /api/orders с customer_session — see backend patch T008; mock loadCustomerSession + verify Order.customerId set

### Implementation for User Story 1

- [ ] T021 [US1] Обновить `apps/web/src/components/checkout/ReviewClient.tsx` — 3-step flow по research.md R3: (1) `/api/checkout/finalize-shipping`, (2) `/api/orders` → получить orderId, (3) `/api/payment/yookassa/create` → `confirmationUrl`. Заменить `redirectUrl` → `confirmationUrl`, payload `{cartId}` → `{orderId, retryNonce}`. Использовать `window.location.assign()` (FR-5604).
- [ ] T022 [US1] В `ReviewClient.tsx` добавить step-indicator (3 шага визуально) + error handling через `PAYMENT_ERROR_STRINGS` (FR-5605/5606): 503 → friendly «Платёжный шлюз недоступен»; 409 → redirect на /cart/order/[token]/ (Order уже paid/expired)
- [ ] T023 [US1] В `ReviewClient.tsx` добавить `pushPaymentIntentEvent` при click «Оплатить» (FR-5630 funnel tracking)
- [ ] T024 [P] [US1] Обновить `apps/web/src/components/cart/PhysicalCheckoutForm.tsx` — заменить TODO-stub (line 144) на real navigate to `/cart/checkout/physical/review/` после успешного `POST /api/orders` либо сохранения checkout-draft

**Checkpoint**: Click «Оплатить» на review-странице → редирект на ЮKassa. Webhook обработает + появится Order=paid (см. US3 для UI на /payment/return).

---

## Phase 5: User Story 3 — Polling page /payment/return/[orderId] (Priority: P1)

**Goal**: Customer после ЮKassa-redirect видит success/failure/processing UI с polling.

**Independent Test**: Открыть `/payment/return/{orderId-with-paid-status}` → должен показать success-UI с SO-номером без timeout.

### Tests for User Story 3

- [ ] T025 [P] [US3] Тесты `apps/web/src/components/payment/__tests__/PaymentReturnClient.test.tsx` — polling state machine: initial loading → first tick → success state; mock fetch responses
- [ ] T026 [P] [US3] Тесты timeout case — 30 ticks no-change → processing_pending state
- [ ] T027 [P] [US3] Тесты anti-double-fire `useRef` guard для dataLayer purchase event

### Implementation for User Story 3

- [ ] T028 [US3] Реализовать `apps/web/src/app/(site)/payment/return/[orderId]/page.tsx` (Server Component) — load Order через Payload Local API, auth check (customer_session/cart_session/publicToken triple-fallback, FR-5621), `export const metadata = { robots: { index: false, follow: false } }`, redirect на /cart/ либо 403 page при no-access
- [ ] T029 [US3] Реализовать `apps/web/src/components/payment/PaymentReturnClient.tsx` (Client Component) — main polling state machine, useEffect + setInterval (FR-5622, max 30 ticks × 2 сек), state derived from data-model.md §1 (`PaymentReturnState` union)
- [ ] T030 [P] [US3] Реализовать `apps/web/src/components/payment/PaymentReturnSuccess.tsx` — success UI (✅ icon, clientNumber, receipt-status, 2 CTAs «В личный кабинет» / «На главную»), aria-live region, focus management на CTA (NFR-5604)
- [ ] T031 [P] [US3] Реализовать `apps/web/src/components/payment/PaymentReturnFailure.tsx` — failure UI (❌ icon, причина, retry-button если retryAvailable либо «Заказ аннулирован», FR-5625)
- [ ] T032 [P] [US3] Реализовать `apps/web/src/components/payment/PaymentReturnProcessing.tsx` — timeout-state UI («Платёж обрабатывается, мы пришлём письмо», FR-5626)
- [ ] T033 [P] [US3] Реализовать `apps/web/src/components/payment/PaymentReturnError.tsx` — 403/404/5xx error UI с `resolvePaymentError(code)` lookup (FR-5605)
- [ ] T034 [US3] В `PaymentReturnSuccess.tsx` интегрировать `pushPurchaseEvent` (FR-5630) — fire-once через `useRef` guard ИЛИ sessionStorage marker (анти-double-fire при refresh)

**Checkpoint**: Customer проходит test-shop card payment → возвращается → видит success-UI. dataLayer purchase event fired ровно один раз.

---

## Phase 6: User Story 2 — Retry payment (Priority: P1)

**Goal**: Customer возвращается через retry-page, повторно оплачивает существующий Order (reuse idempotenceKey).

**Independent Test**: Создать Order в pending_payment, открыть `/cart/order/{token}/retry-payment/`, click «Оплатить снова» → backend возвращает existing confirmationUrl (не новый).

### Tests for User Story 2

- [ ] T035 [P] [US2] Тесты `apps/web/src/components/checkout/__tests__/RetryPaymentButton.test.tsx` — happy retry (existing key reused), expired Order → 409 handling

### Implementation for User Story 2

- [ ] T036 [US2] Обновить `apps/web/src/components/checkout/RetryPaymentButton.tsx` — заменить payload `{orderId, retry: true}` → `{orderId}` (без retryNonce — backend FR-5510 reuse existing idempotenceKey); response field `redirectUrl` → `confirmationUrl`; error handling через `PAYMENT_ERROR_STRINGS` (FR-5602)
- [ ] T037 [US2] В `RetryPaymentButton.tsx` обработать 409 (INVALID_ORDER_STATUS) — redirect на `/cart/order/{token}/` если Order уже paid/expired (FR-5606)

**Checkpoint**: US1 + US2 оба работают. Customer может (1) оплатить новый Order, (2) повторно оплатить заброшенный.

---

## Phase 7: User Story 6 — Admin PaymentEvents related-list (Priority: P2)

**Goal**: На странице Order в Payload admin виден related-list 5 последних PaymentEvents.

**Independent Test**: Создать Order + триггернуть несколько webhook'ов → открыть Order в admin → видеть related-list.

### Implementation

- [ ] T038 [US6] Расширить `apps/web/src/collections/Orders.js` — admin tab «События ЮKassa» через `admin.components.views` либо `tabs[]` field group с related-list filter `where: { order: { equals: doc.id } }` (FR-5660). См. Payload v3 admin customization docs для choice tabs-vs-custom (deferred OQ-7 — решается здесь)

**Checkpoint**: Менеджер открывает Order → видит timeline платежных событий without manual filter search.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: docs + cross-spec patches + final QA gates.

### Spec corrections

- [ ] T039 [P] В `apps/web/AGENTS.md` добавить запись о 056 в раздел «Active features» (см. existing 055 entry pattern)
- [ ] T040 [P] В `07-build-specifications/order-lifecycle-spec.md` — Phase 6 Review «UI flow» теперь fact (не TODO) — обновить
- [ ] T041 [P] В `07-build-specifications/document-register.md` добавить 056

### Final QA gates (Constitution VII)

- [ ] T042 Security review: secrets только в env (`grep -r "YOOKASSA_SHOP_ID\|YOOKASSA_SECRET_KEY" apps/web/src` — only `process.env.*` references), нет PII в dataLayer events, ARIA-accessible на /payment/return
- [ ] T043 Lighthouse audit на `/payment/return/[orderId]` ≥ 90 accessibility (SC-5606) — run `pnpm lhci autorun` либо manual через Chrome DevTools
- [ ] T044 Run quickstart.md §3 e2e (US1 card flow) на staging test-shop ЮKassa — full path до success-UI
- [ ] T045 Run quickstart.md §4 e2e (US2 retry) — verify same confirmationUrl reused
- [ ] T046 Run quickstart.md §6 e2e (4 email templates) — каждый T-015/109/110/111 успешно рендерится + inbox delivery
- [ ] T047 Generate Payload types: `pnpm --filter @soliton/web generate:types` — проверить нет drift'а после 056 (backend patch T008 не меняет collection schema, но safe-check)
- [ ] T048 Run full check: `pnpm --filter @soliton/web test && pnpm typecheck && pnpm lint` — всё green
- [ ] T049 Manual smoke test dev-server: navigate через каталог → cart → checkout → review → /payment/return → success — vivisect полным customer-pathом

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No deps — start immediately.
- **Phase 2 (Foundational)**: depends on Phase 1. **BLOCKS все US-фазы.** T004-T007 параллельны; T008 (backend patch) самостоятельный.
- **Phase 3 (US4 Email templates)**: depends on Phase 2 (no — независимый, могут стартовать после Phase 1). 4 templates параллельны.
- **Phase 4 (US1 Card)**: depends on Phase 2 (utilities + types). ReviewClient — sequential (один файл).
- **Phase 5 (US3 Return page)**: depends on Phase 2. 6 components — большинство [P].
- **Phase 6 (US2 Retry)**: depends on Phase 2 + Phase 4 (учит patterns из ReviewClient).
- **Phase 7 (US6 Admin)**: independent от других US — может идти в любой момент после Phase 2.
- **Phase 8 (Polish)**: depends на завершение всех US-фаз.

### User Story Dependencies

- **US4 (P1)** — independent. Можно реализовать первым.
- **US1 (P1)** — depends on Foundation; не зависит от других US.
- **US2 (P1)** — depends on US1 (patterns); contract-fix sibling.
- **US3 (P1)** — depends on Foundation; не зависит от US1/US2 (но completed flow требует US1 → US3).
- **US5 (P2)** — **DEFERRED** (см. spec.md US5 notice; `/me/orders` UI не существует).
- **US6 (P2)** — independent.

### Within Each User Story

- Tests (если включены) могут писаться FIRST (TDD) ИЛИ после implementation (project pattern — flexibility).
- Models/types перед компонентами.
- Self-contained components (Success/Failure/Processing/Error) — параллельны.

### Parallel Opportunities

- **Phase 2**: T004-T007 [P] + T008 (backend) + T009 [P] tests — 6 параллельных задач.
- **Phase 3**: T010-T013 tests [P] + T014-T017 implementations [P] — 8 параллельных задач.
- **Phase 5**: T025-T027 tests [P] + T030-T033 components [P] — 7 параллельных задач.
- **Phase 8**: T039-T041 docs [P]; T042-T049 — sequential (зависят от готовности).

---

## Parallel Example: User Story 4 (Email Templates)

```bash
# Все 4 template implementations параллельны (разные файлы):
Task: "Implement t-015-payment-expired in apps/web/src/lib/notifications/templates/t-015-payment-expired.ts"
Task: "Implement t-109-amount-mismatch in apps/web/src/lib/notifications/templates/t-109-amount-mismatch.ts"
Task: "Implement t-110-receipt-failed in apps/web/src/lib/notifications/templates/t-110-receipt-failed.ts"
Task: "Implement t-111-refund-failed in apps/web/src/lib/notifications/templates/t-111-refund-failed.ts"

# Их тесты тоже параллельны:
Task: "Test t-015 in apps/web/src/lib/notifications/templates/__tests__/t-015-payment-expired.test.ts"
Task: "Test t-109 in apps/web/src/lib/notifications/templates/__tests__/t-109-amount-mismatch.test.ts"
Task: "Test t-110 in apps/web/src/lib/notifications/templates/__tests__/t-110-receipt-failed.test.ts"
Task: "Test t-111 in apps/web/src/lib/notifications/templates/__tests__/t-111-refund-failed.test.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 + US4)

Все 4 P1 user stories — обязательны для launch (US5 deferred, US6 P2):

1. **Phase 1 + 2** — Setup + Foundation (T001-T009, ~3-4 часа)
2. **Phase 3 (US4)** — Email templates (T010-T018, ~3-4 часа) — independent, можно делать parallel с US1
3. **Phase 4 (US1)** — Card checkout flow fix (T019-T024, ~4-6 часов)
4. **Phase 5 (US3)** — Return page (T025-T034, ~5-7 часов)
5. **Phase 6 (US2)** — Retry button fix (T035-T037, ~1-2 часа)
6. **Phase 8 partial** — Final QA gates (T042-T049, ~2-3 часа)

**MVP total**: ~50 tasks, **~18-26 часов** (2.5-3 рабочих дня для одного dev'a).

### Incremental Delivery

1. After Phase 1+2 (Foundation done) — utilities available, ничего customer-facing yet
2. After Phase 3 (US4) — manager-alerts работают (high-impact на operations)
3. After Phase 4 (US1) — customer может оплатить (но без return-UI = blank page после ЮKassa)
4. After Phase 5 (US3) — full happy-path работает (US1 + US3 together)
5. After Phase 6 (US2) — retry-flow добавлен (incremental conversion lift)
6. After Phase 7 (US6) — admin observability nice-to-have

### Parallel Team Strategy

С 2 разработчиками:

- **Dev A** (frontend-focus): Phase 1 + 2 (foundation) → US4 (templates) → US3 (return page) — независимый track
- **Dev B** (full-stack): Phase 2 T008 (backend patch) → US1 (checkout flow) → US2 (retry) → US6 (admin)
- **Joint Phase 8**: cross-spec docs + final QA

С одним dev: рекомендую sequential по priority: US4 → US1 → US3 → US2 → US6 → Polish.

---

## Notes

- **[P]** = разные файлы, нет зависимостей на незавершённые задачи.
- **[Story]** маркирует traceability на user story.
- Тесты опциональны на TDD-уровне (паттерн 052/053/054/055).
- Commit после каждой задачи либо logical group (Phase boundary).
- **US5 deferred** explicitly — не присутствует в этом tasks.md.
- **OQ-7/OQ-8** deferred to /plan — fold'нуты в T038 (US6 design choice).

---

## Format validation summary

✅ Всего задач: **49** (T001-T049)
✅ Checkbox format: все начинаются с `- [ ]`
✅ Task ID: T001-T049 sequential
✅ [Story] labels:
   - Setup (T001-T003): no label ✓
   - Foundational (T004-T009): no label (T008 US-NEW для backend patch — exception, labeled) ✓
   - US4 (T010-T018): [US4] ✓
   - US1 (T019-T024): [US1] ✓
   - US3 (T025-T034): [US3] ✓
   - US2 (T035-T037): [US2] ✓
   - US6 (T038): [US6] ✓
   - Polish (T039-T049): no label ✓
✅ [P] markers — на parallelizable задачах ✓
✅ File paths — relative to repo root в каждой задаче ✓

**Tasks per story**:
- US1: 6 tasks
- US2: 3 tasks
- US3: 10 tasks
- US4: 9 tasks
- US6: 1 task (admin UI tweak)
- US-NEW (backend FR-5609): 1 task (T008)
- Setup/Foundation/Polish: 19 tasks

**Suggested MVP**: Phases 1+2+3+4+5+6 + partial Polish = US1 + US2 + US3 + US4 + Foundation + final QA.

**Note**: US5 (paymentMethodSnapshot в /me/orders) deferred to spec 057 (отсутствует /me/orders UI).
