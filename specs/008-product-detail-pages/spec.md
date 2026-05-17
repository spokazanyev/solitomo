# Feature Specification: Product Detail Pages

**Feature Branch**: `008-product-detail-pages`

**Created**: 2026-05-15

**Status**: Implemented

**Input**: Continue SDD plan after `007-page-template-system`. Build SEO-ready product detail pages from the collected Soliton assortment so search engines can index real product URLs and buyers can request a quote.

## User Scenarios & Testing

### User Story 1 - Product Pages Exist For Real Assortment (Priority: P1)

As a buyer, I want every collected Soliton product to have a stable page with SKU, description, characteristics, documents, images, and quote CTA so that I can evaluate the item and request commercial terms.

**Why this priority**: Organic traffic needs indexable product URLs, and B2B buyers need technical evidence before contacting sales.

**Independent Test**: Opening `/product/s-16c13-2c19/` returns `200` and shows SKU, CTA, characteristics, documents, and related products.

### User Story 2 - Product URLs Are Search-Indexable (Priority: P1)

As an SEO owner, I want product pages in sitemap with canonical URLs and structured data so that the product layer can participate in organic search.

**Why this priority**: The site previously had only category and landing skeletons; product pages add long-tail search coverage.

**Independent Test**: `/sitemap.xml` includes 66 product URLs and each product page emits `Product` and `BreadcrumbList` JSON-LD.

### User Story 3 - Product Data Stays Close To Source (Priority: P2)

As Codex, I want a typed adapter over the raw assortment file so future Payload/MoySklad import work can replace the source without redesigning the page.

**Why this priority**: Current data is scraped from `soliton1.ru`; the next stages will normalize categories, filters, stock, and commerce data.

**Independent Test**: Product UI reads from `apps/web/src/lib/products/source-products.ts`, not hardcoded route files.

## Requirements

### Functional Requirements

- **FR-001**: The app MUST generate a product page for each product in `00-source-data/assortment/soliton1_assortment_raw.json`.
- **FR-002**: Product URLs MUST use stable SKU-based slugs under `/product/{slug}/`.
- **FR-003**: Product pages MUST show H1, SKU, category, short description, price display, CTA, characteristics, documents, images, and related products.
- **FR-004**: Product pages MUST expose canonical metadata and OpenGraph metadata.
- **FR-005**: Product pages MUST emit `Product` JSON-LD when product data is available.
- **FR-006**: Product pages MUST emit `BreadcrumbList` JSON-LD.
- **FR-007**: Sitemap MUST include all generated product pages.
- **FR-008**: Product page copy MUST avoid unsupported stock, certificate, registry, or equivalence claims.
- **FR-009**: The implementation MUST keep the source-data adapter replaceable by CMS or import-backed data later.
- **FR-010**: Baseline verification MUST pass: lint, typecheck, build, product smoke test, sitemap count.

## Success Criteria

- **SC-001**: `pnpm build` prerenders all product pages.
- **SC-002**: `/product/s-16c13-2c19/` returns `200`.
- **SC-003**: Product page HTML contains `Product`, `BreadcrumbList`, CTA, characteristics, documents, and related products.
- **SC-004**: `/sitemap.xml` contains 102 URLs total: 36 static SEO URLs and 66 product URLs.

## Assumptions

- Product availability is not claimed until stock data is connected.
- Prices from the old site are displayed as source data, not final commerce prices.
- Documents from source cards are preserved, but registry/certificate claims require later verification.
- Category/filter UX will be implemented in `009-category-filter-pages`.
