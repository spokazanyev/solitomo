# Feature Specification: FAQ on Solutions and B2B

**Feature Branch**: `032-faq-on-solutions-and-b2b`

**Created**: 2026-05-16

**Status**: Draft

**Input**: SEO-review found that `FAQPage` JSON-LD is only on catalog and knowledge routes. Solution (4 routes) and B2B landing (`/b2b/`) get many technical and procurement questions but lack FAQ. Missing rich-snippet opportunity.

## User Scenarios & Testing

### User Story 1 - Search Engine Gets FAQ Schema On Engineering Pages (Priority: P1)

A search engine crawls `/solutions/pdu-dlya-servernogo-shkafa/` and finds an FAQPage JSON-LD with 4–6 question/answer pairs.

**Independent Test**: `curl /solutions/pdu-dlya-servernogo-shkafa/ | grep '"@type":"FAQPage"'` returns one match; Google Rich Results Test approves.

### User Story 2 - Buyer Reads Common Procurement Questions On B2B Page (Priority: P1)

A procurement buyer opens `/b2b/` and reads 6 FAQ items (КП, документы, реестр, доставка, оплата, скидки).

**Acceptance Scenarios**:

1. **Given** any solution route, **When** the page is rendered, **Then** a visible FAQ block with at least 4 items is present plus FAQPage JSON-LD.
2. **Given** `/b2b/`, **When** rendered, **Then** the FAQ block contains procurement-focused questions plus FAQPage JSON-LD.

## Requirements

- **FR-001**: 4 solution routes MUST render an FAQ block with 4–6 items and emit FAQPage JSON-LD.
- **FR-002**: `/b2b/` MUST render an FAQ block with 6 items and emit FAQPage JSON-LD.
- **FR-003**: FAQ content MUST be route-specific (no generic copy).

## Success Criteria

- **SC-001**: `pnpm validate:schema` confirms FAQPage on 5 routes (4 solutions + /b2b/).
- **SC-002**: `pnpm public-copy-audit` remains clean.
