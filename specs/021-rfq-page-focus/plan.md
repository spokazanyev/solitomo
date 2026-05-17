# Implementation Plan: RFQ Page Focus

**Branch**: `021-rfq-page-focus`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Split `B2BTemplate` into a generic `B2BLandingTemplate` for `/b2b/`, `/b2b/custom-pdu/`, `/b2b/integrators/`, `/b2b/tenders/`, and a focused `RfqPageTemplate` for `/b2b/request-quote/`. Add a post-submit success state. Remove the wireframe "Быстрый RFQ-макет" block from B2B landings (already required by spec `015`).

## Technical Context

**Touchpoints**:

- `apps/web/src/components/page-templates.tsx` (`B2BTemplate`, `TemplateBody`)
- `apps/web/src/components/RfqForm.tsx`
- New: `apps/web/src/components/templates/RfqPageTemplate.tsx`, `apps/web/src/components/templates/B2BLandingTemplate.tsx`

**Dependencies**:

- Spec `015-sitewide-public-copy-qa` removes "Быстрый RFQ-макет" and other internal markers; this spec adjusts surrounding structure.
- Spec `027-analytics-verification` instruments `begin_quote` / `quote_submitted` events on the new shell.

## Scope

### In Scope

- New `RfqPageTemplate`.
- Refactored `B2BLandingTemplate`.
- Branching in `TemplateBody` for the RFQ path.
- Post-submit success state inside `RfqForm`.

### Out Of Scope

- Form field changes.
- File attachment handling.
- New email notifications.

## Validation

- `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- DOM diff on `/b2b/request-quote/` vs `/b2b/`.
- Manual submission with cart and without cart.
- `pnpm public-copy-audit`.

## Risks

- Existing analytics may be tied to current selectors. Mitigation: keep stable test IDs on form fields.
- Search engine ranking for `/b2b/request-quote/` may drop if textual content shrinks dramatically. Mitigation: keep meta description and H1 strong; rely on `/b2b/` for content depth.

## Follow-Ups

- Spec `027-analytics-verification` will instrument the new success state.
- Future spec can add file attachments and conditional fields.
