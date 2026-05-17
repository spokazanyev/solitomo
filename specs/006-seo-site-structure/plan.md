# Implementation Plan: SEO Site Structure

**Branch**: `006-seo-site-structure` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)

## Summary

Create a search-demand-driven SEO architecture for the Soliton site: landing matrix, technical SEO spec, canonical URL policy, Next.js sitemap and robots routes, metadata generation, BreadcrumbList JSON-LD, and static placeholder routes for priority pages.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.6, React 19.

**Primary Dependencies**: Next.js Metadata API, MetadataRoute sitemap/robots conventions.

**Storage**: Static SEO route registry for this stage; future CMS-backed pages later.

**Testing**: `pnpm lint`, `pnpm typecheck`, `pnpm build`, local curl checks for landing page, robots, sitemap.

**Target Platform**: Search-indexable public site, future production domain TBD.

## Constitution Check

- Specification-first development: PASS.
- SEO and demand as product requirements: PASS.
- B2B/RFQ first: PASS. B2B and RFQ URLs included.
- Integrations isolated and observable: PASS. No payment/delivery integration in this feature.
- Analytics and search control: PASS. SEO routes prepare Webmaster/Search Console submission.
- Maintainable by Codex: PASS. One route registry drives routes, sitemap, metadata.
- Quality gates: PASS. Build/lint/typecheck and curl verification required.

## Project Structure

```text
specs/006-seo-site-structure/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── seo-site-structure-output.md
└── tasks.md
```

```text
apps/web/src/
├── app/
│   ├── robots.ts
│   ├── sitemap.ts
│   ├── catalog/[...slug]/page.tsx
│   ├── solutions/[slug]/page.tsx
│   ├── knowledge/[slug]/page.tsx
│   ├── b2b/[[...slug]]/page.tsx
│   ├── documents/[[...slug]]/page.tsx
│   └── company/[slug]/page.tsx
├── components/SeoLandingPage.tsx
└── lib/seo/
    ├── seo-registry.ts
    └── structured-data.ts
```

## Complexity Tracking

No constitution violations.
