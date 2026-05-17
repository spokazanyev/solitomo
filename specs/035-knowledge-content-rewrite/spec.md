# Feature Specification: Knowledge Content Rewrite

**Feature Branch**: `035-knowledge-content-rewrite`

**Created**: 2026-05-16

**Status**: Deferred (content track)

**Input**: SEO-review found existing 9 knowledge articles use template content from `knowledgeArticleFor()`. Templates are valid for indexing but ceiling for ranking is low. Need 800–1500 word E-E-A-T material with citations and concrete engineering data.

## User Scenarios & Testing

### User Story 1 - Engineer Reads Comprehensive PDU Selection Article (Priority: P1)

A planning engineer searches "как выбрать PDU" and reads a 1500-word article that walks them through current sizing, outlet selection, monitoring needs, and mounting; with concrete numbers and references to IEC/ГОСТ standards.

**Acceptance Scenarios**:

1. **Given** a published knowledge article, **When** measured, **Then** it contains 800+ words, 4+ H2 sections, 6+ FAQ, 2+ standard references.
2. **Given** a published article, **When** measured for uniqueness, **Then** Text.ru reports ≥ 80%.

## Requirements

- **FR-001**: All 9 existing knowledge articles MUST be rewritten with original content.
- **FR-002**: Each article MUST have 800+ words.
- **FR-003**: Each article MUST cite at least 2 industry standards or sources.
- **FR-004**: Each article MUST link to 3–5 related catalog/solution pages.

## Success Criteria

- **SC-001**: Average time-on-page in Yandex.Metrika rises ≥ 50% within 8 weeks.
- **SC-002**: At least 4 articles rank in Yandex top-10 for primary keyword within 12 weeks.

## Status Note

This feature lives in the content track. Page structure already supports the content. No code work required after spec `033` lands.
