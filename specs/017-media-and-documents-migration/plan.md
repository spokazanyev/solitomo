# Implementation Plan: Media And Documents Migration

**Branch**: `017-media-and-documents-migration`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Take ownership of every product image and PDF that the public site currently hot-links from `soliton1.ru`. Cache assets locally, seed them into Payload `media`/`documents`, switch public components to Payload-backed URLs, and serve documents through an internal API. This is the prerequisite for all subsequent UI work because every other change touches images or document links.

## Technical Context

**Runtime**: Next.js 16, React 19, Payload 3, PostgreSQL.

**Current Source**: `00-source-data/assortment/soliton1_assortment_raw.json`, consumed by `apps/web/src/lib/products/source-products.ts`.

**Current Public Components**:

- `apps/web/src/components/SeoLandingPage.tsx` (hero, preload tags)
- `apps/web/src/components/page-templates.tsx` (product cards, documents listing)
- `apps/web/src/components/catalog/CatalogFilterableList.tsx`
- `apps/web/src/components/product/ProductDetailPage.tsx`

**Constraints**: Public site must keep working during migration. Source JSON file remains the authoritative product list until the public Payload cutover (spec `017-payload-public-cutover`, not in this scope).

## Scope

### In Scope

- Asset inventory and idempotent download script.
- Local cache under `apps/web/public/legacy/...` or `00-source-data/legacy-assets/...`.
- Payload seeding for `media` and `documents` with checksum deduplication.
- Public component refactor to use Payload-backed URLs.
- Internal `/documents/files/[id]` route.
- SVG placeholder for products without images.
- Removal of `soliton1.ru` preload tags.

### Out Of Scope

- Photo retouching or replacement.
- New product photography.
- Switching the public site to Payload as the catalog source (separate spec).
- CDN configuration.

## Architecture

```
soliton1.ru assets
        │
        ▼
download-assets.ts ──► apps/web/public/legacy/<sku>/<filename>
        │
        ▼
seed-media-from-legacy.ts ──► Payload media / documents collections
        │
        ▼
source-products.ts (resolveProductImages) ──► /api/media or /documents/files/[id]
        │
        ▼
React components (next/image, <a href>)
```

## Validation

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm validate:catalog`
- `curl -s http://localhost:3000/ | grep -c soliton1.ru` → `0`
- `curl -s http://localhost:3000/catalog/pdu/ | grep -c soliton1.ru` → `0`
- `curl -s http://localhost:3000/product/sp-8/ | grep -c soliton1.ru` → `0`
- Lighthouse mobile run, LCP < 2.5s

## Rollout

1. Inventory and download.
2. Seed Payload from local cache.
3. Land component refactor behind `LEGACY_MEDIA_FALLBACK` flag (default `true` initially).
4. Verify visually and via SSR sweep.
5. Flip default to `false`.
6. Remove the flag and legacy URL path in a follow-up cleanup.

## Risks

- `soliton1.ru` rate-limits the download script. Mitigation: throttle to 1–2 req/sec, retry with backoff.
- Duplicate documents (same file, different filenames). Mitigation: dedup by SHA-256.
- Large PDFs cause memory pressure if buffered. Mitigation: stream via `ReadableStream`.

## Follow-Ups

- `017-payload-public-cutover`: read products and category data from Payload (separate spec).
- Manufacturing photoshoot for `020-homepage-product-first` showcase.
