# Quickstart: Product Catalog Foundation

Дата: 2026-05-14.

## How To Validate This Feature

1. Open `07-build-specifications/product-data-spec.md`.
2. Confirm all raw fields from `soliton1_assortment_raw.json` have target mapping or preservation rule.
3. Open `07-build-specifications/product-attributes-spec.md`.
4. Confirm attribute groups support filters and badges for:
   - 19";
   - 1U;
   - 10";
   - vertical;
   - 16A;
   - 32A;
   - Schuko;
   - IEC C13;
   - IEC C19;
   - monitoring/control;
   - three-phase;
   - UZIP/protection.
5. Open `07-build-specifications/product-import-spec.md`.
6. Confirm all 66 source products can be imported without data loss.
7. Confirm missing categories, docs, specs, logistics fields, and fiscal fields are flagged rather than blocking import.

## Completion Signal

The feature is complete when future Payload collections and importer implementation can be planned from these three documents.
