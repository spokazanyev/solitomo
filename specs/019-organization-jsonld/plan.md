# Implementation Plan: Organization JSON-LD Enrichment

**Branch**: `019-organization-jsonld`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Enrich the Organization JSON-LD emitted on every public page with telephone, email, address, contactPoint, sameAs and logo, sourced from the `company-contacts` Payload record. Add an optional LocalBusiness entity on the contacts page when explicitly enabled.

## Technical Context

**Touchpoints**:

- `apps/web/src/lib/seo/structured-data.ts` (`createOrganizationJsonLd`)
- `apps/web/src/components/SeoLandingPage.tsx` (already calls `createOrganizationJsonLd` on home)
- `apps/web/src/components/templates/ContactsTemplate.tsx` (added by spec `018-company-contacts`)

**Dependencies**:

- Spec `018-company-contacts` defines the singleton record.
- Spec `028-seo-canonical-check` adds the real schema validator.

## Scope

### In Scope

- Refactor `createOrganizationJsonLd()` to accept a contacts record.
- Add `createLocalBusinessJsonLd()` for the opt-in case.
- Update all callers.

### Out Of Scope

- Knowledge graph submission, GMB/Yandex.Business setup.
- Author entity (`Person`) for knowledge pages.

## Validation

- Google Rich Results Test for `/` and `/company/contacts/` — no errors.
- `pnpm validate:schema` (after spec `028`).
- Visual check: home view-source still contains one Organization JSON-LD block, now with extra fields.

## Risks

- Empty fields rendered as `""` or `[]` cause validator warnings. Mitigation: helper drops empty values before serialization.
- Stale logo URL after Payload migration. Mitigation: use `getCompanyContacts().logo?.url` and fall back to `/brand/logo.svg`.

## Follow-Ups

- Add `BreadcrumbList` enrichments and `Article` schema on knowledge pages — separate spec when knowledge content is finalised.
