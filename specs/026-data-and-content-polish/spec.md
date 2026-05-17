# Feature Specification: Data And Content Polish

**Feature Branch**: `026-data-and-content-polish`

**Created**: 2026-05-15

**Status**: Draft

**Input**: Sitewide review v3 collected smaller-but-impactful issues: prices without a refresh date; document list with duplicates and inconsistent names; FAQ missing from B2B and solution pages; catalog mobile header overflow; brand color tokens not extracted; no toast/feedback on cart actions.

## User Scenarios & Testing

### User Story 1 - Buyer Sees Honest Prices With Refresh Date (Priority: P1)

A buyer reads ориентировочная price on a PDP. Next to the price they see "Цена обновлена DD.MM.YYYY" or, if not available, "Цена по запросу".

**Why this priority**: Misleading prices create commercial and legal risk; transparency increases trust.

**Independent Test**: Every product card and PDP shows either a dated price or "Цена по запросу".

**Acceptance Scenarios**:

1. **Given** a product with `priceUpdatedAt`, **When** the PDP is rendered, **Then** the date is displayed near the price.
2. **Given** a product without `priceUpdatedAt`, **When** the PDP is rendered, **Then** "Цена по запросу" is displayed instead.

### User Story 2 - Documents Listing Is Deduped And Filterable (Priority: P2)

A buyer opens `/documents/`. Documents are unique by checksum, named consistently ("Тип — Модель"), and filterable by type (passport / certificate / drawing / manual).

**Why this priority**: Procurement needs to find the right document fast; duplicates erode trust.

**Independent Test**: The documents page shows ≤ 21 unique documents, ordered by type, with a working type filter.

### User Story 3 - B2B And Solution Pages Have FAQ (Priority: P2)

A buyer on `/b2b/` and any solution page sees a FAQ block answering common procurement and engineering questions. FAQPage JSON-LD is emitted.

**Why this priority**: Closes objections, supports SEO.

**Independent Test**: `/b2b/` and a sampled solution page contain a FAQ section and FAQPage JSON-LD.

### User Story 4 - Catalog Header Behaves On Mobile (Priority: P3)

The catalog top bar (filter chip, sort, RFQ cart link, model count) lays out without overlap on 375px.

**Independent Test**: Visual inspection on 375px; elements stack vertically.

### User Story 5 - Brand Tokens Are Centralized (Priority: P3)

A designer changes the brand colour by editing one CSS variable. The change propagates across the site.

**Independent Test**: Editing `--color-brand-primary` updates buttons, links and accents.

### User Story 6 - Buyer Gets Feedback When Adding To Cart (Priority: P3)

Tapping "В корзину КП" shows a toast "Добавлено в КП — N позиций" with a quick link to the cart.

### Edge Cases

- What if a product has price `null`? Render "Цена по запросу".
- What if a document is missing a type? Default to "Прочее" and surface in QA report.
- What if a FAQ page lacks entries for a route? Render the default FAQ defined in `template-content.ts`.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display either `priceUpdatedAt` or "Цена по запросу" next to every published price.
- **FR-002**: System MUST deduplicate documents by SHA-256 and normalize titles in `/documents/` and product tabs.
- **FR-003**: System MUST render FAQ blocks and FAQPage JSON-LD on `/b2b/` and each solution route.
- **FR-004**: System MUST fix the catalog top bar layout on `< md` to avoid overlap.
- **FR-005**: System MUST expose brand colour and spacing primitives via CSS variables.
- **FR-006**: System MUST display a toast on add-to-cart events.

### Key Entities

- **PriceRecord**: amount, currency, display, updatedAt.
- **DocumentRecord**: id, title, type, checksum.
- **FaqItem**: question, answer.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of price displays include a refresh date or "по запросу" label.
- **SC-002**: Documents page lists ≤ 21 unique items and supports type filtering.
- **SC-003**: FAQ JSON-LD validates on `/b2b/` and one solution URL.
- **SC-004**: Brand colour swap is achievable by editing a single CSS variable.

## Assumptions

- `priceUpdatedAt` is sourced from `00-source-data/assortment/soliton1_assortment_raw.json` (added as a global value) until Payload cutover.
- Document types can be derived heuristically from existing filenames or a manual normalisation map.
- FAQ content per route is authored manually; production-grade copywriting is out of scope.
