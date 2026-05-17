# Product Detail Page Specification

Дата: 2026-05-15.

## Назначение

Документ фиксирует реализацию карточки товара Soliton для нового сайта: URL, данные, SEO, структурированные данные, контентные блоки и ограничения по неподтвержденным утверждениям.

## Реализованный Базис

Кодовая реализация:

- `apps/web/src/lib/products/source-products.ts` - адаптер над raw assortment JSON, нормализация SKU, slug, цены, бейджей и JSON-LD.
- `apps/web/src/lib/products/source-products.ts` - вычисляемые коммерческие атрибуты: тип изделия, монтаж, розетки, ток, ввод, кабель, функции, документы и статус поставки.
- `apps/web/src/app/product/[slug]/page.tsx` - product route, static params, metadata, canonical.
- `apps/web/src/components/product/ProductDetailPage.tsx` - UI карточки.
- `apps/web/src/app/sitemap.ts` - добавление 66 product URLs в sitemap.

## URL Policy

| Объект | Правило |
|---|---|
| Карточка товара | `/product/{sku-slug}/` |
| Slug | Генерируется из SKU, приводится к ASCII, `+` и пробелы заменяются дефисами. |
| Canonical | Совпадает с публичным URL карточки и имеет завершающий `/`. |
| Неизвестный slug | Возвращает Next.js `notFound()`. |

## Page Blocks

Карточка товара должна содержать:

- H1 с нормализованным названием.
- SKU и категорию.
- Краткое описание.
- Ориентировочную цену или `Цена по запросу` с пояснением, что итоговая стоимость подтверждается в КП.
- CTA `Запросить КП`.
- Вторичный CTA на подбор/совместимость.
- Коммерческая панель: наличие/срок, поставка по России, документы.
- Изображение или пустое состояние.
- Ключевые параметры выбора и смысловые группы характеристик из raw `specs`: электропитание, розетки, защита, кабель, монтаж, конструктив.
- Блок уточнений перед заказом.
- Описание, разбитое на блоки: назначение, что проверить перед КП, очищенные сведения из исходного описания.
- Документы.
- Доставка и оплата.
- B2B-блок для юрлиц, КП и ТЗ.
- Похожие товары.

## SEO Requirements

Для каждой карточки:

- `title`: `{H1} {SKU}`.
- `description`: краткое описание из source data.
- `alternates.canonical`: `/product/{slug}/`.
- `openGraph`: title, description, first image, URL.
- `sitemap.xml`: weekly frequency, priority `0.64`.

Текущий sitemap после этапа содержит 102 URL: 36 статических SEO URL и 66 карточек товаров.

## Structured Data

Карточка отдает:

- `BreadcrumbList`;
- `Product`;
- `Offer`, если есть числовая цена;
- `additionalProperty` / `PropertyValue` для нормализованных характеристик;
- `category`, `brand`, `manufacturer`, `model`, `mpn`, `productID`;
- `seller` и `itemCondition` внутри `Offer`;
- `subjectOf` для документов товара, если они есть в исходных данных.

`availability` не выводится в schema.org до подключения достоверных остатков. В UI допустим только текст "Наличие и срок подтверждаются при КП". Реестр, сертификаты и сравнение с APC/APS допускаются только после привязки доказательств к конкретному товару или странице.

## Data Source

Текущий источник: `00-source-data/assortment/soliton1_assortment_raw.json`.

Это временный read-only источник для SDD-этапа. После импорта в Payload или синхронизации с МойСклад этот слой должен быть заменен на CMS/import-backed источник без изменения публичных URL.

## Validation

Выполнены проверки:

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
curl -sI http://localhost:3000/product/s-16c13-2c19/
curl -s http://localhost:3000/sitemap.xml | rg -c '<loc>'
```

Результат:

- product route: `200 OK`;
- sitemap URL count: `102`;
- build: `109` generated pages, включая 66 product paths.

## Next Feature

`009-category-filter-pages`: связать категории с товарами, добавить листинги, фильтры, индексируемые комбинации, внутреннюю перелинковку и SEO-тексты категорий.
