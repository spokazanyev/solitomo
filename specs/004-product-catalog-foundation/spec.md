# Feature Specification: Product Catalog Foundation

**Feature Branch**: `004-product-catalog-foundation`

**Created**: 2026-05-14

**Status**: Complete

**Input**: User description: "Продолжить SDD-план. Создать фундамент товарного каталога Soliton: модель товаров, категорий, характеристик, документов, изображений, SEO-полей, данных для доставки/оплаты/МойСклад и правила импорта текущего ассортимента."

## User Scenarios & Testing

### User Story 1 - Normalize The Existing Soliton Assortment (Priority: P1)

As the site owner, I want the current 66 products to fit into a clear catalog model so that future pages, filters, SEO, checkout, and integrations can rely on consistent product data.

**Why this priority**: Product data is the dependency for catalog pages, product pages, filtering, SEO, payment, delivery, and MойСклад integration.

**Independent Test**: A stakeholder can map every current product from the raw JSON to the new product model without losing SKU, name, category, price, images, source URL, descriptions, documents, or cluster signals.

**Acceptance Scenarios**:

1. **Given** the raw assortment JSON, **When** the product model is reviewed, **Then** every source field has a defined destination or preservation rule.
2. **Given** a product with missing documents or structured specs, **When** it is imported, **Then** the product is still valid but marked with data-completeness gaps.
3. **Given** products without source categories, **When** they are normalized, **Then** they are assigned a target category or flagged for manual category review.

---

### User Story 2 - Support Technical Filters And SEO Landing Pages (Priority: P2)

As Codex and future site users, I want technical attributes to be normalized so that categories, filters, badges, comparison tables, and SEO landing pages can be generated from reliable data.

**Why this priority**: Soliton's organic traffic depends on technical dimensions: 19", 1U, vertical, 16A, 32A, Schuko, C13, C19, monitoring, control, three-phase, UZIP, protection.

**Independent Test**: A category page spec can use the attribute model to create filters and product badges for high-priority SEO clusters.

**Acceptance Scenarios**:

1. **Given** a product with clusters such as `розетки IEC320 C13`, `32A`, and `вертикальный монтаж`, **When** attributes are normalized, **Then** those values can become filters and badges.
2. **Given** an SEO landing such as "PDU C13 16A", **When** products are queried by attributes, **Then** the model supports matching products without string-only search.

---

### User Story 3 - Prepare For Commerce And Integrations (Priority: P3)

As a future implementer, I want product data fields for payment, delivery, analytics, and MойСклад so that commerce features do not require redesigning the catalog model later.

**Why this priority**: Product data must support price, stock, fiscal names, VAT, weight/dimensions, delivery eligibility, MойСклад IDs, analytics, and documents.

**Independent Test**: The data model can identify fields required by checkout, payment, delivery calculation, 54-ФЗ, and MойСклад sync.

**Acceptance Scenarios**:

1. **Given** a future delivery calculation, **When** product data is checked, **Then** required logistics fields are defined even if source data is missing today.
2. **Given** future payment/fiscalization, **When** product data is checked, **Then** VAT, unit, receipt name, and fiscal category fields are defined.

### Edge Cases

- Some source specs are free-text only; the model must preserve raw specs and allow gradual normalization.
- Some products have no documents; document completeness must be tracked.
- Some products are configurable systems, not simple SKUs; the model must support product families and variants/options.
- Some products have monitoring/control capabilities that must not be applied to all PDU products.
- Product titles contain mixed casing, units, symbols, and Cyrillic/Latin terms; slug and normalized title rules must handle this safely.

## Requirements

### Functional Requirements

- **FR-001**: The catalog foundation MUST define product, category, attribute, document, image, price, stock, SEO, logistics, fiscal, and integration fields.
- **FR-002**: The catalog foundation MUST map all current raw JSON fields to target fields or preservation rules.
- **FR-003**: The catalog foundation MUST define normalized attribute groups for electrical, outlet, input, mounting, protection, monitoring/control, physical, documentation, and SEO dimensions.
- **FR-004**: The catalog foundation MUST define data-completeness statuses for missing categories, specs, documents, images, logistics fields, fiscal fields, and proof claims.
- **FR-005**: The catalog foundation MUST define import rules for the current 66 products, including uniqueness, repeatability, duplicate prevention, and manual review flags.
- **FR-006**: The catalog foundation MUST define target category taxonomy for the first release.
- **FR-007**: The catalog foundation MUST define which fields are required for filters, badges, product cards, product pages, SEO, delivery, payment, analytics, and MойСклад.
- **FR-008**: The catalog foundation MUST create `product-data-spec.md`, `product-attributes-spec.md`, and `product-import-spec.md`.
- **FR-009**: The catalog foundation SHOULD identify open data gaps that must be filled before frontend implementation.

### Key Entities

- **Product**: Sellable item, product family, or configurable system.
- **Category**: Public catalog or SEO grouping.
- **Attribute Definition**: Typed characteristic such as current, mounting, socket type, outlet count, input, protection, monitoring, or dimensions.
- **Product Attribute Value**: Normalized value assigned to a product.
- **Document**: Passport, manual, certificate, drawing, datasheet, registry document, or downloadable file.
- **Media Asset**: Product photo, close-up, diagram, or placeholder.
- **Data Completeness Status**: Flags indicating whether a product is ready for product page, filters, SEO, delivery, payment, and integrations.
- **Import Mapping**: Rule that maps raw source fields to target model fields.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All current 66 products have a defined import path.
- **SC-002**: At least 10 attribute groups or dimensions are defined for PDU filtering and badges.
- **SC-003**: Every existing raw JSON field has a target mapping or preservation rule.
- **SC-004**: At least 20 key product fields are classified by purpose: page, filter, SEO, commerce, logistics, fiscal, integration, analytics.
- **SC-005**: The output is sufficient to start future implementation of Payload collections and importer tasks.

## Assumptions

- The raw JSON collected from soliton1.ru is the first import source.
- MойСклад may later become the operational source for stock/prices, but Payload/site data remains responsible for SEO, copy, page structure, and enriched product content.
- Not all data is available today; the model must support staged enrichment.
- No product data should be discarded during import; uncertain source strings must be preserved.
