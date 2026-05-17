# Tasks: Media And Documents Migration

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), `07-build-specifications/sitewide-content-design-review-v2.md`, `07-build-specifications/sitewide-content-design-review-v3.md`.

## Phase 1 - Inventory

- [ ] T001 Add `apps/web/scripts/inventory-media.ts` that walks `00-source-data/assortment/soliton1_assortment_raw.json` and outputs `06-reports/06-asset-inventory.md` (URL, size, content-type, status).
- [ ] T002 Run inventory and verify all referenced URLs return 200; flag any unreachable assets.

## Phase 2 - Download

- [ ] T003 Add `apps/web/scripts/download-assets.ts` that downloads inventoried assets to `apps/web/public/legacy/<sku>/<filename>` with rate limiting and SHA-256 checksums.
- [ ] T004 Run download and verify file count matches inventory; commit cache or document storage strategy.
- [ ] T005 Extend `.gitignore` if assets are tracked outside git (decide and document in plan).

## Phase 3 - Payload Seeding

- [ ] T006 Add `apps/web/scripts/seed-media-from-legacy.ts` that uploads cached files into Payload `media` and `documents`, deduplicating by SHA-256 and linking to products by SKU.
- [ ] T007 Run `seed-media-from-legacy:dry-run` and review the diff.
- [ ] T008 Run `seed-media-from-legacy` against the local Payload DB and confirm rows in `media` and `documents`.

## Phase 4 - Public Component Refactor

- [ ] T009 Add `resolveProductImages(product)` and `resolveProductDocuments(product)` helpers in `apps/web/src/lib/products/source-products.ts` returning Payload-backed URLs.
- [ ] T010 Replace `<img src="https://soliton1.ru/...">` with `next/image` in `apps/web/src/components/catalog/CatalogFilterableList.tsx` (`ProductCard`).
- [ ] T011 Replace same in `apps/web/src/components/page-templates.tsx` (`ProductCard` and `FeaturedProducts`).
- [ ] T012 Replace same in `apps/web/src/components/product/ProductDetailPage.tsx` (`ProductImage` and gallery thumbnails).
- [ ] T013 Update `apps/web/src/components/SeoLandingPage.tsx` to remove explicit `soliton1.ru` preload tags; keep at most one preload for the home hero image, sourced from Payload.
- [ ] T014 Configure `next.config.ts` `images.remotePatterns` if the CDN domain differs from the app origin.

## Phase 5 - Documents API

- [ ] T015 Add `apps/web/src/app/api/documents/[id]/route.ts` streaming PDF bodies from Payload with `Content-Type: application/pdf`, `Content-Disposition: inline`, `Cache-Control: public, max-age=2592000`, `X-Robots-Tag: noindex`.
- [ ] T016 Update `getDocumentRegistry()` in `apps/web/src/components/page-templates.tsx` to point at `/documents/files/<id>` and to dedupe by checksum.
- [ ] T017 Update product detail "Documents" tab to use the same internal URL.

## Phase 6 - Placeholder

- [ ] T018 Add `apps/web/public/placeholders/pdu-silhouette.svg` and a small helper to render it with the SKU label.
- [ ] T019 Replace `<LayoutGrid>` placeholders in catalog and product cards with the new SVG.

## Phase 7 - Verification

- [ ] T020 Run SSR sweep: `node -e "..."` or curl-based script that asserts `grep -c soliton1.ru` is `0` across `/sitemap.xml` URLs.
- [ ] T021 Run Lighthouse mobile on `/`, `/catalog/pdu/`, `/product/sp-8/` and record LCP, CLS in `06-reports/06-asset-inventory.md`.
- [ ] T022 Run `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm validate:catalog`.
- [ ] T023 Manual visual check: homepage, three catalog pages, one PDP, `/documents/`.

## Phase 8 - Cleanup

- [ ] T024 Remove `LEGACY_MEDIA_FALLBACK` flag once the migration is live in dev and stage.
- [ ] T025 Document the migration outcome and any orphan assets in `06-reports/06-asset-inventory.md`.
