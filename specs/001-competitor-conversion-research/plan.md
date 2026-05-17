# Implementation Plan: Competitor Conversion Research

**Branch**: `001-competitor-conversion-research` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-competitor-conversion-research/spec.md`

## Summary

Create a structured competitor and conversion research artifact for the Soliton site project. The output will identify marketing, visual, technical, copywriting, and conversion patterns from leading PDU manufacturers and relevant Russian suppliers, then translate those patterns into actionable Soliton recommendations.

## Technical Context

**Language/Version**: Markdown research artifacts; no application runtime.

**Primary Dependencies**: Public competitor websites, existing Soliton project documents, confirmed assortment map and semantic core.

**Storage**: Repository markdown documents under `specs/001-competitor-conversion-research/` and `07-build-specifications/`.

**Testing**: Checklist validation against feature requirements and success criteria.

**Target Platform**: Project documentation consumed by Codex and the site development process.

**Project Type**: Research/specification artifact.

**Performance Goals**: Not applicable.

**Constraints**: Use source links; do not copy competitor text verbatim; separate observed facts from Soliton recommendations; mark unsupported claims.

**Scale/Scope**: At least 8 benchmark sources, 20 patterns, 15 Soliton recommendations.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Specification-first development: PASS. `spec.md` exists and checklist is complete.
- SEO and demand as product requirements: PASS. Research is explicitly tied to SEO page types, conversion paths, and later content specs.
- B2B/RFQ first: PASS. B2B/RFQ patterns are required outputs.
- Integrations isolated and observable: PASS. No integration implementation in this feature.
- Analytics and search control: PASS. Later analytics implications will be recorded where competitor patterns affect conversion tracking.
- Maintainable by Codex: PASS. Outputs are repo-local markdown artifacts.
- Quality gates: PASS. Acceptance criteria are measurable and source-backed.

## Project Structure

### Documentation (this feature)

```text
specs/001-competitor-conversion-research/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── competitor-analysis-output.md
└── tasks.md
```

### Project Output

```text
07-build-specifications/
└── competitor-marketing-analysis.md
```

**Structure Decision**: This feature produces research and specification artifacts only. No source code is required.

## Phase 0: Research

Research must cover:

- global PDU benchmark manufacturers;
- Russian/local PDU suppliers where relevant;
- product detail pages;
- category/product-family pages;
- conversion and CTA patterns;
- technical proof and documentation patterns;
- visual and copywriting implications.

## Phase 1: Design & Contracts

Artifacts:

- `research.md` - decisions, competitor source set, alternatives considered.
- `data-model.md` - entities used in the analysis.
- `contracts/competitor-analysis-output.md` - required output structure.
- `quickstart.md` - how to validate and consume the research.

## Complexity Tracking

No constitution violations.
