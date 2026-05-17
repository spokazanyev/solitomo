# Tasks: Homepage Product-First

**Input**: [spec.md](./spec.md), [plan.md](./plan.md).

## Phase 1 - Hero

- [ ] T001 Rebuild `HomeHero` in `apps/web/src/components/SeoLandingPage.tsx`: replace right-side "Для закупки" panel with a hero product image (next/image). Keep CTAs and trust bullets.
- [ ] T002 Add `priority` and `sizes` to the hero image; set width/height to avoid CLS.

## Phase 2 - Proof Metrics

- [ ] T003 Add `HomeProofBand` component in `apps/web/src/components/page-templates.tsx` (or new file under `components/home/`).
- [ ] T004 Update `homeProofMetrics` in `apps/web/src/lib/seo/template-content.ts`: replace `RFQ` with `КП` and confirm wording.
- [ ] T005 Insert `HomeProofBand` between `HomeHero` and `FeaturedProducts` in `HomeTemplate`.

## Phase 3 - Trust Signals With Proof Links

- [ ] T006 Extend `TrustSignal` type in `template-content.ts` with optional `href`.
- [ ] T007 Set href for each existing signal: `/company/about/`, `/company/production/`, `/documents/certificates/`, `/knowledge/kak-vybrat-pdu/`.
- [ ] T008 Update `TrustBand` to render a `Link` when `href` is present.
- [ ] T009 Include `TrustBand` in `HomeTemplate` (after `UseCaseBand`).

## Phase 4 - Manufacturing Showcase

- [ ] T010 Add `ManufacturingShowcase` component with three tiles (sourcing/sourcing/assembly/quality, copy per `copywriting-and-positioning-spec.md`).
- [ ] T011 Insert showcase into `HomeTemplate` between `TrustBand` and the `LinkGrid` section.

## Phase 5 - Non-Home Hero Cleanup

- [ ] T012 In `SeoLandingPage.tsx`, remove the right-side `aside` rendering `route.keywords`.
- [ ] T013 Merge `route.summary` content into the left column or into a single subtitle line.

## Phase 6 - Open Graph Images

- [ ] T014 Add `apps/web/src/app/(site)/opengraph-image.tsx` rendering a 1200×630 image with logo and H1 (use `ImageResponse`).
- [ ] T015 Add `apps/web/src/app/(site)/catalog/[...slug]/opengraph-image.tsx` for category pages.
- [ ] T016 Add `apps/web/src/app/(site)/product/[slug]/opengraph-image.tsx` for product pages with product photo.
- [ ] T017 Update `apps/web/src/app/(site)/layout.tsx` metadata to declare `openGraph` and `twitter` defaults.

## Phase 7 - Verification

- [ ] T018 Run `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] T019 Run `pnpm public-copy-audit` (spec `015`).
- [ ] T020 Manual visual check on `/`, `/catalog/pdu/`, `/knowledge/kak-vybrat-pdu/`, `/b2b/`, `/solutions/pdu-dlya-servernogo-shkafa/`.
- [ ] T021 Run Twitter Card Validator and Telegram preview on `/` and `/product/sp-8/`.
- [ ] T022 Capture before/after screenshots into `07-build-specifications/020-homepage-product-first/screenshots/`.
