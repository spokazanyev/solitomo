# Tasks: Price Valid Until

- [ ] T001 Add helper `derivePriceValidUntil(priceUpdatedAt?: string): string | undefined` in `source-products.ts`. Returns `priceUpdatedAt + 90 дней` formatted as `YYYY-MM-DD`.
- [ ] T002 Use it in `createProductJsonLd().offers`, compacted via `compactJsonLd`.
- [ ] T003 Verify schema on `/product/sp-8/` — field absent (no priceUpdatedAt yet).
- [ ] T004 Run `pnpm validate:schema`.
