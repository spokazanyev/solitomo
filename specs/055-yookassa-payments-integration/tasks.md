# Tasks: ЮKassa Payments Integration (055)

**Input**: Design documents from `/specs/055-yookassa-payments-integration/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Включены OPTIONAL unit + integration tests (паттерн 052/053/054). E2E tests — manual через `quickstart.md` на test-shop ЮKassa (OQ-12).

**Organization**: 7 user stories (US1-US7 из spec), сгруппированы по приоритету (P1 → P2). Phase 3 (US3 Security) идёт раньше Phase 4 (US1 Card), потому что US1 webhook требует уже работающий security pipeline.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Можно выполнять параллельно (разные файлы, нет блокирующих зависимостей).
- **[Story]**: `US1..US7`, маппинг на user stories из spec.md.
- Все пути — абсолютные относительно repo root (`apps/web/src/...`).

## Path Conventions

Monorepo Next.js + Payload (apps/web):
- Globals: `apps/web/src/globals/`
- Collections: `apps/web/src/collections/`
- Lib modules: `apps/web/src/lib/payments/`, `apps/web/src/lib/returns/` (existing, extend)
- API routes: `apps/web/src/app/api/payment/yookassa/{create,webhook}/`, `apps/web/src/app/api/orders/[id]/payment-status/`, `apps/web/src/app/api/cron/payments-expire/`
- Tests: `apps/web/src/lib/payments/__tests__/`, `apps/web/src/lib/returns/__tests__/`, `apps/web/src/collections/__tests__/`, `apps/web/src/globals/__tests__/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Минимальные скелеты + env-документация. Не блокирующий, но рекомендуется первым.

