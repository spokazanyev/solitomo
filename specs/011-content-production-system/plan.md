# Implementation Plan: Content Production System

**Branch**: `011-content-production-system` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)

## Summary

Create a repeatable content production layer and replace public draft placeholders with useful first-release content for knowledge pages and catalog FAQ blocks.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.6, React 19.

**Primary Dependencies**: Existing page templates, SEO route registry, `template-content.ts`, structured data helpers.

**Testing**: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `curl` smoke tests.

## Source Structure

```text
apps/web/src/lib/seo/template-content.ts
apps/web/src/lib/seo/structured-data.ts
apps/web/src/components/page-templates.tsx
apps/web/src/components/SeoLandingPage.tsx
07-build-specifications/content-production-plan.md
```

## Constitution Check

- Specification-first development: PASS.
- SEO and demand as product requirements: PASS.
- B2B/RFQ first: PASS.
- Claim-control: PASS.
- Quality gates: PASS.
