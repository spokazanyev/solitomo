# Tasks: Public Catalog from Payload

**Spec**: `specs/045-public-catalog-from-payload/spec.md`

**Plan**: `specs/045-public-catalog-from-payload/plan.md`

## Фаза 1. Модуль `lib/products/catalog.ts`

- [x] T045-01 — создать `apps/web/src/lib/products/catalog.ts` с:
  - импортом `getPayload`, `cache`, `Payload Product/Category/Document` типов;
  - приватной `loadCatalog = cache(async () => { ... })`;
  - публичными async-функциями: `getProducts`, `getProductBySlug`, `getCatalogProducts`, `getCatalogFacetGroups`, `getCatalogAttributeStats`, `getRelatedProducts`;
  - синхронными `createProductJsonLd`, `createProductBreadcrumbJsonLd`;
  - типом `Product` (re-export старого) и `CatalogFacetGroup`.

## Фаза 2. Переключение консьюмеров

- [x] T045-02 — `apps/web/src/app/sitemap.ts` → async, await `getProducts()` из нового модуля.
- [x] T045-03 — `apps/web/src/app/(site)/product/[slug]/page.tsx` → `generateStaticParams` async, имена импортов обновлены.
- [x] T045-04 — `apps/web/src/components/SeoLandingPage.tsx` → async server component, `catalogProducts = await getCatalogProducts(...)`.
- [x] T045-05 — `apps/web/src/components/page-templates.tsx` → все шаблоны, которые читают данные, async:
  - `HomeTemplate.FeaturedProducts` (вынести в await до рендера);
  - `CatalogTemplate`;
  - `DocumentTemplate.getDocumentRegistry`;
  - вспомогательные использования `getProducts/getCatalogProducts`.
- [x] T045-06 — `apps/web/src/components/product/ProductDetailPage.tsx` → async, `await getRelatedProducts(product)`.

## Фаза 3. Чистка

- [x] T045-07 — Удалить `apps/web/src/lib/products/source-products.ts` или оставить shim с deprecation-комментарием.
- [x] T045-08 — Удостовериться, что seed-скрипт `apps/web/scripts/seed-catalog-payload.mjs` и `00-source-data/assortment/soliton1_assortment_raw.json` не используются в `apps/web/src/**`.

## Фаза 4. Проверки и документация

- [x] T045-09 — `pnpm --filter @soliton/web typecheck` — зелёный.
- [x] T045-10 — `pnpm --filter @soliton/web lint` — зелёный.
- [x] T045-11 — Обновить `agent-project-context.md`: «Публичный каталог переключён на Payload. JSON остаётся как input для seed».
- [x] T045-12 — Обновить `07-build-specifications/document-register.md` записью для спеки 045.
- [x] T045-13 — Обновить `MEMORY.md` / `deferred-work.md` если применимо.
