# Tasks: Product Schema Enrichment + Key Facts Block

**Status: ✅ Done (2026-05-26).** Реализовано на ветке `039-product-schema-enrichment`.

- [X] T001 `apps/web/src/lib/products/key-facts.ts` — `buildKeyFacts(product): { sentence; properties: KeyFact[] }`. Единый источник для key-facts предложения и `additionalProperty[]`. Числовые атрибуты несут UN/CEFACT `unitCode`/`unitText`, все — `propertyID`.
- [X] T002 `createProductJsonLd()` (`catalog.ts`) использует `buildKeyFacts(product).properties` для `additionalProperty[]` (заменил inline-map на `getProductAttributeRows`). FR-004/005.
- [X] T003 `createProductJsonLd()`: уже были `mpn`/`brand`/`manufacturer`/`model`; добавлен `countryOfOrigin: { @type: Country, name: Россия }`. Бонус: `offers.availability = https://schema.org/InStock` (закрывает находку аудита).
- [X] T004 `createOrganizationJsonLd()` (`structured-data.ts`) — добавлен `@id: "${siteUrl}/#organization"`, чтобы `manufacturer`/`seller` ref резолвились в узел Organization на главной.
- [X] T005 `ProductDetailPage.tsx` — после H1, над `shortDescription`, рендерится `{keyFacts.sentence}` (первый visible-текст → дословная цитата ИИ-агентом). FR-003.
- [X] T006 Unit-тест `key-facts.test.ts` (6 тестов): порядок предложения, единицы UN/CEFACT, категориальные без unitCode, propertyID, фильтрация плейсхолдеров, русская плюрализация. Все зелёные.
- [ ] T007 **Post-deploy gate**: `SITE_URL=https://pdumarket.ru pnpm --filter @soliton/web validate:schema` + Google Rich Results Test на `/product/sp-8/` — выполнить после мёржа и деплоя (скрипт бьётся по live-URL).
- [X] T008 `pnpm typecheck` + `pnpm lint` (по изменённым файлам) — зелёные. 2 lint-ошибки в репозитории — pre-existing в чужих файлах (`CompanyProductionInfo.tsx`, `metrika-management-client.ts`), не относятся к 039.

## Реальное состояние vs изначальный план

Изначально часть полей (`additionalProperty`, `mpn`, `brand`, `manufacturer`, `model`) уже была на проде — оставалось добить `countryOfOrigin`, единицы UN/CEFACT, единый источник `buildKeyFacts`, key-facts блок и Organization `@id`. Все 5 пробелов закрыты.
