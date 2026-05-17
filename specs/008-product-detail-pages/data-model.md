# Data Model: Product Detail Pages

## RawProduct

Source: `00-source-data/assortment/soliton1_assortment_raw.json`

Fields used:

- `url`: legacy source URL.
- `title`: original product title.
- `sku`: product SKU.
- `priceRub`: source price text.
- `categories`: category labels and source URLs.
- `shortDesc`: short description.
- `descriptionText`: long text.
- `specs`: raw characteristics list.
- `documents`: document title and URL.
- `images`: legacy image URLs.
- `breadcrumbs`: source breadcrumb string.
- `clusters`: early semantic/product grouping.

## Product

Runtime normalized model in `apps/web/src/lib/products/source-products.ts`.

- `slug`: SKU-derived URL slug.
- `h1`: normalized title for page H1.
- `sku`: commercial SKU.
- `title`: original title.
- `shortDescription`: description for metadata and hero.
- `description`: product body text.
- `price.amount`: numeric price or `null`.
- `price.display`: user-facing price string or quote fallback.
- `price.currency`: `RUB`.
- `categories`: source categories.
- `specs`: raw characteristic rows.
- `documents`: product documents.
- `images`: image URLs.
- `badges`: derived category/spec tags.
- `legacyUrl`: old source URL.

## Derived Outputs

- Static params: one product slug per product.
- Metadata: title, description, canonical, OpenGraph.
- JSON-LD: `Product` and `BreadcrumbList`.
- Sitemap entries: one weekly product URL per product.
