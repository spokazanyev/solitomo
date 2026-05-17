# Implementation Plan: Solution Mini Finder

**Branch**: `025-solution-mini-finder`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Add a `RackParametersForm` to each solution page that converts engineering inputs into catalog filters or an RFQ deep link. Surface relevant solutions on PDPs.

## Technical Context

**Touchpoints**:

- `apps/web/src/components/page-templates.tsx` (`SolutionTemplate`)
- New: `apps/web/src/components/solutions/RackParametersForm.tsx`
- `apps/web/src/components/RfqForm.tsx` (reads search params)
- `apps/web/src/components/product/ProductDetailPage.tsx` (related solutions block)
- `apps/web/src/lib/catalog/query.ts` (from spec `024`)

## Scope

### In Scope

- New form component.
- Mapping form values → catalog query string or RFQ prefill.
- PDP-related solutions block.

### Out Of Scope

- Heuristic recommendations beyond direct attribute matches.
- Saved configurations.

## Validation

- `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- E2E manual: solution → form → catalog → cart → RFQ.
- Analytics events fire (after spec `027`).

## Risks

- Mismatches between user inputs and available catalogs. Mitigation: define an explicit mapping table; log unmatched inputs.
- Mixed-outlet selections may not map to a single catalog. Mitigation: route to `/catalog/iec-c13-c19/` with a note.

## Follow-Ups

- Multi-step finder with drawing of the rack — separate spec.
- AI-assisted suggestions — out of scope and dependent on broader product roadmap.
