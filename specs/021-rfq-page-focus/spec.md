# Feature Specification: RFQ Page Focus

**Feature Branch**: `021-rfq-page-focus`

**Created**: 2026-05-15

**Status**: Draft

**Input**: Sitewide review v3 found that `/b2b/request-quote/` renders the full B2B template below the form: "Корпоративная закупка" card, a duplicated "Запрос КП" link, five-step process, the wireframe-style "Быстрый RFQ-макет", a trust band and link grid. The page hosting the primary conversion action has the most distracting content.

## User Scenarios & Testing

### User Story 1 - Buyer Submits The Form Without Distraction (Priority: P1)

A buyer arrives at `/b2b/request-quote/`. They see a short hero, the form, a side panel "What speeds up the КП", and a brief "What happens after submit" block. There are no duplicated CTAs, no five-step process repetition, no wireframe placeholder form.

**Why this priority**: This is the primary conversion page. Every extra block reduces submission rate.

**Independent Test**: SSR HTML for `/b2b/request-quote/` does not include the five-step process block, the wireframe form, the trust band or the duplicate "Запрос КП" tile.

**Acceptance Scenarios**:

1. **Given** the RFQ page, **When** rendered, **Then** only the hero, form, side panel and post-submit explanation are present.
2. **Given** a buyer submits the form, **When** the request is accepted, **Then** a success card with a tracking ID and the next steps replaces the form.

### User Story 2 - Non-RFQ B2B Pages Retain Their Content (Priority: P1)

A visitor opens `/b2b/`, `/b2b/custom-pdu/`, `/b2b/integrators/`, `/b2b/tenders/`. They still see the full B2B narrative: process, trust band, link grid.

**Why this priority**: The RFQ-focus change must not strip educational B2B pages.

**Independent Test**: SSR HTML for non-`request-quote` B2B URLs still contains the five-step process and trust band.

**Acceptance Scenarios**:

1. **Given** `/b2b/`, **When** rendered, **Then** the existing B2B landing content is preserved.

### User Story 3 - Buyer Sees Where The Request Goes (Priority: P2)

After submit, the page shows three short blocks: confirmation arrived in inbox, expected response time, a way to add more items or attach a TЗ.

**Why this priority**: Reduces "did it go through?" support tickets and reassures B2B buyers.

**Independent Test**: A test submission renders the success card with the three messages and a tracking ID.

**Acceptance Scenarios**:

1. **Given** a successful submission, **When** rendered, **Then** the success card lists the tracking ID, the expected response time and links back to the catalog and documents.

### Edge Cases

- What happens when submission fails? Render the error inline above the form; do not navigate away.
- What happens when the cart is empty? Allow free-form description; do not block submission.
- What happens when the user is on mobile? The form remains usable single-column; the side panel collapses below the form.

## Requirements

### Functional Requirements

- **FR-001**: Route `/b2b/request-quote/` MUST render a dedicated `RfqPageTemplate`, not the generic B2B template plus form.
- **FR-002**: `RfqPageTemplate` MUST contain only: hero, form, side panel, post-submit explanation.
- **FR-003**: Non-RFQ B2B routes MUST keep the existing `B2BTemplate` content.
- **FR-004**: System MUST render a success card after a successful submission with the tracking ID, expected response time and supporting links.
- **FR-005**: System MUST surface errors inline without redirect.

### Key Entities

- **RfqSubmissionResult**: trackingId, submittedAt, expectedResponseHours, attachedItemsCount.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `/b2b/request-quote/` page weight drops by ≥ 30% (fewer DOM nodes) compared to baseline.
- **SC-002**: Time-on-form (analytics) improves; analytics events `begin_quote` and `quote_submitted` fire correctly (depends on spec `027`).
- **SC-003**: Non-RFQ B2B pages remain visually unchanged.

## Assumptions

- The existing `RfqForm` component already handles cart and search params; only the surrounding shell changes.
- A tracking ID is generated server-side on successful submission.
- The "expected response time" copy is approved by sales (e.g., "within 1 business day").
