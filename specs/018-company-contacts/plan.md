# Implementation Plan: Company Contacts

**Branch**: `018-company-contacts`

**Date**: 2026-05-15

**Spec**: [spec.md](./spec.md)

## Summary

Introduce a singleton Payload collection for company contacts, a dedicated `ContactsTemplate` for `/company/contacts/`, and a single source for phones/emails used by the contacts page, footer, header and Organization JSON-LD.

## Technical Context

**Runtime**: Next.js 16, React 19, Payload 3.

**Touchpoints**:

- `apps/web/src/app/(site)/company/[slug]/page.tsx`
- `apps/web/src/components/page-templates.tsx` (`CompanyTemplate`)
- `apps/web/src/components/site/SiteFooter.tsx`
- `apps/web/src/lib/seo/structured-data.ts` (`createOrganizationJsonLd`)
- `apps/web/src/payload.config.ts`

**Inputs**: Spec `019-organization-jsonld` consumes the same helper.

## Scope

### In Scope

- Payload `company-contacts` collection (singleton).
- Server helper `getCompanyContacts()`.
- `ContactsTemplate` rendered for `/company/contacts/`.
- Footer and header integration.
- Source data file `00-source-data/company/contacts.yaml` for initial seed.

### Out Of Scope

- Map widget.
- Multilingual.
- Live chat / chatbot.

## Architecture

```
00-source-data/company/contacts.yaml
        │
        ▼ seed (one-shot)
Payload company-contacts (singleton)
        │
        ▼ getCompanyContacts()
ContactsTemplate / SiteFooter / SiteHeader / createOrganizationJsonLd()
```

## Validation

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `/company/contacts/` renders phones, emails, requisites.
- `view-source` contains `tel:` and `mailto:`.
- `createOrganizationJsonLd()` JSON contains `telephone`, `email`, `address`.

## Risks

- Verified contact data may not be ready. Mitigation: ship the page with a placeholder `Контакты согласовываются` and the RFQ CTA; do not block other specs.
- Payload singleton pattern: confirm chosen approach (collection with `limit: 1` admin guard, or globals). Document the choice in the plan and tasks.

## Follow-Ups

- `019-organization-jsonld`: consume `getCompanyContacts()` to fill the schema fields.
- `026-data-and-content-polish`: surface support escalation policy in the footer if applicable.
