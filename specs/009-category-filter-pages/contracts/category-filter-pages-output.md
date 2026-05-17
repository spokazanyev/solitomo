# Contract: Category Filter Pages Output

## Route Contract

`GET /catalog/{slug}/`

Expected:

- `200` for approved catalog routes from the SEO registry.
- Existing metadata and canonical behavior from `seo-registry.ts`.
- No query-string filter URLs in rendered filter navigation.

## Page Content Contract

Each catalog page must render:

- Product count.
- Category-specific listing title and description.
- Route-based filter groups.
- Filter option counts.
- Real product cards.
- Product links to `/product/{slug}/`.
- RFQ CTA.
- Existing comparison, selection guidance, and internal links.

## Structured Data Contract

Each catalog page must include:

- `BreadcrumbList` JSON-LD.
- `ItemList` JSON-LD for matched products.

## SEO Contract

Indexable filter pages are explicit URLs only:

- `/catalog/bloki-rozetok-19-1u/`
- `/catalog/vertical-pdu/`
- `/catalog/schuko/`
- `/catalog/iec-c13-c19/`
- `/catalog/16a/`
- `/catalog/32a/`
- `/catalog/metered-pdu/`
- `/catalog/managed-pdu/`
- `/catalog/three-phase-pdu/`
- `/catalog/pdu-uzip/`

Arbitrary combinations remain non-indexable until they are promoted to explicit routes.
