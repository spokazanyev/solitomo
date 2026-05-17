# Tasks: Product Detail Redesign

**Input**: [spec.md](./spec.md), [plan.md](./plan.md).

## Phase 1 - Hero Restructure

- [ ] T001 Rebuild the PDP hero section in `apps/web/src/components/product/ProductDetailPage.tsx` as a three-column grid (`minmax(0,520px)_1fr_360px`) on `lg+`, single column on mobile.
- [ ] T002 Move the "вторая секция с фото" content into the hero; remove the separate fallback fotosection.
- [ ] T003 Verify spec summary, badges and price aside line up with the gallery.

## Phase 2 - Client Gallery

- [ ] T004 Add `apps/web/src/components/product/ProductGallery.tsx` (client component) with active-image state and thumbnail row.
- [ ] T005 Server renders the first image and a `<noscript>` fallback; client hydrates state.
- [ ] T006 Add the lightbox using `<dialog>` element; trap focus and close on ESC and backdrop click.

## Phase 3 - Breadcrumbs

- [ ] T007 Add helper `resolveProductCategoryBreadcrumb(product)` in `apps/web/src/lib/products/source-products.ts` that returns category label and href.
- [ ] T008 Update the breadcrumb DOM in `ProductDetailPage` and the `createProductBreadcrumbJsonLd` payload to include the category node.

## Phase 4 - Mobile Sticky CTA

- [ ] T009 Add `apps/web/src/components/product/MobileStickyCta.tsx` rendering price and primary action, fixed bottom on `md-`, hidden on `lg+`.
- [ ] T010 Use `IntersectionObserver` on the hero CTA so the sticky bar appears only after the hero scrolls out of view.
- [ ] T011 Add `padding-bottom: env(safe-area-inset-bottom)` to prevent iOS overlap.

## Phase 5 - Coordination With Spec 023

- [ ] T012 After spec `023-site-shell` lands, remove the inline `<header>` from `ProductDetailPage` and rely on the shared `SiteHeader`.

## Phase 6 - Verification

- [ ] T013 Run `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] T014 Sample five PDPs (different categories), capture before/after screenshots, store in `07-build-specifications/022-product-detail-redesign/screenshots/`.
- [ ] T015 Validate BreadcrumbList JSON-LD with the Google testing tool.
- [ ] T016 Run `pnpm public-copy-audit`.
