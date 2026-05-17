# Implementation Plan: Product Detail Redesign

**Branch**: `022-product-detail-redesign`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Restructure `ProductDetailPage` so the gallery, headline, specs and price-aside live in a single hero section. Add a category-aware breadcrumb trail. Introduce a client-side gallery component with thumbnail swap and a lightbox via `<dialog>`. Add a mobile-only sticky CTA.

## Technical Context

**Touchpoints**:

- `apps/web/src/components/product/ProductDetailPage.tsx`
- `apps/web/src/components/product/ProductInfoTabs.tsx`
- `apps/web/src/lib/seo/structured-data.ts` (`createProductBreadcrumbJsonLd`)
- `apps/web/src/lib/products/source-products.ts` (`getRelatedProducts`, category lookups)

**Dependencies**:

- Spec `017-media-and-documents-migration` ensures local image URLs.
- Spec `023-site-shell` removes the inline header — this spec must coordinate so PDP no longer renders its own header.

## Scope

### In Scope

- New hero grid: gallery / headline + specs / price aside.
- Client `ProductGallery` component with thumbnail state.
- Lightbox via `<dialog>`.
- Mobile sticky CTA.
- Breadcrumb improvements (visible + JSON-LD).

### Out Of Scope

- Reviews/ratings UI.
- 360° images, videos.
- Variant selection.

## Validation

- `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- BreadcrumbList JSON-LD validation on five sampled PDPs.
- Manual mobile/desktop layout check.
- `pnpm public-copy-audit`.

## Risks

- Client component bloat on PDP. Mitigation: keep `ProductGallery` lean and code-split if needed.
- Sticky CTA may overlap with mobile browser UI. Mitigation: ensure `env(safe-area-inset-bottom)` padding.

## Follow-Ups

- Variant matrix (model series with different outlet counts) — separate spec.
- Stock/availability live data — separate spec.
