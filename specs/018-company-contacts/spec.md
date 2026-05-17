# Feature Specification: Company Contacts

**Feature Branch**: `018-company-contacts`

**Created**: 2026-05-15

**Status**: Draft

**Input**: Sitewide review v3 found no phone, email, address or legal requisites anywhere on the site. `/company/contacts/` renders the generic `CompanyTemplate`. For a B2B-first site this breaks trust before any conversion.

## User Scenarios & Testing

### User Story 1 - Buyer Calls Or Emails Soliton Directly (Priority: P1)

A buyer opens `/company/contacts/`, sees a phone number with `tel:` and an email with `mailto:`, separated for sales and technical support. The contact page also shows the legal name, INN, KPP, OGRN and the working hours.

**Why this priority**: B2B buyers and procurement staff require contact details before sending an RFQ. Their absence blocks deals and breaks the positioning of a real Russian manufacturer.

**Independent Test**: `/company/contacts/` contains a clickable phone, a clickable email and at least one address. `view-source` shows `tel:` and `mailto:` anchors.

**Acceptance Scenarios**:

1. **Given** the contacts page, **When** rendered, **Then** at least one phone, one email and the legal requisites are visible.
2. **Given** a manager updates phones in Payload, **When** the contacts page reloads, **Then** the new value is shown.
3. **Given** a buyer is on mobile, **When** they tap the phone, **Then** the device opens the dialer.

### User Story 2 - Footer And Header Show Quick Contact (Priority: P2)

A buyer on any page sees a primary phone in the footer and a "КП" button plus phone in the header. The data source is the same Payload record so changes propagate everywhere.

**Why this priority**: Reduces the click cost to contact Soliton from any page.

**Independent Test**: Phone and email in the footer match the values shown on `/company/contacts/`.

**Acceptance Scenarios**:

1. **Given** a Payload contacts record, **When** the site is built, **Then** the same phone string appears in `/company/contacts/`, footer and header.
2. **Given** a manager edits the phone, **When** the page is reloaded, **Then** the new value propagates without code changes.

### User Story 3 - Search Engines See Contact Info In JSON-LD (Priority: P2)

The Organization JSON-LD on every page is populated from the same Payload record. Telephone, email, address, contactPoint and sameAs are present.

**Why this priority**: Local SEO and rich-results require structured contact data.

**Independent Test**: Google Rich Results Test on `/` and `/company/contacts/` reports the Organization entity with no errors.

**Acceptance Scenarios**:

1. **Given** the contacts record exists, **When** any page is rendered, **Then** `createOrganizationJsonLd()` returns a payload with `telephone`, `email`, `address` and at least one `contactPoint`.

### Edge Cases

- What happens when the contacts record is missing? Render a fallback that links to the RFQ form and shows "Контакты согласовываются", but never silently empty.
- What happens when multiple phones are configured? Show all, label each one (Sales / Support / Office).
- How is invalid data handled? Validate phone format on save in Payload; the public component is purely presentational.

## Requirements

### Functional Requirements

- **FR-001**: System MUST persist company contacts in a Payload collection (singleton-style).
- **FR-002**: System MUST expose a server-side helper `getCompanyContacts()` that returns the contact record for both pages and JSON-LD.
- **FR-003**: System MUST render a dedicated `ContactsTemplate` for `/company/contacts/`.
- **FR-004**: System MUST display phone with `tel:` and email with `mailto:` anchors.
- **FR-005**: System MUST display legal requisites: legal name, INN, KPP, OGRN, legal address, actual address, working hours.
- **FR-006**: System MUST show a primary phone in the footer and the header.
- **FR-007**: System MUST populate Organization JSON-LD with telephone, email, address, contactPoint and sameAs.

### Key Entities

- **CompanyContacts**: singleton, fields: legalName, brandName, inn, kpp, ogrn, legalAddress, actualAddress, workingHours, phones (label + value + isPrimary), emails (label + value + isPrimary), socials (platform + url), supportPolicy.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `/company/contacts/` displays at least one phone, one email, and legal requisites in DOM and Organization JSON-LD.
- **SC-002**: Footer and header on all public URLs show the primary phone.
- **SC-003**: Manager-edited contact value reaches the public site within one revalidation cycle (≤ 60s) without code deploy.
- **SC-004**: Google Rich Results Test reports no warnings on Organization schema for `/`.

## Assumptions

- The site owner provides verified contact data before public release.
- Map widget is out of scope for v1 (privacy and cookie banner overhead).
- Multilingual contacts are out of scope.
- The contacts page uses the same site shell (`SiteHeader`, `SiteFooter`) introduced in spec `023-site-shell`.
