# Feature Specification: Competitor Comparison Pages

**Feature Branch**: `033-competitor-comparison-pages`

**Created**: 2026-05-16

**Status**: Draft

**Input**: SEO-review found that competitor/alternative queries (`hyperline pdu` 423, `apc pdu` 339, `vertiv pdu` 16, `eaton pdu` 29, `rittal pdu` 13, `schneider pdu` 3) — ~800/мес of buyer-intent traffic for import replacement — have no landing page. Russian-manufacturer positioning makes this a high-conversion B2B segment that we should capture.

## User Scenarios & Testing

### User Story 1 - Buyer Searching For Import Replacement Lands On Solton Comparison (Priority: P1)

A buyer searches "замена hyperline pdu" and lands on `/knowledge/pdu-soliton-vs-hyperline/`. They see a comparison table, an intro paragraph explaining import replacement, and a CTA to RFQ pre-filled with "Замена Hyperline".

**Independent Test**: `curl /knowledge/pdu-soliton-vs-hyperline/` returns 200, contains the brand name, has comparison table markup, and a RFQ link with prefill.

### User Story 2 - Comparison Tables Indexable Without Deep Content (Priority: P2)

Even before model-by-model detail is filled, the page has ≥400 words of useful content (intro + comparison criteria + FAQ) and a clear "Detailed comparison being prepared" notice.

**Acceptance Scenarios**:

1. **Given** the 5 comparison routes, **When** rendered, **Then** each returns 200, has 400+ words, FAQPage JSON-LD, and shows a "Раздел дополняется" notice.
2. **Given** the RFQ deep link, **When** clicked, **Then** RfqForm comment is prefilled with "Замена [vendor] PDU".

### Edge Cases

- What if a vendor name is misspelled? Keep canonical URL; do not add separate routes for spelling variants.

## Requirements

- **FR-001**: 5 new routes MUST exist: `/knowledge/zamena-importnyh-pdu/`, `/knowledge/pdu-soliton-vs-hyperline/`, `/knowledge/zamena-apc-pdu-rossijskij-analog/`, `/knowledge/analogi-vertiv-eaton-pdu/`, `/knowledge/analogi-rittal-schneider-pdu/`.
- **FR-002**: Each page MUST have unique title, description, H1, 400+ word intro+comparison block, FAQ (3+).
- **FR-003**: Each page MUST contain a visible "Раздел дополняется" notice for users.
- **FR-004**: Each page MUST emit BreadcrumbList + FAQPage JSON-LD.
- **FR-005**: Each page MUST have a prefilled CTA to `/b2b/request-quote/?comment=...`.
- **FR-006**: Internal linking: `/b2b/custom-pdu/` and `/b2b/` link to "Замена импортных PDU" overview page.

## Success Criteria

- **SC-001**: 5 URLs return 200, are in sitemap, indexable.
- **SC-002**: `pnpm validate:seo` and `pnpm validate:schema` pass for new URLs.
- **SC-003**: Yandex.Webmaster shows pages indexed within 8 weeks; ranking measurable for at least one target query.

## Placeholder Policy

- Comparison table is generic (criteria-by-criteria, not model-by-model) — that's enough to avoid thin-content threshold.
- "Раздел дополняется" notice is honest and does not hurt SEO (Google treats this neutrally if intro is real).
- Detailed model-by-model tables go into the deferred content track.
