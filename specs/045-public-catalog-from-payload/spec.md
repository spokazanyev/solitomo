# Feature Specification: Public Catalog Reads from Payload

**Feature Branch**: `045-public-catalog-from-payload`

**Created**: 2026-05-17

**Status**: Active

**Input**: Сейчас публичный сайт читает товары из `00-source-data/assortment/soliton1_assortment_raw.json` через `apps/web/src/lib/products/source-products.ts`. Payload-коллекции (`products`, `categories`, `attributes`, `filter-fields`, `filter-options`, `media`, `documents`) уже заполнены тем же seed-скриптом `apps/web/scripts/seed-catalog-payload.mjs` и являются единственным местом, где редактор/агент может изменять данные. Параллельные источники истины — это риск рассинхронизации: правка в Payload не доезжает до сайта, а правка в JSON ломает Payload. Спринт переводит публичный каталог на Payload local API как единственный источник данных.

## User Scenarios & Testing

### User Story 1 — Редактор обновил карточку товара в Payload (Priority: P1)

Контент-редактор открывает Payload admin, у товара S-PDU-16C13-2x16 меняет `shortDescription`, `price.amount`, добавляет ещё одно фото в `imageLinks`, сохраняет, ставит status=`published`. Без отдельного seed-цикла и без правки JSON — следующий запрос на `/product/s-pdu-16c13-2x16/` и `/catalog/pdu/` показывает обновлённую цену, описание и фото; `<script type="application/ld+json">` отдаёт новую цену в `offers`. Sitemap содержит slug товара. `view_item` событие аналитики отрабатывает с новой ценой.

**Acceptance**:
1. После публикации в Payload и пересборки страницы (или revalidate) изменения видны на сайте.
2. JSON-файл `soliton1_assortment_raw.json` больше не влияет на публичный рендер.
3. Сборка `pnpm --filter @soliton/web build` падает с понятной ошибкой, если БД недоступна (а не молча подставляет старые данные из JSON).

### User Story 2 — Маркетолог добавляет новую категорию каталога (Priority: P2)

Маркетолог создаёт в Payload `categories` запись `{ slug: "pdu-iec-c19", title: "PDU IEC C19", h1: "PDU IEC C19", intro: "...", status: "published" }` и привязывает к ней нужные товары через `categories` relation. Категория появляется в выпадающих фильтрах CatalogFilterableList; счётчики товаров отражают только связанные.

