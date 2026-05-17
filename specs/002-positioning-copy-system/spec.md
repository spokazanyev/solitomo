# Feature Specification: Positioning Copy System

**Feature Branch**: `002-positioning-copy-system`

**Created**: 2026-05-14

**Status**: Complete

**Input**: User description: "Создать систему позиционирования и копирайтинга для сайта Soliton. Сайт должен быть современным, убедительным, технически точным и конверсионным. Нужно учесть конкурентный анализ и новые факты о Soliton: производитель с известной 15-летней историей, российское производство, продукция/фильтры внесены в реестр, надежность проверена годами, конструктив и качество изготовления по оценкам пользователей не уступают APS/APC."

## User Scenarios & Testing

### User Story 1 - Define Brand Positioning (Priority: P1)

As the project owner, I want a clear positioning system for Soliton so that every page communicates why buyers should trust Soliton instead of treating the site as a generic PDU catalog.

**Why this priority**: Positioning guides homepage, categories, product cards, B2B pages, SEO copy, CTAs, and future design.

**Independent Test**: A stakeholder can open the copywriting specification and understand the core promise, trust arguments, audience segments, and proof requirements.

**Acceptance Scenarios**:

1. **Given** the positioning document, **When** a homepage headline is drafted, **Then** it uses the approved positioning and avoids generic ecommerce language.
2. **Given** a trust claim such as 15-year history or Russian registry inclusion, **When** it is used in copy, **Then** the document defines what proof is required and how to phrase it safely.

---

### User Story 2 - Create Page-Level Copy Rules (Priority: P2)

As Codex, I want page-level copy templates so that I can later write consistent, technical, SEO-aligned, conversion-focused pages for products, categories, B2B, delivery/payment, and knowledge content.

**Why this priority**: The site will have many pages. Without a copy system, texts will become inconsistent or generic.

**Independent Test**: A copywriter or Codex can create a first draft for each page type using only this specification and the product data.

**Acceptance Scenarios**:

1. **Given** a product page, **When** Codex writes copy, **Then** it follows the approved structure: purpose, key specs, use cases, proof, documents, CTA, FAQ.
2. **Given** a category page, **When** Codex writes copy, **Then** it explains selection criteria and maps to search intent without keyword stuffing.

---

### User Story 3 - Control Claims And Technical Accuracy (Priority: P3)

As the site owner, I want a claim-control system so that strong marketing statements are used only when supportable and technical copy remains accurate.

**Why this priority**: Soliton can use strong claims, but unsupported comparison, registry, reliability, and production statements create legal and trust risks.

**Independent Test**: Every major claim in the copy spec is labeled as safe now, requires proof, product-dependent, testimonial-dependent, or avoid.

**Acceptance Scenarios**:

1. **Given** the claim "качество не уступает APS/APC", **When** it is considered for public copy, **Then** the document requires source clarification and proof/testimonial framing before use.
2. **Given** the claim "внесено в реестр", **When** it is considered for public copy, **Then** the document requires registry name, entry number/link, and product scope.

### Edge Cases

- If "APS" actually means "APC", the final copy must use the corrected brand name only after confirmation.
- If registry inclusion applies only to some product lines, the copy must not imply all Soliton products are included.
- If user evaluations are informal, the copy should use cautious wording or move the claim into testimonials rather than direct comparative advertising.
- If a product lacks documents or verified specs, copy must not invent guarantees, certifications, or performance claims.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST define Soliton's positioning, core promise, proof pillars, and audience-specific message priorities.
- **FR-002**: The system MUST include page-level copy templates for homepage, category, product detail, B2B/RFQ, payment/delivery, knowledge articles, and FAQ blocks.
- **FR-003**: The system MUST include approved CTA language for B2B, B2C, technical consultation, RFQ, and product selection.
- **FR-004**: The system MUST include a claim-control matrix for 15-year history, Russian production, registry inclusion, reliability, user evaluations, and comparison to APS/APC.
- **FR-005**: The system MUST define banned or discouraged copy patterns such as generic marketing filler, unsupported superlatives, and keyword stuffing.
- **FR-006**: The system MUST map copy rules to SEO clusters and buyer intent from the semantic core.
- **FR-007**: The system MUST use competitor research outputs as input and cite them as internal project source material.
- **FR-008**: The system MUST create `07-build-specifications/copywriting-and-positioning-spec.md`.
- **FR-009**: The system SHOULD identify follow-up content tasks for first-release pages.

### Key Entities

- **Audience Segment**: Buyer group with needs, objections, decision criteria, and preferred CTA.
- **Message Pillar**: Core Soliton argument such as Russian production, 15-year history, technical reliability, product selection, documentation, or B2B supply.
- **Copy Template**: Page-level structure for writing consistent high-conversion copy.
- **Claim Rule**: Approved phrasing, proof requirement, status, and restrictions for factual or comparative statements.
- **CTA Pattern**: Reusable conversion text mapped to buyer stage and page type.

## Success Criteria

### Measurable Outcomes

- **SC-001**: At least 5 audience segments are defined with needs, objections, and CTA priorities.
- **SC-002**: At least 7 page-level copy templates are defined.
- **SC-003**: At least 25 approved or conditional message/CTA patterns are documented.
- **SC-004**: Every high-risk claim has a proof requirement and approved-safe alternative wording.
- **SC-005**: The output is sufficient to start `visual-design-system`, `product-detail-pages`, and `category-filter-pages` features.

## Assumptions

- Soliton's 15-year history is a business fact provided by the project owner but still needs final publication wording and proof source.
- Russian production and registry inclusion may apply to specific product lines; final page copy must scope this precisely.
- "APS" may mean "APC"; public comparative language is deferred until the brand and evidence are confirmed.
- This feature creates a copywriting system, not final finished copy for every product page.
