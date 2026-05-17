# Feature Specification: Media And Documents Migration

**Feature Branch**: `017-media-and-documents-migration`

**Created**: 2026-05-15

**Status**: Draft

**Input**: Sitewide review v3 (2026-05-15) found that public product images and PDF documents are served directly from `soliton1.ru`. The site preloads images from this external host, leaks brand trust to a competing domain, and depends on a third party for LCP and document availability.

## User Scenarios & Testing

### User Story 1 - Buyer Sees Soliton Images On Soliton Domain (Priority: P1)

A buyer opens the homepage, catalog or product page. All product images load from the Soliton domain. The network panel shows zero requests to `soliton1.ru`. LCP for the homepage hero comes from the local CDN.

**Why this priority**: Without owning the media, the site visibly depends on a legacy domain owned by a competitor, breaks the "Russian manufacturer" positioning, and degrades performance.

**Independent Test**: `curl -s http://localhost:3000/ | grep -c soliton1.ru` returns `0`. Same for `/catalog/pdu/`, `/product/sp-8/`, `/catalog/pdu-uzip/`, `/catalog/schuko/`.

**Acceptance Scenarios**:

1. **Given** the public site, **When** any page is rendered, **Then** all `<img>`/`<Image>` `src` and `<link rel="preload">` `href` point to the Soliton origin or its CDN.
2. **Given** a product has no image in Payload, **When** the card is rendered, **Then** a stylized SVG placeholder is shown with the SKU watermark.

### User Story 2 - Buyer Opens Documents On Soliton Domain (Priority: P1)

A buyer downloads a passport, certificate or drawing. The URL bar shows the Soliton domain. The file streams from the project's own API. PDFs are tagged `X-Robots-Tag: noindex` to avoid duplicate-document SEO issues.

**Why this priority**: Documents are core to B2B trust. Hot-linking PDFs from a third party fails compliance audits and risks file disappearance.

**Independent Test**: `curl -I http://localhost:3000/documents/files/<id>.pdf` returns `200`, `Content-Type: application/pdf`, `X-Robots-Tag: noindex`.

**Acceptance Scenarios**:

1. **Given** a document exists in Payload, **When** it is linked from `/documents/` or a product card, **Then** the link points to `/documents/files/<id>.pdf`.
2. **Given** a missing document, **When** the URL is fetched, **Then** the endpoint returns `404`, not a redirect to `soliton1.ru`.

### User Story 3 - Operator Updates Assets Through Admin (Priority: P2)

A catalog manager opens Payload, uploads a replacement image or a new PDF for a product, publishes it, and the public page picks the new asset on next render.

**Why this priority**: Without admin support, every asset change requires a developer.

**Independent Test**: In Payload admin, replacing a product image and saving updates the public `/product/[slug]/` image without code changes.

**Acceptance Scenarios**:

1. **Given** an admin updates `products.images[]`, **When** the public page rebuilds or revalidates, **Then** the new image renders.
2. **Given** a document is replaced, **When** the public page is reloaded, **Then** the same `/documents/files/<id>.pdf` URL returns the new file body.

### Edge Cases

- What happens when `soliton1.ru` returns 403 during bulk download? Retry with throttling; record failures; do not block migration on transient errors.
- How does the system handle duplicate documents (the legacy export contains near-duplicates)? Deduplicate by SHA-256 of file body; keep one canonical record; alias the rest.
- What happens when a product has no image? Render the stylized SVG placeholder with SKU.
- What if a PDF is large (>10 MB)? Stream with HTTP range support; do not buffer in memory.

## Requirements

### Functional Requirements

- **FR-001**: System MUST inventory all legacy media and document URLs referenced by current source data with availability, size and content-type.
- **FR-002**: System MUST download legacy assets into the repository idempotently with checksum tracking.
- **FR-003**: System MUST seed `media` and `documents` Payload collections with the downloaded assets, deduplicated by checksum.
- **FR-004**: Public components MUST use Payload-backed asset URLs, not direct `soliton1.ru` URLs.
- **FR-005**: System MUST expose `/documents/files/[id]` route streaming PDF bodies with correct headers.
- **FR-006**: System MUST render a stylized SVG placeholder when a product has no image.
- **FR-007**: System MUST remove `soliton1.ru` `<link rel="preload">` tags from public HTML.
- **FR-008**: System MUST keep a feature flag `LEGACY_MEDIA_FALLBACK` defaulting to `false` to allow rollback during migration only.

### Key Entities

- **MediaAsset**: id, file, alt, width, height, source URL, checksum, linked products.
- **DocumentAsset**: id, file, title, type (passport/certificate/drawing/manual), source URL, checksum, linked products.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 0 occurrences of `soliton1.ru` in SSR HTML across all 102 public URLs.
- **SC-002**: Homepage LCP < 2.5s on Moto G4 / Slow 4G in Lighthouse.
- **SC-003**: 100% of products either have at least one local image or render the placeholder; no broken images.
- **SC-004**: All 21 unique legacy documents are reachable through `/documents/files/[id]` and return `200` with the right content-type.

## Assumptions

- Legacy assets on `soliton1.ru` are reachable by the migration script during the migration window.
- Payload `media` and `documents` collections already exist and are seeded with the current assortment (per `agent-project-context.md`).
- The site does not yet need a CDN; Next.js image optimization is acceptable for v1.
- Photoshoot for manufacturing assets is out of scope here; this feature only migrates what already exists.
