# Feature Specification: RFQ And Cart

**Feature Branch**: `012-rfq-and-cart`

**Created**: 2026-05-15

**Status**: Implemented

**Input**: Continue SDD plan after `011-content-production-system`. Build the first working request-for-quote flow for Soliton: product-to-RFQ handoff, company/contact fields, project details, persistence, and admin-ready records.

## User Scenarios & Testing

### User Story 1 - Buyer Requests A Quote From Product Card (Priority: P1)

As a buyer, I want to open a product and request a commercial proposal with SKU already filled so I do not retype the product name.

**Independent Test**: Product page CTA links to `/b2b/request-quote/?sku=...&product=...`, and the form renders the SKU and product name.

### User Story 2 - Corporate Buyer Sends Project Details (Priority: P1)

As a corporate buyer or integrator, I want to send company details, contact, city, timing, line items, comments, and pasted technical specification.

**Independent Test**: `/b2b/request-quote/` contains a real form with item rows, company fields, contact fields, project comment, and technical specification area.

### User Story 3 - Request Is Saved (Priority: P1)

As a manager, I need every RFQ submission to be stored so it can be processed later.

**Independent Test**: Posting valid JSON to `/api/rfq-submit/` returns `200` and an ID. If Postgres is unavailable locally, a JSONL fallback file is written.

## Requirements

- **FR-001**: Product pages MUST pass SKU and product title to the RFQ page.
- **FR-002**: RFQ page MUST render a working form, not a static field mockup.
- **FR-003**: RFQ form MUST support multiple line items with SKU, name, and quantity.
- **FR-004**: RFQ form MUST collect customer type, company, INN, contact name, email, phone, city, deadline, comment, and technical specification text.
- **FR-005**: API MUST validate contact name and at least one contact method.
- **FR-006**: RFQ requests MUST be saved to Payload collection `rfq-requests` when Postgres is available.
- **FR-007**: API MUST provide a local JSONL fallback when Payload/Postgres is unavailable in local development.
- **FR-008**: RFQ collection MUST be readable/editable only by authenticated admin users.
- **FR-009**: Build MUST pass without requiring live form submission.
- **FR-010**: Baseline verification MUST pass: lint, typecheck, build, page smoke test, API smoke test.

## Success Criteria

- **SC-001**: `/b2b/request-quote/` returns `200` and renders the RFQ form.
- **SC-002**: `/product/s-16c13-2c19/` contains an RFQ link with SKU query data.
- **SC-003**: `/api/rfq-submit/` accepts a valid test request and returns `ok: true`.
- **SC-004**: `pnpm build` lists `/api/rfq-submit` as a dynamic route.

## Assumptions

- File upload is deferred; this stage accepts pasted TЗ text.
- Email notifications and analytics event dispatch are specified but implemented in later stages.
- Local JSONL fallback is for development only and is gitignored to avoid committing request data.
