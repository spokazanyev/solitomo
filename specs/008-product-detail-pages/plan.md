# Implementation Plan: Product Detail Pages

**Branch**: `008-product-detail-pages` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)

## Summary

Add SKU-based product pages generated from the collected Soliton assortment. Each page should support SEO indexing, B2B quote conversion, technical review, and future replacement of raw JSON data by Payload/MoySklad import data.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.6, React 19.

**Primary Dependencies**: Existing Next app, SEO registry, Tailwind CSS, `lucide-react`.

**Storage**: Read-only adapter over `00-source-data/assortment/soliton1_assortment_raw.json` for this feature.

**Testing**: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `curl` product route, `curl` sitemap count.

## Constitution Check

- Specification-first development: PASS.
- SEO and demand as product requirements: PASS.
- B2B/RFQ first: PASS.
- Integrations isolated and observable: PASS.
- Analytics and search control: PASS, no analytics implementation in this feature.
- Maintainable by Codex: PASS, data adapter separated from UI.
- Quality gates: PASS.

## Source Structure

```text
apps/web/src/app/product/[slug]/page.tsx
apps/web/src/components/product/ProductDetailPage.tsx
apps/web/src/lib/products/source-products.ts
apps/web/src/app/sitemap.ts
```

## Complexity Tracking

No constitution violations.
