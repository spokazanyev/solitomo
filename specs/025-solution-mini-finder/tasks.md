# Tasks: Solution Mini Finder

**Input**: [spec.md](./spec.md), [plan.md](./plan.md).

## Phase 1 - Form Component

- [ ] T001 Add `apps/web/src/components/solutions/RackParametersForm.tsx` with fields: rackUnits, current, outletType, monitoring, surge, notSure.
- [ ] T002 Validate inputs; allow partial submissions.
- [ ] T003 Map inputs to catalog URL via `apps/web/src/lib/catalog/query.ts` (defined in spec `024`).

## Phase 2 - Integration

- [ ] T004 Include `RackParametersForm` in `SolutionTemplate` (`apps/web/src/components/page-templates.tsx`).
- [ ] T005 If `notSure` is selected, route to `/b2b/request-quote/?...&comment=<inputs>`.
- [ ] T006 Extend `RfqForm` to consume the comment prefill and the inputs.

## Phase 3 - PDP Related Solutions

- [ ] T007 Add helper `getRelatedSolutions(product)` in `apps/web/src/lib/products/source-products.ts`.
- [ ] T008 Render the block in `ProductDetailPage`, below specs, above the related products list.

## Phase 4 - Verification

- [ ] T009 Run `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] T010 Manual flow: solution → form → catalog → cart → RFQ.
- [ ] T011 Confirm analytics events when spec `027` is in place.
- [ ] T012 Capture screenshots, store in `07-build-specifications/025-solution-mini-finder/screenshots/`.
- [ ] T013 Run `pnpm public-copy-audit`.
