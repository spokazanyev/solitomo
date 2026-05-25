# Implementation Plan: ЮKassa Frontend Integration

**Branch**: `056-yookassa-frontend-integration` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/056-yookassa-frontend-integration/spec.md` (8 OQ resolved, 100% готовность к /plan).

## Summary

Frontend-integration слой поверх backend 055. Закрывает 4 P1 + 1 P2 user story: (1) US1 — fix 3 existing UI компонента (ReviewClient, RetryPaymentButton, PhysicalCheckoutForm) под новый API contract; (2) US2 — retry-flow с reuse существующего `idempotenceKey`; (3) US3 — новая page `/payment/return/[orderId]` с polling-логикой и 4 финальных UI states; (4) US4 — 4 новых email-template (T-015 customer + T-109/110/111 manager) с registration в 049 REGISTRY; (5) US6 — admin PaymentEvents related-list на странице Order. Технический подход: re-use существующих UI паттернов (lucide-react icons, Tailwind classes, существующий error/loading state pattern из ReviewClient), Next.js 16 Server/Client component split, polling через native `fetch` + setInterval, доступ через 054 customer_session / 052 cart_session / 047 publicToken triple-fallback.

Также 056 добавляет один `POST /api/orders` backend-патч (FR-5609): customer_session-binding при Order creation (additive, не breaking).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 16 (App Router, RSC), React 19.

**Primary Dependencies**:
- Next.js 16 (Server Components + Client Components, `useRouter`, `useState`, `useEffect`)
- React 19 (hooks, `use` for promise unwrapping в RSC)
- `lucide-react` (icons — existing pattern в проекте)
- Tailwind CSS (existing styling system)
- Payload CMS v3 Local API (Server Component доступ к Order)
- Native `fetch` для polling (никаких new dependencies)

**Storage**: N/A — frontend читает Payload через `/api/orders/[id]/payment-status` endpoint + Server Component через Local API.

**Testing**: Vitest (unit tests для UI logic — polling state machine, error-mapping dictionary). E2E через manual quickstart на test-shop ЮKassa.

**Target Platform**: Mobile + Desktop browsers (Chrome, Safari, Firefox, Yandex Browser). Modern only — никаких IE11 hacks. Touch-friendly mobile-first.

**Project Type**: Web frontend integration (нет нового project type — расширение existing Next.js app).

**Performance Goals**:
- p95 first-render `/payment/return/[orderId]` ≤ 500 мс (NFR-5601)
- p95 polling-tick ≤ 300 мс (NFR-5602)
- Lighthouse accessibility ≥ 90 (SC-5606)

**Constraints**:
- Никаких client-side секретов (NFR-5603) — все ЮKassa API через backend
- ARIA-accessible UI на success/failure (NFR-5604) — `role="status"`, `aria-live`, focus management
- Все тексты на русском (no i18n)
- Backend 055 ещё на feature-branch — 056 implement'ится поверх 055 ветки до общего merge

**Scale/Scope**:
- ~5-15 платежей/день на старте — polling load minimal
- 4 UI компонента modify + 4 NEW component + 1 NEW page + 4 NEW email templates + 1 backend patch (POST /api/orders)

## Constitution Check

*GATE: должен пройти ДО Phase 0; пересмотр после Phase 1.*

| Принцип | Соблюдение | Обоснование |
| --- | --- | --- |
| **I. Spec-First** | ✅ | spec.md → /clarify (7 OQ resolved) → /plan. Implementation после `/tasks`. |
| **II. SEO/Demand** | N/A | `/payment/return/[orderId]` — закрытая страница, `robots: noindex` через app metadata. Никакого indexing-impact. |
| **III. B2B/RFQ First, B2C Second** | ✅ | B2B-checkout flow (US2 037 invoice) **не затрагивается** — этот UI только для US1 (физлицо). Invoice flow остаётся на existing `/cart/checkout/invoice/`, ничего там не меняется. |
| **IV. Integrations Isolated** | ✅ | Все ЮKassa-вызовы через 055 backend endpoints. UI **никогда** не вызывает `api.yookassa.ru` напрямую. Webhook-логика — в 055, не в 056. |
| **V. Analytics** | ✅ | `payment.succeeded` domain event (055 FR-5599) уже содержит `utm` snapshot. Frontend `dataLayer.push({event:'purchase', ...})` на `/payment/return/[orderId]` success state — добавим в FR-5630 (новый). |
| **VI. Maintainable by Codex** | ✅ | Все компоненты explicit-typed, страница и client-component документированы. Никаких hidden behaviors. |
| **VII. Quality Gates** | ✅ | E2E на test-shop (quickstart.md), accessibility audit, security review (нет secrets на client). |

**Gate result**: ✅ PASS. Минорное дополнение: FR-5630 для Analytics (dataLayer purchase event на success page).

**Technical Constraints check**: Next.js + Payload + PostgreSQL — соблюдено. ЮKassa primary provider — соблюдено (UI consumes backend only).

## Project Structure

### Documentation (this feature)

```text
specs/056-yookassa-frontend-integration/
├── plan.md              # ← this file
├── research.md          # Phase 0: existing UI patterns + polling strategy
├── data-model.md        # Phase 1: minimal (no new DB entities, только types)
├── contracts/
│   ├── ui-events.md             # dataLayer / analytics events contract
│   └── email-templates.md       # T-015/109/110/111 specifications
├── quickstart.md        # Phase 1: manual e2e recipe + ngrok flow
├── spec.md              # /specify + /clarify output
└── tasks.md             # /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── app/(site)/payment/
│   │   └── return/
│   │       └── [orderId]/
│   │           ├── page.tsx              ⭐ NEW (Server Component)
│   │           └── opengraph-image.tsx   ⭐ NEW (optional, для shared links)
│   │
│   ├── app/api/orders/
│   │   └── route.ts                      (existing — patch FR-5609 customer_session binding)
│   │
│   ├── components/
│   │   ├── payment/
│   │   │   ├── PaymentReturnClient.tsx   ⭐ NEW (Client Component, polling)
│   │   │   ├── PaymentReturnSuccess.tsx  ⭐ NEW (success UI)
│   │   │   ├── PaymentReturnFailure.tsx  ⭐ NEW (failure UI, retry-aware)
│   │   │   ├── PaymentReturnProcessing.tsx ⭐ NEW (timeout-pending UI)
│   │   │   ├── PaymentReturnError.tsx    ⭐ NEW (403/404 UI)
│   │   │   ├── payment-error-strings.ts  ⭐ NEW (code → russian-string mapping)
│   │   │   └── __tests__/
│   │   │       ├── PaymentReturnClient.test.tsx
│   │   │       └── payment-error-strings.test.ts
│   │   │
│   │   ├── checkout/
│   │   │   ├── ReviewClient.tsx          (modify — API contract fix)
│   │   │   └── RetryPaymentButton.tsx    (modify — API contract fix)
│   │   │
│   │   └── cart/
│   │       └── PhysicalCheckoutForm.tsx  (modify — wire to real endpoint)
│   │
│   └── lib/notifications/templates/
│       ├── t-015-payment-expired.ts      ⭐ NEW (customer)
│       ├── t-109-amount-mismatch.ts      ⭐ NEW (manager)
│       ├── t-110-receipt-failed.ts       ⭐ NEW (manager)
│       ├── t-111-refund-failed.ts        ⭐ NEW (manager)
│       └── index.ts                      (modify — register 4 new templates)
```

**Structure Decision**:
- Папка `components/payment/` новая — отдельный namespace для всего ЮKassa-customer-UI (не смешиваем с `checkout/` который про cart-checkout flow).
- Server Component (`page.tsx`) грузит Order через Payload Local API + проверяет auth → передаёт props в Client Component.
- Client Component делает polling. Это минимизирует client-server roundtrips (first render = SSR, далее polling-only).
- Tests рядом с компонентами (`__tests__/`) — паттерн 052/053/054.

## Complexity Tracking

Нет нарушений конституции — пусто.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_ | — | — |

## Cross-spec coordination matrix

| Спека | Что 056 даёт ей | Что 056 берёт у неё |
| --- | --- | --- |
| **055** | UI consumer для `/api/payment/yookassa/create` + `/api/orders/[id]/payment-status` | OpenAPI contracts, FR-5500..5599 |
| **049** | 4 новых template-renderer в REGISTRY | T-001 как образец, NotificationsSettings.senderEmail |
| **054** | Patch для `/api/orders` (customer_session binding, FR-5609) | customer_session JWT verification utility |
| **052** | T-015 email содержит cart-recovery link | `Order.cartId` ↔ `Cart.id` для recovery |
| **047** | Использует `Order.publicToken` для guest-fallback на `/payment/return` | publicToken auto-generation (existing) |
| **051** | Отображает `clientNumber` (SO-NNNN) на success-UI | clientNumber generation |
| **037** | Заменяет mock-checkout flow на реальный | Cart/checkout pages (no change) |

## Phase 0: Outline & Research

См. `research.md`. Темы:

1. **Polling-pattern**: native fetch + setInterval vs SWR/react-query. Trade-offs.
2. **Server/Client Component split**: что грузить в SSR, что в client (UX vs performance).
3. **Existing ReviewClient.tsx contract**: full diff для fix.
4. **404/403 handling**: что показывать при wrong-orderId / expired session.
5. **dataLayer purchase event**: format для GA4 + Twenty Activity (когда подключат).
6. **Email template pattern T-001**: HTML structure, sender, links.
7. **`/api/orders/route.ts` current state**: какие поля заполняет, как detect customer_session.
8. **Existing CartCookie / customer_session loader**: reusable utilities.
9. **Accessibility for polling-page**: aria-live, focus management, screen-reader announcements.
10. **Test-shop ЮKassa testing**: validation cards + SBP test flow.

**Expected output**: `research.md` с Decision/Rationale/Alternatives для каждой темы.

## Phase 1: Design & Contracts

**Prerequisites**: `research.md` complete.

### Data Model

См. `data-model.md`. **Никаких новых DB-entities**. Только:
1. UI-state shape для PaymentReturnClient (TypeScript interfaces).
2. Error-code → Russian-string mapping (constant dictionary).
3. dataLayer event shape для `purchase`.

### Contracts

См. `contracts/`:

1. **`ui-events.md`** — dataLayer events для аналитики:
   - `purchase` event format (GA4-compliant: `currency, value, transaction_id, items[]`)
   - `payment_intent` event при click «Оплатить» (для funnel)
   - Когда триггерить + payload shape

2. **`email-templates.md`** — спецификация 4 шаблонов:
   - T-015: subject / preheader / hero block / 2 CTAs / footer
   - T-109/110/111: manager templates с required {placeholders}
   - HTML pattern: re-use T-001 как baseline

### Quickstart

См. `quickstart.md`:

1. Branch setup: merge 056 поверх 055 локально (или rebase когда 055 merged в main)
2. ngrok tunnel для webhook URL
3. Test-shop ЮKassa config (shopId/secret в env)
4. Manual e2e recipe US1 → US2 → US3 → US4

### Agent context update

Запустить `.specify/scripts/bash/update-agent-context.sh claude` после generation Phase 1 — добавит ссылку на 056 в `apps/web/AGENTS.md` и root `CLAUDE.md`.

## Post-Design Constitution Re-Check

(Выполняется ПОСЛЕ создания research.md + data-model.md + contracts/ + quickstart.md.)

**Ожидаемое дополнение к spec.md после Phase 1**:
- **FR-5630** *(NEW, для Constitution V Analytics)*: System MUST эмитить dataLayer `purchase` event на `/payment/return/[orderId]` success-state с `{transaction_id: clientNumber, value: amount, currency: "RUB", items[]}`. Для GA4 + Yandex Metrica integration.

## Stop & Report

После /speckit-plan создаются:
- `plan.md` ✅ (этот файл)
- `research.md` — Phase 0
- `data-model.md` — Phase 1
- `contracts/{ui-events,email-templates}.md` — Phase 1
- `quickstart.md` — Phase 1
- `AGENTS.md` / `CLAUDE.md` updates — Phase 1 final

**НЕ создаётся**: `tasks.md` (это `/speckit-tasks`), реальный код (`/speckit-implement`).
