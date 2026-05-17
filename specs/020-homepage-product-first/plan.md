# Implementation Plan: Homepage Product-First

**Branch**: `020-homepage-product-first`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Rebuild the homepage hero so the product is visible above the fold. Surface proof metrics, trust signals with proof links, and a manufacturing showcase. Remove the SEO keyword chips aside from non-home heroes. Add dynamic Open Graph images for the homepage, catalogs and product pages.

## Technical Context

**Touchpoints**:

- `apps/web/src/components/SeoLandingPage.tsx` (`HomeHero`, non-home hero aside)
- `apps/web/src/components/page-templates.tsx` (`HomeTemplate`, `TrustBand`)
- `apps/web/src/lib/seo/template-content.ts` (`homeProofMetrics`, `trustSignals`)
- `apps/web/src/app/(site)/layout.tsx` (metadata)
- New: `apps/web/src/app/(site)/opengraph-image.tsx`, `apps/web/src/app/(site)/catalog/[...slug]/opengraph-image.tsx`, `apps/web/src/app/(site)/product/[slug]/opengraph-image.tsx`

**Dependencies**:

- Spec `017-media-and-documents-migration` for product images.
- Spec `015-sitewide-public-copy-qa` for safe replacement of "RFQ" and SEO chips.

## Scope

### In Scope

- New `HomeHero` layout with product visual.
- New `HomeProofBand` consuming `homeProofMetrics`.
- Trust signal link extension.
- New `ManufacturingShowcase` block.
- Removal of `route.keywords` aside.
- Dynamic OG image routes for home, category, product.

### Out Of Scope

- PDP redesign (covered in spec `022`).
- New copywriting beyond the proof labels.
- Photo retouching.

## Architecture

```
HomeHero ── Image + headline + CTAs + four trust bullets
HomeProofBand ── metrics (66 models / 11 sections / 15+ years / КП)
FeaturedProducts ── three real product cards
UseCaseBand ── existing component
TrustBand ── linked to proof pages
ManufacturingShowcase ── three story tiles
LinkGrid ── related entries via publicSummary (from spec 015)
```

## Validation

- `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- `pnpm public-copy-audit` clean on `/` and non-home SEO URLs.
- Visual diff on `/`, `/catalog/pdu/`, `/knowledge/kak-vybrat-pdu/`, `/b2b/`.
- Twitter Card Validator / Telegram link preview on `/` and `/product/sp-8/`.

## Risks

- Manufacturing photos may not exist. Mitigation: ship the block with placeholder vector tiles, label them "production process"; do not block release.
- Dynamic OG via `ImageResponse` increases build/runtime cost. Mitigation: cache the rendered image with `revalidate` and prebake popular pages.
- Removing the keyword aside may regress catalog page comprehension. Mitigation: integrate the `summary` into the main description copy.

## Follow-Ups

- Spec `023-site-shell` integrates header CTAs with the new home tone.
- A future spec moves `homeProofMetrics` and `trustSignals` into Payload.
