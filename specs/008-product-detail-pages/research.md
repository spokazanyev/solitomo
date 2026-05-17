# Research: Product Detail Pages

## Decisions

### Product Source

Use the collected raw JSON assortment as the temporary source for product pages.

**Reasoning**: The project already has 66 real Soliton product records. This enables immediate SEO URL generation before Payload/MoySklad import is implemented.

**Alternative considered**: Wait for CMS import. Rejected because product URLs, sitemap, and page templates can be validated earlier with the existing dataset.

### Product Slugs

Use SKU-based slugs with conservative transliteration and punctuation cleanup.

**Reasoning**: SKUs are stable commercial identifiers and are more reliable than Russian product titles from raw source data.

### Stock And Registry Claims

Do not claim stock availability, registry presence, certificates, or APS equivalence inside product structured data unless the specific evidence exists.

**Reasoning**: The positioning system allows these as controlled claims only after proof is attached.

### Product JSON-LD

Emit `Product` schema with `Offer` only when a numeric price is available. Omit `availability` until stock is connected.

**Reasoning**: This gives search engines useful product data without inventing inventory state.

### Related Products

Select related products by the first category match.

**Reasoning**: It is deterministic and good enough until normalized categories and filters are implemented in the next feature.
