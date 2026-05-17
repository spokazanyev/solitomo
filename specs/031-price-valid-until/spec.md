# Feature Specification: Price Valid Until

**Feature Branch**: `031-price-valid-until`

**Created**: 2026-05-16

**Status**: Draft

**Input**: SEO review found that `Offer` schema on PDP lacks `priceValidUntil`. Google's product-snippet rules recommend including this field; absence triggers a warning in the testing tool.

## User Scenarios & Testing

### User Story 1 - Search Engines Get Price Validity (Priority: P2)

A product page contains `Offer.priceValidUntil = priceUpdatedAt + 90 days` when `priceUpdatedAt` is known. When unknown, the field is omitted gracefully (not rendered as empty).

**Acceptance Scenarios**:

1. **Given** a product has `priceUpdatedAt = 2026-05-16`, **When** PDP JSON-LD is rendered, **Then** `Offer.priceValidUntil = 2026-08-14`.
2. **Given** a product has no `priceUpdatedAt`, **When** PDP JSON-LD is rendered, **Then** `Offer.priceValidUntil` is absent.

## Requirements

- **FR-001**: `Offer.priceValidUntil` MUST be derived as `priceUpdatedAt + 90 days` (ISO date).
- **FR-002**: When `priceUpdatedAt` is missing, the field MUST be omitted (not empty string).
- **FR-003**: `compactJsonLd` MUST drop undefined values.

## Success Criteria

- **SC-001**: Google Rich Results Test on `/product/sp-8/` shows no missing-field warning for `Offer`.
- **SC-002**: `pnpm validate:schema` passes.
