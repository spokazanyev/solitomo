# Implementation Plan: SEO Canonical And Validation Scripts

**Branch**: `028-seo-canonical-check`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Implement real `validate:seo` and `validate:schema` scripts; ensure trailing-slash redirects are enforced; keep canonical free of query parameters.

## Technical Context

**Touchpoints**:

- `apps/web/next.config.ts` (or `middleware.ts`) for trailing slash
- `apps/web/src/lib/seo/seo-registry.ts` (canonical)
- New: `apps/web/scripts/validate-seo.ts`, `apps/web/scripts/validate-schema.ts`
- `apps/web/package.json`

## Scope

### In Scope

- Trailing slash enforcement.
- SEO validator (titles, descriptions, H1, canonical, JSON-LD presence).
- Schema validator (JSON-LD types and shape).
- Reports under `06-reports/seo-audit-YYYY-MM-DD.md`.

### Out Of Scope

- External validator integration (Google Rich Results, Schema.org). These remain manual checks for spot validation.
- Performance audits.

## Validation

- `pnpm validate:seo` on a fresh build.
- `pnpm validate:schema` on the same.
- Curl trailing-slash checks.

## Risks

- Slow validator on 102 URLs. Mitigation: concurrent fetches with a small pool; rely on cached SSR.
- False positives on dynamic OG images. Mitigation: skip OG image routes by URL prefix.

## Follow-Ups

- Integrate validators into CI when CI is introduced.
- Add Lighthouse CI for performance/accessibility.
