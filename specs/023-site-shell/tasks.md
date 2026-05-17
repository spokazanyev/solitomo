# Tasks: Site Shell

**Input**: [spec.md](./spec.md), [plan.md](./plan.md).

## Phase 1 - Header Component

- [ ] T001 Add `apps/web/src/components/site/SiteHeader.tsx` with the agreed navigation: Каталог, Подбор, Решения, Документы, Компания.
- [ ] T002 Include logotype, phone (from `getCompanyContacts()`), KP CTA and `RfqCartLink`.
- [ ] T003 Mount `SiteHeader` in `apps/web/src/app/(site)/layout.tsx` above `children`.

## Phase 2 - Remove Inline Headers

- [ ] T004 Delete the inline header in `apps/web/src/components/SeoLandingPage.tsx`.
- [ ] T005 Delete the inline header in `apps/web/src/components/product/ProductDetailPage.tsx`.
- [ ] T006 Ensure breadcrumbs still render after the header in both paths.

## Phase 3 - Mobile Drawer

- [ ] T007 Add `apps/web/src/components/site/MobileNavDrawer.tsx` using the WAI-ARIA disclosure pattern.
- [ ] T008 Trap focus while the drawer is open; close on ESC and backdrop click.
- [ ] T009 Add a hamburger trigger to `SiteHeader` visible only on `< md`.

## Phase 4 - Skip Link And Focus

- [ ] T010 Add a "Skip to content" anchor as the first focusable child of `<body>` in the layout.
- [ ] T011 Ensure `#main` exists on every page and is targetable.
- [ ] T012 Verify focus-visible styles on all interactive elements.

## Phase 5 - Verification

- [ ] T013 Run `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] T014 Run Lighthouse Accessibility on `/` and `/product/sp-8/`.
- [ ] T015 Manual responsive check on 375 / 768 / 1024 / 1440 viewports.
- [ ] T016 Capture screenshots, store in `07-build-specifications/023-site-shell/screenshots/`.
- [ ] T017 Run `pnpm public-copy-audit`.
