# Tasks: Organization JSON-LD Enrichment

**Input**: [spec.md](./spec.md), [plan.md](./plan.md).

## Phase 1 - Refactor Helper

- [ ] T001 Update `createOrganizationJsonLd()` in `apps/web/src/lib/seo/structured-data.ts` to accept a `CompanyContacts` argument.
- [ ] T002 Map fields: `name`, `legalName`, `url`, `logo`, `image`, `description`, `telephone`, `email`, `address`, `contactPoint[]`, `sameAs[]`, `foundingDate`.
- [ ] T003 Add a `compactJsonLd()` utility that strips `undefined`, empty strings and empty arrays before serialization.

## Phase 2 - LocalBusiness

- [ ] T004 Add `createLocalBusinessJsonLd(contacts)` in `structured-data.ts`, returning `undefined` when `contacts.publishLocalBusiness !== true`.
- [ ] T005 Render the LocalBusiness JSON-LD block in `ContactsTemplate` next to Organization JSON-LD.

## Phase 3 - Callers

- [ ] T006 Update `SeoLandingPage.tsx` to fetch contacts and pass to `createOrganizationJsonLd`.
- [ ] T007 Ensure the JSON-LD is emitted exactly once per page (home keeps it; non-home should also emit it to enable cross-page consistency, unless the SEO spec forbids it).

## Phase 4 - Verification

- [ ] T008 Run Google Rich Results Test on `/`, `/company/contacts/`, `/product/sp-8/`, `/catalog/pdu/`.
- [ ] T009 Run `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- [ ] T010 Run `pnpm validate:schema` after spec `028` is implemented.
