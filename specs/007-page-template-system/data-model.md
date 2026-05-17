# Data Model: Page Template System

## Template Content

- `filterGroups`: catalog filter labels and options.
- `sampleProducts`: placeholder product rows with technical badges.
- `trustSignals`: proof-controlled trust claims.
- `knowledgeLinks`: article/internal linking blocks.
- `processSteps`: B2B/RFQ process cards.
- `documentNeeds`: procurement/document checklist.

## Template Props

- `route`: SEO route from `seo-registry.ts`.
- `relatedRoutes`: selected internal links derived from SEO registry.

## Page Type Templates

- `HomeTemplate`
- `CatalogTemplate`
- `SolutionTemplate`
- `KnowledgeTemplate`
- `B2BTemplate`
- `DocumentTemplate`
- `CompanyTemplate`

Each template must render useful content now and remain replaceable with CMS data later.
