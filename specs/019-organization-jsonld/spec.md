# Feature Specification: Organization JSON-LD Enrichment

**Feature Branch**: `019-organization-jsonld`

**Created**: 2026-05-15

**Status**: Draft

**Input**: Sitewide review v3 found that `createOrganizationJsonLd()` returns only `name`, `url` and `description`. The Organization entity has no logo, no contactPoint, no address, no sameAs and no foundingDate. Search engines ignore the entity for sitelinks and rich results.

## User Scenarios & Testing

### User Story 1 - Search Engines See A Complete Organization Entity (Priority: P1)

A search engine crawls `/` and `/company/contacts/`. It discovers a single Organization entity with telephone, email, address, contactPoint (sales and support), sameAs, logo and foundingDate.

**Why this priority**: Without this entity, Google does not show sitelinks, brand panels, or rich attributes for the Soliton brand. Local SEO suffers.

**Independent Test**: Google Rich Results Test for `/` reports the Organization entity with no errors and no warnings.

**Acceptance Scenarios**:

1. **Given** the contacts singleton is filled, **When** any public page is rendered, **Then** Organization JSON-LD contains telephone, email, address, contactPoint, sameAs, logo.
2. **Given** the contacts singleton is missing some optional fields, **When** the JSON-LD is built, **Then** missing fields are omitted (not rendered as empty).

### User Story 2 - LocalBusiness Markup Appears Only When Justified (Priority: P3)

A `LocalBusiness` entity is added on `/company/contacts/` only when the contacts record explicitly opts in (a physical office is published, with geo coordinates).

**Why this priority**: Avoid claiming `LocalBusiness` without verified address and geo data.

**Independent Test**: With opt-in disabled, no `LocalBusiness` JSON-LD is rendered; with opt-in enabled and geo present, the entity is rendered and passes validation.

**Acceptance Scenarios**:

1. **Given** `contacts.publishLocalBusiness === false`, **When** `/company/contacts/` is rendered, **Then** no `LocalBusiness` JSON-LD is emitted.
2. **Given** `contacts.publishLocalBusiness === true` and geo is present, **When** `/company/contacts/` is rendered, **Then** `LocalBusiness` JSON-LD with openingHours and geo is emitted.

### Edge Cases

- What happens when contacts singleton is missing? Render the minimal Organization (current shape) without telephone/address.
- What happens when only legal address is present, not actual? Use legal address.
- How are international phone formats handled? Store and emit E.164 in JSON-LD; the UI may format separately.

## Requirements

### Functional Requirements

- **FR-001**: `createOrganizationJsonLd()` MUST accept the contacts record and produce a complete `Organization` schema where data is available.
- **FR-002**: System MUST omit empty fields rather than emit empty strings or arrays.
- **FR-003**: System MUST emit `LocalBusiness` JSON-LD only when explicitly enabled in the contacts record.
- **FR-004**: System MUST keep a single Organization entity across all public pages.
- **FR-005**: System MUST source logo URL from Payload media when present, otherwise from `/public/brand/logo.svg`.

### Key Entities

- **OrganizationSchema**: `@type` Organization, `name`, `legalName`, `url`, `logo`, `image`, `description`, `telephone`, `email`, `address` (PostalAddress), `contactPoint[]` (ContactPoint), `sameAs[]`, `foundingDate`.
- **LocalBusinessSchema**: `@type` LocalBusiness, plus `openingHours`, `geo` (GeoCoordinates), `address`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Rich Results Test for `/` reports a valid Organization entity with no errors.
- **SC-002**: When the contacts singleton lists support and sales phones, both contactPoints appear in JSON-LD.
- **SC-003**: Schema validator (`pnpm validate:schema`, real implementation, see spec `028-seo-canonical-check`) passes the new shape.

## Assumptions

- Spec `018-company-contacts` lands first; this spec consumes its data.
- Logo file is available as SVG or PNG ≥ 112×112 px.
- `sameAs` URLs are verified profiles (VK, YouTube, RuTube, Telegram); placeholders are not added.
