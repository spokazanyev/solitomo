# Feature Specification: Homepage Product-First

**Feature Branch**: `020-homepage-product-first`

**Created**: 2026-05-15

**Status**: Draft

**Input**: Sitewide review v3 found that the homepage hero shows a text block plus a generic "Для закупки и проекта" panel, without a product photo. Trust signals defined in `template-content.ts` are only used on `/b2b/*` and `/documents/`. `homeProofMetrics` is declared but never rendered. Catalog and B2B heroes also render a right-side panel with raw SEO keywords visible to the user.

## User Scenarios & Testing

### User Story 1 - Visitor Sees A Manufacturer, Not A Catalog Wireframe (Priority: P1)

A visitor lands on `/`. The first screen shows the H1, a short value proposition, two clear CTAs, four short trust bullets, and a real product photo next to the text. Below the fold there are proof metrics, featured products, trust band linked to proof pages, and a manufacturing showcase.

**Why this priority**: Spec `ui-design-system-spec.md` requires "first screen uses product visuals" and "more proofs of manufacturing and documents". Current homepage looks like an SEO scaffold.

**Independent Test**: The homepage hero contains a `<picture>` or `<Image>` with a product photo and the trust band block is visible on `/` (not only on `/b2b/`).

**Acceptance Scenarios**:

1. **Given** the homepage, **When** rendered above the fold, **Then** the H1 sits beside a real product image.
2. **Given** the homepage scrolled, **When** the proof metrics section is reached, **Then** four metrics are visible (no `RFQ` label).
3. **Given** any trust signal card, **When** clicked, **Then** the user lands on the corresponding proof page.

### User Story 2 - Non-Home Pages Don't Show SEO Keyword Chips (Priority: P1)

A visitor opens any catalog, B2B, knowledge or solution page. There is no right-side panel listing SEO keywords. The eyebrow, H1 and description are clean commercial copy.

**Why this priority**: The current "Коротко + keywords" aside reads as a developer debug pane and undermines trust on every non-home page.

**Independent Test**: SSR HTML for `/catalog/pdu/`, `/b2b/`, `/knowledge/kak-vybrat-pdu/`, `/solutions/pdu-dlya-servernogo-shkafa/` does not include the keyword chips block.

**Acceptance Scenarios**:

1. **Given** any non-home SEO page, **When** rendered, **Then** there is no `aside` listing `route.keywords`.

### User Story 3 - Social Sharing Renders A Branded Preview (Priority: P2)

When the homepage or any product page URL is pasted into Telegram, Slack or Twitter, a branded OG image with the H1 is shown.

**Why this priority**: Sharing happens in B2B procurement chats; a bare link weakens trust.

**Independent Test**: Twitter Card Validator and Telegram preview show the title plus a 1200×630 image.

**Acceptance Scenarios**:

1. **Given** the homepage URL is shared, **When** previewed, **Then** the OG image contains the Soliton logotype and the H1.
2. **Given** a product URL is shared, **When** previewed, **Then** the OG image contains the model name and a product photo.

### Edge Cases

- What happens when the featured product has no image? Use the SVG placeholder from spec `017`.
- What happens when manufacturing photos are not available? Use vector illustration or a single stock photo placeholder approved by the owner; never show empty space.

## Requirements

### Functional Requirements

- **FR-001**: The homepage hero MUST render a real product image next to the text.
- **FR-002**: The homepage MUST include the proof metrics band (no `RFQ` label).
- **FR-003**: The homepage MUST include the trust band with linked proof pages.
- **FR-004**: The homepage MUST include a manufacturing showcase block.
- **FR-005**: Non-home SEO pages MUST NOT render the right-side keyword chips aside.
- **FR-006**: System MUST generate dynamic OG images for the homepage, category pages and product pages via Next.js `opengraph-image.tsx`.
- **FR-007**: Trust signal cards MUST be clickable links when an associated proof page exists.

### Key Entities

- **ProofMetric**: label, text. Sourced from `template-content.ts` or Payload after cutover.
- **TrustSignal**: label, text, optional `href`.
- **OgImageContext**: title, subtitle, optional image URL — used by `opengraph-image.tsx`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Homepage hero contains a product image and at least one CTA above the fold on 1440×900 viewport.
- **SC-002**: Trust band on the homepage links to four proof pages.
- **SC-003**: SSR sweep of all `/catalog/*`, `/b2b/*`, `/knowledge/*`, `/solutions/*` URLs contains no `route.keywords` chip markup.
- **SC-004**: Telegram, Slack and Twitter previews render an OG image and the H1 for the homepage and a sample product.

## Assumptions

- At least one well-lit product photo is available for the homepage hero (from spec `017` legacy migration).
- Brand logo SVG is available.
- Manufacturing showcase uses three approved photos or vector illustrations.
- Catalog and PDP heroes are touched in spec `022-product-detail-redesign`; this spec touches only home and the shared non-home hero aside.
