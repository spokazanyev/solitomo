# Tasks: RFQ And Cart

**Input**: Design documents from `specs/012-rfq-and-cart/`

## Phase 1: Setup

- [x] T001 Create Spec Kit feature directory
- [x] T002 Create feature specification
- [x] T003 Create requirements checklist
- [x] T004 Create plan, research, data model, contract, and quickstart

## Phase 2: Implementation

- [x] T005 Add Payload collection `rfq-requests`
- [x] T006 Add API route `/api/rfq-submit/`
- [x] T007 Add local JSONL fallback for development
- [x] T008 Add client RFQ form
- [x] T009 Render RFQ form on `/b2b/request-quote/`
- [x] T010 Pass product SKU/title from product page to RFQ form
- [x] T011 Add validation for contact name and contact method

## Phase 3: Documentation

- [x] T012 Create `checkout-rfq-spec.md`
- [x] T013 Update document register
- [x] T014 Update README next step
- [x] T015 Update `.gitignore` for local request files
- [x] T016 Update `AGENTS.md` and `.specify/feature.json`

## Phase 4: Validation

- [x] T017 Run `pnpm lint`
- [x] T018 Run `pnpm typecheck`
- [x] T019 Run `pnpm build`
- [x] T020 Smoke-test RFQ page
- [x] T021 Smoke-test RFQ API
