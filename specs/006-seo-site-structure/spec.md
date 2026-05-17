# Feature Specification: SEO Site Structure

**Feature Branch**: `006-seo-site-structure`

**Created**: 2026-05-15

**Status**: Implemented

**Input**: User direction: continue the SDD plan for a modern Soliton ecommerce site with maximum SEO potential, organic traffic acquisition, B2C and B2B demand capture, and future Codex-driven implementation.

## User Scenarios & Testing

### User Story 1 - Demand-Based URL Structure (Priority: P1)

As the project owner, I want the site structure to map confirmed demand clusters to stable URLs so that SEO work targets real search behavior instead of arbitrary categories.

**Why this priority**: Organic acquisition depends on landing pages for confirmed clusters: PDU, blocks 19/1U, Schuko, IEC C13/C19, 16A, 32A, vertical PDU, metered/managed PDU, three-phase PDU, and use-case pages.

**Independent Test**: The landing matrix lists each priority URL, demand cluster, target phrases, page type, and indexability decision.

**Acceptance Scenarios**:

1. **Given** the semantic core, **When** a priority demand cluster exists, **Then** the site has a corresponding URL or a documented later-stage URL.
2. **Given** a URL in sitemap, **When** it is opened locally, **Then** it has a 200 response or an intentional redirect to the canonical variant.

### User Story 2 - Technical SEO Baseline (Priority: P1)

As Codex, I want reusable metadata, canonical, sitemap, robots, and structured-data logic so that future pages inherit SEO behavior from a single source of truth.

**Why this priority**: Future catalog and content work should not duplicate SEO rules across pages.

**Independent Test**: `pnpm build` shows sitemap/robots routes and static pages generated from the SEO registry.

**Acceptance Scenarios**:

1. **Given** the app, **When** `/sitemap.xml` is requested, **Then** it lists indexable landing pages.
2. **Given** the app, **When** `/robots.txt` is requested, **Then** it allows public pages and blocks admin/API/search-parameter URLs.
3. **Given** a landing page, **When** HTML is inspected, **Then** canonical and JSON-LD are present.

### User Story 3 - Future Content And Page Production (Priority: P2)

As the content and SEO workflow owner, I want a clear page matrix so that copywriting, product templates, and SEO briefs can be produced systematically.

**Why this priority**: The next stages depend on knowing which pages exist, what intent they serve, and what content blocks each type needs.

**Independent Test**: `seo-landing-matrix.md` and `seo-technical-spec.md` are usable as inputs for page-template and content-production specs.

## Requirements

### Functional Requirements

- **FR-001**: The project MUST define a demand-based landing matrix for category, use-case, B2B, document, company, and knowledge pages.
- **FR-002**: The web app MUST expose sitemap and robots routes through Next.js metadata file conventions.
- **FR-003**: Indexable URLs MUST use one canonical trailing-slash format.
- **FR-004**: Public SEO routes MUST use metadata title, description, canonical, Open Graph, and robots directives from one registry.
- **FR-005**: Public SEO routes MUST include BreadcrumbList structured data.
- **FR-006**: The homepage MUST include Organization structured data.
- **FR-007**: Admin, API, search parameters, random filters, sorting, and empty pages MUST be excluded from indexation.
- **FR-008**: Product URLs MUST be reserved for `/product/{sku-slug}/`, but product sitemap inclusion is deferred until product import exists.
- **FR-009**: The implementation MUST keep future content and ecommerce work independent from the SEO registry.

## Key Entities

- **SEO Route**: Indexable public URL with metadata, demand cluster, priority, change frequency, and CTA.
- **Landing Matrix**: Editorial and SEO plan that maps URL to intent, keywords, content blocks, and implementation status.
- **Canonical Policy**: URL normalization and indexing decision rules.
- **Sitemap**: Search-engine discovery file generated from the route registry.
- **Robots Policy**: Crawl rules for public and private paths.

## Success Criteria

- **SC-001**: At least 30 priority indexable URLs are defined for the initial SEO skeleton.
- **SC-002**: `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.
- **SC-003**: `/catalog/pdu/` responds with 200 and includes canonical metadata.
- **SC-004**: `/sitemap.xml` includes the initial route set.
- **SC-005**: `/robots.txt` blocks `/admin/`, `/api/`, and parameter URLs.

## Assumptions

- Product pages will be added after product import and Payload product collections.
- The first SEO pages are skeleton pages; final copy, filters, product listings, FAQ, and schemas come in later SDD stages.
- The production domain is not final, so local verification uses `NEXT_PUBLIC_SITE_URL` fallback `http://localhost:3000`.
