# Feature Specification: Page Template System

**Feature Branch**: `007-page-template-system`

**Created**: 2026-05-15

**Status**: Implemented

**Input**: Continue SDD plan after `006-seo-site-structure`. Build a reusable page-template system for the Soliton site so SEO pages are not empty placeholders and future content/product data can plug into stable layouts.

## User Scenarios & Testing

### User Story 1 - Page Types Are Meaningfully Different (Priority: P1)

As the project owner, I want homepage, catalog, use-case, knowledge, B2B, document, and company pages to use different templates so that each page matches its search intent and conversion goal.

**Why this priority**: A modern SEO ecommerce site cannot use one generic landing layout for every page. Category pages must help compare and select; B2B pages must drive RFQ; knowledge pages must educate and link to products.

**Independent Test**: Opening one page from each route type shows distinct blocks and CTAs.

### User Story 2 - Templates Support Future Product And CMS Data (Priority: P1)

As Codex, I want reusable templates fed by typed route/content data so that future product lists, filters, FAQ, documents, forms, and CMS content can be added without replacing page structure.

**Why this priority**: Next stages will implement catalog data and content production. The template layer must be stable before adding dozens of pages.

**Independent Test**: Template data lives separately from route components and can be extended without changing every route file.

### User Story 3 - Conversion And SEO Blocks Are Present (Priority: P2)

As a marketer/SEO owner, I want each template to include useful content blocks, internal links, technical details, and CTA zones so that skeleton pages already reflect the intended conversion structure.

**Why this priority**: The design must convert both organic B2C and B2B traffic; templates must reserve space for the content and data that will be written next.

**Independent Test**: Pages include H1, metadata from SEO registry, practical block structure, internal links, primary CTA, and structured data.

## Requirements

### Functional Requirements

- **FR-001**: The app MUST provide separate templates for home, catalog, solution, knowledge, B2B, document, and company page types.
- **FR-002**: Templates MUST keep metadata/canonical behavior from the SEO registry.
- **FR-003**: Catalog templates MUST include filter groups, product-list placeholders, selection guidance, comparison/table space, internal links, FAQ, and RFQ CTA.
- **FR-004**: Home template MUST include product directions, PDU selector, trust signals, B2B route, and knowledge links.
- **FR-005**: Solution templates MUST explain the task, selection criteria, relevant categories, and RFQ path.
- **FR-006**: Knowledge templates MUST use article-like sections with related category links and CTA.
- **FR-007**: B2B templates MUST support project flow, document needs, company fields, and RFQ CTA.
- **FR-008**: Document/company templates MUST support trust and proof needs without unsupported claims.
- **FR-009**: Templates MUST be responsive and avoid text overflow on mobile.
- **FR-010**: Baseline verification MUST pass: lint, typecheck, build.

## Success Criteria

- **SC-001**: `pnpm build` prerenders all current SEO routes.
- **SC-002**: `/`, `/catalog/pdu/`, `/solutions/pdu-dlya-servernogo-shkafa/`, `/knowledge/kak-vybrat-pdu/`, `/b2b/`, `/documents/`, and `/company/about/` render distinct templates.
- **SC-003**: Templates expose reusable data structures for future CMS/product integration.
- **SC-004**: No route loses canonical, sitemap, robots, or JSON-LD behavior from stage 006.

## Assumptions

- Product cards use representative placeholders until product import is implemented.
- Final copywriting, FAQ content, and product-specific details will be created in later content stages.
- Payments, delivery, cart, and RFQ persistence remain separate features.
