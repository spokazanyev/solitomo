# Implementation Plan: Brand Alternate Name

**Branch**: `029-brand-alternate-name`

**Date**: 2026-05-16

**Spec**: [spec.md](./spec.md)

## Summary

Add `alternateName: ["Soliton"]` to Organization JSON-LD; mention both spellings on `/company/about/` and in its meta description.

## Touchpoints

- `apps/web/src/lib/seo/structured-data.ts` (`createOrganizationJsonLd`)
- `apps/web/src/components/page-templates.tsx` (`CompanyTemplate`)
- `apps/web/src/lib/seo/seo-registry.ts` (about route description)

## Validation

- `pnpm validate:schema`
- `curl /` — Organization JSON-LD contains `alternateName`
- `/company/about/` body contains "Солитон (Soliton)"
