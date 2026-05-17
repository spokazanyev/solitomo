# Tasks: Product Schema Enrichment + Key Facts Block

- [ ] T001 Создать `apps/web/src/lib/products/key-facts.ts` — функция `buildKeyFacts(product: Product): { sentence: string; properties: PropertyValue[] }`. Использует существующий `ProductAttributes`.
- [ ] T002 В `createProductJsonLd()` использовать `buildKeyFacts().properties` для `additionalProperty[]`.
- [ ] T003 В `createProductJsonLd()` добавить `mpn` (=sku), `brand: { @type: "Brand", name: "Солитон" }`, `manufacturer` (ref `${siteUrl}/#organization`), `countryOfOrigin: { @type: "Country", name: "Россия" }`, `model` (опционально).
- [ ] T004 В `apps/web/src/lib/seo/structured-data.ts` `createOrganizationJsonLd()` — добавить `@id: "${siteUrl}/#organization"`, чтобы manufacturer ссылался стабильно.
- [ ] T005 В `apps/web/src/components/product/ProductDetailPage.tsx` сразу после H1 + product.shortDescription рендерить `<p className="key-facts">{sentence}</p>` через `buildKeyFacts()`.
- [ ] T006 Запустить `pnpm validate:schema` — подтвердить наличие новых полей.
- [ ] T007 Google Rich Results Test на /product/sp-8/ — 0 warnings.
- [ ] T008 `pnpm typecheck`, `pnpm lint` — зелёные.
