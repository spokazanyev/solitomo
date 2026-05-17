# Implementation Plan: Catalog Long-Tail Sub-Categories

**Branch**: `034-catalog-longtail-subcategories`

**Spec**: [spec.md](./spec.md)

## Touchpoints

- `apps/web/src/lib/seo/seo-registry.ts` — 10 new routes.
- `apps/web/src/lib/products/source-products.ts` — `getCatalogProducts(path)` and `productMatchesFacet(product, path)` extended for compound paths.
- `apps/web/src/components/SeoLandingPage.tsx` — breadcrumb already covers nested segments via existing logic.
- `apps/web/src/app/(site)/catalog/[...slug]/page.tsx` — already supports nested slug.

## Implementation Notes

- Parse path segments: split `/catalog/<parent>/<child>/` into parent and child filter functions; AND them.
- For each sub-category, count products at build time; if zero, mark route `indexable: false` (or omit entirely from seoRoutes). We will keep them in seoRoutes with `indexable: false` to preserve URL but exclude from sitemap.
- Title pattern: `<Child label> в <Parent label> Солитон` (e.g., "Блоки розеток 19″ 1U с 8 розетками Солитон").
- ItemList JSON-LD uses sub-filtered product set.
- Canonical: the sub-category URL itself.

## Validation

- `pnpm validate:seo`
- `pnpm validate:schema`
- Manual visual check: 3 sample sub-categories.
- Sitemap check: indexable sub-categories appear; non-indexable do not.
