# Implementation Plan: Positioning Copy System

**Branch**: `002-positioning-copy-system` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-positioning-copy-system/spec.md`

## Summary

Create the positioning and copywriting system for Soliton's new site. The output will define brand positioning, audience-specific messages, proof pillars, page-level copy templates, CTA vocabulary, claim-control rules, and follow-up inputs for design and content production.

## Technical Context

**Language/Version**: Markdown specification artifacts; no application runtime.

**Primary Dependencies**: Competitor analysis, semantic core, current content briefs, user-provided Soliton claims.

**Storage**: Repository markdown documents under `specs/002-positioning-copy-system/` and `07-build-specifications/`.

**Testing**: Checklist validation against success criteria and contract requirements.

**Target Platform**: Project documentation consumed by Codex during site design, content production, and implementation.

**Project Type**: Copywriting and positioning specification.

**Performance Goals**: Not applicable.

**Constraints**: No unsupported claims; no copied competitor copy; technical accuracy over generic marketing; every risky claim must have proof control.

**Scale/Scope**: At least 5 audience segments, 7 page templates, 25 message/CTA patterns, claim-control matrix.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Specification-first development: PASS.
- SEO and demand as product requirements: PASS. Copy rules map to semantic clusters and search intent.
- B2B/RFQ first: PASS. B2B audience and RFQ copy are required outputs.
- Integrations isolated and observable: PASS. No integration implementation in this feature.
- Analytics and search control: PASS. Copy templates include conversion events as later requirements.
- Maintainable by Codex: PASS. Outputs are repo-local markdown specifications.
- Quality gates: PASS. Claims are controlled and acceptance criteria are measurable.

## Project Structure

### Documentation (this feature)

```text
specs/002-positioning-copy-system/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── copywriting-positioning-output.md
└── tasks.md
```

### Project Output

```text
07-build-specifications/
└── copywriting-and-positioning-spec.md
```

**Structure Decision**: This feature produces a copywriting and positioning specification only. No source code is required.

## Phase 0: Research

Research inputs:

- `07-build-specifications/competitor-marketing-analysis.md`;
- `06-reports/03-semantic-core.md`;
- `03-content/content-briefs.md`;
- user-provided Soliton claims.

## Phase 1: Design & Contracts

Artifacts:

- `research.md` - positioning decisions and alternatives.
- `data-model.md` - copywriting system entities.
- `contracts/copywriting-positioning-output.md` - required output structure.
- `quickstart.md` - validation and usage guide.

## Complexity Tracking

No constitution violations.
