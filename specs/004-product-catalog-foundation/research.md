# Research: Product Catalog Foundation

Дата: 2026-05-14.

## Source Data Observations

Current source: `00-source-data/assortment/soliton1_assortment_raw.json`.

Observed structure:

- 66 products.
- 9 source categories.
- 2 products without source category.
- All products have images.
- All products have prices.
- 48 products have no documents.
- 48 products have no structured `specs` array.
- Raw source fields: `url`, `title`, `sku`, `priceRub`, `categories`, `shortDesc`, `specs`, `additional`, `documents`, `images`, `breadcrumbs`, `descriptionText`, `clusters`.

## Decision: Preserve Raw Data And Normalize Gradually

The importer must store raw source fields and normalized fields.

## Rationale

Many specs are free text or missing. If normalization is too strict, import will fail or lose useful data. Staged enrichment lets the catalog launch while improving data quality.

## Decision: Treat Product Data As Multi-Purpose

Product fields must be grouped by purpose:

- public product page;
- product card/listing;
- filters and badges;
- SEO;
- RFQ/B2B;
- payment/fiscalization;
- delivery;
- MойСклад;
- analytics;
- proof/claim control.

## Rationale

PDU product data is reused across many site layers. A field that looks optional for copy may be required for checkout, delivery, or SEO later.

## Decision: Keep Operational Data Separate From SEO Enrichment

MойСклад can later own operational stock, price, orders, and counterparties. Payload/site content should own SEO fields, copy, page placement, documents, and enriched technical content.

## Rationale

This avoids overwriting SEO and content work during operational sync.

## Decision: Use Controlled Attribute Definitions

Filters and badges must use controlled values, not arbitrary strings.

## Rationale

SEO landing pages and category filters need predictable values such as `16A`, `32A`, `Schuko`, `IEC C13`, `IEC C19`, `19"`, `1U`, `vertical`, `three_phase`, `monitoring`, `control`, `UZIP`.

## Alternatives Considered

### Import Only Existing WooCommerce Fields

Rejected because the current source fields are insufficient for future SEO, RFQ, delivery, payment, and MойСклад.

### Require Fully Normalized Specs Before Import

Rejected because 48 products lack structured specs today. The project needs staged enrichment.

### Store All Technical Data As Free Text

Rejected because filters, badges, SEO landing pages, comparison tables, and analytics require typed values.
