# Implementation Plan: ЮKassa Payments Integration

**Branch**: `055-yookassa-payments-integration` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/055-yookassa-payments-integration/spec.md` (653 строки, все 12 OQ из /clarify закрыты, НДС 22% по ФЗ-425 учтён).

## Summary

Полная интеграция ЮKassa как primary online payment provider. Покрывает покупку (card / СБП) с двухстадийной авторизацией (configurable), фискальный чек 54-ФЗ с новой ставкой НДС 22% (vat_code=12), webhook-handler с трёхуровневой защитой (IP-allowlist + idempotency + amount-match), cron-reconciliation потерянных webhook'ов, capture-retry с exponential backoff, замыкание refund-flow 053 (webhook `refund.succeeded` → `Returns.status: refund_pending → refunded`), новый global `paymentSettings`, наблюдаемость через `paymentEvents` collection. Технический подход: re-use паттернов из `yookassa-refunds.ts` (053) и `apiship-provider.ts` (047), доменные события через существующий `emitDomainEvent`, immutability через 051 `wasEverPaid` guard. Backend-only; frontend для checkout — отдельный track.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js (Next.js 16 runtime).

**Primary Dependencies**:
- Next.js 16 (App Router, route handlers, server-only modules)
- Payload CMS v3 (collections, globals, hooks, access control)
- @payloadcms/db-postgres (PG SEQUENCE + sql.raw)
- PostgreSQL (advisory locks, sequences)
- `fetch` (нативный, без axios — как в `yookassa-refunds.ts`)
- `crypto` (HMAC, ETag, secure tokens — как 054)

**Storage**: PostgreSQL (через Payload). Новые сущности: global `paymentSettings`, collection `paymentEvents`. Расширения: `Orders.payment.*` (вшитая группа).

**Testing**: Vitest (как 052/053/054). Mock ЮKassa через `nock` или handler-stub. E2E — отдельный sandbox-shop ЮKassa (OQ-12, staging).

**Target Platform**: Linux (Vercel serverless functions для cron + API routes; Next.js Node runtime).

**Project Type**: web-service backend (Next.js API routes + Payload CMS + PG). Frontend для /cart/review → /payment/* — out of scope этой спеки.

**Performance Goals**:
- p95 `POST /api/payment/yookassa/create` ≤ 800 мс (NFR-5500)
- p95 webhook-handler response ≤ 1500 мс (NFR-5501)
- cron-reconciliation покрывает ≥99% потерянных webhook'ов в течение 10 мин (SC-5504)

**Constraints**:
- RUB only (NFR + FR-5533)
- 22% НДС default, vat_code=12 (A1, ФЗ-425)
- PCI-DSS scope полностью у ЮKassa (FR-5596)
- Webhook IP-allowlist ЮKassa (CIDR: `185.71.76.0/27`, `185.71.77.0/27`, `77.75.153.0/25`, `77.75.154.128/25`, `77.75.156.11`, `77.75.156.35`, `2a02:5180::/32`)
- `Idempotence-Key` (без `y` — ЮKassa-spelling)
- 7-дневный TTL hold для two-stage capture
- Webhook response ≤3 секунд (heavy ops в waitUntil)

**Scale/Scope**:
- ~10-50 платежей/день на старте (B2C сегмент мал по объёму, но критичен)
- Бан тариф ЮKassa: ~5000 транзакций/мес (OQ-7)
- `paymentEvents` retention 90 дней (FR-5572) → ~100-500K записей max
- 9 функциональных областей × ~80 FR + 11 SC + 4 NFR

## Constitution Check

*GATE: должен пройти ДО Phase 0; пересмотр после Phase 1.*

| Принцип | Соблюдение | Обоснование |
| --- | --- | --- |
| **I. Spec-First** | ✅ | spec.md (653 строки), /clarify 3 раунда (12 OQ закрыты), теперь /plan. |
| **II. SEO/Demand** | N/A | Платежи — backend-only, без публичных страниц. /payment/return и /payment/success — закрытые URL для авторизованного flow, `robots:noindex` (см. data-model). |
| **III. B2B/RFQ First, B2C Second** | ✅ | B2B-инвойс flow (US2 037, awaiting_payment) **не затрагивается** — он по-прежнему вне ЮKassa. 055 — только US1 037 (физлицо/картой+СБП). FR-5509 гарантирует, что webhook для `awaiting_payment` отбивается (защита от случайного pay-confusion). |
| **IV. Integrations Isolated** | ✅ | Explicit provider interface: `apps/web/src/lib/payments/yookassa-client.ts` (новый), `yookassa-webhook-handler.ts` (новый), `yookassa-refunds.ts` (existing). Никакого ЮKassa-кода в UI/components. Webhooks idempotent (FR-5531). Логи без PII (FR-5595..5597). |
| **V. Analytics & Search** | ⚠️→✅ | DataLayer events `purchase` (после `payment.succeeded`), `payment_failed` (после `payment.canceled`/`expired`) — нужно описать в data-model.md. Не пишем GA4-код сами (это 027), но FR-5xxx должны эмитить domain-events `payment.*`, которые подхватит analytics-subscriber (отдельный track или dataLayer.push на success-странице). **Добавляю FR-5599 в spec.md post-plan.** |
| **VI. Maintainable by Codex** | ✅ | Все типы в `contracts/yookassa-types.ts`, схема в `data-model.md`, скрипты в `apps/web/src/lib/payments/`, docs рядом с кодом. Никакой логики «только в админке». |
| **VII. Quality Gates** | ✅ | Pre-launch checklist в spec §17. Все SC измеримы. Webhook-handler safely retriable (idempotency). Secrets через env (FR-5598). |

**Technical Constraints (constitution §Technical Constraints) check**:
- Next.js + Payload CMS + PostgreSQL ✅
- ЮKassa as primary payment provider ✅ (это и есть фича)
- МойСклад — не задействован в 055 (TODO/Phase 2 для inventory check перед capture; пока FR-5520 говорит "всегда capture")

**Gate result**: ✅ PASS. Принцип V требует одну минорную поправку в spec (добавить FR-5599 про domain-event для аналитики), но это пост-design fixup, не violation.

## Project Structure

### Documentation (this feature)

```text
specs/055-yookassa-payments-integration/
├── plan.md              # ← this file
├── research.md          # Phase 0: API exploration + cross-spec patterns
├── data-model.md        # Phase 1: paymentSettings, paymentEvents, Orders.payment extensions
├── contracts/
│   ├── create-payment.openapi.yaml      # POST /api/payment/yookassa/create
│   ├── payment-status.openapi.yaml      # GET /api/orders/[id]/payment-status
│   ├── yookassa-webhook-events.ts       # Typed inbound event union
│   ├── domain-events-payment.ts         # Typed outbound domain-events (payment.*)
│   └── refund-webhook-contract.md       # 053↔055 integration contract
├── quickstart.md        # Phase 1: env setup, test-shop config, e2e steps
├── spec.md              # ← /specify + /clarify output (existing)
└── tasks.md             # Phase 2: /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── globals/
│   │   ├── ApiShipSettings.ts           (existing, 047)
│   │   ├── CrmSettings.ts               (existing, 048)
│   │   ├── NotificationsSettings.ts     (existing, 049)
│   │   └── PaymentSettings.ts           ⭐ NEW (055)
│   │
│   ├── collections/
│   │   ├── Orders.js                    (existing — extend payment group, add captureAttempts, vatCodeApplied, paymentMethodSnapshot, confirmationUrl, idempotenceKey, capturedAt, receiptStatus)
│   │   ├── ShippingCalculations.ts      (existing, 047)
│   │   ├── ShippingLogs.ts              (existing, 047)
│   │   ├── CrmSyncJobs.ts               (existing, 048)
│   │   ├── NotificationJobs.ts          (existing, 049)
│   │   └── PaymentEvents.ts             ⭐ NEW (055)
│   │
│   ├── lib/
│   │   ├── payments/
│   │   │   ├── yookassa-refunds.ts      (existing, 053 — extend signature for receipt input + Orders.payment.vatCodeApplied snapshot)
│   │   │   ├── yookassa-client.ts       ⭐ NEW (createPayment, capturePayment, cancelPayment, getPayment)
│   │   │   ├── yookassa-webhook-handler.ts ⭐ NEW (verify + dispatch)
│   │   │   ├── yookassa-receipt.ts      ⭐ NEW (build receipt from Order + paymentSettings)
│   │   │   ├── yookassa-types.ts        ⭐ NEW (re-exports from contracts/yookassa-webhook-events.ts)
│   │   │   ├── ip-allowlist.ts          ⭐ NEW (CIDR-match для FR-5530)
│   │   │   ├── settings.ts              ⭐ NEW (loadPaymentSettings cached)
│   │   │   └── __tests__/
│   │   │       ├── yookassa-client.test.ts
│   │   │       ├── webhook-verify.test.ts
│   │   │       ├── receipt-builder.test.ts
│   │   │       ├── amount-match.test.ts
│   │   │       └── capture-retry.test.ts
│   │   │
│   │   ├── lifecycle/                   (existing — used here; we EMIT new payment.* events)
│   │   ├── returns/                     (existing, 053 — extend repository.applyRefundSucceeded / applyRefundCanceled)
│   │   ├── cart/                        (existing, 052 — recovery-subscriber подписывается на payment.canceled / payment.expired)
│   │   └── notifications/               (existing, 049 — matrix дополняется payment.* events)
│   │
│   └── app/
│       └── api/
│           ├── payment/
│           │   └── yookassa/
│           │       ├── create/
│           │       │   └── route.ts     ⭐ NEW — POST /api/payment/yookassa/create
│           │       └── webhook/
│           │           └── route.ts     (existing mock — REPLACE с реальным handler из 055)
│           │
│           ├── orders/
│           │   └── [id]/
│           │       └── payment-status/
│           │           └── route.ts     ⭐ NEW — GET для polling на success-page
│           │
│           └── cron/
│               └── payments-expire/
│                   └── route.ts         ⭐ NEW — cron expire + reconcile (FR-5580..5585)
```

**Structure Decision**:
- Single Next.js + Payload app (monorepo `apps/web/`), как все спеки 047-054.
- Все 055-новые модули в `apps/web/src/lib/payments/` (cohesive vertical slice).
- Никаких новых пакетов в `packages/` — слишком тонко.
- Tests рядом с кодом (`__tests__/`), как 052/053/054.

## Complexity Tracking

Нет нарушений конституции — оставляем пустым.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_ | — | — |

## Cross-spec coordination matrix

| Спека | Что 055 даёт ей | Что 055 берёт у неё |
| --- | --- | --- |
| **037** (checkout-flows) | `POST /api/payment/yookassa/create` endpoint + return URL | Готовая корзина + checkout-form (frontend) |
| **047** (delivery-checkout-apiship) | `payment.succeeded` webhook эмитит `order.paid` (вместо текущего mock) | `priceSnapshot`, `Order.totals.total`, finalize-shipping shape |
| **049** (notifications) | Новые events `payment.{succeeded,canceled,expired,amount_mismatch,receipt_failed}` | Matrix `notification-matrix.ts` (расширяется) |
| **051** (numbering + immutability) | `wasEverPaid=true` после `payment.succeeded` | Immutability guard (frozen `Order.totals` после `paid`) |
| **052** (cart-as-entity) | События `payment.canceled` / `payment.expired` для cart-recovery | `Cart.metadata.utm` snapshot для FR-5507 |
| **053** (returns-refunds) | Webhook `refund.succeeded`/`refund.canceled` закрывает petlю; receipt-параметр в `createRefund` | `payment.refunds[]` структура, `Returns.providerRefundId` |
| **054** (customer-account) | _none in MVP_ — saved cards в Phase 2 | Customer auth для polling `/payment-status` (опционально) |
| **048** (Twenty CRM) | Подписчик получит `payment.succeeded` (когда Twenty включат) | Гарантирована изоляция: `crmSettings.enabled=false` на launch ⇒ нет cross-spec activity |

## Phase 0: Outline & Research

См. отдельный документ `research.md` (генерируется на следующем шаге).

**Темы research'a**:
1. ЮKassa API authentication (basic auth, idempotency)
2. Two-stage capture flow (auth → capture, TTL 7д)
3. Webhook payload structure (4 event types + edge cases)
4. Receipt 54-ФЗ объект (FR-5540..5546)
5. PCI-DSS scope verification
6. IP-allowlist CIDR-matching (FR-5530)
7. Capture-retry exponential backoff strategy (FR-5523a)
8. Cron reconciliation patterns (FR-5580..5585)
9. Cross-spec event contract (053-integration)
10. ЮKassa changelog 2026 (новые ставки, любые breaking changes API)

**Expected output**: `research.md` с разделами Decision/Rationale/Alternatives для каждой темы.

## Phase 1: Design & Contracts

**Prerequisites**: `research.md` complete.

### Data Model

См. `data-model.md`:

**Сущности:**
1. **Payload Global `paymentSettings`** — поля (FR-5560), доступ owner-only, secrets с `access.read: () => false`.
2. **Payload Collection `paymentEvents`** — read-only, рост ≤500K, retention cron.
3. **`Orders.payment` extensions** — `idempotenceKey`, `confirmationUrl`, `paymentMethodSnapshot`, `capturedAt`, `receiptStatus`, `captureAttempts[]`, `vatCodeApplied`.
4. **Domain events (typed)** — `payment.authorized`, `payment.captured`, `payment.succeeded`, `payment.canceled`, `payment.expired`, `payment.amount_mismatch`, `payment.receipt_failed`. Cross-spec: `return.refunded`, `return.refund_failed`.

### Contracts

См. `contracts/`:

1. **`create-payment.openapi.yaml`** — `POST /api/payment/yookassa/create`: req `{orderId, retryNonce?}` → resp `{confirmationUrl, confirmationType, providerRef, paymentMethodTypes}` либо `{code, message}` errors.
2. **`payment-status.openapi.yaml`** — `GET /api/orders/[id]/payment-status`: polling endpoint для success-page; resp `{status, paidAt?, providerStatus, retryAvailable}`.
3. **`yookassa-webhook-events.ts`** — typed union для inbound: `WaitingForCaptureEvent | SucceededEvent | CanceledEvent | RefundSucceededEvent | RefundCanceledEvent`. Все с `event_id`, `event_type`, `object`.
4. **`domain-events-payment.ts`** — typed outbound: `PaymentAuthorized | PaymentCaptured | PaymentSucceeded | PaymentCanceled | PaymentExpired | PaymentAmountMismatch | PaymentReceiptFailed`.
5. **`refund-webhook-contract.md`** — markdown-контракт между 055 и 053: интерфейс `applyRefundSucceeded(event)` / `applyRefundCanceled(event)` в `apps/web/src/lib/returns/repository.ts`.

### Quickstart

См. `quickstart.md`:

1. Env vars setup (`YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_WEBHOOK_SECRET` — последний из Payload, но для миграции с testshop).
2. ЮKassa test-shop creation (OQ-12) + IP webhook URL.
3. Локальный dev через ngrok-туннель.
4. E2E recipe:
   - Create test order via admin.
   - POST `/api/payment/yookassa/create`.
   - Открыть `confirmationUrl` в браузере.
   - Использовать test card (`4111 1111 1111 1026`, любой 3-DS).
   - Проверить webhook → Order → paid + receipt registered.
5. Refund e2e:
   - Customer POST `/api/returns`.
   - Admin approve → `/api/admin/returns/:id/refund`.
   - Дождаться webhook `refund.succeeded`.
   - Проверить `Returns.status: refunded`.

### Agent context update

Запустить `.specify/scripts/bash/update-agent-context.sh claude` после generation Phase 1 — добавит ссылку на 055 в `apps/web/AGENTS.md` (existing) и `CLAUDE.md` (existing).

## Post-Design Constitution Re-Check

✅ **PASS** (выполнен после Phase 1 + /analyze remediation).

**Spec corrections applied (after /analyze)**:
- ✅ **FR-5599** добавлен в spec.md §3.1 — закрывает Constitution Principle V (Analytics).
- ✅ **FR-5542 + A4** уточнены — единый `vat_code=12` для доставки в MVP, бухгалтерская валидация в pre-launch checklist (резолюция F1).
- ✅ **T082** добавлен в tasks.md Phase 10 — load-test для SC-5509 (резолюция C1).
- ✅ **Note** про deferred FR-5535 (HMAC enforce) добавлен в tasks.md Phase 3 (резолюция D2).

**Out of Scope §10 #18** (saved card UX) — фиксирован при /analyze, в Phase 2.

## Stop & Report

После /speckit-plan создаются:
- `plan.md` ✅ (этот файл)
- `research.md` — Phase 0
- `data-model.md` — Phase 1
- `contracts/*` — Phase 1
- `quickstart.md` — Phase 1
- `AGENTS.md` / `CLAUDE.md` updates — Phase 1 final

**НЕ создаётся**: `tasks.md` (это `/speckit-tasks`), реальный код (`/speckit-implement`).
