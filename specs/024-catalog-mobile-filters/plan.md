# Implementation Plan: Catalog Mobile Filters

**Branch**: `024-catalog-mobile-filters`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Add a mobile filter drawer, desktop accordion grouping and URL-state synchronization to the catalog. Improve the empty state with reset shortcuts and an RFQ deep link.

## Technical Context

**Touchpoints**:

- `apps/web/src/components/catalog/CatalogFilterableList.tsx`
- `apps/web/src/app/(site)/catalog/[...slug]/page.tsx` (canonical handling)
- `apps/web/src/lib/seo/seo-registry.ts` (canonical metadata)
- New: `apps/web/src/components/catalog/CatalogFiltersDrawer.tsx`

## Scope

### In Scope

- Mobile drawer for filters.
- Accordion grouping on desktop.
- Query-string state synchronization (with `useSearchParams`).
- Empty state improvements.

### Out Of Scope

- Filter facet schema changes.
- Server-side rendering of query-state (the catalog stays client-side filtered for now).
- Saved searches / user accounts.

## Validation

- `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- Manual viewport checks at 375 / 768 / 1024 / 1440.
- A11y check on the drawer (focus trap, ESC).
- SSR sweep: canonical tag remains unchanged for query-param variants.

## Risks

- Indexing duplication if query params produce SEO collisions. Mitigation: canonical points to the clean URL; robots stays open.
- Performance regression from re-filtering. Mitigation: memoize as already done.

## Follow-Ups

- Server-side rendered query state for shareable listings — separate spec.
- Saved filter presets per user — separate spec.
