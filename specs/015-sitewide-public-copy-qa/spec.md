# Feature Specification: Sitewide Public Copy QA

**Feature Branch**: `015-sitewide-public-copy-qa`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: Sitewide review found public leakage of internal SEO and prototype language.

## User Scenarios

### Scenario 1: Buyer reads the site without internal terminology

A visitor opens any public page and sees commercial, technical, and purchasing language, not internal SEO, SDD, RFQ prototype, or demand-cluster labels.

### Scenario 2: Buyer follows related links with useful descriptions

A visitor sees related categories, solutions, documents, or articles. Each card explains what the page helps them do, instead of showing `demandCluster` values.

### Scenario 3: Team prevents future copy regressions

Before QA or demonstration, Codex runs an automated public-copy audit across sitemap URLs and catches forbidden visible markers.

## Requirements

### Functional Requirements

- FR-001: The public UI must not render `demandCluster` directly.
- FR-002: Route eyebrows must use public labels, never raw SEO clusters.
- FR-003: Related-link cards must use public summaries or task-oriented descriptions.
- FR-004: Homepage public copy must not mention organic traffic, SEO mechanics, listing mechanics, or RFQ abbreviations.
- FR-005: B2B pages must use Russian purchasing language: КП, заявка, коммерческое предложение, документы, счет, поставка.
- FR-006: Knowledge pages must not mention internal linking or SEO workflow.
- FR-007: Company pages must not mention `B2B-процесс`, `Trust`, `Brand trust`, or `Conversion`.
- FR-008: A repeatable public-copy audit must check rendered public pages from sitemap.

### Quality Requirements

- QR-001: All 102 current public URLs must pass the public language gate.
- QR-002: Every P1 copy defect must be traceable to source lines before implementation.
- QR-003: The audit must distinguish hard forbidden markers from words that need editorial review.
- QR-004: The site must remain compatible with existing schema.org JSON-LD and sitemap behavior.

## Non-Goals

- No МойСклад integration.
- No payment or delivery integration in this iteration.
- No redesign of the whole visual system.
- No content expansion beyond fixing public language leaks and improving existing page blocks.

## Task Plan

1. Replace raw route cluster rendering.
2. Add public route labels and card descriptions.
3. Rewrite homepage proof/navigation blocks.
4. Rewrite B2B RFQ/prototype wording.
5. Rewrite company and knowledge internal-language blocks.
6. Add public-copy audit script.
7. Run audit across sitemap.
8. Run visual/DOM checks on representative templates.
9. Update review report with final pass/fail results.

## Acceptance Criteria

- `pnpm public-copy-audit` or equivalent command reports zero hard marker failures.
- Source sweep finds no hard forbidden public markers in UI strings.
- Browser/DOM review confirms corrected pages:
  - `/`
  - `/catalog/pdu/`
  - `/product/sp-8/`
  - `/b2b/`
  - `/b2b/request-quote/`
  - `/documents/`
  - `/knowledge/kak-vybrat-pdu/`
  - `/solutions/pdu-dlya-cod/`
  - `/company/about/`
- The user-facing copy reads as a finished manufacturer ecommerce/B2B site.
