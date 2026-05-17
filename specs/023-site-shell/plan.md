# Implementation Plan: Site Shell

**Branch**: `023-site-shell`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Extract a single `SiteHeader` component, mounted in `app/(site)/layout.tsx`, that renders on every public page. Remove inline headers from `SeoLandingPage` and `ProductDetailPage`. Add a mobile drawer with focus trap and a skip-link.

## Technical Context

**Touchpoints**:

- `apps/web/src/app/(site)/layout.tsx`
- `apps/web/src/components/site/SiteHeader.tsx` (new)
- `apps/web/src/components/site/MobileNavDrawer.tsx` (new)
- `apps/web/src/components/SeoLandingPage.tsx` (remove inline header)
- `apps/web/src/components/product/ProductDetailPage.tsx` (remove inline header)
- `apps/web/src/components/rfq/RfqCart.tsx` (`RfqCartLink` used by header)

## Scope

### In Scope

- New `SiteHeader` and `MobileNavDrawer`.
- Layout-level mount.
- Skip-link and focus styles.
- Removal of inline headers from page-specific components.

### Out Of Scope

- Mega-menu with subcategories.
- Search bar (separate spec).
- Language selector.

## Validation

- `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- Lighthouse Accessibility ≥ 95.
- Manual responsive check on 375 / 768 / 1024 / 1440 viewports.
- SSR diff: header markup identical across sampled URLs.

## Risks

- PDP relied on its own header to add product-specific links. Mitigation: confirm none of those links are unique; if needed, surface them in the product hero, not the global header.
- Drawer accessibility patterns are easy to break. Mitigation: follow the WAI-ARIA disclosure pattern; add manual a11y test cases.

## Follow-Ups

- Search bar in header — separate spec.
- Sticky header behaviour on scroll.
