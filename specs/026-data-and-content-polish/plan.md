# Implementation Plan: Data And Content Polish

**Branch**: `026-data-and-content-polish`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Land a batch of high-impact, low-coupling improvements: price refresh date, document deduplication and filtering, FAQ on B2B and solution pages, catalog mobile header fix, brand CSS tokens, and toast feedback on cart actions.

## Technical Context

**Touchpoints**:

- `apps/web/src/lib/products/source-products.ts` (price metadata)
- `apps/web/src/components/product/ProductDetailPage.tsx` and listing cards
- `apps/web/src/components/page-templates.tsx` (documents listing, B2B, solution)
- `apps/web/src/components/catalog/CatalogFilterableList.tsx` (header layout)
- `apps/web/src/app/globals.css` (CSS variables)
- New: `apps/web/src/components/ui/Toaster.tsx`

## Scope

### In Scope

- `priceUpdatedAt` end-to-end (data → display).
- Document normaliser and filter UI.
- FAQ blocks + JSON-LD for B2B and solutions.
- Catalog header responsive fix.
- CSS variable tokens for brand and spacing.
- Toast component and integration into cart actions.

### Out Of Scope

- Full Payload cutover for prices/documents.
- Multilingual content.
- Knowledge article rewrites (separate content track).

## Validation

- `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- `pnpm validate:schema` (after spec `028`).
- Visual checks on `/documents/`, `/b2b/`, `/solutions/*`, `/product/sp-8/`, `/catalog/pdu/` mobile.
- Manual cart toast check.

## Risks

- Price metadata may not exist for all products. Mitigation: default to "Цена по запросу" without erroring.
- Document normalisation can mis-merge near-duplicates. Mitigation: dedup by SHA-256 only; titles are normalised independently.

## Follow-Ups

- Move tokens into a design-system package once a second app is added.
- Author proper FAQ content as part of `011-content-production-system`.
