# Tasks: RFQ Page Focus

**Input**: [spec.md](./spec.md), [plan.md](./plan.md).

## Phase 1 - Extract Templates

- [ ] T001 Create `apps/web/src/components/templates/B2BLandingTemplate.tsx` and move existing B2B content from `B2BTemplate` (process, trust band, link grid).
- [ ] T002 Create `apps/web/src/components/templates/RfqPageTemplate.tsx` containing only: hero, form, side panel, post-submit explanation.
- [ ] T003 Update `TemplateBody` in `apps/web/src/components/page-templates.tsx` to route `/b2b/request-quote/` to `RfqPageTemplate` and all other B2B routes to `B2BLandingTemplate`.
- [ ] T004 Remove the wireframe "Быстрый RFQ-макет" block from `B2BLandingTemplate` (also enforced by spec `015`).

## Phase 2 - Success State

- [ ] T005 Extend `RfqForm` to render a success card after a successful submit with tracking ID, expected response time, and links to catalog and documents.
- [ ] T006 Ensure the server response returns the tracking ID; coordinate with the existing RFQ API.
- [ ] T007 Clear the RFQ cart on success.

## Phase 3 - Side Panel And Hero

- [ ] T008 Move the "Что ускорит КП" panel content into `RfqPageTemplate` as a sticky side card on `lg+`.
- [ ] T009 Tighten the hero copy on `/b2b/request-quote/` per spec `015` (no SEO labels).

## Phase 4 - Verification

- [ ] T010 Run `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] T011 Submit the form with and without items in cart; verify success card appears.
- [ ] T012 Submit with a deliberately failing endpoint; verify inline error.
- [ ] T013 DOM diff `/b2b/` vs `/b2b/request-quote/` and capture screenshots into `07-build-specifications/021-rfq-page-focus/screenshots/`.
- [ ] T014 Run `pnpm public-copy-audit`.
