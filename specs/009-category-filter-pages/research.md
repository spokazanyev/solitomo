# Research: Category Filter Pages

## Decisions

### Route-Based Filters First

Use approved catalog URLs as filters instead of query-string filtering.

**Reasoning**: The project needs SEO-safe landing pages. Query strings would create crawl waste and duplicate pages before attribute normalization is complete.

### Matching Rules

Use deterministic text/category/spec matching over raw product records for this stage.

**Reasoning**: Raw data already includes titles, categories, specs, clusters, and descriptions. This is sufficient to connect category pages to real products while the normalized attribute model is still being prepared.

### ItemList Schema

Emit `ItemList` JSON-LD for catalog routes.

**Reasoning**: Category pages now show real product lists and should expose the visible product set to search engines.

### Product Count In Filters

Show counts for each approved filter route.

**Reasoning**: Counts make filters useful for buyers and expose gaps where a category needs data cleanup or product enrichment.

### Empty Categories

Do not fabricate products. Render an RFQ-oriented empty state if a category has no matched products.

**Reasoning**: Fake listings would damage trust and produce unsupported SEO claims.