- [ ] T001 [P] Создать stub-файлы (пустые экспорты с TODO) для будущих модулей: `apps/web/src/lib/payments/{settings,ip-allowlist,yookassa-client,yookassa-receipt,yookassa-webhook-handler,yookassa-types}.ts`
- [ ] T002 [P] Обновить `apps/web/.env.example` записями `YOOKASSA_SHOP_ID=`, `YOOKASSA_SECRET_KEY=` с комментариями (см. quickstart.md §2)
- [ ] T003 [P] Обновить `apps/web/AGENTS.md` — раздел «Краткая карта модулей»: добавить строки про `src/lib/payments/yookassa-client.ts`, `yookassa-webhook-handler.ts`, `yookassa-receipt.ts`, `src/globals/PaymentSettings.ts`, `src/collections/PaymentEvents.ts`, `src/app/api/cron/payments-expire/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Базовая инфраструктура, без которой невозможно начать US-работы.

**⚠️ CRITICAL**: НИ один US-task не может начаться до завершения Phase 2.

- [ ] T004 Создать Payload global `apps/web/src/globals/PaymentSettings.ts` по схеме data-model.md §1 (все 11 fields + senderCompanyInfo subgroup); зарегистрировать в `apps/web/src/payload.config.ts`
- [ ] T005 [P] Создать Payload collection `apps/web/src/collections/PaymentEvents.ts` по схеме data-model.md §2 (15 fields, append-only access, индексы); зарегистрировать в `apps/web/src/payload.config.ts`
- [ ] T006 Расширить `apps/web/src/collections/Orders.js` — payment group по data-model.md §3: add `capturedAt`, `idempotenceKey`, `confirmationUrl`, `confirmationType`, `paymentMethodSnapshot` (subgroup), `captureAttempts` (array), `receiptStatus`, `vatCodeApplied`; добавить значение `authorized` в `providerStatus` select; добавить индексы на `payment.providerRef` + `payment.idempotenceKey`
- [ ] T007 Сгенерировать Payload миграцию `apps/web/src/migrations/<timestamp>-055-yookassa-payments.ts` через `pnpm --filter @soliton/web payload migrate:create`; провалидировать SQL по data-model.md §7
- [ ] T008 [P] Расширить `apps/web/src/lib/lifecycle/domain-events.ts`: добавить `PaymentEventKind` union (7 variants), типы из `contracts/domain-events-payment.ts`; extend `ReturnEvent` union на `ReturnRefunded | ReturnRefundFailed`; обновить главный `DomainEvent` union
- [ ] T009 [P] Реализовать `apps/web/src/lib/payments/ip-allowlist.ts` — экспорт `isIpInYooKassaAllowlist(ip: string): boolean` с CIDR-matcher для IPv4 + IPv6 (без зависимостей), список CIDR из research.md R6
- [ ] T010 [P] Реализовать `apps/web/src/lib/payments/settings.ts` — `loadPaymentSettings()` cached, с fail-fast валидацией `taxSystemCode ∈ {1..6}` + `defaultVatCode ∈ {1..12}` (FR-5544a); throws с понятным сообщением при invalid config
- [ ] T011 [P] Реализовать `apps/web/src/lib/payments/yookassa-types.ts` — re-export всех типов из `contracts/yookassa-webhook-events.ts` (`YooKassaWebhookEvent`, `CreatePaymentRequest`, `YooKassaReceiptInput`, etc.) + helper `composeEventId`
- [ ] T012 Реализовать `apps/web/src/lib/payments/yookassa-client.ts` — функции `createPayment(req: CreatePaymentRequest, idempotencyKey): Promise<...>`, `capturePayment(paymentId, req: CapturePaymentRequest, idempotencyKey)`, `cancelPayment(paymentId, idempotencyKey)`, `getPayment(paymentId)`; basic auth, 10s timeout, fail-fast-prod при отсутствии creds (паттерн `yookassa-refunds.ts`); R1, R2
- [ ] T013 Реализовать `apps/web/src/lib/payments/yookassa-receipt.ts` — `buildReceipt(order, paymentSettings): YooKassaReceiptInput` по R4 + FR-5540..5546: customer email-priority/phone-fallback (FR-5544b), items с `vat_code=defaultVatCode`, delivery как `payment_subject:"service"`, `tax_system_code=1`
- [ ] T014 Создать skeleton `apps/web/src/app/api/payment/yookassa/webhook/route.ts` (override existing mock из 037) — только верхнеуровневая обвязка: `runtime="nodejs"`, `dynamic="force-dynamic"`, проверка `paymentSettings.enabled`, заглушки для верификации (US3) и dispatch (US1/US4); НЕ удалять existing route — переписать поверх

**Checkpoint**: Foundation готов — БД, типы, клиент, settings, ip-allowlist, skeleton handler. Можно начать US-работы параллельно.

---

## Phase 3: User Story 3 - Webhook от ЮKassa защищён от подделки (Priority: P1) 🛡️ Security Foundation

**Goal**: Webhook-handler проходит трёхуровневую проверку (IP allowlist + idempotency by composite eventId + amount-match) и записывает каждое событие в `PaymentEvents` ДО любой мутации Order/Return.

**Why first among P1**: US1 и US4 расширяют этот handler. Без security первой нельзя deploy. См. plan.md «cross-spec coordination matrix».

**Independent Test**: Curl с поддельного IP → 403, запись в PaymentEvents с `rejectedReason=ip_not_allowed`. Replay того же `eventId` → 200 OK, `duplicateCount++`, без мутаций. Webhook с `amount.value` отличным от `Order.totals.total` → emit `payment.amount_mismatch`, Order не меняется.

### Tests for User Story 3

- [ ] T015 [P] [US3] Тесты `apps/web/src/lib/payments/__tests__/ip-allowlist.test.ts` — match IPv4 в каждом CIDR, IPv6, edge: пустая строка / malformed / IP вне списка
- [ ] T016 [P] [US3] Тесты `apps/web/src/lib/payments/__tests__/webhook-verify.test.ts` — три сценария reject (ip, amount, currency), один dup-detection, один success-pass (с использованием mock fetch)
- [ ] T017 [P] [US3] Тесты `apps/web/src/collections/__tests__/PaymentEvents.test.ts` — append-only invariants (update заблокирован), truncate logic для payload >16KB

### Implementation for User Story 3

- [ ] T018 [US3] Реализовать `apps/web/src/lib/payments/yookassa-webhook-handler.ts` — `verifyAndLog(event, sourceIp)`: (а) IP-allowlist check (FR-5530); (б) compose `eventId` через `composeEventId(event)`; (в) lookup в `PaymentEvents` для dedup (FR-5531); (г) для payment-event поиск Order по `providerRef` + amount-match с допуском 0.01 ₽ (FR-5532..5534); (д) currency check (FR-5533)
- [ ] T019 [US3] В webhook route.ts (T014) — вызвать `verifyAndLog` ПЕРВЫМ; при reject — записать `PaymentEvents{result:'rejected', rejectedReason}` и вернуть 403/200 (200 для amount-mismatch чтобы ЮKassa не ретраил, FR-5532a); при duplicate — записать `duplicateCount++` и вернуть 200; при success → pass to dispatch
- [ ] T020 [US3] Реализовать emit `payment.amount_mismatch` (FR-5532a) с alert через 049 (NotificationJobs с priority=high) — но Order НЕ мутировать
- [ ] T021 [US3] Реализовать heavy-ops через `after()` Next.js helper (FR-5536): handler возвращает 200 за ≤3 секунды, emit + 049 + dispatch — после ответа
- [ ] T022 [US3] PII-masking в логах (FR-5595..5597): `[yookassa-webhook]` логи скрывают email/phone/full card, оставляют только last4

**Deferred (NOT in MVP)**:
- **FR-5535** (HMAC webhook signature `enforce` mode) — оставляем `paymentSettings.webhookSignatureMode="off"` как default; verification stub в T018 проверяет, что mode читается, но не enforce'ит. Полноценная HMAC-проверка — Phase 2 после публикации ЮKassa формата подписи (см. spec §10 #7, research.md R10).

**Checkpoint**: Webhook handler принимает события безопасно, но НЕ обрабатывает payload (только логирует). Готовая база для US1/US4.

---

## Phase 4: User Story 1 - Физлицо платит картой (Priority: P1) 🎯 MVP

**Goal**: Customer кликает «Оплатить картой» → редирект на ЮKassa → 3DS → возврат на /payment/return → webhook `payment.waiting_for_capture` → capture → `payment.succeeded` → Order paid, email отправлен.

**Independent Test**: На test-shop с тестовой картой `5555 5555 5555 4477` пройти полный flow от `POST /api/payment/yookassa/create` до Order.status=paid, проверить `paidAt`, `paymentMethodSnapshot.card.last4`, `vatCodeApplied=12`, что эмит `order.paid` сработал и 049 поставила в очередь письмо.

### Tests for User Story 1

- [ ] T023 [P] [US1] Тесты `apps/web/src/lib/payments/__tests__/yookassa-client.test.ts` — happy path createPayment/capturePayment/cancelPayment/getPayment с моком `fetch` (vitest mock); проверка корректности body, headers, idempotency-key formatting
- [ ] T024 [P] [US1] Тесты `apps/web/src/lib/payments/__tests__/receipt-builder.test.ts` — корректность receipt для типичного Order (3 items + delivery) с `vat_code=12`, customer email-приоритет, fallback на phone, edge: missing email & phone → throws
- [ ] T025 [P] [US1] Integration test `apps/web/src/lib/payments/__tests__/webhook-flow-card.integration.test.ts` — webhook waiting_for_capture → capture call → succeeded; проверка Order.status, paidAt, paymentMethodSnapshot
- [ ] T026 [P] [US1] Тесты state-machine extension в `apps/web/src/lib/lifecycle/__tests__/status-machine.test.ts` — переход `pending_payment → paid` allowed только с `context.paymentWebhookVerified=true`

### Implementation for User Story 1

- [ ] T027 [US1] Реализовать `apps/web/src/app/api/payment/yookassa/create/route.ts` — POST по `contracts/create-payment.openapi.yaml`: load Order, проверить `status==="pending_payment"` (FR-5509), gen retryNonce если absent, dedup по idempotenceKey (FR-5510), build receipt (T013), call `createPayment` (T012), persist `confirmationUrl/providerRef/idempotenceKey/paymentMethodSnapshot.expected/createdAt` в Order
- [ ] T028 [US1] В create endpoint — UTM-snapshot из Cart.metadata.utm в `metadata.utm` (FR-5507) для аналитики
- [ ] T029 [US1] В create endpoint — handle ЮKassa errors: 4xx → 503 user-facing, 5xx + timeout → retry до 3 раз с тем же idempotenceKey, потом 503 (FR-5511)
- [ ] T030 [US1] В webhook handler (apps/web/src/lib/payments/yookassa-webhook-handler.ts) — добавить `dispatch(event)` для `payment.waiting_for_capture`: emit `payment.authorized` (R2, FR-5520), вызвать `capturePayment` async с `Idempotence-Key=${orderId}:capture` (FR-5522), при non-success capture — записать в `Order.payment.captureAttempts[]` (FR-5523a, см. также US7)
- [ ] T031 [US1] В webhook handler — `dispatch(event)` для `payment.succeeded`: переход `pending_payment → paid` через Orders update с `context.paymentWebhookVerified=true` (immutability bypass для 051), set `paidAt`, `capturedAt`, `amount`, `paymentMethodSnapshot.actual`, `vatCodeApplied=paymentSettings.defaultVatCode`, `providerStatus=succeeded`; emit `payment.captured` + `payment.succeeded` (FR-5551, FR-5524)
- [ ] T032 [US1] В webhook handler — `dispatch(event)` для `payment.canceled`: проверить `Order.payment.createdAt + paymentRetryWindowMin`; если внутри окна → Order=cancelled; если истёк → Order=expired; emit `payment.canceled` с `reason=cancellation_details.reason` mapped to `PaymentCancelReason` enum (FR-5552)
- [ ] T033 [US1] В webhook handler — обработка `receipt_registration`: сохранить в `Order.payment.receiptStatus`; если `canceled` → emit `payment.receipt_failed` + alert через 049 (FR-5545, FR-5546)
- [ ] T034 [US1] Реализовать `apps/web/src/app/api/orders/[id]/payment-status/route.ts` — GET по `contracts/payment-status.openapi.yaml`: read-only, auth через customer_session ИЛИ cart_session ИЛИ publicToken query
- [ ] T035 [US1] Extend `apps/web/src/lib/lifecycle/status-machine.ts` — add transition `pending_payment → paid` allowed only с `context.paymentWebhookVerified` flag; transition `pending_payment → cancelled` always allowed, `pending_payment → expired` from cron only

**Checkpoint**: US1 полностью работает на test-shop ЮKassa с картой. Order переходит в paid, email уходит, receiptStatus=succeeded.

---

## Phase 5: User Story 2 - Покупатель платит через СБП (Priority: P1)

**Goal**: На странице ЮKassa customer выбирает СБП, ЮKassa отдаёт QR, customer платит из банк-приложения, ЮKassa → `payment.succeeded` (без waiting_for_capture).

**Independent Test**: На test-shop включить СБП, вернуть QR через testing-tool, в тестовом банк-app подтвердить → проверить, что Order→paid с `paymentMethodSnapshot.type="sbp"` и БЕЗ записей в `captureAttempts` (СБП всегда one-stage).

### Tests for User Story 2

- [ ] T036 [P] [US2] Integration test `apps/web/src/lib/payments/__tests__/webhook-flow-sbp.integration.test.ts` — webhook `payment.succeeded` для SBP сразу (без waiting_for_capture); проверить, что capture call НЕ был выполнен
- [ ] T037 [P] [US2] Test `apps/web/src/app/api/payment/yookassa/create/__tests__/sbp-amount-limit.test.ts` — Order с `totals.total > sbpMaxAmount` → СБП недоступен в `availableMethods` ответа

### Implementation for User Story 2

- [ ] T038 [US2] В `create/route.ts` (T027) — если в `paymentSettings.paymentMethods` есть `sbp` И `Order.totals.total ≤ paymentSettings.sbpMaxAmount` — включить sbp в `availableMethods`; иначе исключить (FR-5505, edge case)
- [ ] T039 [US2] В webhook handler dispatch — для `payment.succeeded` детектировать `payment_method.type==="sbp"`: пропустить шаг capture (СБП всегда one-stage у ЮKassa); сразу Order → paid (FR в US2 #2)
- [ ] T040 [US2] В webhook handler — извлечь `payer_bank_details` для SBP в `paymentMethodSnapshot.sbp.{bankId,bankName}` (data-model §3)

**Checkpoint**: US1 + US2 оба работают независимо.

---

## Phase 6: User Story 4 - Возврат закрывается webhook'ом refund.succeeded (Priority: P1)

**Goal**: 053 шлёт refund-request → ЮKassa отвечает асинхронно `refund.succeeded` → 055 webhook → 053 repository → Returns.status: refund_pending → refunded → 049 шлёт письмо клиенту.

**Independent Test**: На test-shop выполнить refund flow customer→admin→approve, дождаться webhook → проверить Returns.status=refunded, payment.refunds[].providerStatus=succeeded, email отправлен.

### Tests for User Story 4

- [ ] T041 [P] [US4] Тесты `apps/web/src/lib/returns/__tests__/refund-receipt.test.ts` — `buildRefundReceipt(order, return, vatCodeApplied=12)` возвращает корректную structure для full/partial refund; для legacy `vatCodeApplied=4` использует legacy vat_code (FR-5544d)
- [ ] T042 [P] [US4] Тесты `apps/web/src/lib/returns/__tests__/apply-refund.test.ts` — happy: refund_pending → refunded; idempotent (replay → already_in_terminal_state); unknown providerRefundId → not_found; amount mismatch → amount_mismatch (см. refund-webhook-contract.md §Behavior)
- [ ] T043 [P] [US4] Integration test `apps/web/src/lib/payments/__tests__/webhook-flow-refund.integration.test.ts` — end-to-end: 053 calls createRefund → mock ЮKassa webhook `refund.succeeded` → assert Returns.status=refunded + Order.payment.refunds[i].providerStatus=succeeded + emit return.refunded

### Implementation for User Story 4

- [ ] T044 [P] [US4] Расширить `apps/web/src/lib/payments/yookassa-refunds.ts` — добавить optional `receipt?: YooKassaReceiptInput` в `CreateRefundInput`; передавать в ЮKassa если присутствует (R11); сохранить backward-compat (тесты без receipt всё ещё проходят)
- [ ] T045 [P] [US4] Создать `apps/web/src/lib/returns/refund-receipt.ts` — `buildRefundReceipt(order, ret, vatCodeApplied)` по contracts/refund-webhook-contract.md §«Receipt support extension»
- [ ] T046 [US4] Расширить `apps/web/src/lib/returns/repository.ts` — экспортировать `applyRefundSucceeded(input)` + `applyRefundCanceled(input)` по контракту contracts/refund-webhook-contract.md; внутри: find Return by providerRefundId, state-machine transition, update Order.payment.refunds[i], вызов existing `maybeMarkOrderReturned`, emit `return.refunded`/`return.refund_failed`
- [ ] T047 [US4] Обновить existing `Returns.afterChange` hook (053) — при инициации refund (status: received_back → refund_pending) — собрать receipt через `buildRefundReceipt(order, return, order.payment.vatCodeApplied)` и передать в `createRefund({receipt})`
- [ ] T048 [US4] В webhook handler dispatch — добавить `refund.succeeded`/`refund.canceled` → call applyRefundSucceeded/applyRefundCanceled (T046); записать `PaymentEvents.return = result.returnId` если applied (FR-5553, FR-5554)
- [ ] T049 [US4] При rejected refund-webhook (not_found / amount_mismatch / already_in_terminal_state) — записать `PaymentEvents.rejectedReason`, alert менеджеру через 049 (FR US4 #3)

**Checkpoint**: Refund-loop замкнут. Returns.status автоматически переходит в refunded без ручного вмешательства.

---

## Phase 7: User Story 5 - Owner настраивает captureMode и methods через admin (Priority: P2)

**Goal**: PaymentSettings global доступен в Payload admin для owner'а; изменения applies в реальном времени без redeploy.

**Independent Test**: Открыть Payload admin → Globals → Payment Settings → переключить `captureMode: two_stage → one_stage` → следующий create-payment вызов идёт с `capture=true`. Снять галку sbp → SBP пропадает из `availableMethods` ответа create-payment.

### Tests for User Story 5

- [ ] T050 [P] [US5] Тесты `apps/web/src/globals/__tests__/PaymentSettings.test.ts` — beforeChange validation (taxSystemCode/defaultVatCode range, webhookSecret length), afterChange audit fields populated

### Implementation for User Story 5

- [ ] T051 [US5] В `PaymentSettings.ts` (T004) — реализовать `beforeChange` hook: валидация `taxSystemCode ∈ {1..6}`, `defaultVatCode ∈ {1..12}`, `webhookSecret.length ≥ 32` (если задан), `senderCompanyInfo.inn` matches 10 или 12 digit regex (FR-5544a)
- [ ] T052 [US5] В `PaymentSettings.ts` — реализовать `afterChange` hook: `lastChangedBy=req.user.id`, `lastChangedAt=now`, emit `paymentSettings.changed` audit event
- [ ] T053 [US5] В `PaymentSettings.ts` — field-level access для `webhookSecret`: `access: { read: () => false }` (не выходит из БД)
- [ ] T054 [P] [US5] Admin UI improvements в `PaymentSettings.ts`: tooltip/description на каждом field (FR-5560: что меняет, к каким FR относится); ссылки на quickstart.md в `admin.description`

**Checkpoint**: Owner может менять captureMode, methods, paymentRetryWindowMin без deploy. Audit log работает.

---

## Phase 8: User Story 6 - Менеджер видит историю webhook'ов (Priority: P2)

**Goal**: PaymentEvents collection в admin показывает таймлайн всех webhook'ов; на странице Order — related list событий.

**Independent Test**: Открыть admin → Collections → Payment Events → видеть список с фильтром по eventType/result. На странице Order → секция «События ЮKassa» с relatedList.

### Tests for User Story 6

- [ ] T055 [P] [US6] Тесты `apps/web/src/collections/__tests__/PaymentEvents.test.ts` — payload-truncate logic для >16KB (set `truncatedAt`), append-only access (update→error), retention query (where receivedAt < now - 90d)

### Implementation for User Story 6

- [ ] T056 [US6] В `PaymentEvents.ts` (T005) — реализовать `beforeChange` (only on `create`): если `payload.length > 16384` → truncate, set `truncatedAt=originalLength`; полный payload — в structured log (FR-5570)
- [ ] T057 [US6] Admin UI: настроить list view с колонками `receivedAt, eventType, providerRef, result, rejectedReason`; фильтры по `result`, `eventType`, date range (FR-5570)
- [ ] T058 [US6] Admin UI: на странице Order (Orders.js) — related list `paymentEvents` через `relationTo: 'paymentEvents'` фильтром `where: { order: { equals: ${doc.id} } }` (FR-5571)
- [ ] T059 [US6] Admin UI: на странице Return (Returns.ts) — same related list через `where: { return: { equals: ${doc.id} } }`

**Checkpoint**: Observability полная — любое расследование начинается с Order/Return → видим всю историю.

---

## Phase 9: User Story 7 - Cron автоматически экспирит зависшие платежи (Priority: P2)

**Goal**: Cron каждые 5 мин проверяет Orders в `pending_payment` старше 60 мин, дёргает ЮKassa GET, переводит в expired (canceled) или paid (потерянный succeeded webhook). Retry capture-attempts.

**Independent Test**: Создать Order в `pending_payment` с `payment.createdAt` 65 мин назад без webhook — запустить cron → если ЮKassa returns canceled → Order=expired. Если returns succeeded → Order=paid (reconciliation). Если есть captureAttempts с `nextRetryAt < now` → capture call повторяется.

### Tests for User Story 7

- [ ] T060 [P] [US7] Тесты `apps/web/src/app/api/cron/payments-expire/__tests__/cron.test.ts` — happy path: expire (canceled), reconcile (succeeded), capture-retry (5xx → retry), advisory-lock contention (second call возвращает 200 с `skipped=true`), batch limit 100
- [ ] T061 [P] [US7] Тесты `apps/web/src/lib/payments/__tests__/capture-retry.test.ts` — exponential backoff sequence `[1m, 5m, 15m, 1h, 6h, 24h]`; after 6th failure → Order=cancelled with reason=capture_retries_exhausted

### Implementation for User Story 7

- [ ] T062 [US7] Создать `apps/web/src/app/api/cron/payments-expire/route.ts` — `runtime="nodejs"`, `dynamic="force-dynamic"`, проверка `CRON_SECRET` header, `pg_try_advisory_lock("payments_expire_lock")` (FR-5584), early-return если lock fail
- [ ] T063 [US7] Реализовать в cron функцию `expireStaleOrders(payload)` — query `status==='pending_payment' && payment.createdAt < now - paymentRetryWindowMin`, для каждого: `getPayment(providerRef)`, switch по ЮKassa-status (canceled→Order expired, succeeded→reconcile, иначе→оставить + alert) (FR-5581..5583)
- [ ] T064 [US7] Реализовать `reconcileLostWebhook(order, ykPayment)` — обработать как webhook `payment.succeeded`, но пометить `PaymentEvents.source="cron_reconciliation"` (FR-5583)
- [ ] T065 [US7] Реализовать `retryCaptureAttempts(payload)` — query Orders с `captureAttempts[last].nextRetryAt < now AND captureAttempts[last].exhausted = false`, для каждого: `capturePayment(providerRef, {}, idempotencyKey=${orderId}:capture)`; на success → handler-like update; на failure → append captureAttempts с next backoff из `[5m,15m,1h,6h,24h]`; после 6-й — set `exhausted=true`, Order=cancelled, emit `payment.canceled reason=capture_retries_exhausted` (FR-5523a, R7)
- [ ] T066 [US7] Реализовать `prunePaymentEvents(payload)` — delete `paymentEvents.find({where:{receivedAt:{less_than:now-90d}}})` (FR-5572)
- [ ] T067 [P] [US7] Зарегистрировать cron в `apps/web/vercel.json` или `cron.json`: `{ "path": "/api/cron/payments-expire", "schedule": "*/5 * * * *" }` (приоритет — проверить, как зарегистрированы 052/053 cron'ы)
- [ ] T068 [US7] Реализовать batch limit ≤100 Orders за запуск (FR-5585); если очередь больше — следующий cron подберёт через 5 мин

**Checkpoint**: Никаких stuck Orders в `pending_payment`. Потерянные webhook'и подхватываются reconciliation. Capture-retries безопасно повторяются.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Cross-spec patches + минорные spec corrections + final QA.

### Spec corrections (Constitution Principle V Analytics)

- [ ] T069 [P] В `specs/055-yookassa-payments-integration/spec.md` добавить **FR-5599**: «System MUST включать `utm` snapshot в `payment.succeeded` event payload для downstream-аналитики (dataLayer / GA4 / Twenty Activity)» — в раздел §3.1 после FR-5598

### Cross-spec patches

- [ ] T070 [P] Обновить `07-build-specifications/order-lifecycle-spec.md`: в §Phase 7 — «webhook ЮKassa дёргает emitDomainEvent» теперь fact (а не TODO); в таблице переходов уточнить, что `pending_payment → paid` идёт через 055-webhook
- [ ] T071 [P] Обновить `07-build-specifications/document-register.md` — добавить запись о спеке 055 в реестр документов
- [ ] T072 [P] Расширить 049 `apps/web/src/lib/notifications/matrix.ts` — добавить entries для `payment.succeeded`, `payment.canceled`, `payment.expired`, `payment.amount_mismatch`, `payment.receipt_failed`, `return.refunded`, `return.refund_failed` (templates из data-model.md §6)
- [ ] T073 [P] Расширить 052 `apps/web/src/lib/cart/recovery-subscriber.ts` — подписаться на `payment.canceled` + `payment.expired` (помимо `order.cancelled`); восстановить Cart с теми же items
- [ ] T074 [P] Расширить 048 `apps/web/src/lib/crm/twenty/subscriber.ts` — `kindMap` дополнить `payment.succeeded` → Activity name; CRM_RELEVANT_PREFIXES уже включает `payment.` — verify; gating через `crmSettings.enabled` сохраняется (Twenty off на launch)

### Documentation

- [ ] T075 [P] Обновить `apps/web/AGENTS.md` финальной информацией: pre-launch checklist link в раздел про 055
- [ ] T076 [P] Добавить runbook в `specs/055-yookassa-payments-integration/quickstart.md` §10 Troubleshooting — детализировать действия при `payment.amount_mismatch`, `payment.receipt_failed` алёртах (если ещё не покрыто)

### Final QA gates (Constitution VII)

- [ ] T077 Security review pass: secrets only in env (`grep -r "YOOKASSA_SECRET_KEY" apps/web/src` should find only references to `process.env.YOOKASSA_SECRET_KEY`), no logs containing full PAN, IP-allowlist CIDR correct per latest ЮKassa docs, webhook handler safely retriable
- [ ] T078 Run quickstart.md §5 + §6 e2e tests on staging test-shop ЮKassa: US1 (card payment), US2 (СБП payment), US4 (refund) — все проходят полный flow до paid/refunded
- [ ] T079 Generate Payload types: `pnpm --filter @soliton/web generate:types`; проверить, что NEW collections/globals попадают в types
- [ ] T080 Run full check: `pnpm --filter @soliton/web test && pnpm typecheck && pnpm lint` — все green
- [ ] T081 Manual smoke check в dev-server: open admin → Payment Settings exists с дефолтами; create Order → POST create-payment отдаёт confirmationUrl
- [ ] T082 [P] Lightweight load-test для `POST /api/payment/yookassa/create` — assert SC-5509 (p95 ≤ 800 мс) при N=50 concurrent requests (mock ЮKassa через nock или test-shop с throttling). Скрипт `apps/web/scripts/load-test-create-payment.mjs` (autocannon / k6). Запуск manually pre-launch, не CI

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No deps — может стартовать сразу.
- **Phase 2 (Foundational)**: Depends on Phase 1. **BLOCKS все US-фазы.** Внутри Phase 2: T007 (миграция) после T004-T006; T012 (yookassa-client) после T011 (types); T013 (receipt) после T010 (settings).
- **Phase 3 (US3 Security)**: Depends on Phase 2 (T011 types, T014 handler skeleton, T009 ip-allowlist, T005 PaymentEvents).
- **Phase 4 (US1 Card)**: Depends on Phase 2 + Phase 3 (handler verification pipeline). T030/T031/T032 расширяют существующий handler из T018/T019.
- **Phase 5 (US2 SBP)**: Depends on Phase 4 (расширяет create endpoint + handler dispatch).
- **Phase 6 (US4 Refund)**: Depends on Phase 2 + Phase 3 (handler verification reusable). Не зависит от US1/US2 — refund flow независим.
- **Phase 7 (US5 Settings)**: Depends on Phase 2 (PaymentSettings global). Расширяет hooks + UI.
- **Phase 8 (US6 Observability)**: Depends on Phase 2 (PaymentEvents collection). Расширяет UI + access.
- **Phase 9 (US7 Cron)**: Depends on Phase 4 (handler logic reused for reconciliation). Captures-retry зависит от T030 (initial capture impl).
- **Phase 10 (Polish)**: Depends on все предыдущие phases для cross-spec patches; spec-corrections (T069) могут идти параллельно.

### User Story Dependencies

- **US3 (P1)** — независим, но usable только после US1/US4 dispatch logic.
- **US1 (P1)** — depends on US3 (handler verification).
- **US2 (P1)** — depends on US1 (extends create endpoint).
- **US4 (P1)** — independent (использует handler verification из US3, не зависит от US1 dispatch).
- **US5 (P2)** — independent от US1-4 (admin UX над PaymentSettings, который уже foundation).
- **US6 (P2)** — independent от US1-4 (admin UX над PaymentEvents).
- **US7 (P2)** — depends on US1 (reconciliation reuses succeeded-flow), US3 (creates PaymentEvents entries).

### Within Each User Story

- Tests могут писаться FIRST (TDD) ИЛИ после implementation (паттерн 052/053/054 — tests after). Решение разработчика.
- Models/types before services before handlers (классика).
- В US1: T027 (create) и T030/T031/T032 (handler dispatch) могут идти параллельно (разные файлы).

### Parallel Opportunities

- **Phase 1**: T001-T003 — все [P].
- **Phase 2**: T005, T008, T009, T010, T011 — [P] (разные файлы). T012/T013 — sequential (T012 → T013 после settings).
- **Phase 3**: T015-T017 (тесты) — [P].
- **Phase 4**: T023-T026 (тесты) — [P]. T027-T035 — частично [P] (T027 + T034 разные файлы).
- **Phase 5**: T036-T037 [P]; T038-T040 sequential (одна функция в `create/route.ts`).
- **Phase 6**: T041-T043 [P]. T044-T045 [P]. T046-T049 sequential.
- **Phase 7-9**: Внутри каждого — тесты [P], impl sequential.
- **Phase 10**: Почти все [P], кроме final QA (T077-T081 sequential).

---

## Parallel Example: User Story 1 (MVP)

```bash
# Tests can be written in parallel:
Task: "Implement yookassa-client unit tests in apps/web/src/lib/payments/__tests__/yookassa-client.test.ts"
Task: "Implement receipt-builder tests in apps/web/src/lib/payments/__tests__/receipt-builder.test.ts"
Task: "Implement webhook-flow-card integration test in apps/web/src/lib/payments/__tests__/webhook-flow-card.integration.test.ts"
Task: "Implement status-machine tests in apps/web/src/lib/lifecycle/__tests__/status-machine.test.ts"

