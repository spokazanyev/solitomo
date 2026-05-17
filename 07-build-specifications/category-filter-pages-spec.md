# Category Filter Pages Specification

Дата: 2026-05-15.

## Назначение

Документ фиксирует реализацию SEO-категорий и фильтров каталога Soliton: какие URL индексируются, как категории связываются с товарами, какие фильтры допустимы и какие структурированные данные должны быть на страницах.

## Реализованный Базис

Кодовая реализация:

- `apps/web/src/lib/products/source-products.ts` - matching rules для категорий, route-based facet groups, счетчики товаров.
- `apps/web/src/lib/products/source-products.ts` - attribute-based stats по товарам текущей категории.
- `apps/web/src/components/page-templates.tsx` - реальные product cards в шаблоне каталога.
- `apps/web/src/components/SeoLandingPage.tsx` - подключение `ItemList` JSON-LD для catalog routes.
- `apps/web/src/lib/seo/structured-data.ts` - `createItemListJsonLd`.

## Indexable Category URLs

Индексируемыми являются только явные URL из SEO registry:

| URL | Интент |
|---|---|
| `/catalog/pdu/` | Общий каталог PDU и блоков розеток |
| `/catalog/bloki-rozetok-19-1u/` | 19 дюймов, 1U |
| `/catalog/vertical-pdu/` | Вертикальные PDU |
| `/catalog/schuko/` | Schuko |
| `/catalog/iec-c13-c19/` | IEC C13 / C19 |
| `/catalog/16a/` | 16A |
| `/catalog/32a/` | 32A |
| `/catalog/metered-pdu/` | Измерение и мониторинг |
| `/catalog/managed-pdu/` | Управление и контроль |
| `/catalog/three-phase-pdu/` | Трехфазные PDU |
| `/catalog/pdu-uzip/` | УЗИП и защита |

Фильтры в интерфейсе ведут на эти URL. Query-string фильтры, сортировка и произвольные комбинации не индексируются.

## Product Matching Policy

До нормализации атрибутов категории используют консервативное сопоставление по:

- SKU;
- названию;
- H1;
- краткому описанию;
- категориям source data;
- clusters/badges;
- raw specs;
- description text.

Правила сопоставления изолированы в `source-products.ts`, чтобы позже заменить их на нормализованные атрибуты из Payload или МойСклад.

## Page Blocks

Категория должна содержать:

- счетчик найденных товаров;
- title и описание листинга;
- фильтры как ссылки на indexable routes;
- счетчики товаров в фильтрах;
- сводку фактических параметров текущей выдачи: тип изделия, монтаж, розетки, ток, функции;
- product cards с SKU, изображением, ключевыми параметрами, функциями, описанием, ценой и CTA на КП;
- CTA на запрос КП;
- блок критериев выбора;
- таблицу сравнения параметров;
- внутреннюю перелинковку.

## Structured Data

Catalog pages отдают:

- `BreadcrumbList`;
- `ItemList` с видимыми товарами.

`ItemList` ограничивается первыми 24 товарами, чтобы structured data оставалась компактной.

## SEO Controls

Разрешено:

- индексировать явные category URLs;
- делать внутренние ссылки между category/use-case/knowledge страницами;
- показывать counts по фильтрам.
- показывать attribute-based counts внутри категории без создания новых индексируемых URL.

Запрещено до отдельной спецификации:

- индексировать query-string комбинации;
- создавать бесконечные facet URLs;
- делать attribute stats кликабельными фильтрами без отдельной SEO-спецификации;
- заявлять наличие товара на складе без источника остатков;
- обещать функции конкретного товара без подтверждения в карточке или документе.

## Validation

Проверки:

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
curl -sI http://localhost:3000/catalog/iec-c13-c19/
curl -s http://localhost:3000/catalog/iec-c13-c19/ | rg -o 'ItemList|Найдено моделей|/product/'
```

## Next Feature

`010-homepage-b2b-trust`: усилить главную, B2B-раздел и trust blocks для современной презентации производителя и конверсии в заявки.
