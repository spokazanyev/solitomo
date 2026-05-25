# solitomo-organic-site Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-25

## Active Technologies
- TypeScript 5.x (strict mode), Next.js 16 (App Router, RSC), React 19. (056-yookassa-frontend-integration)
- N/A — frontend читает Payload через `/api/orders/[id]/payment-status` endpoint + Server Component через Local API. (056-yookassa-frontend-integration)

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
- 056-yookassa-frontend-integration: Added TypeScript 5.x (strict mode), Next.js 16 (App Router, RSC), React 19.

- 055-yookassa-payments-integration: Added TypeScript 5.x (strict mode), Node.js (Next.js 16 runtime).

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