# Implementation (create + status endpoint can go parallel after T030..T032):
Task: "Implement create payment endpoint in apps/web/src/app/api/payment/yookassa/create/route.ts"
Task: "Implement payment-status polling endpoint in apps/web/src/app/api/orders/[id]/payment-status/route.ts"
```

---

## Implementation Strategy

### MVP First (US3 + US1 + US4 + US7)

Минимально для production launch:

1. **Phase 1 + 2** — Setup + Foundation (~10 задач, ~3 дня)
2. **Phase 3 (US3)** — Webhook Security (~8 задач, ~2 дня)
3. **Phase 4 (US1)** — Card Payment (~13 задач, ~3 дня)
4. **Phase 6 (US4)** — Refund Webhook (~9 задач, ~1.5 дня)
5. **Phase 9 (US7)** — Cron Expire/Reconcile/Retry (~9 задач, ~2 дня)
6. **Phase 10** (partial — T069, T072-T074, T077-T081) — Polish + QA (~1 день)

**MVP total**: ~50 задач, **~12-13 рабочих дней** + 2-3 дня e2e тестирования.

**STOP and VALIDATE** после MVP: e2e на test-shop, security-review, можно deploy в prod без US2/US5/US6.

### Incremental Delivery (после MVP)

1. **+ US2 (SBP)** — расширение existing endpoint, ~2 дня → deploy → SBP включён в `paymentSettings.paymentMethods`
2. **+ US5 (Admin Settings UX)** — ~1 день → deploy → owner-managed config
3. **+ US6 (Admin Observability)** — ~1.5 дня → deploy → менеджер видит timeline

### Parallel Team Strategy

Если 2 разработчика:

1. **Joint Phase 1 + 2** (T001-T014).
2. После Foundation:
   - **Dev A**: US3 (T015-T022) → US1 (T023-T035) → US7 (T060-T068)
   - **Dev B**: US4 (T041-T049) → US5 (T050-T054) → US6 (T055-T059)
3. **Joint Phase 10**: cross-spec patches + QA.

---

## Notes

- **[P]** = разные файлы, нет зависимостей на незавершённые задачи.
- **[Story]** маркирует traceability на user story из spec.
- Тесты опциональны на TDD-уровне — допустимо implementation first затем tests (паттерн 052/053/054).
- Commit после каждой задачи или logical group (Phase boundary).
- Stop at any checkpoint — после Phase 4 (US1) уже можно демонстрировать на test-shop.
- **Не пропускать T077 (security review)** — это constitutional gate VII.

---

## Format validation summary

✅ Всего задач: **82** (T001-T082)
✅ Checkbox format: все задачи начинаются с `- [ ]`
✅ Task ID: T001-T082 sequential
✅ [Story] labels:
   - Setup (T001-T003): no label ✓
   - Foundational (T004-T014): no label ✓
   - US3 (T015-T022): [US3] ✓
   - US1 (T023-T035): [US1] ✓
   - US2 (T036-T040): [US2] ✓
   - US4 (T041-T049): [US4] ✓
   - US5 (T050-T054): [US5] ✓
   - US6 (T055-T059): [US6] ✓
   - US7 (T060-T068): [US7] ✓
   - Polish (T069-T082): no label ✓
✅ [P] markers — на parallelizable задачах ✓
✅ File paths — absolute relative to repo root в каждой задаче ✓

**Tasks per story**:
- US1: 13 tasks
- US2: 5 tasks
- US3: 8 tasks
- US4: 9 tasks
- US5: 5 tasks
- US6: 5 tasks
- US7: 9 tasks
- Setup/Foundation/Polish: 28 tasks (T001-T014 setup+foundation + T069-T082 polish)

**Suggested MVP**: Phases 1+2+3+4+6+9 + Polish-partial = US3, US1, US4, US7 + foundation + final QA.

**Remediation applied (post-/analyze)**:
- ✅ FR-5599 добавлен в spec.md §3.1 (Constitution V Analytics) → A1 resolved
- ✅ T082 добавлен для load-test SC-5509 (p95 ≤ 800мс) → C1 resolved
- ✅ Note про FR-5535 deferred в Phase 3 → D2 resolved
- ✅ FR-5542 + A4 уточнены — единый `vat_code=12` для доставки в MVP; pre-launch checklist расширен бухгалтерской валидацией → F1 resolved
