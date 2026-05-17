# Tasks: Competitor Conversion Research

**Input**: Design documents from `specs/001-competitor-conversion-research/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/competitor-analysis-output.md`

**Tests**: Checklist validation only. This is a research/specification feature, not application code.

**Organization**: Tasks are grouped by user story to enable independent validation.

## Phase 1: Setup

**Purpose**: Prepare research structure and source list.

- [x] T001 Create Spec Kit feature directory in `specs/001-competitor-conversion-research/`
- [x] T002 Create feature specification in `specs/001-competitor-conversion-research/spec.md`
- [x] T003 Create requirements checklist in `specs/001-competitor-conversion-research/checklists/requirements.md`
- [x] T004 Create planning artifacts in `specs/001-competitor-conversion-research/plan.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/competitor-analysis-output.md`

---

## Phase 2: Foundational

**Purpose**: Establish benchmark source set and output contract.

- [x] T005 Define required output contract in `specs/001-competitor-conversion-research/contracts/competitor-analysis-output.md`
- [x] T006 [P] Review global benchmark sources and capture observations in `07-build-specifications/competitor-marketing-analysis.md`
- [x] T007 [P] Review Russian/local benchmark sources and capture observations in `07-build-specifications/competitor-marketing-analysis.md`

---

## Phase 3: User Story 1 - Identify Winning Conversion Patterns (Priority: P1)

**Goal**: Produce a competitor matrix and conversion pattern inventory.

**Independent Test**: Stakeholder can identify what competitor patterns Soliton should adapt and where they apply.

- [x] T008 [US1] Create competitor source table in `07-build-specifications/competitor-marketing-analysis.md`
- [x] T009 [US1] Document at least 20 marketing, UX, technical proof, and conversion patterns in `07-build-specifications/competitor-marketing-analysis.md`
- [x] T010 [US1] Map patterns to Soliton page types in `07-build-specifications/competitor-marketing-analysis.md`

---

## Phase 4: User Story 2 - Build Copywriting Inputs For Technical Pages (Priority: P2)

**Goal**: Produce copywriting guidance grounded in competitor patterns and technical buyer needs.

**Independent Test**: The next feature, `positioning-copy-system`, can start from this document.

- [x] T011 [US2] Add copywriting implications and message structures to `07-build-specifications/competitor-marketing-analysis.md`
- [x] T012 [US2] Add claim-control table to `07-build-specifications/competitor-marketing-analysis.md`
- [x] T013 [US2] Add technical proof requirements to `07-build-specifications/competitor-marketing-analysis.md`

---

## Phase 5: User Story 3 - Inform Visual Design Direction (Priority: P3)

**Goal**: Produce visual and UX guidance for later UI system specification.

**Independent Test**: The next visual design feature can derive page and component requirements from this document.

- [x] T014 [US3] Add visual design pattern recommendations to `07-build-specifications/competitor-marketing-analysis.md`
- [x] T015 [US3] Add page-type implications for homepage, category, product detail, B2B/RFQ, and knowledge pages to `07-build-specifications/competitor-marketing-analysis.md`

---

## Phase 6: Polish & Validation

- [x] T016 Validate `07-build-specifications/competitor-marketing-analysis.md` against `specs/001-competitor-conversion-research/quickstart.md`
- [x] T017 Update `07-build-specifications/document-register.md` with the competitor analysis document status
- [x] T018 Update `README.md` with link to the competitor analysis document

## Dependencies & Execution Order

- Setup tasks T001-T004 are complete.
- T006 and T007 can run in parallel.
- T008-T010 depend on source observations.
- T011-T013 depend on pattern inventory.
- T014-T015 depend on pattern inventory.
- T016-T018 run after the research document is complete.

## Implementation Strategy

Complete this feature as a research MVP before starting `positioning-copy-system`.
