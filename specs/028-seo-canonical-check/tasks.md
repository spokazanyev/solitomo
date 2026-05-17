# Tasks: SEO Canonical And Validation Scripts

**Input**: [spec.md](./spec.md), [plan.md](./plan.md).

## Phase 1 - Canonical / Trailing Slash

- [ ] T001 Confirm Next.js trailing-slash policy in `apps/web/next.config.ts` (`trailingSlash: true`).
- [ ] T002 Add `apps/web/src/middleware.ts` rule that 308-redirects non-slashed public URLs to slashed equivalents (excluding API/static).
- [ ] T003 Ensure `createMetadata()` and `<link rel="canonical">` always render the clean URL (no query parameters).

## Phase 2 - SEO Validator

- [ ] T004 Add `apps/web/scripts/validate-seo.ts` that fetches `/sitemap.xml`, walks URLs, and asserts: 200 OK, unique title, present H1, present meta description, canonical equals clean URL, at least one JSON-LD block.
- [ ] T005 Write a dated report into `06-reports/seo-audit-YYYY-MM-DD.md`.
- [ ] T006 Wire `pnpm validate:seo` to the new script.

## Phase 3 - Schema Validator

- [ ] T007 Add `apps/web/scripts/validate-schema.ts` that parses JSON-LD blocks and verifies expected types per page type (Organization, BreadcrumbList, ItemList, Product, Offer, FAQPage).
- [ ] T008 Implement a minimal JSON-LD shape validator (required fields per type, no empty values).
- [ ] T009 Write a dated report into `06-reports/schema-audit-YYYY-MM-DD.md`.
- [ ] T010 Wire `pnpm validate:schema` to the new script.

## Phase 4 - Verification

- [ ] T011 Run both scripts on the healthy build; commit the latest report.
- [ ] T012 Deliberately break one page's canonical and confirm the validator fails.
- [ ] T013 Run `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] T014 Update `agent-project-context.md` Команды block once placeholder scripts are real.
