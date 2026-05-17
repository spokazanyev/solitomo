# Tasks: Company Contacts

**Input**: [spec.md](./spec.md), [plan.md](./plan.md).

## Phase 1 - Data Collection

- [ ] T001 Collect verified contacts from the site owner: legal name, brand name, INN, KPP, OGRN, legal address, actual address, working hours, phones (sales/support), emails, socials.
- [ ] T002 Store the verified record in `00-source-data/company/contacts.yaml` with the source line for each field.

## Phase 2 - Payload Collection

- [ ] T003 Add Payload global or singleton collection `company-contacts` in `apps/web/src/collections/CompanyContacts.ts`.
- [ ] T004 Register the collection or global in `apps/web/src/payload.config.ts`.
- [ ] T005 Run `pnpm --filter @soliton/web generate:types` to refresh types.
- [ ] T006 Seed the singleton from `contacts.yaml` via a `seed-contacts` script.

## Phase 3 - Server Helper

- [ ] T007 Add `apps/web/src/lib/company/get-company-contacts.ts` returning a typed contacts record. Provide a fallback for the empty state.

## Phase 4 - Public Template

- [ ] T008 Add `apps/web/src/components/templates/ContactsTemplate.tsx` with sections: Sales, Support, Office, Legal requisites, Working hours.
- [ ] T009 Update `apps/web/src/components/page-templates.tsx` `TemplateBody` to render `ContactsTemplate` for `route.path === "/company/contacts/"`.

## Phase 5 - Footer And Header

- [ ] T010 Use `getCompanyContacts()` in `apps/web/src/components/site/SiteFooter.tsx` to show the primary phone and email.
- [ ] T011 After spec `023-site-shell` lands, wire the primary phone into the header CTA cluster.

## Phase 6 - Verification

- [ ] T012 Manual visual check on `/company/contacts/`, footer, header.
- [ ] T013 Run `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- [ ] T014 Confirm `view-source` of `/company/contacts/` contains both `tel:` and `mailto:`.
- [ ] T015 Re-run public-copy audit (`pnpm public-copy-audit`) to confirm no regressions.
