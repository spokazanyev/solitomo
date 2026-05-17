# Implementation Plan: Competitor Comparison Pages

**Branch**: `033-competitor-comparison-pages`

**Spec**: [spec.md](./spec.md)

## Architecture

- 5 new routes registered in `seo-registry.ts`, type `knowledge`, indexable, priority 0.5–0.65.
- Knowledge template is enriched: for these routes the standard `KnowledgeTemplate` plus a `ComparisonPlaceholder` block (table + RFQ prefill).
- `template-content.ts` `knowledgeArticleFor` returns route-specific intro/sections/faqs.
- New helper component `apps/web/src/components/comparison/ComparisonPlaceholder.tsx`.
- RFQ prefill leverages existing `RfqForm` `useSearchParams` consumer.

## Touchpoints

- `apps/web/src/lib/seo/seo-registry.ts` — 5 routes.
- `apps/web/src/lib/seo/template-content.ts` — entries in `knowledgeArticleFor`.
- `apps/web/src/components/comparison/ComparisonPlaceholder.tsx` — new.
- `apps/web/src/components/page-templates.tsx` — `KnowledgeTemplate` renders `ComparisonPlaceholder` when route path matches.

## Content per Page

| URL | Brand focus | Comment prefill | Volume target |
|---|---|---|---|
| `/knowledge/zamena-importnyh-pdu/` | Обзор | "Замена импортных PDU" | Hub page |
| `/knowledge/pdu-soliton-vs-hyperline/` | Hyperline | "Замена Hyperline PDU" | 423/мес |
| `/knowledge/zamena-apc-pdu-rossijskij-analog/` | APC | "Замена APC PDU" | 339/мес |
| `/knowledge/analogi-vertiv-eaton-pdu/` | Vertiv, Eaton | "Замена Vertiv/Eaton PDU" | 45/мес |
| `/knowledge/analogi-rittal-schneider-pdu/` | Rittal, Schneider | "Замена Rittal/Schneider PDU" | 16/мес |

## Validation

- `pnpm validate:seo`, `pnpm validate:schema`, `pnpm public-copy-audit`.
- All 5 URLs return 200, sitemap.xml includes them.
- Comparison table markup is HTML, not image.
