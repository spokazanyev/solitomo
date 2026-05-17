# SEO Technical Specification

Дата: 2026-05-15.

## Назначение

Спецификация задает технический SEO-каркас нового сайта Soliton: URL, canonical, sitemap, robots, metadata, структурированные данные, индексируемость фильтров и правила для будущих товарных страниц.

## Реализованный Базис

Кодовая реализация:

- `apps/web/src/lib/seo/seo-registry.ts` - единый реестр SEO-маршрутов.
- `apps/web/src/app/sitemap.ts` - sitemap из реестра.
- `apps/web/src/app/robots.ts` - robots policy.
- `apps/web/src/lib/seo/structured-data.ts` - BreadcrumbList и Organization JSON-LD.
- `apps/web/src/components/SeoLandingPage.tsx` - общий скелет SEO-страницы.
- `apps/web/next.config.ts` - `trailingSlash: true`.

## Canonical Policy

| Тип URL | Правило |
|---|---|
| Публичные посадочные | Канонический URL с завершающим `/`. |
| URL без завершающего `/` | 308 redirect на вариант с `/`. |
| `/admin/` | Не индексировать, закрыть в robots. |
| `/api/` | Не индексировать, закрыть в robots. |
| URL с параметрами `?` | Не индексировать, закрыть в robots как `/*?*`. |
| Случайные фильтры | Не индексировать, пока не созданы как отдельные посадочные. |
| Пагинация | Canonical на текущую страницу или основную категорию определяется позже в feature фильтров. |
| Товарные страницы | `/product/{sku-slug}/`, включены в sitemap после `008-product-detail-pages`. |

## Sitemap Policy

Текущий sitemap включает 102 индексируемых URL:

- главная;
- 11 каталоговых страниц;
- 4 solution/use-case страницы;
- 5 B2B страниц;
- 9 knowledge страниц;
- 3 document страницы;
- 3 company страницы.
- 66 product pages из исходного ассортимента.

Частота и priority задаются в `seo-registry.ts`. При подключении CMS sitemap должен собирать:

- статические страницы из реестра;
- категории из Payload;
- индексируемые SEO-посадочные;
- опубликованные товары;
- опубликованные статьи.

## Robots Policy

Текущий `robots.txt`:

```text
User-Agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /*?*

Sitemap: {siteUrl}/sitemap.xml
```

Перед запуском нужно заменить `NEXT_PUBLIC_SITE_URL` на production-домен.

## Metadata Policy

Для каждой индексируемой страницы обязательны:

- `title`;
- `description`;
- `alternates.canonical`;
- `openGraph.title`;
- `openGraph.description`;
- `openGraph.url`;
- `robots.index = true`;
- `robots.follow = true`.

Правила написания:

- Title начинается с поискового объекта, а не с бренда.
- Description объясняет назначение, параметры и следующий шаг.
- H1 должен быть коммерчески точным и не дублировать title дословно, если это ухудшает читаемость.

## Structured Data Policy

Соответствие актуальному словарю schema.org и рекомендациям поисковых систем является обязательным проектным требованием. Любая новая публичная страница или изменение товарных/категорийных данных должны сохранять валидную, правдивую и машиночитаемую JSON-LD-разметку.

| Тип страницы | Schema |
|---|---|
| Все публичные страницы | `BreadcrumbList` |
| Главная | `Organization` |
| Категория | `ItemList` для route-based товарных листингов |
| Карточка товара | `Product`, `Offer`, `PropertyValue`, `BreadcrumbList` |
| FAQ-блок | `FAQPage`, если FAQ уникален и видим пользователю |
| База знаний | `Article`, после появления финального текста |
| Контакты | `Organization` или `LocalBusiness`, после подтверждения реквизитов/адреса |

Для товаров:

- `Product.@id` должен быть стабильным `{canonical}#product`.
- `Offer.@id` должен быть стабильным `{canonical}#offer`.
- Технические параметры выводятся через `additionalProperty` как `PropertyValue`.
- `availability` разрешено добавлять только после появления достоверных остатков или ручного статуса наличия.
- `review` и `aggregateRating` запрещены без реальных отзывов.
- Документы товара можно выводить через `subjectOf`, если URL документа есть в исходных данных.

## Indexable Filter Policy

Индексировать только спросовые комбинации, которые станут отдельными URL или CMS-посадочными:

- 19 дюймов 1U;
- 8 розеток;
- Schuko;
- IEC C13;
- IEC C19;
- 16A;
- 32A;
- вертикальные;
- мониторинг;
- управление;
- трехфазные.

Не индексировать:

- сортировку;
- цену;
- цвет без самостоятельного спроса;
- пустые фильтры;
- комбинации без товаров;
- технические параметры без уникального интента;
- любые URL с query string.

## Redirect Policy For Старый Сайт

Перед запуском нужно создать карту редиректов:

| Источник | Цель |
|---|---|
| Старые категории soliton1.ru | Новые `/catalog/.../` |
| Старые карточки | Новые `/product/{sku-slug}/` |
| Старые документы | Новые `/documents/.../` |
| Удаленные товары | Ближайшая категория или аналог |

Редиректы должны быть 301.

## Quality Gates

Перед merge каждого SEO-related feature:

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
```

Дополнительно:

```bash
curl -sI http://localhost:3000/catalog/pdu/
curl -sI http://localhost:3000/catalog/pdu
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml
```

## Sources

- Next.js local docs: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md`
- Next.js local docs: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md`
- Next.js local docs: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`
