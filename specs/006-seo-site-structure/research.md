# Research: SEO Site Structure

Дата: 2026-05-15.

## Использованные Внутренние Источники

- `06-reports/03-semantic-core.md`
- `06-reports/02-demand-validation-and-semantics.md`
- `01-site-structure/target-site-structure.md`
- `04-seo-methods/seo-methods.md`
- `07-build-specifications/product-data-spec.md`
- `07-build-specifications/technical-project-foundation.md`

## Использованные Технические Источники

- Local Next.js docs: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md`
- Local Next.js docs: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md`
- Local Next.js docs: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`

## Decisions

### D1. Use A Static SEO Route Registry First

Decision: create `apps/web/src/lib/seo/seo-registry.ts` as the source of truth for initial public routes.

Reason: product/CMS collections are not implemented yet, but SEO architecture must be concrete. A static registry lets Codex generate pages, sitemap, robots, metadata, and docs consistently.

### D2. Use Trailing Slash Canonicals

Decision: set `trailingSlash: true` in `next.config.ts`.

Reason: the existing site-structure documents use trailing slash URLs. Sitemap, canonical, links, and route behavior must not disagree.

### D3. Defer Product Sitemap Until Product Import

Decision: reserve `/product/{sku-slug}/`, but do not include product URLs in sitemap yet.

Reason: product slugs, canonical titles, availability, images, and Product schema should come from normalized product data.

### D4. Noindex Random Filter Parameters

Decision: robots blocks parameter URLs with `/*?*`; indexable filter combinations should become static landing pages or CMS-controlled canonical pages.

Reason: filters can create duplicate or thin pages. Only demand-proven combinations should be indexable.
