# Tasks: Catalog Mobile Filters

**Input**: [spec.md](./spec.md), [plan.md](./plan.md).

## Phase 1 - Drawer

- [ ] T001 Add `apps/web/src/components/catalog/CatalogFiltersDrawer.tsx` (client component) implementing the WAI-ARIA dialog pattern.
- [ ] T002 Wire the existing facet UI from `CatalogFilterableList` into the drawer.
- [ ] T003 Add a "Фильтры (N)" trigger button visible on `< lg`.

## Phase 2 - Desktop Accordion

- [ ] T004 Group facets into accordion sections inside `CatalogFilterableList`.
- [ ] T005 Open the first group by default; persist state within the session via `sessionStorage`.

## Phase 3 - URL State

- [ ] T006 Use `useSearchParams` and `useRouter` to read/write filter selections to query parameters.
- [ ] T007 Define a stable query schema (`current`, `mounting`, `outlet`, `function`) in `apps/web/src/lib/catalog/query.ts`.
- [ ] T008 Apply query state on initial load; reflect changes back to URL using `router.replace` to avoid history bloat.

## Phase 4 - Empty State

- [ ] T009 Update the empty state in `CatalogProductList` to offer two reset chips derived from the current selection (the two largest-impact filters).
- [ ] T010 Update the RFQ link to include the attempted criteria as a prefilled comment.

## Phase 5 - Verification

- [ ] T011 Run `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] T012 Manual checks at 375 / 768 / 1024 / 1440 viewports.
- [ ] T013 Keyboard accessibility check on the drawer (Tab, Shift+Tab, ESC).
- [ ] T014 SSR sweep to confirm canonical tag stability.
- [ ] T015 Capture screenshots, store in `07-build-specifications/024-catalog-mobile-filters/screenshots/`.
- [ ] T016 Run `pnpm public-copy-audit`.
