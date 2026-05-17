# Implementation Plan: Public Catalog from Payload

**Spec**: `specs/045-public-catalog-from-payload/spec.md`

**Status**: Active

## Архитектурные решения

### Где загружаются данные

Один новый модуль `apps/web/src/lib/products/catalog.ts`:

- импортирует `getPayload` из `payload` и `config` из `@/payload.config`;
- определяет приватный `loadCatalog = cache(async () => { ... })` из `react` (React 19 `cache()`);
- внутри `loadCatalog` делает **один** `payload.find({ collection: "products", limit: 1000, depth: 1, where: { status: { equals: "published" } }, overrideAccess: true })`;
- маппит docs → `Product[]` через `mapPayloadProductToProduct(doc)`;
- строит `Map<slug, Product>` один раз.

Это даёт O(1) запрос на рендер благодаря React `cache()` (мемоизация на запрос) и предотвращает N+1 при множественных вызовах `getProducts()`/`getCatalogProducts(path)` на одной странице.

### Маппинг Payload → Product

```
Product = {
  sku            ← doc.sku
  slug           ← doc.slug
  title          ← doc.title
  h1             ← buildProductDisplayName(rawShape, attributes)  // как сейчас
  description    ← doc.description ?? doc.shortDescription ?? ""
  shortDescription ← doc.shortDescription ?? fallback
  price.amount   ← doc.price.amount (null если price.status !== "published")
  price.display  ← formatPrice(amount, doc.price.amount?.toString())
  price.currency ← "RUB"
  price.updatedAt ← doc.updatedAt  // временно; новое поле price.updatedAt опционально
  images         ← doc.imageLinks.map(l => rewriteLegacyAssetUrl(l.url))
  documents      ← doc.documents.map(d => ({ title, url: rewriteLegacyAssetUrl(d.externalUrl) }))
  categories     ← doc.categories.map(c => ({ name: c.title, url: `/catalog/${c.slug}/` }))
  breadcrumbs    ← doc.categories?.[0]?.title
  legacyUrl      ← doc.sourceUrl ?? ""
  badges         ← из doc.categories (как «clusters») + текстовая эвристика
  specs          ← []                          // пока нет в Payload; можно докинуть позже
  attributes     ← normalizeProductAttributes({ sku, title, shortDesc, descriptionText, categories })
}
```

`Product` тип остаётся прежним — никаких изменений в UI.

### Где остаются route-правила

`catalogRules` и `catalogFacetDefinitions` копируем в `catalog.ts` без изменений. Они описывают **маршруты** (slug → matcher → title/description), а не данные. SEO-URL — это часть кода, не контента.

Если у категории Payload есть совпадающий `slug` (например `pdu`), то её `title`/`h1`/`intro` **переопределяют** статические значения из `catalogRules[i].title`/`description`. Это даёт редактору контроль над верхним H1/описанием категории без правки кода.

### JSON-LD и pure helpers

`createProductJsonLd`, `createProductBreadcrumbJsonLd` остаются синхронными — они зависят только от `Product`. Кладём их в тот же `catalog.ts`. Если файл становится большим — выносим в `lib/products/json-ld.ts` отдельной задачей (не в этом спринте).

### React Server Component contract

- `sitemap.ts` → `default async function sitemap()`, использует `await getProducts()`.
- `app/(site)/product/[slug]/page.tsx`:
  - `generateStaticParams` → `async`, `await getProducts()`.
  - `generateMetadata` → уже async, `await getProductBySlug(slug)`.
  - `ProductPage` → уже async, `await getProductBySlug(slug)`.
- `SeoLandingPage` → переводим в `async function`, `await getCatalogProducts(route.path)`.
- `page-templates.tsx`:
  - `HomeTemplate.FeaturedProducts` → async section; либо инлайн рендер через top-level `await` в `HomeTemplate`.
  - `CatalogTemplate` → async.
  - `DocumentTemplate.getDocumentRegistry` → async helper.
- `ProductDetailPage` → async server component, `await getRelatedProducts(product)`.

Все вышеперечисленные — уже server components (`"use client"` присутствует только в `CatalogFilterableList.tsx` и `ProductInfoTabs.tsx`, которые принимают `Product` через props и **не делают** загрузку данных).

### Что НЕ меняется

- `Product` тип (поверхность для UI / типа).
- `normalizeProductAttributes()` логика инференса атрибутов из текста.
- `rewriteLegacyAssetUrl()` для путей изображений и документов.
- `formatPrice` и `derivePriceValidUntil` — без изменений.
- `CatalogFilterableList`, `ProductInfoTabs`, `ProductCard` — не трогаем.

## Риски и митигация

- **БД недоступна во время билда.** Митигация: явная ошибка в Payload, документация в README; задача в `06-operations-setup` уже описывает локальный compose; build CI поднимает контейнер.
- **Категории Payload пустые** (нет товаров с `categories` relation). Митигация: `getCatalogProducts(path)` опирается на `catalogRules.matcher` в первую очередь; категории Payload используются только для override title/description.
- **Несогласованность slug в Payload и в catalogRules**. Митигация: совпадение по `slug === pathToSlug(path)`. Никаких сложных join'ов.
- **Изменения `payload-types.ts` могут перетекать в `Product`**. Митигация: маппер явно копирует поля; рассинхрон вызывает typecheck-ошибку.
- **Сценарий «БД пустая, билд должен пройти»**. Митигация: `getProducts()` возвращает `[]`, `generateStaticParams` пустой массив, билд проходит, страниц нет. Логируется warning.

## Фазы

1. **Фаза 1 — Модуль и маппинг (без переключения консьюмеров).** Пишем `catalog.ts`, типы и хелперы. Старый `source-products.ts` остаётся; ничего ещё не сломано.
2. **Фаза 2 — Переключение консьюмеров.** Меняем импорты, добавляем `await`. Все 5 файлов из FR-004.
3. **Фаза 3 — Чистка.** `source-products.ts` либо удалён, либо превращён в одностраничный re-export для предотвращения сломанных импортов снаружи (например, из bin-скриптов).
4. **Фаза 4 — Проверки.** `typecheck`, `lint`, `validate:seo`, `validate:schema`, `public-copy-audit`. Документация обновлена.

## Validation gates

- `pnpm --filter @soliton/web typecheck`.
- `pnpm --filter @soliton/web lint`.
- `grep -rn "source-products" apps/web/src` → 0 матчей (или 1 — сам shim).
- `grep -rn "00-source-data/assortment/soliton1_assortment_raw.json" apps/web` → только в seed-скрипте.
