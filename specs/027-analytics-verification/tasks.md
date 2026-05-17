# Tasks: Analytics Verification

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), `07-build-specifications/analytics-measurement-spec.md`.

## Phase 1 - Foundations

- [ ] T001 Verify and document counter IDs in `.env.example` and `07-build-specifications/analytics-measurement-spec.md`.
- [ ] T002 Add a thin `apps/web/src/lib/analytics/data-layer.ts` exposing `pushEvent(name, payload)`.

## Phase 2 - Client Instrumentation

- [ ] T003 In `ProductDetailPage`, push `view_item` on mount (client wrapper if needed).
- [ ] T004 In `AddToRfqButton`, push `add_to_rfq` on success.
- [ ] T005 In `RfqForm`, push `view_cart` on mount and `begin_quote` on first field focus.
- [ ] T006 In the success state, push `quote_submitted` with cart items, value and tracking ID.

## Phase 3 - Server-Side Hit

- [ ] T007 In the RFQ API route, send a Measurement Protocol hit to Metrika on successful submission.
- [ ] T008 Add a feature flag `SERVER_ANALYTICS_DISABLED` for dev.

## Phase 4 - Consent

- [ ] T009 Add a minimal cookie banner gating client tag initialisation; persist consent in `localStorage`.
- [ ] T010 Ensure server-side hits always fire (independent of client consent), since they are not personalised tracking.

## Phase 5 - Verification

- [ ] T011 Run the happy-path session with DevTools Network open; capture screenshots of the five events.
- [ ] T012 Repeat the session with client tags blocked; confirm server hit in Metrika's event log.
- [ ] T013 Run `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] T014 Document outcomes in `07-build-specifications/analytics-measurement-spec.md`.
