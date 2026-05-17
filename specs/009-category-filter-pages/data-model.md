# Data Model: Category Filter Pages

## CatalogRule

Runtime rule in `apps/web/src/lib/products/source-products.ts`.

- `path`: approved catalog URL.
- `title`: listing title.
- `description`: category-specific intro text.
- `matcher`: deterministic predicate over normalized product text.

## CatalogFacetGroup

Runtime navigation group.

- `label`: facet group name, for example `Монтаж`.
- `options`: route-backed options.

## CatalogFacetOption

- `label`: visible filter option.
- `path`: clean indexable URL.
- `count`: number of products matched by that URL.
- `current`: whether option matches current category route.

## CatalogListing

Returned by `getCatalogProducts(routePath)`.

- `title`: category listing title.
- `description`: category-specific description.
- `total`: matched product count.
- `products`: matched `Product[]`.

## Structured Data

`createItemListJsonLd(route, products)` outputs:

- `ItemList`;
- `name`;
- `url`;
- `numberOfItems`;
- up to 24 visible product links as `ListItem`.
