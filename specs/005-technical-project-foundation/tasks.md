# Tasks: Technical Project Foundation

**Input**: Design documents from `specs/005-technical-project-foundation/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/technical-foundation-output.md`

**Tests**: Baseline lint/build verification.

## Phase 1: Setup

- [x] T001 Create Spec Kit feature directory in `specs/005-technical-project-foundation/`
- [x] T002 Create feature specification in `specs/005-technical-project-foundation/spec.md`
- [x] T003 Create requirements checklist in `specs/005-technical-project-foundation/checklists/requirements.md`
- [x] T004 Create planning artifacts in `specs/005-technical-project-foundation/plan.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/technical-foundation-output.md`

---

## Phase 2: Foundational

- [x] T005 Create root pnpm workspace files in `package.json` and `pnpm-workspace.yaml`
- [x] T006 Create local Postgres config in `docker-compose.yml`
- [x] T007 Create root `.env.example`
- [x] T008 Scaffold Next.js TypeScript app in `apps/web`

---

## Phase 3: User Story 1 - Run The Web Application Locally (Priority: P1)

**Goal**: Provide a local runnable web app.

**Independent Test**: `pnpm dev` starts the app and homepage route exists.

- [x] T009 [US1] Add Soliton placeholder homepage in `apps/web/src/app/page.tsx`
- [x] T010 [US1] Add app styles aligned with current visual direction in `apps/web/src/app/globals.css`
- [x] T011 [US1] Ensure web app scripts support dev/build/lint in `apps/web/package.json`

---

## Phase 4: User Story 2 - Establish Maintainable Project Structure (Priority: P2)

**Goal**: Prepare code layout for future features.

**Independent Test**: Future feature paths are obvious and documented.

- [x] T012 [US2] Add Payload dependencies and config in `apps/web/src/payload.config.ts`
- [x] T013 [US2] Add minimal Payload collections directory in `apps/web/src/collections/`
- [x] T014 [US2] Add environment documentation in `apps/web/.env.example` or root `.env.example`

---

## Phase 5: User Story 3 - Provide Baseline Quality Gates (Priority: P3)

**Goal**: Provide repeatable verification commands.

**Independent Test**: Lint/build commands run from project root.

- [x] T015 [US3] Add root scripts for dev/build/lint/typecheck in `package.json`
- [x] T016 [US3] Run install and baseline verification commands
- [x] T017 [US3] Document known verification results in `07-build-specifications/technical-project-foundation.md`

---

## Phase 6: Polish & Validation

- [x] T018 Update `07-build-specifications/document-register.md` with technical foundation status
- [x] T019 Update `README.md` with local development links/commands
- [x] T020 Update `AGENTS.md` current Spec Kit plan reference
- [x] T021 Mark feature spec complete after verification

Note: Docker daemon was not running in the local environment, so PostgreSQL/admin runtime verification is documented as pending in `07-build-specifications/technical-project-foundation.md`.

## Dependencies & Execution Order

- T005-T008 are foundational.
- T009-T011 make the app runnable.
- T012-T014 establish CMS structure.
- T015-T017 establish verification.
- T018-T021 register results.
