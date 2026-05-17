# Feature Specification: Competitor Conversion Research

**Feature Branch**: `001-competitor-conversion-research`

**Created**: 2026-05-14

**Status**: Complete

**Input**: User description: "Двигаемся по SDD-плану. Первый этап - изучить сайты альтернативных производителей PDU/блоков розеток, выявить маркетинговые, визуальные, технические и конверсионные паттерны, которые нужно использовать при создании современного сайта Soliton."

## User Scenarios & Testing

### User Story 1 - Identify Winning Conversion Patterns (Priority: P1)

As the project owner, I want a structured comparison of leading PDU and rack power distribution competitors so that Soliton's future site can use proven conversion patterns instead of generic ecommerce blocks.

**Why this priority**: This informs page structure, copywriting, visual design, CTA strategy, trust blocks, technical tables, and future development requirements.

**Independent Test**: The story is complete when a stakeholder can open one document and see which competitor patterns should be adapted for Soliton, where they should appear, and why they matter.

**Acceptance Scenarios**:

1. **Given** the competitor research document, **When** a stakeholder reviews the competitor matrix, **Then** at least 8 relevant competitors or benchmark sources are covered.
2. **Given** the pattern recommendations, **When** a stakeholder reviews each recommendation, **Then** it is mapped to specific Soliton page types: homepage, category, product detail, B2B/RFQ, delivery/payment, or knowledge base.
3. **Given** a marketing claim from a competitor, **When** it is proposed for Soliton, **Then** the document marks whether it is directly usable, needs proof, or should be avoided.

---

### User Story 2 - Build Copywriting Inputs For Technical Pages (Priority: P2)

As the future copywriter and Codex implementation agent, I want competitor-derived message patterns and technical detail requirements so that Soliton pages can be persuasive without becoming vague marketing copy.

**Why this priority**: Soliton's pages must convert technical buyers, engineers, procurement teams, and private buyers. Copy must be specific, technically credible, and aligned with search demand.

**Independent Test**: The story is complete when the research identifies reusable message blocks, technical proof points, CTA patterns, and page-level copy guidance.

**Acceptance Scenarios**:

1. **Given** the copywriting section, **When** a product page template is drafted later, **Then** it has clear source inputs for benefits, applications, proof points, FAQ, and CTA text.
2. **Given** a technical claim such as reliability, monitoring, protection, or uptime, **When** the claim is considered for Soliton, **Then** the research states what evidence is required before publishing it.

---

### User Story 3 - Inform Visual Design Direction (Priority: P3)

As the future designer/developer, I want to understand the visual and UX patterns used by strong PDU brands so that Soliton's design feels modern, technical, trustworthy, and conversion-focused.

**Why this priority**: Visual design decisions should support buying confidence and technical comprehension, not only aesthetics.

**Independent Test**: The story is complete when the research provides visual design implications for product cards, category pages, tables, comparison blocks, CTA areas, and document/download blocks.

**Acceptance Scenarios**:

1. **Given** the visual pattern section, **When** the UI design system spec is created later, **Then** it can reuse concrete guidance on layout, hierarchy, product imagery, technical tables, and CTA placement.
2. **Given** a page type, **When** design requirements are derived, **Then** the requirements include both visual clarity and conversion purpose.

### Edge Cases

- Some competitors may provide limited public page detail; in that case, record only observable patterns and avoid inventing claims.
- Some claims may be product-specific, such as outlet-level switching or environmental monitoring; these must not be applied to Soliton unless Soliton has matching product capabilities.
- Russian competitors may use simpler ecommerce layouts; the research should separate market-local expectations from best-in-class global design.
- Competitor language must not be copied verbatim; the output should extract patterns and implications.

## Requirements

### Functional Requirements

- **FR-001**: The research MUST cover at least 8 benchmark sources, including global PDU manufacturers and Russian/local suppliers where relevant.
- **FR-002**: The research MUST classify findings by page type: homepage, category, product detail, B2B/RFQ, support/documentation, and knowledge/education.
- **FR-003**: The research MUST identify marketing messages, conversion blocks, CTA types, trust signals, visual patterns, and technical-detail patterns.
- **FR-004**: The research MUST distinguish verified competitor observations from Soliton recommendations.
- **FR-005**: The research MUST mark Soliton claims as one of: safe to use now, requires proof, product-dependent, or avoid.
- **FR-006**: The research MUST produce recommendations for copywriting and visual design, not only a competitor list.
- **FR-007**: The research MUST include source links for reviewed competitor pages.
- **FR-008**: The research MUST create or update `07-build-specifications/competitor-marketing-analysis.md`.
- **FR-009**: The research SHOULD identify inputs needed for later specs: `copywriting-and-positioning-spec.md`, `ui-design-system-spec.md`, `product-detail-pages`, and `category-filter-pages`.

### Key Entities

- **Competitor Source**: A reviewed manufacturer, supplier, or benchmark page with URL, market role, page type, and observed patterns.
- **Marketing Pattern**: A reusable strategic message or conversion mechanism, such as reliability, uptime, remote management, proof documents, or engineering support.
- **Visual Pattern**: A reusable UX or design approach, such as technical comparison tables, product family grids, CTA bands, downloadable datasheets, or selector flows.
- **Soliton Recommendation**: A proposed adaptation for Soliton with page type, rationale, confidence, and proof requirement.
- **Claim Control**: A status attached to claims to prevent unsupported copy: safe now, requires proof, product-dependent, or avoid.

## Success Criteria

### Measurable Outcomes

- **SC-001**: At least 8 competitor or benchmark sources are analyzed with source links.
- **SC-002**: At least 20 distinct patterns are identified and grouped by marketing, UX/design, technical proof, and conversion function.
- **SC-003**: At least 15 concrete Soliton recommendations are produced and mapped to page types.
- **SC-004**: Every recommendation involving a factual product claim includes a proof status.
- **SC-005**: The final document provides enough detail to start the next SDD feature: `positioning-copy-system`.

## Assumptions

- The first research pass may use public pages only; no private dealer portals or paid market tools are required.
- English-language global manufacturers and Russian-language suppliers are both relevant because Soliton needs modern UX and local market fit.
- The output is a strategic research artifact, not final copy for publication.
- Unsupported competitor claims must not become Soliton claims until product documents, certificates, datasheets, or business evidence confirm them.
