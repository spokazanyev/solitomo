# Tasks: Data And Content Polish

**Input**: [spec.md](./spec.md), [plan.md](./plan.md).

## Phase 1 - Prices With Date

- [ ] T001 Add `priceUpdatedAt` (string, ISO date) to the source product shape in `apps/web/src/lib/products/source-products.ts`.
- [ ] T002 Surface the date in PDP price card; if missing, render "Цена по запросу".
- [ ] T003 Surface the same value in catalog card price line (compact form).

## Phase 2 - Documents

- [ ] T004 Add a normaliser in `apps/web/scripts/normalise-documents.ts` that derives a clean title and a type from raw filenames.
- [ ] T005 Deduplicate documents by SHA-256 in `getDocumentRegistry()`.
- [ ] T006 Add a type filter UI to `/documents/` (passports / certificates / drawings / manuals / прочее).

## Phase 3 - FAQ On B2B And Solutions

- [ ] T007 Author FAQ items for `/b2b/` and each solution route in `apps/web/src/lib/seo/template-content.ts` (or load from Payload after cutover).
- [ ] T008 Render FAQ blocks in `B2BLandingTemplate` and `SolutionTemplate`.
- [ ] T009 Emit FAQPage JSON-LD on these routes.

## Phase 4 - Catalog Header

- [ ] T010 Fix the header row layout in `apps/web/src/components/catalog/CatalogFilterableList.tsx` to stack vertically on `< md`.
- [ ] T011 Ensure the sort selector and RfqCartLink remain reachable in mobile view.

## Phase 5 - CSS Tokens

- [ ] T012 Define brand and spacing CSS variables in `apps/web/src/app/globals.css` (`--color-brand-primary`, `--color-accent`, `--color-surface`, `--space-...`).
- [ ] T013 Map Tailwind theme via `theme.extend.colors` to the variables.
- [ ] T014 Replace direct `sky-700`/`slate-*` usages with semantic classes (`bg-brand-primary`, `text-brand-on`, etc.) in primary CTAs and links.

## Phase 6 - Toast

- [ ] T015 Add `apps/web/src/components/ui/Toaster.tsx` (small, no external dependency) and a `useToast()` hook.
- [ ] T016 Mount the toaster in `app/(site)/layout.tsx`.
- [ ] T017 Trigger toasts in `AddToRfqButton` interactions.

## Phase 7 - Verification

- [ ] T018 Run `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] T019 Run `pnpm public-copy-audit` and `pnpm validate:schema` (once spec `028` ships).
- [ ] T020 Manual visual checks; capture screenshots, store in `07-build-specifications/026-data-and-content-polish/screenshots/`.
