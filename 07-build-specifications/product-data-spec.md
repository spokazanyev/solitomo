# Спецификация Товарных Данных Soliton

Дата: 2026-05-14.

SDD feature: `specs/004-product-catalog-foundation`.

## Executive Summary

Каталог Soliton должен хранить не только текущие WooCommerce-поля, но и данные для современного SEO/B2B-магазина:

- карточки товаров;
- фильтры;
- технические таблицы;
- документы;
- SEO-посадочные;
- запрос КП;
- оплату;
- доставку;
- фискализацию;
- МойСклад;
- аналитику;
- claim-control и доказательства.

Модель должна поддерживать staged enrichment: импортировать все 66 товаров сейчас, сохранить raw-данные без потерь и постепенно нормализовать характеристики.

Актуальный реализованный слой нормализации атрибутов описан отдельно: `07-build-specifications/product-attributes-normalization-spec.md`.

## Source Data Summary

Источник: `00-source-data/assortment/soliton1_assortment_raw.json`.

Текущее состояние:

- товаров: 66;
- категорий источника: 9;
- товаров без категории: 2;
- товаров без документов: 48;
- товаров без структурированного массива specs: 48;
- товаров без изображений: 0;
- товаров без цены: 0.

Raw fields:

- `url`;
- `title`;
- `sku`;
- `priceRub`;
- `categories`;
- `shortDesc`;
- `specs`;
- `additional`;
- `documents`;
- `images`;
- `breadcrumbs`;
- `descriptionText`;
- `clusters`.

## Entity Model

## Product

Главная сущность товара, товарной системы или конфигурируемой линейки.

Обязательные поля для импорта:

- `source_url`;
- `source_system`;
- `sku`;
- `source_title`;
- `display_title`;
- `slug`;
- `raw_description`;
- `short_description`;
- `price`;
- `categories`;
- `images`;
- `raw_clusters`;
- `import_status`;

Обязательные поля для публикации:

- `display_title`;
- `sku`;
- `primary_category`;
- `short_description`;
- `product_type`;
- `technical_badges`;
- `attribute_values`;
- `media`;
- `seo_title`;
- `seo_description`;
- `cta_mode`;

## Category

Типы категорий:

- `source_category` - категория с текущего сайта;
- `catalog_category` - публичная категория нового каталога;
- `seo_landing_category` - посадочная категория под спрос;
- `service_category` - B2B/подбор/доставка/оплата, если связана с товарами.

Поля:

- `name`;
- `slug`;
- `parent`;
- `category_type`;
- `source_url`;
- `h1`;
- `intro`;
- `seo_title`;
- `seo_description`;
- `indexing_policy`;
- `primary_filters`;
- `related_categories`;
- `related_use_cases`.

## Product Fields By Purpose

| Purpose | Fields |
|---|---|
| Product page | display_title, sku, short_description, product_type, application, attributes, documents, media, related_products |
| Product card | image, title, sku, badges, price_status, stock_status, primary_cta, secondary_cta |
| Filters | mounting, rack_size, unit_height, current, voltage, phase_count, socket_types, outlet_counts, input_type, protection, monitoring, control |
| SEO | slug, h1, seo_title, seo_description, canonical, schema_type, target_queries, cluster |
| RFQ/B2B | rfq_enabled, quote_note, project_supply_eligible, analog_request_enabled, document_request_enabled |
| Commerce | price, currency, price_status, stock_status, purchasable, min_order_qty |
| Logistics | weight, length, width, height, package_weight, package_dimensions, pickup_point_eligible, freight_required |
| Fiscal | vat_rate, unit_name, receipt_name, payment_subject, payment_method |
| MойСклад | moysklad_product_id, moysklad_variant_id, moysklad_code, sync_mode, price_source, stock_source |
| Analytics | product_id, sku, category_path, item_list_name, search_cluster |
| Proof | registry_status, registry_number, made_in_russia_status, certificate_status, warranty_status |

## Source Field Mapping

| Raw field | Target field | Rule |
|---|---|---|
| `url` | `source_url`, `legacy_url` | Preserve exactly; later used for redirects. |
| `title` | `source_title`, draft `display_title` | Preserve source; normalize display title manually/algorithmically later. |
| `sku` | `sku` | Unique product key; must not be empty. |
| `priceRub` | `price.amount`, `price.currency=RUB` | Parse as decimal, preserve original string. |
| `categories` | `source_categories`, draft category mapping | Map to target taxonomy; flag empty categories. |
| `shortDesc` | `short_description_source`, draft `short_description` | Preserve; rewrite later using copy spec. |
| `specs` | `raw_specs`, candidate attributes | Preserve array; parse gradually into normalized attributes. |
| `additional` | `raw_additional` | Preserve for manual review. |
| `documents` | `documents` | Import title/url; classify document type later. |
| `images` | `media` | Import URLs; classify primary/secondary/diagram later. |
| `breadcrumbs` | `source_breadcrumbs` | Preserve for source category context. |
| `descriptionText` | `raw_description` | Preserve as full source text. |
| `clusters` | `raw_clusters`, candidate badges, candidate filters | Map to controlled attributes; preserve original values. |

