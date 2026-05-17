# Implementation Plan: Analytics Verification

**Branch**: `027-analytics-verification`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Wire client-side `dataLayer` events through the funnel, add a server-side Measurement Protocol hit on RFQ submission, document counter IDs and consent flow.

## Technical Context

**Touchpoints**:

- `apps/web/src/components/analytics/AnalyticsScripts.tsx`
- `apps/web/src/components/rfq/RfqCart.tsx` (`AddToRfqButton`)
- `apps/web/src/components/RfqForm.tsx`
- `apps/web/src/components/product/ProductDetailPage.tsx` (`view_item` trigger)
- RFQ API route in `apps/web/src/app/api/...`
- `.env.example`, `07-build-specifications/analytics-measurement-spec.md`

## Scope

### In Scope

- Client event helpers (`pushEvent`) and instrumentation across the funnel.
- Server-side Metrika Measurement Protocol hit on submission.
- Counter IDs via `.env`.
- Minimal cookie consent banner (Russian market scope).

### Out Of Scope

- A/B testing framework.
- Cross-domain tracking.
- CRM integration.

## Validation

- Manual happy-path browse-and-submit with DevTools Network filter `mc.yandex.ru`.
- With client tags blocked, confirm server-side hit via Metrika debug console.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Risks

- Consent banner blocks events for first-time visitors. Mitigation: document the trade-off and ensure server-side hits cover submissions regardless.
- Measurement Protocol mismatch with Metrika's expected schema. Mitigation: small wrapper with explicit field names.

## Follow-Ups

- A/B testing — separate spec when MVP traffic is sufficient.
- Off-the-shelf tag manager evaluation.
