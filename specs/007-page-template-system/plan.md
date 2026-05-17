# Implementation Plan: Page Template System

**Branch**: `007-page-template-system` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)

## Summary

Replace the single generic SEO placeholder with a reusable template system for each priority page type. Keep route registry, metadata, sitemap, robots, canonical and structured data intact while adding richer layouts for homepage, catalog, solution, knowledge, B2B, documents, and company pages.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.6, React 19.

**Primary Dependencies**: Existing Next app, SEO registry, Tailwind CSS. Add `lucide-react` for consistent UI icons.

**Storage**: Static template data in code for this stage. Future CMS-backed content later.

**Testing**: `pnpm lint`, `pnpm typecheck`, `pnpm build`, local curl/smoke render checks.

## Constitution Check

- Specification-first development: PASS.
- SEO and demand as product requirements: PASS.
- B2B/RFQ first: PASS.
- Integrations isolated and observable: PASS.
- Analytics and search control: PASS, no analytics implementation in this feature.
- Maintainable by Codex: PASS, data separated from templates.
- Quality gates: PASS.

## Source Structure

```text
apps/web/src/components/
├── SeoLandingPage.tsx
└── page-templates.tsx

apps/web/src/lib/seo/
├── seo-registry.ts
├── structured-data.ts
└── template-content.ts
```

## Complexity Tracking

No constitution violations.
