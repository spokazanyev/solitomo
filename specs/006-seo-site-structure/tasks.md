# Tasks: SEO Site Structure

**Input**: Design documents from `specs/006-seo-site-structure/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/seo-site-structure-output.md`

## Phase 1: Setup

- [x] T001 Create Spec Kit feature directory in `specs/006-seo-site-structure/`
- [x] T002 Create feature specification in `specs/006-seo-site-structure/spec.md`
- [x] T003 Create requirements checklist in `specs/006-seo-site-structure/checklists/requirements.md`
- [x] T004 Create planning artifacts in `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, and contract file

## Phase 2: Documentation

- [x] T005 Create SEO technical specification in `07-build-specifications/seo-technical-spec.md`
- [x] T006 Create SEO landing matrix in `07-build-specifications/seo-landing-matrix.md`
- [x] T007 Update `01-site-structure/site-map.md`

## Phase 3: Implementation

- [x] T008 Add SEO route registry in `apps/web/src/lib/seo/seo-registry.ts`
- [x] T009 Add structured-data helpers in `apps/web/src/lib/seo/structured-data.ts`
- [x] T010 Add shared SEO landing page component
- [x] T011 Add sitemap and robots routes
- [x] T012 Add catalog, solution, knowledge, B2B, document, and company route skeletons
- [x] T013 Set trailing slash canonical policy in `next.config.ts`

## Phase 4: Validation

- [x] T014 Run `pnpm lint`
- [x] T015 Run `pnpm typecheck`
- [x] T016 Run `pnpm build`
- [x] T017 Smoke-test landing page, redirect, robots, sitemap, canonical, JSON-LD

## Phase 5: Project Updates

- [x] T018 Update document register
- [x] T019 Update README next step
- [x] T020 Update `AGENTS.md` current Spec Kit plan reference
- [x] T021 Update `.specify/feature.json`
