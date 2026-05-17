# Feature Specification: Brand Alternate Name

**Feature Branch**: `029-brand-alternate-name`

**Created**: 2026-05-16

**Status**: Draft

**Input**: SEO-review 2026-05-16 found that after Soliton → Солитон replacement, latin brand queries (`soliton pdu`, `soliton блок розеток` — ~26/мес) lost direct keyword anchor. Need an explicit `alternateName` declaration to preserve coverage.

## User Scenarios & Testing

### User Story 1 - Search Engine Resolves Both Brand Spellings (Priority: P1)

A search engine crawls Organization JSON-LD on any page and finds both Cyrillic and Latin brand names declared. Both spellings remain searchable.

**Independent Test**: `curl /` returns Organization JSON-LD containing `"alternateName":["Soliton"]`.

**Acceptance Scenarios**:

1. **Given** any public page, **When** the Organization JSON-LD is rendered, **Then** `alternateName` array contains `"Soliton"`.
2. **Given** the about page, **When** rendered, **Then** body text contains the phrase "Солитон (Soliton)" exactly once.

### Edge Cases

- What if owner adds a different alternative spelling? Make it a Payload field in `company-contacts`.

## Requirements

### Functional Requirements

- **FR-001**: Organization JSON-LD MUST include `alternateName: ["Soliton"]` on every public page.
- **FR-002**: `/company/about/` MUST contain a visible phrase "Солитон (Soliton)" or equivalent in body copy.
- **FR-003**: Meta description of `/company/about/` MUST mention both spellings.

## Success Criteria

- **SC-001**: `pnpm validate:schema` passes; `alternateName` is in Organization payload.
- **SC-002**: Yandex/Google after 2 weeks index "Soliton" as alternate brand.
