# Tasks: Competitor Comparison Pages

- [ ] T001 Add 5 new routes to `seo-registry.ts` (type knowledge, indexable true, priority 0.5–0.65, unique title/description/h1/summary/keywords).
- [ ] T002 Add corresponding `knowledgeArticleFor()` entries in `template-content.ts` (intro 200+ words, 3 sections, 4 FAQ each).
- [ ] T003 Add `apps/web/src/components/comparison/ComparisonPlaceholder.tsx` rendering criteria comparison table, "Раздел дополняется" notice, and CTA to RFQ with comment prefill.
- [ ] T004 Update `KnowledgeTemplate` (page-templates.tsx) to detect comparison routes and render `ComparisonPlaceholder`.
- [ ] T005 Add "Замена импортных PDU" link block in `/b2b/custom-pdu/` and `/b2b/` (B2BTemplate).
- [ ] T006 Run `pnpm public-copy-audit`, `pnpm validate:seo`, `pnpm validate:schema`. All zero issues.
- [ ] T007 Manual verify each of 5 URLs returns 200, has FAQ, has CTA prefill.
