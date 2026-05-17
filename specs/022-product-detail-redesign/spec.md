# Feature Specification: Product Detail Redesign

**Feature Branch**: `022-product-detail-redesign`

**Created**: 2026-05-15

**Status**: Draft

**Input**: Sitewide review v3 found that PDP hero shows H1, specs and a price aside, but the product photo lives in a separate section below. Breadcrumbs jump from "Каталог" straight to SKU. Mobile lacks a sticky CTA. Gallery thumbnails are static.

## User Scenarios & Testing

### User Story 1 - Buyer Sees Photo, Price And CTA Above The Fold (Priority: P1)

A buyer opens any product page. Above the fold they see: gallery (main photo + thumbnails), H1 with badges, key technical specs, ориентировочная price with date, availability, "В корзину КП" and "Перейти к заявке" CTAs. The page does not require a scroll to see the product image and the primary CTA together.

**Why this priority**: This is the standard PDP pattern that procurement and technical buyers expect. The current layout looks like a wireframe.

**Independent Test**: On 1440×900 viewport, the hero section contains gallery, headline, key specs and the primary CTA.

**Acceptance Scenarios**:

1. **Given** any product page, **When** rendered, **Then** the gallery and price aside are siblings in the hero, not separate sections.
2. **Given** the product has multiple images, **When** a thumbnail is clicked, **Then** the main image swaps without page reflow.

### User Story 2 - Breadcrumbs Show The Category (Priority: P1)

A buyer sees the breadcrumb trail: Главная → Каталог → Блоки розеток 19″ 1U → SP-8. The middle node points back to the relevant catalog page.

**Why this priority**: Helps buyers navigate the catalog and matches Google's BreadcrumbList expectations.

**Independent Test**: HTML for `/product/sp-8/` includes a breadcrumb item linking to the right catalog (`/catalog/bloki-rozetok-19-1u/` or appropriate).

**Acceptance Scenarios**:

1. **Given** a product, **When** breadcrumbs are rendered, **Then** the middle node corresponds to the primary catalog category of the product.

### User Story 3 - Mobile Sticky CTA Keeps Conversion Reachable (Priority: P2)

A buyer on mobile scrolls through specs and tabs. A bottom sticky bar with price and the primary CTA remains visible. Tapping it opens the RFQ cart or jumps to the form.

**Why this priority**: Mobile B2B procurement is significant; without sticky CTA the conversion drops after the fold.

**Independent Test**: On 390×844 viewport, the sticky bar is visible after scrolling 800px.

**Acceptance Scenarios**:

1. **Given** mobile viewport, **When** the user scrolls past the hero, **Then** the sticky bar appears at the bottom.
2. **Given** desktop viewport, **When** the user scrolls, **Then** the sticky bar is hidden (aside stays).

### User Story 4 - Gallery Has Click-To-Zoom (Priority: P3)

A buyer clicks the main image. A lightbox opens with a larger version. ESC or backdrop click closes.

**Why this priority**: Engineers and procurement often need to read labels on the photo.

**Independent Test**: Clicking the hero image opens a `<dialog>` with the larger photo; ESC closes it.

### Edge Cases

- What if the product has only one image? Thumbnails row is hidden; lightbox still works on the single image.
- What if no image is available? Use the placeholder; sticky bar still works.
- What if specifications block overflows on mobile? Make it horizontally scrollable.

## Requirements

### Functional Requirements

- **FR-001**: PDP hero MUST render the gallery and price aside as siblings in the same section.
- **FR-002**: Breadcrumbs MUST include a category node derived from `product.categories[0]` or `product.attributes.mounting`.
- **FR-003**: System MUST render a mobile-only sticky bottom CTA with price and primary action.
- **FR-004**: Clicking a thumbnail MUST swap the main hero image without page reflow.
- **FR-005**: Clicking the main image MUST open a lightbox via the native `<dialog>` element.
- **FR-006**: BreadcrumbList JSON-LD MUST reflect the visible breadcrumb trail.

### Key Entities

- **ProductHeroState**: activeImageIndex (client state for gallery).
- **BreadcrumbItem**: label, href, position.

## Success Criteria

### Measurable Outcomes

- **SC-001**: PDP hero on 1440×900 contains gallery, H1, key specs and primary CTA above the fold.
- **SC-002**: Mobile sticky CTA shown on 390×844 after `scrollY > 800`.
- **SC-003**: BreadcrumbList JSON-LD validates and matches visible breadcrumbs on 5 sampled PDPs.

## Assumptions

- Product data already exposes `categories[0]` and mounting attribute.
- Lightbox is implemented without a third-party library to keep bundle size low.
- Gallery state is fully client-side; server renders the first image.
