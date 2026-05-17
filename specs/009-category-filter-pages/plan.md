# Implementation Plan: Category Filter Pages

**Branch**: `009-category-filter-pages` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)

## Summary

Replace placeholder catalog listings with real Soliton products selected by approved SEO category routes. Keep filters as clean internal links to indexable category pages, add product counts, and emit `ItemList` structured data for catalog pages.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.6, React 19.

**Primary Dependencies**: Existing Next app, SEO registry, product adapter, Tailwind CSS, `lucide-react`.

**Storage**: Read-only adapter over `00-source-data/assortment/soliton1_assortment_raw.json`.

**Testing**: `pnpm lint`, `pnpm typecheck`, `pnpm build`, catalog route smoke checks, sitemap smoke check.

## Constitution Check

- Specification-first development: PASS.
- SEO and demand as product requirements: PASS.
- B2B/RFQ first: PASS.
- Integrations isolated and observable: PASS.
- Analytics and search control: PASS, no analytics implementation in this feature.
- Maintainable by Codex: PASS, matching rules isolated in product adapter.
- Quality gates: PASS.

## Source Structure

```text
apps/web/src/lib/products/source-products.ts
apps/web/src/components/page-templates.tsx
apps/web/src/components/SeoLandingPage.tsx
apps/web/src/lib/seo/structured-data.ts
```

## Complexity Tracking

No constitution violations.
