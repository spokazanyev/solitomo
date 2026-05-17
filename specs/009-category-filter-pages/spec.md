# Feature Specification: Category Filter Pages

**Feature Branch**: `009-category-filter-pages`

**Created**: 2026-05-15

**Status**: Implemented

**Input**: Continue SDD plan after `008-product-detail-pages`. Connect SEO catalog pages to real Soliton products, add filter navigation, indexable category combinations, ItemList structured data, and internal links.

## User Scenarios & Testing

### User Story 1 - Category Pages Show Real Products (Priority: P1)

As a buyer, I want catalog pages to show actual Soliton models matching the category so that I can move from a search query to a product card or quote request.

**Why this priority**: Category pages are expected to capture core organic demand. Placeholder products do not support SEO or conversion.

**Independent Test**: Opening `/catalog/iec-c13-c19/` returns `200` and shows real SKUs linking to `/product/.../`.

### User Story 2 - Filters Create Controlled SEO Routes (Priority: P1)

As an SEO owner, I want filter links to point only to approved category URLs so that the site does not create crawlable query-string noise.

**Why this priority**: PDU search demand is clustered by mounting, current, socket type, and functions. These deserve indexable pages, while arbitrary combinations should stay non-indexable.

**Independent Test**: Catalog filter panel links to `/catalog/bloki-rozetok-19-1u/`, `/catalog/16a/`, `/catalog/schuko/`, etc., and not to query-string URLs.

### User Story 3 - Search Engines See Product Lists (Priority: P2)

As an SEO owner, I want catalog pages to emit `ItemList` JSON-LD so search engines can understand the product set behind the category.

**Why this priority**: Category pages now have real product listings and should expose them in structured form.

**Independent Test**: Catalog HTML contains `ItemList` JSON-LD and product links.

## Requirements

### Functional Requirements

- **FR-001**: Catalog templates MUST use real products from the normalized raw assortment adapter.
- **FR-002**: Each priority catalog route MUST have a deterministic product matching rule.
- **FR-003**: Catalog routes MUST show product count, category-specific description, product cards, price display, badges, and product links.
- **FR-004**: Filter navigation MUST use clean indexable URLs, not query strings.
- **FR-005**: Filter navigation MUST show product counts for each approved facet route.
- **FR-006**: Catalog pages MUST keep existing metadata, canonical, sitemap, breadcrumbs, and internal linking.
- **FR-007**: Catalog pages MUST emit `ItemList` JSON-LD.
- **FR-008**: Empty category states MUST avoid fake products and must route users to RFQ/consultation.
- **FR-009**: Matching rules MUST avoid unsupported claims about stock, registry, certification, or functions.
- **FR-010**: Baseline verification MUST pass: lint, typecheck, build, category smoke tests.

## Success Criteria

- **SC-001**: `pnpm build` prerenders all catalog and product routes.
- **SC-002**: `/catalog/iec-c13-c19/`, `/catalog/vertical-pdu/`, `/catalog/16a/`, and `/catalog/pdu-uzip/` render real product listings.
- **SC-003**: Catalog HTML contains `ItemList` JSON-LD.
- **SC-004**: No catalog filter links use `?` query strings.

## Assumptions

- Filtering is route-based in this feature. Client-side faceted filtering can be added later after normalized attributes exist.
- Product matching uses conservative text/category/spec patterns over raw data.
- Final category SEO copy and FAQ will be expanded in `011-content-production-system`.