**Acceptance**:
1. Категории каталога считываются из Payload (плюс остаются совместимыми с существующими `catalogRules`, которые описывают подкатегории-route'ы вроде `/catalog/bloki-rozetok-19-1u/16-rozetok/`).
2. Счётчики `getCatalogFacetGroups(path)` пересчитываются по данным Payload.

### User Story 3 — Сборка статического сайта `pnpm build` (Priority: P0)

Билд Next.js должен генерировать те же страницы, что и раньше (`/catalog/...`, `/product/[slug]`, `sitemap.xml`), но `generateStaticParams`, `generateMetadata` и тело страниц теперь асинхронно тянут данные из Payload local API.

**Acceptance**:
1. `pnpm --filter @soliton/web typecheck` зелёный.
2. `pnpm --filter @soliton/web lint` зелёный.
3. `pnpm --filter @soliton/web build` создаёт ту же поверхность маршрутов (66 product pages, 23 catalog routes), считая `DATABASE_URI` доступным и БД засеянной.

### Edge Cases

- **БД пустая** — `generateStaticParams` для `/product/[slug]` возвращает пустой массив, билд проходит, но product-страниц нет. Лог-предупреждение в build output.
- **Категория без товаров** — `getCatalogProducts(path).total === 0` приводит к рендеру каталога с сообщением «Показано моделей: 0 из 0»; никаких 500.
- **Цена `null` / status=request** — JSON-LD не добавляет `offers`, карточка показывает «Цена по запросу».
- **legacy JSON удалён** — публичный сайт продолжает работать; seed-скрипт даст explicit error «file not found», не загружая сайт.
- **`technicalAttributes` пусто** — нормализация атрибутов в `Product` продолжает работать через text-инференс из `sourceRawTitle`/`sourceRawDescription` (как сейчас), Payload-данные не теряются.

## Requirements

### Functional Requirements

- **FR-001**: Создать модуль `apps/web/src/lib/products/catalog.ts`, который через `getPayload({ config })` загружает все опубликованные товары (`status: { equals: "published" }`), категории, документы и медиа, преобразует в существующий тип `Product` и кеширует на запрос через `React.cache()`.
- **FR-002**: Все публичные геттеры (`getProducts`, `getProductBySlug`, `getCatalogProducts`, `getCatalogFacetGroups`, `getCatalogAttributeStats`, `getRelatedProducts`) становятся `async` и возвращают `Promise<...>`.
- **FR-003**: Pure-функции (`createProductJsonLd`, `createProductBreadcrumbJsonLd`, `getListingAttributeRows`, `getProductAttributeRows`, `slugify`) остаются синхронными; вынесены в отдельный модуль или сохранены в `catalog.ts` без зависимости от данных.
- **FR-004**: Все консьюмеры из списка ниже обновлены под async-API:
  - `apps/web/src/app/sitemap.ts`
  - `apps/web/src/app/(site)/product/[slug]/page.tsx`
  - `apps/web/src/components/SeoLandingPage.tsx`
  - `apps/web/src/components/page-templates.tsx`
  - `apps/web/src/components/product/ProductDetailPage.tsx`
- **FR-005**: `source-products.ts` удалён или превращён в re-export для обратной совместимости. JSON-файл (`00-source-data/assortment/soliton1_assortment_raw.json`) остаётся как input для seed-скрипта `apps/web/scripts/seed-catalog-payload.mjs`.
- **FR-006**: Тип `Product` и `catalogRules`/`catalogFacetDefinitions` сохраняются с прежним поведением (route → matcher → title/description). Категории Payload используются как факультативный источник `title`/`description`/`h1` если slug совпадает.
- **FR-007**: Атрибуты `Product.attributes` нормализуются из Payload-полей (`sourceRawTitle`, `sourceRawDescription`, `sku`, `title`, `shortDescription`) тем же `normalizeProductAttributes()` — не теряется текущая логика инференса.
- **FR-008**: Изображения товара берутся из `imageLinks[].url` (после `rewriteLegacyAssetUrl`). Документы — из `documents` relation (`title` + `externalUrl`).

### Non-Functional Requirements

- **NFR-001**: Загрузка каталога должна укладываться в один Payload `find` запрос с `depth=1` для `documents`/`primaryCategory` (без N+1).
- **NFR-002**: `React.cache()` гарантирует, что в рамках одного SSG-рендера каталог загружается один раз даже при множественных вызовах.
- **NFR-003**: Список консьюмеров `source-products.ts` — закрыт. Если новый код хочет читать товары, он импортирует только из `lib/products/catalog`.

## Success Criteria

- **SC-001**: `pnpm --filter @soliton/web typecheck && pnpm --filter @soliton/web lint` — зелёные.
- **SC-002**: `pnpm --filter @soliton/web build` — зелёный (предполагает работающую БД).
- **SC-003**: На `/catalog/pdu/`, `/product/<любой-slug>/`, `/sitemap.xml` контент полностью совпадает с тем, что было до миграции (тот же `Product` shape, тот же набор страниц, тот же JSON-LD при тех же данных).
- **SC-004**: Поиск `grep -rn "source-products" apps/web/src` возвращает 0 results (либо только re-export shim, документированный в комментарии).

## Assumptions

- Payload-коллекции засеяны актуальным ассортиментом (66 товаров) через `apps/web/scripts/seed-catalog-payload.mjs`.
- БД (Postgres) запускается локально через docker-compose из репо, `DATABASE_URI` доступен на dev/build/runtime.
- `payload-types.ts` сгенерирован и актуален.
- React 19 `cache()` доступен и работает в Next.js 16 server components.

## Non-Goals

- Перенос `catalogRules` (route-логика) внутрь Payload — оставляем в коде, эти правила про SEO-URL, а не данные.
- Полная замена text-based инференса атрибутов на mapping из Payload `technicalAttributes` (отложено: текущая логика стабильна и хорошо протестирована; миграция станет отдельной спекой когда появятся ручные правки атрибутов).
- Удаление seed-скрипта или legacy JSON-файла — они остаются как канонический import-flow для следующего ассортимента.
- ISR / on-demand revalidation — отдельная задача; пока полагаемся на `pnpm build`.
