# Tasks: Catalog Long-Tail Sub-Categories

- [ ] T001 Extend `productMatchesFacet` in `source-products.ts` (or its catalog equivalent) to support compound paths like `/catalog/<parent>/<child>/`.
- [ ] T002 Extend `getCatalogProducts(path)` to detect nested paths, derive parent + child filters, and return intersection.
- [ ] T003 Add 10 routes to `seo-registry.ts` with appropriate title/description/h1/summary. Set `indexable: false` for routes that have zero matching products (verify before commit).
- [ ] T004 Ensure breadcrumb path on sub-category renders parent label correctly (uses route hierarchy).
- [ ] T005 Ensure ItemList JSON-LD on sub-category uses filtered set.
- [ ] T006 Run `pnpm validate:seo` and `pnpm validate:schema`; expect zero errors.
- [ ] T007 Confirm sitemap.xml includes indexable sub-categories.
