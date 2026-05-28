# solitomo-organic-site Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-28

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
- TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime) + Next.js 16 (App Router, RSC), React 19, Payload CMS v3, Drizzle ORM, `@payloadcms/db-postgres`, `pdfkit` (для PDF-генерации), `libphonenumber-js`, `lucide-react`. Уже существующие модули: `@/components/checkout/{AddressForm,DeliveryBlock,PointSelector,DadataSuggestInput,PhoneInput}`, `@/components/cart/OrderSummaryCard`, `@/lib/shipping/*` (ApiShip provider от 047), `@/lib/consent/make-consent-record` (от 057), `@/lib/analytics/{events,data-layer}` (от 058), `@/lib/company/get-company-contacts` (для адреса склада). (062-invoice-shipping-unify)
- PostgreSQL через Payload v3 (Drizzle adapter). Существующая таблица `orders` — добавляется одно опциональное поле `delivery.handoverNote` (textarea, ≤1000 символов) + миграция значения enum `delivery.method`: `tc → own_carrier`. Никаких новых таблиц. (062-invoice-shipping-unify)
- TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime) + Next.js 16 (App Router, RSC), React 19; существующие модули — `@/lib/dadata/client` (axios-based), `@/components/checkout/DadataSuggestInput`, `@/lib/analytics/events` + `@/lib/analytics/data-layer`. Новых внешних зависимостей нет. (063-dadata-party-autofill)
- N/A — изменений схемы Payload/Postgres нет. Поля `companyName, inn, kpp, ogrn, legalAddress` уже принимаются `POST /api/orders` (`customer.*`). (063-dadata-party-autofill)
- TypeScript 5.x (strict), Node.js 20.x (Next.js 16 runtime) + Next.js 16 (App Router, RSC), React 19, Payload CMS v3, Drizzle ORM, `@payloadcms/db-postgres`, `pdfkit` (PDF-счёт). Существующие модули: `@/lib/shipping/*` (ApiShip provider + `providerNameFromKey`, спека 047), `@/components/cart/{InvoiceCheckoutForm,PhysicalCheckoutForm}`, `@/components/checkout/ReviewClient`, `@/app/api/invoice/[orderId]/route.ts` (PDF), `@/app/api/orders/route.ts`. (064-apiship-any-carrier)
- PostgreSQL через Payload v3 (Drizzle adapter). Существующая таблица `orders`, группа `delivery`. Изменения: enum `enum_orders_delivery_method` → `text`; новые колонки `delivery.channel` (text/enum), `delivery.provider_name` (text). Formal migration в `apps/web/src/migrations/` (`payload migrate`, autopush off в prod). (064-apiship-any-carrier)

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
- 064-apiship-any-carrier: Added TypeScript 5.x (strict), Node.js 20.x (Next.js 16 runtime) + Next.js 16 (App Router, RSC), React 19, Payload CMS v3, Drizzle ORM, `@payloadcms/db-postgres`, `pdfkit` (PDF-счёт). Существующие модули: `@/lib/shipping/*` (ApiShip provider + `providerNameFromKey`, спека 047), `@/components/cart/{InvoiceCheckoutForm,PhysicalCheckoutForm}`, `@/components/checkout/ReviewClient`, `@/app/api/invoice/[orderId]/route.ts` (PDF), `@/app/api/orders/route.ts`.
- 063-dadata-party-autofill: Added TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime) + Next.js 16 (App Router, RSC), React 19; существующие модули — `@/lib/dadata/client` (axios-based), `@/components/checkout/DadataSuggestInput`, `@/lib/analytics/events` + `@/lib/analytics/data-layer`. Новых внешних зависимостей нет.
- 062-invoice-shipping-unify: Added TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime) + Next.js 16 (App Router, RSC), React 19, Payload CMS v3, Drizzle ORM, `@payloadcms/db-postgres`, `pdfkit` (для PDF-генерации), `libphonenumber-js`, `lucide-react`. Уже существующие модули: `@/components/checkout/{AddressForm,DeliveryBlock,PointSelector,DadataSuggestInput,PhoneInput}`, `@/components/cart/OrderSummaryCard`, `@/lib/shipping/*` (ApiShip provider от 047), `@/lib/consent/make-consent-record` (от 057), `@/lib/analytics/{events,data-layer}` (от 058), `@/lib/company/get-company-contacts` (для адреса склада).


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
