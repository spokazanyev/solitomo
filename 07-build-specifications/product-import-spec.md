# Спецификация Импорта Товаров Soliton

Дата: 2026-05-14.

SDD feature: `specs/004-product-catalog-foundation`.

## Import Source

Первый источник:

`00-source-data/assortment/soliton1_assortment_raw.json`

Содержит:

- 66 products;
- 9 source categories;
- product source URLs;
- prices in RUB;
- descriptions;
- image URLs;
- document URLs where available;
- source clusters.

## Import Goals

Импорт должен:

- создать или обновить все 66 товаров;
- не терять raw-данные;
- не создавать дубликаты при повторном запуске;
- отделять raw source от normalized attributes;
- флагировать пробелы данных;
- готовить товары к будущим Payload collections, SEO, RFQ, оплате, доставке и МойСклад.

## Raw Field Mapping

| Raw field | Import action |
|---|---|
| `url` | Store as `source_url` and `legacy_url`. |
| `title` | Store as `source_title`; create draft `display_title`. |
| `sku` | Store as unique product SKU; required. |
| `priceRub` | Store original string and parsed decimal RUB price. |
| `categories` | Store source categories; map to target categories. |
| `shortDesc` | Store source short description; draft public short description. |
| `specs` | Store raw specs; attempt attribute extraction where reliable. |
| `additional` | Store raw additional data for manual review. |
| `documents` | Store document title/url; classify later. |
| `images` | Store image URLs; first image becomes draft primary image. |
| `breadcrumbs` | Store source breadcrumbs. |
| `descriptionText` | Store raw full description. |
| `clusters` | Store raw clusters; map to candidate attributes and badges. |

## Normalization Rules

## SKU

- SKU is primary unique key.
- Trim whitespace.
- Preserve original case and symbols.
- If duplicate SKU appears, use `source_url` as secondary identity and flag manual review.

## Price

- Parse `priceRub` to decimal.
- Currency is `RUB`.
- Preserve original string.
- Set `price_status = shown` if parsed successfully.
- If parsing fails, set `price_status = on_request` and flag review.

## Slug

Initial slug priority:

1. Existing source URL product slug if clean enough.
2. Transliteration of SKU.
3. Generated slug from product type + SKU.

Rules:

- stable across repeated imports;
- no percent-encoded Cyrillic in final new site slug unless intentionally approved;
- legacy URL preserved for redirects.

## Title

Store:

- `source_title` exactly;
- `display_title` normalized for human readability;
- `h1` generated later by copy rules.

Example direction:

Source:

`БЛОК РОЗЕТОК ВЕРТ. 16А/250В~ S-18 IEC320C13`

Draft display:

`Вертикальный PDU 16A с 18 розетками IEC C13, S-18 IEC320C13`

## Category Mapping

Source categories map to target categories:

| Source category | Target category |
|---|---|
| БЛОКИ РОЗЕТОК 10” 1U 16A/250B~ | Блоки розеток 10" 1U |
| БЛОКИ РОЗЕТОК 19” 1U 16A/250B~ | Блоки розеток 19" 1U |
| БЛОКИ РОЗЕТОК 19” 1U 32A/250B~ | Блоки розеток 19" 1U |
| БЛОКИ РОЗЕТОК для вертикального монтажа 16A/250B~ | Вертикальные PDU |
| БЛОКИ РОЗЕТОК для вертикального монтажа 32A/250B~ | Вертикальные PDU |
| БЛОКИ РОЗЕТОК с управлением и контролем | Мониторинговые и управляемые PDU |
| ИЗМЕРИТЕЛЬНЫЕ БЛОКИ РОЗЕТОК | Измерительные PDU |
| БЛОКИ РОЗЕТОК трех-фазные | Трехфазные PDU |
| Сетевые фильтры с узип | Сетевые фильтры и УЗИП |
| empty | Manual review |

Products requiring manual category review:

- `S-36C13+6C19 M`;
- `S-36C13+6C19 M 3Ф`.

## Attribute Extraction Rules

Use source clusters as first-pass signals:

| Source cluster | Candidate attribute |
|---|---|
| `16A` | nominal_current_a = `16A` |
| `32A` | nominal_current_a = `32A` |
| `розетки Schuko` | outlet_types contains `Schuko` |
| `розетки IEC320 C13` | outlet_types contains `IEC C13` |
| `вход IEC320 C20` | input_type contains `IEC C20` |
| `вертикальный монтаж` | mounting_orientation = `vertical` |
| `19 дюймов / 1U` | rack_size = `19_inch`, unit_height = `1U` |
| `10 дюймов / 1U` | rack_size = `10_inch`, unit_height = `1U` |
| `трехфазные блоки` | phase_count = `3_phase` |
| `измерение / индикация` | has_metering candidate |
| `управление и контроль` | has_network_monitoring/control candidate |
| `сетевой фильтр / УЗИП` | has_surge_protection candidate |
| `с выключателем` | has_switch candidate |

Use `specs`, `shortDesc`, and `descriptionText` for stronger extraction only when patterns are explicit:

- outlet counts: `16 розеток IEC320C13`;
- C19 counts: `2 розетки IEC320 C19`;
- cable length: `длина 3м`;
- input: `вилка IEC320C20`;
- dimensions: `Высота 50 мм`;
- power: `Номинальная мощность 7 кВт`.

Uncertain extracted values must be flagged as `needs_review`.

## Duplicate Prevention

Import identity:

1. `sku`;
2. fallback: `source_url`;
3. fallback: hash of `source_url + source_title`.

Repeat import behavior:

- update raw source fields;
- do not overwrite manually edited SEO/copy fields unless explicitly configured;
- update source price only if source remains current;
- append import warnings instead of silently dropping data.

## Data Completeness Flags

Set flags during import:

- `missing_category`;
- `missing_documents`;
- `missing_structured_specs`;
- `missing_short_description`;
- `missing_logistics_fields`;
- `missing_fiscal_fields`;
- `needs_attribute_review`;
- `needs_seo_copy`;
- `needs_document_classification`;
- `needs_registry_proof`.

Initial expected flags:

- `missing_category`: 2 products.
- `missing_documents`: 48 products.
- `missing_structured_specs`: 48 products.
- `missing_logistics_fields`: most/all products.
- `missing_fiscal_fields`: most/all products.

## Manual Review Queue

Manual review categories:

1. No category.
2. No documents.
3. No structured specs.
4. Monitoring/control claims.
5. Protection claims.
6. Registry/Russian production claims.
7. Logistics/fiscal readiness.
8. Ambiguous SKU/title.

Review output:

- target category;
- verified attributes;
- missing data owner;
- publish readiness status.

## Import Acceptance Checklist

Import is acceptable when:

- all 66 products are present;
- all SKUs are unique or flagged;
- all source URLs are preserved;
- all prices are parsed or flagged;
- all images are preserved;
- all documents are preserved where present;
- all raw specs/descriptions are preserved;
- category gaps are flagged;
- attribute candidates are created from clusters;
- manual review queue is generated;
- import can run repeatedly without duplicates.

## Future Implementation Notes

The importer should be built after technical foundation exists. It should:

- run from a local or server script;
- produce a report;
- support dry run;
- support update mode;
- support no-overwrite for human-edited SEO/copy fields;
- log warnings per SKU.