## Target Category Taxonomy For First Release

Primary catalog:

- PDU / блоки распределения питания;
- блоки розеток 19" 1U;
- блоки розеток 10" 1U;
- вертикальные PDU / 0U;
- PDU 16A;
- PDU 32A;
- трехфазные PDU;
- измерительные PDU;
- мониторинговые и управляемые PDU;
- сетевые фильтры и УЗИП.

Attribute-driven landings:

- PDU Schuko;
- PDU IEC C13;
- PDU IEC C19;
- PDU C13+C19;
- PDU с выключателем;
- PDU с автоматом/защитой;
- PDU для серверного шкафа;
- PDU для ЦОД;
- PDU для ИБП.

Manual category review:

- `S-36C13+6C19 M`;
- `S-36C13+6C19 M 3Ф`.

## Document And Media Model

## Document

Fields:

- `title`;
- `url`;
- `file_type`;
- `document_type`;
- `product_relation`;
- `is_public`;
- `proof_role`;
- `download_event_name`;

Document types:

- паспорт;
- руководство;
- описание;
- сертификат;
- декларация;
- запись реестра;
- чертеж;
- схема;
- datasheet;
- прочее.

## Media

Fields:

- `url`;
- `alt`;
- `media_type`;
- `role`;
- `sort_order`;
- `source_url`;

Roles:

- primary product photo;
- secondary product photo;
- close-up;
- diagram;
- installation;
- placeholder.

## SEO Fields

Product SEO:

- `slug`;
- `h1`;
- `seo_title`;
- `seo_description`;
- `canonical`;
- `indexing_status`;
- `target_query`;
- `secondary_queries`;
- `schema_product_enabled`;

Category SEO:

- `h1`;
- `intro`;
- `seo_text`;
- `faq`;
- `related_links`;
- `target_cluster`;
- `indexing_policy`.

## Commerce Fields

- `price.amount`;
- `price.currency`;
- `price_status`: `shown`, `on_request`, `hidden`, `outdated`;
- `stock_status`: `in_stock`, `on_order`, `by_request`, `out_of_stock`, `unknown`;
- `purchasable`;
- `rfq_enabled`;
- `min_order_qty`;
- `lead_time_note`.

## Logistics And Fiscal Fields

Logistics:

- `weight_kg`;
- `length_mm`;
- `width_mm`;
- `height_mm`;
- `package_weight_kg`;
- `package_length_mm`;
- `package_width_mm`;
- `package_height_mm`;
- `pickup_point_eligible`;
- `courier_eligible`;
- `freight_required`;
- `delivery_requires_manager_approval`.

Fiscal:

- `vat_rate`;
- `unit_name`;
- `receipt_name`;
- `payment_subject`;
- `payment_method`;
- `country_of_origin`;

Current source gap:

These fields are mostly absent today and must be filled manually, from MойСклад, or from product documentation before automated payment/delivery.

## Integration Fields

MойСклад:

- `moysklad_product_id`;
- `moysklad_variant_id`;
- `moysklad_code`;
- `moysklad_external_code`;
- `sync_enabled`;
- `sync_price_from_moysklad`;
- `sync_stock_from_moysklad`;
- `last_synced_at`;

Payments:

- `receipt_name`;
- `vat_rate`;
- `unit_name`;
- `payment_subject`;

Delivery:

- dimensions and eligibility fields listed above.

Analytics:

- `analytics_item_id`;
- `analytics_item_name`;
- `analytics_category`;
- `analytics_variant`;
- `search_cluster`.

## Data Completeness Rules

Statuses:

- `import_ready`;
- `catalog_ready`;
- `product_page_ready`;
- `filter_ready`;
- `seo_ready`;
- `rfq_ready`;
- `payment_ready`;
- `delivery_ready`;
- `moysklad_ready`;
- `proof_ready`.

Initial rules:

- Product can be `import_ready` with raw data, SKU, title, price, image, and URL.
- Product can be `catalog_ready` when it has target category and display title.
- Product can be `filter_ready` when required controlled attributes are assigned.
- Product can be `seo_ready` when H1/title/description/canonical are filled.
- Product can be `payment_ready` only after fiscal fields are filled.
- Product can be `delivery_ready` only after weight/dimensions are filled or delivery is manager-approved.
- Product can be `proof_ready` only after documents/registry/certificates are attached where claims require them.

## Open Data Gaps

Known gaps from source:

- 2 products need category assignment.
- 48 products need documents or document status.
- 48 products need structured specs enrichment.
- All products need logistics dimensions/weight confirmation.
- All products need fiscal fields for online payment.
- Registry inclusion needs exact registry name, entry numbers, and product scope.
- Russian production status needs product-line mapping.
- APC/APS comparison needs source clarification and evidence.
