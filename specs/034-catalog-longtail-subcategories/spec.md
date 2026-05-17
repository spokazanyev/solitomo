# Feature Specification: Catalog Long-Tail Sub-Categories

**Feature Branch**: `034-catalog-longtail-subcategories`

**Created**: 2026-05-16

**Status**: Draft

**Input**: SEO-review found that high-volume long-tail queries (`блок розеток 8 розеток` 3868, `блок розеток 19 8 розеток` 2594, `блок розеток schuko 19` 2037, `блок розеток 19 16а` 1559, plus combinations like `pdu c13 16a`, `вертикальный pdu 32а`) — ~3–4K queries/month — currently land on broad catalog pages and require manual filtering. Direct sub-category URLs would capture this commercial intent.

## User Scenarios & Testing

### User Story 1 - Buyer Searching "блок розеток 19 8 розеток" Lands On Specific Page (Priority: P1)

A buyer searches the phrase and lands on `/catalog/bloki-rozetok-19-1u/8-rozetok/` showing only products with 1U mounting and 8 outlets.

**Independent Test**: URL returns 200, listing has 1+ products that match both filters, breadcrumb shows hierarchy "Каталог / Блоки розеток 19″ 1U / 8 розеток".

### User Story 2 - Sub-Category Pages Are Crawlable And Carry SEO (Priority: P1)

Each sub-category route has its own title, description, H1, ItemList JSON-LD, canonical to itself.

### User Story 3 - Empty Sub-Categories Are Skipped (Priority: P2)

If a combination has zero products, the route is not registered (or `indexable: false`) — Google should not see thin or empty pages.

## Requirements

- **FR-001**: 10 new sub-category routes MUST be registered in `seo-registry.ts`.
- **FR-002**: Filtering logic in `getCatalogProducts(path)` MUST return products that match BOTH parent and sub-criteria.
- **FR-003**: Breadcrumb on sub-category MUST include parent category.
- **FR-004**: Canonical MUST point to the sub-category URL (not parent).
- **FR-005**: Empty combinations MUST be `indexable: false` or omitted entirely.
- **FR-006**: ItemList JSON-LD MUST include products from the filtered set.

## Sub-Category Routes

| URL | Filter |
|---|---|
| `/catalog/bloki-rozetok-19-1u/8-rozetok/` | mounting=rack_19_1u AND outletCount=8 |
| `/catalog/bloki-rozetok-19-1u/16-rozetok/` | mounting=rack_19_1u AND outletCount≥16 |
| `/catalog/bloki-rozetok-19-1u/schuko/` | mounting=rack_19_1u AND outlet includes Schuko |
| `/catalog/bloki-rozetok-19-1u/iec-c13/` | mounting=rack_19_1u AND outlet includes IEC C13 |
| `/catalog/bloki-rozetok-19-1u/16a/` | mounting=rack_19_1u AND maxCurrent=16 |
| `/catalog/vertical-pdu/32a/` | mounting=vertical AND maxCurrent=32 |
| `/catalog/vertical-pdu/42u/` | mounting=vertical AND outletCount≥18 (a proxy for 42U-capable length) |
| `/catalog/iec-c13-c19/16a/` | outlet IEC AND maxCurrent=16 |
| `/catalog/iec-c13-c19/32a/` | outlet IEC AND maxCurrent=32 |
| `/catalog/metered-pdu/32a/` | monitoring=true AND maxCurrent=32 |

## Success Criteria

- **SC-001**: 10 URLs return 200 with at least 1 product each (or are `indexable: false`).
- **SC-002**: `pnpm validate:seo` and `pnpm validate:schema` pass.
- **SC-003**: Sitemap includes all eligible sub-categories.
