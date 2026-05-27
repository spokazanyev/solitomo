# solitomo-organic-site Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-27

## Active Technologies
- TypeScript 5.x (strict mode), Next.js 16 (App Router, RSC), React 19. (056-yookassa-frontend-integration)
- N/A — frontend читает Payload через `/api/orders/[id]/payment-status` endpoint + Server Component через Local API. (056-yookassa-frontend-integration)
- TypeScript 5.x (strict), Next.js 16 App Router + RSC, React 19 + Payload CMS v3 (admin + collections + versioning), Drizzle ORM + PostgreSQL, Tailwind CSS, @payloadcms/richtext-lexical (rich-text rendering для юр-документов), schema.org JSON-LD utilities (существующие из 047+) (057-yookassa-buyer-info-compliance)
- PostgreSQL через @payloadcms/db-postgres. Новая таблица `static_pages` + расширение `consent` embedded в 4 существующих коллекциях (Orders, Carts, Returns, Customers) — последняя через extension RFQ не требуется (RFQ-flow уже хранит согласие из 047, см. research.md R5) (057-yookassa-buyer-info-compliance)
- TypeScript 5.x (strict), Node.js 20.x runtime (Next.js 16 default). (057-yookassa-buyer-info-compliance)
- PostgreSQL через Payload v3. Новые поля на существующих коллекциях (`Carts`, `Orders`, `Customers`), новая коллекция `Annotations`, новая Global `AnalyticsSettings`. Никаких отдельных аналитических БД — Метрика хранит исторические данные у себя. (057-yookassa-buyer-info-compliance)
- TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime) + Next.js 16 (App Router + RSC), React 19, Payload CMS v3, Drizzle ORM, @payloadcms/db-postgres, Vitest для тестов (060-shipping-package-dimensions)
- PostgreSQL через Payload v3 (Drizzle adapter). Новые опциональные колонки в существующей таблице `products` через formal migration в `apps/web/src/migrations/` — на проде используется `payload migrate` (autopush выключен в production). (060-shipping-package-dimensions)
- TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime) + Next.js 16 (App Router, RSC), React 19, Tailwind CSS, `lucide-react` (icons: Receipt, CreditCard, Loader2, ArrowRight), внутренний компонент `@/components/consent/ConsentCheckbox` (от спеки 057), `@/components/rfq/RfqCart` для `RfqCartItem`/`getCartTotal`. (061-unified-checkout-summary)
- N/A — изменения чисто на UI-слое, ни в одну коллекцию Payload и ни в одну таблицу Postgres не пишем. (061-unified-checkout-summary)

- TypeScript 5.x (strict mode), Node.js (Next.js 16 runtime). (055-yookassa-payments-integration)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (strict mode), Node.js (Next.js 16 runtime).: Follow standard conventions

## Recent Changes
- 061-unified-checkout-summary: Added TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime) + Next.js 16 (App Router, RSC), React 19, Tailwind CSS, `lucide-react` (icons: Receipt, CreditCard, Loader2, ArrowRight), внутренний компонент `@/components/consent/ConsentCheckbox` (от спеки 057), `@/components/rfq/RfqCart` для `RfqCartItem`/`getCartTotal`.
- 060-shipping-package-dimensions: Added TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime) + Next.js 16 (App Router + RSC), React 19, Payload CMS v3, Drizzle ORM, @payloadcms/db-postgres, Vitest для тестов
- 057-yookassa-buyer-info-compliance: Added TypeScript 5.x (strict), Node.js 20.x runtime (Next.js 16 default).


<!-- MANUAL ADDITIONS START -->

## Authoritative project docs (root)

**This file is generic shell.** For real conventions read these, in this order:

1. `agent-project-context.md` — cross-cutting project context (Payload collections, public routes, SEO/schema.org, RFQ behavior).
2. `apps/web/AGENTS.md` — Web app module map, active features 047-055, useful commands.
3. `07-build-specifications/order-lifecycle-spec.md` — canonical commerce lifecycle.
4. `07-build-specifications/crm-integration-pattern.md` — CRM gating capability matrix (Twenty off on launch).
5. `07-build-specifications/document-register.md` — index of all specification documents.
6. `.specify/memory/constitution.md` — project constitution (Spec-First, SEO requirements, etc.).

## Active specifications (chronological)

- Specs 001-046 — site foundation, content, SEO, RFQ system (background).
- Specs 047-054 — commerce backend MVP (active implementation).
- Spec 055 — **ЮKassa Payments Integration** (current; `/speckit-specify` + `/speckit-clarify` done; `/speckit-plan` in progress).

## Stack reality

- **NOT** the `backend/frontend/tests/` layout above. Real layout: `apps/web/` (Next.js 16 + Payload CMS v3 + PostgreSQL monorepo).
- Build/lint/test commands from `apps/web/AGENTS.md`:
  ```
  pnpm agent:context
  pnpm --filter @soliton/web generate:types
  pnpm typecheck
  pnpm lint
  pnpm --filter @soliton/web test
  ```

## Speckit workflow

This project uses `github-spec-kit` v0.8.11 with `claude` integration. Skills installed at `.claude/skills/speckit-*`.

Phases: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` → `/speckit-analyze`.

<!-- MANUAL ADDITIONS END -->
