# Feature Specification: Solution Mini Finder

**Feature Branch**: `025-solution-mini-finder`

**Created**: 2026-05-15

**Status**: Draft

**Input**: Sitewide review v3 found that solution pages are static descriptions with no interactive aid. They are visually similar to catalog pages but do not help an engineer narrow down a PDU choice.

## User Scenarios & Testing

### User Story 1 - Engineer Inputs Rack Parameters And Lands In The Right Catalog (Priority: P1)

An engineer opens `/solutions/pdu-dlya-servernogo-shkafa/`. They fill a short form with the rack height (U), input current (16A / 32A / 3φ), outlet types (Schuko / IEC C13 / IEC C19 / mixed) and need-for-monitoring or surge protection. Submitting sends them to the relevant catalog page with the matching filters preselected.

**Why this priority**: This is the only interactive engineering aid on the site and the natural top-of-funnel for technical buyers.

**Independent Test**: Submitting the form with rack=42, current=32a, outlet=c13, monitoring=yes lands on `/catalog/metered-pdu/?current=32a&outlet=c13`.

**Acceptance Scenarios**:

1. **Given** the form, **When** valid values are submitted, **Then** the user lands on a catalog URL with query params reflecting the inputs.
2. **Given** the user picks "Не уверен", **When** they submit, **Then** they land on `/b2b/request-quote/` with the entered parameters in the comment field.

### User Story 2 - PDP Links Back To Relevant Solutions (Priority: P2)

A buyer on a PDP sees a small "Где применяется эта модель" block linking to two or three relevant solution pages, derived from the product's attributes (mounting, current, function).

**Why this priority**: Reinforces topical authority and helps procurement understand fit.

**Independent Test**: PDP for SP-8 lists at least one solution link (e.g., serverstand 19″ или 42U).

### Edge Cases

- What if no exact catalog matches the inputs? Route to the broadest matching catalog with a note about the closest match.
- What if the engineer skips fields? Allow partial submissions; only known inputs are passed as query params.

## Requirements

### Functional Requirements

- **FR-001**: System MUST render a `RackParametersForm` on each solution page.
- **FR-002**: Submitting the form MUST route to the matching catalog URL with appropriate query parameters as defined in spec `024`.
- **FR-003**: Choosing "Не уверен" MUST route to `/b2b/request-quote/` with the criteria captured in the comment field.
- **FR-004**: PDP MUST render a "Где применяется эта модель" block listing relevant solutions.

### Key Entities

- **RackParameters**: rackUnits, current, outletType, monitoring, surge, notSure.
- **SolutionLink**: title, href, applicableAttributes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Submitting the form prefills the right catalog filters and lands the user on the listing.
- **SC-002**: Solution → catalog → cart → RFQ flow can be completed in one session.
- **SC-003**: Analytics events `solution_submit` and `solution_to_rfq` fire on respective actions (see spec `027`).

## Assumptions

- Spec `024-catalog-mobile-filters` defines the catalog query schema before this spec ships.
- Spec `027-analytics-verification` adds event instrumentation.
- "Где применяется эта модель" content can be derived from product attributes; manual curation lives in Payload after cutover.
