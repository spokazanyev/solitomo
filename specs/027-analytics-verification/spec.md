# Feature Specification: Analytics Verification

**Feature Branch**: `027-analytics-verification`

**Created**: 2026-05-15

**Status**: Draft

**Input**: `analytics-measurement-spec.md` defines required events, but the live components do not push them to `dataLayer`, and the configured counter IDs are not documented. Without verified analytics, the funnel "organic → RFQ" is invisible.

## User Scenarios & Testing

### User Story 1 - Marketing Sees The Full Conversion Funnel (Priority: P1)

Marketing opens Yandex.Metrika and Google Analytics 4 and sees events `view_item`, `add_to_rfq`, `view_cart`, `begin_quote`, `quote_submitted` with consistent `items[]`, `sku`, `value`, source page.

**Why this priority**: Without the funnel, business cannot evaluate ROI of organic SEO and B2B campaigns.

**Independent Test**: Live preview shows hits for each event during a happy-path browse-and-submit session.

**Acceptance Scenarios**:

1. **Given** the user opens a PDP, **When** the page is rendered, **Then** `view_item` is pushed once with the product data.
2. **Given** the user clicks "В корзину КП", **When** the action succeeds, **Then** `add_to_rfq` is pushed with the SKU and quantity.
3. **Given** the user opens the RFQ page, **When** the form is rendered, **Then** `view_cart` is pushed.
4. **Given** the user starts editing the form, **When** the first field gains focus, **Then** `begin_quote` is pushed.
5. **Given** the form submits successfully, **When** the success card renders, **Then** `quote_submitted` is pushed with cart items and `value`.

### User Story 2 - Adblock Users Still Counted (Priority: P2)

A buyer using an adblocker submits an RFQ. The server fires a Measurement Protocol hit so the event is counted even if client tags are blocked.

**Why this priority**: B2B audiences include adblock-heavy procurement laptops.

**Independent Test**: With client requests to Metrika blocked, the server-side hit appears in Metrika's API event log.

### User Story 3 - Developer Documents Counter IDs (Priority: P3)

A developer reads `analytics-measurement-spec.md` and finds the actual GA4 measurement ID and Metrika counter ID, the environment variable names and the staging/prod difference.

### Edge Cases

- What if the user disables JavaScript entirely? Server-side hits cover form submissions; other events are lost (acceptable).
- What if the same SKU is added multiple times? Each add fires its own event with `quantity`.

## Requirements

### Functional Requirements

- **FR-001**: System MUST push `view_item`, `add_to_rfq`, `view_cart`, `begin_quote`, `quote_submitted` to `dataLayer`.
- **FR-002**: Events MUST include `items[]` (sku, name, category, quantity, price), `value` and `currency` where applicable.
- **FR-003**: The RFQ API MUST send a server-side hit on successful submission.
- **FR-004**: Counter IDs MUST be configured via environment variables and documented.
- **FR-005**: Analytics MUST honor cookie consent (basic banner) before initialising client tags.

### Key Entities

- **AnalyticsEvent**: name, payload, timestamp.
- **EventEnvelope**: source, userId or anonymousId, sessionId.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Five required events visible during one happy-path manual session.
- **SC-002**: Server-side hit appears for a submission with client tags blocked.
- **SC-003**: Funnel report in Metrika returns non-zero numbers within 24 hours of the first user.

## Assumptions

- Yandex.Metrika is the primary counter; GA4 is secondary.
- Cookie consent is minimal banner; no GDPR/CCPA complexities for the Russian market in v1.
- The RFQ API has access to outbound HTTP to send server-side hits.
