# Implementation Plan: Product Schema Enrichment + Key Facts Block

**Branch**: `039-product-schema-enrichment`

**Spec**: [spec.md](./spec.md)

## Touchpoints

- `apps/web/src/lib/products/source-products.ts` — `createProductJsonLd()` расширение
- `apps/web/src/components/product/ProductDetailPage.tsx` — key-facts блок
- New helper: `apps/web/src/lib/products/key-facts.ts` — `buildKeyFacts(product)` возвращает `{ sentence, properties[] }`

## Architecture

Единый источник истины: `buildKeyFacts(product)` принимает `Product`, возвращает:
- `sentence: string` — одно предложение для UI
- `properties: Array<{ name, value, unitText?, propertyID? }>` — массив для schema additionalProperty

Используется в:
- `ProductDetailPage` — рендерит `sentence` в первый visible-block
- `createProductJsonLd` — использует `properties` для `additionalProperty[]`

## Schema fields to add

```jsonc
{
  "@type": "Product",
  "name": "...",
  "sku": "...",
  "mpn": "SP-8",
  "brand": { "@type": "Brand", "name": "Солитон" },
  "manufacturer": { "@id": "https://soliton.ru/#organization" },
  "countryOfOrigin": { "@type": "Country", "name": "Россия" },
  "model": "...",
  "additionalProperty": [
    { "@type": "PropertyValue", "name": "Кол-во розеток", "value": 8, "unitText": "шт", "propertyID": "outlet_count" },
    { "@type": "PropertyValue", "name": "Ток", "value": 16, "unitCode": "AMP", "propertyID": "max_current" },
    { "@type": "PropertyValue", "name": "Монтаж", "value": "19″ 1U", "propertyID": "mounting" },
    { "@type": "PropertyValue", "name": "Тип розеток", "value": "Schuko", "propertyID": "outlet_types" },
    { "@type": "PropertyValue", "name": "Ввод", "value": "Schuko", "propertyID": "input_type" },
    { "@type": "PropertyValue", "name": "Опции", "value": "УЗИП", "propertyID": "options" }
  ],
  "offers": { ... }
}
```

## Validation

- `pnpm validate:schema` — Product содержит `additionalProperty`, `mpn`, `brand`, `manufacturer`, `countryOfOrigin`.
- `pnpm typecheck`, `pnpm lint`.
- Google Rich Results Test → 0 warnings.
- Manual: открыть `/product/sp-8/`, прочитать key-facts блок, сверить с табличной частью PDP.
