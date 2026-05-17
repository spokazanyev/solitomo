# Feature Specification: Catalog Mobile Filters

**Feature Branch**: `024-catalog-mobile-filters`

**Created**: 2026-05-15

**Status**: Draft

**Input**: Sitewide review v3 found that the catalog renders filters as a 280px sticky sidebar on `lg+` and inline above products on smaller breakpoints. On mobile, users must scroll past filters to reach products. There is no URL-state synchronization for ad-hoc filter combinations. The empty state offers a single "Send rack params" action.

## User Scenarios & Testing

### User Story 1 - Mobile Buyer Reaches Products Fast (Priority: P1)

A buyer opens `/catalog/pdu/` on a 390×844 viewport. They see the listing immediately, with a "Фильтры (N)" button at the top of the listing. Tapping the button opens a slide-in drawer with all filters. Selections apply on close; the listing updates.

**Why this priority**: The current layout pushes products below the fold on mobile, reducing engagement.

**Independent Test**: On 390×844, the first product card is visible above the fold; the filters drawer opens via the button.

**Acceptance Scenarios**:

1. **Given** mobile viewport, **When** the catalog renders, **Then** the first product card is in the first 800 pixels of the page.
2. **Given** the drawer is open, **When** the user applies filters and closes the drawer, **Then** the listing updates and the active filter chips are visible.

### User Story 2 - Desktop Buyer Sees Compact Filters (Priority: P2)

A buyer on `lg+` sees an accordion for filter groups. The first group is open by default; others collapse. Sticky behaviour remains.

**Why this priority**: Long flat lists of filters make the sidebar exhausting; accordions reduce cognitive load.

**Independent Test**: Desktop sidebar shows one open group and three collapsed groups by default.

**Acceptance Scenarios**:

1. **Given** desktop viewport, **When** the catalog renders, **Then** the first filter group is open and the rest are collapsed.
2. **Given** the buyer expands and collapses groups, **When** the page is reloaded, **Then** the previously chosen open/closed state is preserved within the session.

### User Story 3 - Buyer Shares A Filtered Listing (Priority: P2)

A buyer applies filters and copies the URL. The URL contains query params for active filters. Opening the URL in a new browser shows the same filtered listing.

**Why this priority**: Procurement often shares filtered shortlists.

**Independent Test**: `/catalog/pdu/?current=32a&function=monitoring` opens with the corresponding facets preselected.

**Acceptance Scenarios**:

1. **Given** the buyer toggles filters, **When** the URL is observed, **Then** the query string reflects active selections.
2. **Given** a URL with query params, **When** opened, **Then** the listing is filtered accordingly.
3. **Given** an SEO landing (e.g., `/catalog/pdu-uzip/`), **When** rendered, **Then** the canonical SEO state is preserved and additional filters compose via the query string without breaking canonical/indexing rules.

### User Story 4 - Empty State Offers Useful Resets (Priority: P3)

A buyer narrows filters to zero results. The empty state offers two quick resets ("Сбросить ток", "Сбросить розетки") and an RFQ link with the current attempted criteria prefilled.

**Why this priority**: Reduces dead ends and increases conversion from impossible filter sets.

**Independent Test**: With a deliberate impossible filter set, the empty state shows two reset chips plus the RFQ link.

### Edge Cases

- What if the user has both query params and a canonical SEO URL? Canonical wins for `rel=canonical`; query state still drives the visible filtering.
- What if the query contains unknown facets? Ignore them; do not break the page.
- What if the user disables JavaScript? Fall back to the linked SEO listing pages.

## Requirements

### Functional Requirements

- **FR-001**: System MUST render the mobile filter drawer button on `< lg` viewports.
- **FR-002**: Drawer MUST contain all filter facets and respect the WAI-ARIA dialog pattern.
- **FR-003**: System MUST render filter groups as accordions on `lg+` with the first group open by default.
- **FR-004**: Filter selections MUST sync to URL query parameters.
- **FR-005**: URL query parameters MUST be applied as initial selections when the page loads.
- **FR-006**: Empty state MUST suggest two reset shortcuts and an RFQ link with the attempted criteria as comment.
- **FR-007**: Canonical tag MUST remain unchanged by query parameter state.
- **FR-008**: The drawer MUST surface an active filter count badge on the trigger.

### Key Entities

- **FilterSelectionState**: array of selected facet paths.
- **CatalogQueryParams**: serialised filter selections.

## Success Criteria

### Measurable Outcomes

- **SC-001**: First product card is visible above the fold on 390×844 viewport.
- **SC-002**: Sharing a filtered URL reproduces the same listing on a fresh load.
- **SC-003**: Lighthouse Best Practices ≥ 90 on the catalog.
- **SC-004**: Filter drawer interaction is keyboard-accessible (open/close, focus trap).

## Assumptions

- Existing facet/option model in `CatalogFilterableList` is reused; no Payload migration is required by this spec.
- Canonical SEO URLs continue to exist for primary facets (Schuko, IEC, UZIP, 16A, 32A, etc.).
- Query parameter names align with `seo-technical-spec.md` (define if missing during T0 of this spec).
