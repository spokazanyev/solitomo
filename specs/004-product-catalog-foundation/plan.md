# Implementation Plan: Product Catalog Foundation

**Branch**: `004-product-catalog-foundation` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-product-catalog-foundation/spec.md`

## Summary

Define the product catalog foundation for Soliton: product data model, attribute taxonomy, import mapping, data completeness rules, category taxonomy, and readiness fields for SEO, product pages, delivery, payment, MойСклад, and analytics.

## Technical Context

**Language/Version**: Markdown specification artifacts; no application runtime in this feature.

**Primary Dependencies**: Raw assortment JSON, assortment map, semantic core, UI design system, copywriting spec, payment/logistics specs.

**Storage**: Repository markdown documents under `specs/004-product-catalog-foundation/` and `07-build-specifications/`.

**Testing**: Checklist validation against source field mapping, 66-product coverage, attribute coverage, and output contracts.

**Target Platform**: Future Next.js + Payload CMS + PostgreSQL implementation.

**Project Type**: Product data and import specification.

**Performance Goals**: Future importer must be repeatable and duplicate-safe; no runtime implementation in this feature.

**Constraints**: Preserve raw source data; support staged enrichment; do not force all products to be complete before import.

**Scale/Scope**: 66 current products, 9 source categories, 2 category gaps, 48 document gaps, 48 structured spec gaps.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Specification-first development: PASS.
- SEO and demand as product requirements: PASS. Model supports SEO clusters, filters, and landing pages.
- B2B/RFQ first: PASS. Model supports RFQ, fiscal, logistics, documents, and B2B proof.
- Integrations isolated and observable: PASS. MойСклад fields are defined without embedding integration logic.
- Analytics and search control: PASS. Product/category identifiers support event tracking.
- Maintainable by Codex: PASS. Outputs are repo-local specifications.
- Quality gates: PASS. Data completeness and import validation are explicit.

## Project Structure

### Documentation (this feature)

```text
specs/004-product-catalog-foundation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── catalog-foundation-output.md
└── tasks.md
```

### Project Output

```text
07-build-specifications/
├── product-data-spec.md
├── product-attributes-spec.md
└── product-import-spec.md
```

**Structure Decision**: This feature produces data specifications only. Payload collections and importer code are deferred to the technical implementation features.

## Phase 0: Research

Inputs:

- `00-source-data/assortment/soliton1_assortment_raw.json`;
- `00-source-data/assortment/soliton1_assortment_map.md`;
- `06-reports/03-semantic-core.md`;
- `07-build-specifications/ui-design-system-spec.md`;
- `07-build-specifications/copywriting-and-positioning-spec.md`;
- `05-implementation-roadmap/russia-payments-logistics.md`.

## Phase 1: Design & Contracts

Artifacts:

- `research.md` - decisions and source data observations.
- `data-model.md` - entities and relationships.
- `contracts/catalog-foundation-output.md` - required output structure.
- `quickstart.md` - validation guide.

## Complexity Tracking

No constitution violations.
