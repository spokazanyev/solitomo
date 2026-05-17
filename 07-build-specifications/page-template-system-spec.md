# Page Template System Specification

Дата: 2026-05-15.

SDD feature: `specs/007-page-template-system`.

## Назначение

Эта спецификация фиксирует систему шаблонов страниц нового сайта Soliton. После этапа `006-seo-site-structure` сайт имел URL и SEO-скелет; теперь каждая группа страниц получила собственную структуру блоков, соответствующую поисковому интенту и конверсионной задаче.

## Реализовано В Коде

- `apps/web/src/components/SeoLandingPage.tsx` - общий SEO-shell: header, breadcrumbs, hero, JSON-LD.
- `apps/web/src/components/page-templates.tsx` - шаблоны разных типов страниц.
- `apps/web/src/lib/seo/template-content.ts` - данные для фильтров, примерных товаров, trust-блоков, B2B-процесса и документов.
- `apps/web/src/lib/seo/seo-registry.ts` - сохраняет маршруты, metadata, canonical и sitemap-данные.
- `lucide-react` добавлен для прикладных UI-иконок.

## Шаблоны

| Тип | Компонент | Назначение |
|---|---|---|
| Главная | `HomeTemplate` | Вести в каталог, подбор PDU, B2B, документы и знания. |
| Категория | `CatalogTemplate` | Фильтры, товарные строки, сравнение параметров, выбор, перелинковка. |
| Use-case | `SolutionTemplate` | Перевести задачу стойки/ЦОД/шкафа в параметры PDU. |
| Knowledge | `KnowledgeTemplate` | Статья с практической структурой и переходами к категориям. |
| B2B | `B2BTemplate` | Процесс КП, данные для юрлица, поля RFQ, документы. |
| Documents | `DocumentTemplate` | Документы, сертификаты, реестр, claim-control, закупки. |
| Company | `CompanyTemplate` | История, производство, доверие, контакты и переход в подбор. |

## Category Template Requirements

Категория должна содержать:

- H1 и intro из SEO registry;
- фильтры по монтажу, току, розеткам и функциям;
- список товаров или placeholder до импорта;
- технические badges;
- CTA "Запросить КП";
- блок "Как выбрать";
- таблицу/сравнение параметров;
- внутреннюю перелинковку на категории, use-case и knowledge.

## B2B Template Requirements

B2B-страницы должны содержать:

- процесс работы от ТЗ до КП;
- список данных, нужных для заявки;
- RFQ-макет;
- trust-блоки;
- ссылки на каталог, документы и компанию.

## Knowledge Template Requirements

Статья должна:

- начинаться с практического объяснения;
- не конкурировать с коммерческой категорией;
- вести в подбор или категорию;
- иметь перелинковку;
- в будущем получать `Article` и `FAQPage` schema после финального текста.

## Claim-Control

Текущие trust-блоки намеренно формулируются осторожно:

- "19+ лет истории" требует подтверждения года основания.
- "Российское производство" указывается по подтвержденным линейкам.
- "Реестр" используется только с номером записи и документом.
- Сравнение с APC/APS не публикуется как прямое утверждение без доказательств.

## Verification

Выполнено:

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
```

Smoke-test:

```text
200 /
200 /catalog/pdu/
200 /solutions/pdu-dlya-servernogo-shkafa/
200 /knowledge/kak-vybrat-pdu/
200 /b2b/
200 /documents/
200 /company/about/
```

Дополнительно проверено:

- `/catalog/pdu/` содержит `Фильтры для каталога`, `Модели для первичного подбора`, `Сравнение параметров`.
- `/b2b/` содержит `Для юрлиц`, `Компания, ИНН`, `Быстрый RFQ-макет`.
- JSON-LD остается в HTML.

## Следующий Этап

Следующий SDD-этап: `008-product-detail-pages`.

Нужно реализовать карточку товара и подготовить данные так, чтобы импортированные товары могли получать реальные product pages, Product schema, характеристики, документы, похожие товары и RFQ/корзину.
