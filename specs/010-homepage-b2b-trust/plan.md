# Implementation Plan: Homepage B2B Trust

**Branch**: `010-homepage-b2b-trust` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)

## Summary

Turn the homepage and B2B template into stronger conversion pages: manufacturer proof, real product visuals, visible trust signals, use-case routing, and RFQ-oriented corporate purchasing copy.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.6, React 19.

**Primary Dependencies**: Existing Next app, SEO registry, product adapter, Tailwind CSS, `lucide-react`.

**Storage**: Static template content plus real products from the source product adapter.

**Testing**: `pnpm lint`, `pnpm typecheck`, `pnpm build`, homepage and B2B route smoke checks.

## Constitution Check

- Specification-first development: PASS.
- SEO and demand as product requirements: PASS.
- B2B/RFQ first: PASS.
- Integrations isolated and observable: PASS.
- Analytics and search control: PASS, no analytics implementation in this feature.
- Maintainable by Codex: PASS, content arrays remain isolated in `template-content.ts`.
- Quality gates: PASS.

## Source Structure

```text
apps/web/src/components/SeoLandingPage.tsx
apps/web/src/components/page-templates.tsx
apps/web/src/lib/seo/template-content.ts
```

## Complexity Tracking

No constitution violations.
