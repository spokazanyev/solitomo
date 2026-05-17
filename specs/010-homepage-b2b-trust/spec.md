# Feature Specification: Homepage B2B Trust

**Feature Branch**: `010-homepage-b2b-trust`

**Created**: 2026-05-15

**Status**: Implemented

**Input**: Continue SDD plan after `009-category-filter-pages`. Strengthen the homepage and B2B/trust sections so the site reads as a modern manufacturer ecommerce site, not just a set of product cards.

## User Scenarios & Testing

### User Story 1 - Homepage Explains The Business Quickly (Priority: P1)

As a new visitor, I want the first screen to show that Soliton produces PDU and rack power products, with clear paths to catalog, selection, and B2B purchasing.

**Why this priority**: Organic visitors may enter the homepage or return from category pages. The homepage must establish trust and direct them to the correct commercial path.

**Independent Test**: Opening `/` shows product visual, manufacturer proof points, catalog/selection/B2B entry cards, and real product links.

### User Story 2 - B2B Buyers See A Project Workflow (Priority: P1)

As a corporate buyer or integrator, I want the B2B page to explain what data is needed for a quote and how Soliton handles technical/project requests.

**Why this priority**: The project’s main conversion goal is RFQ and contract sales, not only direct cart purchase.

**Independent Test**: Opening `/b2b/` shows RFQ path, required inputs, document needs, and project workflow.

### User Story 3 - Trust Claims Are Visible But Controlled (Priority: P2)

As a project owner, I want trust signals such as 15-year history, Russian production, registry, and reliability to be visible, while detailed proof is still routed to documents and company pages.

**Why this priority**: These claims support conversion but must remain connected to verification and documents.

**Independent Test**: Homepage and B2B pages include trust claims and links to document/company/B2B flows, without unsupported stock or certification claims on product cards.

## Requirements

### Functional Requirements

- **FR-001**: Homepage hero MUST show product/manufacturer proof instead of internal SEO-role copy.
- **FR-002**: Homepage MUST include quick paths to catalog, engineering selection, and B2B purchasing.
- **FR-003**: Homepage MUST show visible proof metrics and trust signals.
- **FR-004**: Homepage MUST show real products from the catalog, not placeholder products.
- **FR-005**: Homepage MUST include use-case cards for server cabinets, data centers/projects, and procurement/integrators.
- **FR-006**: B2B template MUST include a project RFQ explanation and primary RFQ CTA.
- **FR-007**: B2B template MUST list practical inputs needed from the buyer: quantity, city, timing, PDU parameters, documents, and optional technical specification.
- **FR-008**: Trust copy MUST not claim stock, certificates, or registry details for a specific SKU unless attached to documents.
- **FR-009**: Layout MUST remain responsive and avoid text overflow on mobile.
- **FR-010**: Baseline verification MUST pass: lint, typecheck, build, homepage and B2B smoke checks.

## Success Criteria

- **SC-001**: `/` returns `200` and contains real product references, manufacturer trust claims, and links to catalog/B2B/selection pages.
- **SC-002**: `/b2b/` returns `200` and contains RFQ/project copy and B2B trust points.
- **SC-003**: `pnpm build` prerenders current static routes successfully.
- **SC-004**: Homepage still emits existing `Organization` and breadcrumb structured data.

## Assumptions

- Trust claims are based on project-owner input and remain general until document proof is attached.
- Rich final copy and FAQ expansion will continue in `011-content-production-system`.
- Checkout, cart, and saved RFQ submission are handled in later features.
