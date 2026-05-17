# Implementation Plan: Price Valid Until

**Branch**: `031-price-valid-until`

**Spec**: [spec.md](./spec.md)

## Touchpoints

- `apps/web/src/lib/products/source-products.ts` — `createProductJsonLd()` Offer block
- Optional: introduce `priceUpdatedAt` field; if absent, gracefully omit.

## Notes

Owner-supplied prices have no date yet (TODO). Until then, `priceValidUntil` will be absent — which is acceptable for Google (it just omits the rich snippet detail).
