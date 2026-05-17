# Tasks: Product Catalog Foundation

**Input**: Design documents from `specs/004-product-catalog-foundation/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/catalog-foundation-output.md`

**Tests**: Checklist validation only. This is a data/specification feature.

## Phase 1: Setup

- [x] T001 Create Spec Kit feature directory in `specs/004-product-catalog-foundation/`
- [x] T002 Create feature specification in `specs/004-product-catalog-foundation/spec.md`
- [x] T003 Create requirements checklist in `specs/004-product-catalog-foundation/checklists/requirements.md`
- [x] T004 Create planning artifacts in `specs/004-product-catalog-foundation/plan.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/catalog-foundation-output.md`

---

## Phase 2: Foundational

- [x] T005 Review raw assortment JSON, assortment map, semantic core, UI spec, and copywriting spec
- [x] T006 Create `07-build-specifications/product-data-spec.md`
- [x] T007 Create `07-build-specifications/product-attributes-spec.md`
- [x] T008 Create `07-build-specifications/product-import-spec.md`

---

## Phase 3: User Story 1 - Normalize The Existing Soliton Assortment (Priority: P1)

**Goal**: Define a model that imports all 66 products without data loss.

**Independent Test**: Every raw field has target mapping or preservation rule.

- [x] T009 [US1] Add source data summary and raw field mapping to `07-build-specifications/product-data-spec.md`
- [x] T010 [US1] Add product, category, media, document, price, stock, and completeness models to `07-build-specifications/product-data-spec.md`
- [x] T011 [US1] Add import source and duplicate-prevention rules to `07-build-specifications/product-import-spec.md`

---

## Phase 4: User Story 2 - Support Technical Filters And SEO Landing Pages (Priority: P2)

**Goal**: Define filterable attributes and badge rules.

**Independent Test**: High-priority SEO clusters can be mapped to controlled attributes.

- [x] T012 [US2] Add attribute groups and controlled values to `07-build-specifications/product-attributes-spec.md`
- [x] T013 [US2] Add filter, badge, table, and SEO landing mappings to `07-build-specifications/product-attributes-spec.md`
- [x] T014 [US2] Add category taxonomy and SEO field rules to `07-build-specifications/product-data-spec.md`

---

## Phase 5: User Story 3 - Prepare For Commerce And Integrations (Priority: P3)

**Goal**: Define fields for payment, delivery, MойСклад, analytics, and claim/proof control.

**Independent Test**: Future commerce/integration specs can reference product fields without changing the model.

- [x] T015 [US3] Add commerce, fiscal, logistics, integration, analytics, and proof fields to `07-build-specifications/product-data-spec.md`
- [x] T016 [US3] Add data completeness flags and manual review queue rules to `07-build-specifications/product-import-spec.md`
- [x] T017 [US3] Add open data gaps and enrichment priorities to all output documents as needed

---

## Phase 6: Polish & Validation

- [x] T018 Validate outputs against `specs/004-product-catalog-foundation/quickstart.md`
- [x] T019 Update `07-build-specifications/document-register.md` with product specs status
- [x] T020 Update `README.md` with links to product specs
- [x] T021 Update `AGENTS.md` current Spec Kit plan reference

## Dependencies & Execution Order

- T005-T008 are foundational.
- T009-T011 complete current assortment normalization.
- T012-T014 complete filter/SEO support.
- T015-T017 complete commerce/integration readiness.
- T018-T021 validate and register the output.
