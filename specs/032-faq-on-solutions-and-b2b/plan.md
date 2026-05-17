# Implementation Plan: FAQ on Solutions and B2B

**Branch**: `032-faq-on-solutions-and-b2b`

**Spec**: [spec.md](./spec.md)

## Touchpoints

- `apps/web/src/lib/seo/template-content.ts` — add `solutionFaqsFor(path)`, `b2bFaqsFor(path)`.
- `apps/web/src/components/page-templates.tsx` — render FAQ block + JSON-LD in `SolutionTemplate` and `B2BTemplate` (non-RFQ branch).
- `apps/web/src/components/SeoLandingPage.tsx` — extend JSON-LD emission for solution/b2b routes if needed.

## Content Outline

- `/solutions/pdu-dlya-servernogo-shkafa/`: 5 FAQs — outlet count, vertical/horizontal, current sizing, mounting, compatibility with rack vendor.
- `/solutions/pitanie-stojki-42u/`: 5 FAQs — total current, multiple PDUs, reserve, redundant power, project docs.
- `/solutions/pdu-dlya-cod/`: 5 FAQs — monitoring, three-phase, tender docs, delivery timeline.
- `/solutions/pdu-dlya-telekommunikacionnogo-shkafa/`: 4 FAQs — current for telecom, schuko vs IEC, rack vendor compat.
- `/b2b/`: 6 FAQs — quote process, tender docs, registry status, delivery, invoice options, volume discount.

## Validation

- `pnpm validate:schema`, `pnpm validate:seo`, `pnpm public-copy-audit`, manual visual check.
