# Feature Specification: Content Production System

**Feature Branch**: `011-content-production-system`

**Created**: 2026-05-15

**Status**: Implemented

**Input**: Continue SDD plan after `010-homepage-b2b-trust`. Replace remaining placeholder content with usable SEO/commercial copy and create a production process for category, product, use-case, FAQ, and knowledge content.

## User Scenarios & Testing

### User Story 1 - Pages Do Not Expose Draft Placeholders (Priority: P1)

As a visitor, I should never see internal development text like “this block will be expanded later” on public pages.

**Independent Test**: Search app source for placeholder phrases returns no public page-template matches.

### User Story 2 - Knowledge Pages Contain Useful First-Draft Articles (Priority: P1)

As a search visitor, I want knowledge pages to answer practical PDU questions and guide me to categories or RFQ.

**Independent Test**: Opening `/knowledge/kak-vybrat-pdu/` shows an intro, real sections, FAQ, and links to commercial pages.

### User Story 3 - Categories Include FAQ And SEO Support Copy (Priority: P2)

As an SEO owner, I want category pages to include FAQ content and structured data so that pages are not only product grids.

**Independent Test**: Opening `/catalog/iec-c13-c19/` shows FAQ and emits `FAQPage` JSON-LD.

## Requirements

- **FR-001**: Public page templates MUST not show development placeholder copy.
- **FR-002**: Knowledge pages MUST use route-specific article content.
- **FR-003**: Knowledge pages MUST include visible FAQ.
- **FR-004**: Catalog pages MUST include visible FAQ.
- **FR-005**: FAQ content MUST emit `FAQPage` JSON-LD when visible.
- **FR-006**: Content must follow claim-control: no stock, certificate, registry, or competitor-equivalence claims without proof.
- **FR-007**: Content production plan MUST define first-release page priorities, templates, proof requirements, and review workflow.
- **FR-008**: Baseline verification MUST pass: lint, typecheck, build, route smoke tests.

## Success Criteria

- **SC-001**: `pnpm build` succeeds.
- **SC-002**: `/knowledge/kak-vybrat-pdu/` renders real article copy and FAQ.
- **SC-003**: `/catalog/iec-c13-c19/` renders FAQ and `FAQPage` JSON-LD.
- **SC-004**: `rg` finds no public placeholder copy in app templates.

## Assumptions

- These are first-release drafts, not final legally reviewed copy.
- Proof-dependent claims remain general until documents are attached.
- Product-card text enrichment continues after normalized attribute import.
