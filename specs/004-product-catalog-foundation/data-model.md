# Data Model: Product Catalog Foundation

Дата: 2026-05-14.

## Product

Primary sellable item, product family, or configurable system.

Relationships:

- belongs to one or more categories;
- has many attribute values;
- has many media assets;
- has many documents;
- may have variants/options;
- may have related products.

## Category

Public catalog category, source category, or SEO category.

Relationships:

- can have parent category;
- has many products;
- can map to one or more SEO clusters.

## Attribute Definition

Controlled definition of a filterable/displayable characteristic.

Examples:

- mounting;
- current;
- voltage;
- socket type;
- socket count;
- input type;
- protection;
- monitoring;
- control;
- phase count.

## Product Attribute Value

Value assigned to a product under an attribute definition.

Examples:

- current = `16A`;
- mounting = `vertical`;
- socket_type = `IEC C13`;
- outlet_count_c13 = `18`;

## Document

Downloadable or proof asset.

Types:

- passport;
- manual;
- certificate;
- declaration;
- registry record;
- drawing;
- datasheet;
- installation guide.

## Media Asset

Product image, close-up, diagram, or placeholder.

## Price

Commercial price data.

Fields:

- amount;
- currency;
- source;
- status;
- updated at.

## Stock

Availability data.

Fields:

- status;
- quantity;
- source;
- updated at.

## Data Completeness Status

Readiness flags for product publication.

Examples:

- ready for import;
- ready for product page;
- ready for filters;
- ready for SEO;
- ready for payment;
- ready for delivery;
- ready for MойСклад sync.

## Import Record

Tracks source import.

Fields:

- source URL;
- source SKU;
- source hash;
- imported at;
- import status;
- warnings.
