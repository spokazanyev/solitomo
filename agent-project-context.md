# Agent Project Context: Soliton Organic Site

Дата обновления: 2026-05-15.

## Назначение Проекта

Проект создает новый сайт и интернет-магазин Soliton для продажи PDU, блоков розеток, сетевых фильтров и смежного оборудования. Основная цель: привлекать органический трафик из поиска, конвертировать частных и корпоративных покупателей в заявки, КП и заказы, а затем подключить оплату, доставку и учетные интеграции.

## Стек

- Next.js 16
- React 19
- Payload CMS 3
- PostgreSQL
- pnpm workspace
- Docker Compose для локальной БД

## Важные Принципы

- Разработка ведется по SDD: spec -> plan -> tasks -> implementation -> verification.
- Публичные страницы должны соответствовать schema.org там, где это применимо.
- SEO-безопасность обязательна: `/admin/`, `/api/` и параметрические URL не индексируются.
- МойСклад, оплата и доставка пока не реализуются в текущем фокусе.
- Сейчас приоритет: современный сайт, каталог, заявки на фильтры/PDU, SEO и agent-ready админка.

## Текущий Статус

Реализовано:

- публичный сайт на Next.js;
- главная, каталог, карточки товаров, B2B, документы, knowledge/company/use-case страницы;
- RFQ форма и сохранение заявок в Payload;
- базовая Payload admin;
- Product/ItemList/Breadcrumb schema.org на публичных страницах;
- управляемая спецификация админки;
- начальный слой Payload collections для товаров, категорий, атрибутов, фильтров, документов, медиа и audit log.
- seed текущего ассортимента в Payload: 66 товаров, 11 категорий, 7 полей фильтров, 18 опций фильтров, 91 media-запись, 21 уникальный документ.

Публичный каталог читает товары и категории из Payload через `apps/web/src/lib/products/catalog.ts` (spec 045). JSON-файл `00-source-data/assortment/soliton1_assortment_raw.json` остаётся как input для seed-скрипта `apps/web/scripts/seed-catalog-payload.mjs`; редактирование товаров — только через Payload admin или MCP-канал.

## Ключевые Документы

- `07-build-specifications/document-register.md`
- `05-implementation-roadmap/development-roadmap.md`
- `05-implementation-roadmap/sdd-step-by-step-execution-plan.md`
- `07-build-specifications/admin-configuration-spec.md`
- `specs/016-admin-configuration-system/spec.md`
- `07-build-specifications/product-data-spec.md`
- `07-build-specifications/product-attributes-normalization-spec.md`
- `07-build-specifications/seo-technical-spec.md`
- `07-build-specifications/checkout-rfq-spec.md`
- `07-build-specifications/design-review-methodology.md`
- `07-build-specifications/sitewide-review-v3-work-plan.md`

## Текущая Feature

Параллельно идут две дорожки:

1. `specs/016-admin-configuration-system` — agent-ready Payload admin (продолжается).
2. Доводка публичного сайта по Sitewide Review v3 — спринт 0 / `specs/017-media-and-documents-migration`. Дальше по плану: 015, 018, 019 (спринт 1), 020 (спринт 2), 021–023 (спринт 3), 024–025 (спринт 4), 026–028 (спринт 5). См. `07-build-specifications/sitewide-review-v3-work-plan.md`.

Цель дорожки v3: устранить утечку внутренних SEO-терминов, добавить реальные контакты компании, перенести product images и PDF из `soliton1.ru` в Payload, сделать главную похожей на сайт производителя, очистить `/b2b/request-quote/` от дублей, перестроить PDP, обеспечить mobile-friendly каталог и интерактивный подбор на solution-страницах, верифицировать аналитику и реализовать реальные `validate:seo`/`validate:schema`.

## Agent Workflow

1. Прочитать этот файл.
2. Прочитать текущий `AGENTS.md`.
3. Проверить активную feature spec и task list.
4. Найти записи по stable identifiers: `sku`, `slug`, `code`, `id`.
5. Для массовых изменений сначала выполнить dry-run.
6. Для high-risk изменений запросить подтверждение владельца.
7. После изменения запустить проверки.
8. Зафиксировать результат и, когда workflow будет реализован полностью, записать audit log.

High-risk изменения:

- цены;
- юридические утверждения;
- сертификаты;
- реестровые сведения;
- payment/delivery/integration settings;
- production secrets;
- индексация технических URL.

## Команды

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm --filter @soliton/web generate:types
pnpm --filter @soliton/web generate:importmap
pnpm --filter @soliton/web agent:context
pnpm --filter @soliton/web seed:catalog:dry-run
pnpm --filter @soliton/web seed:catalog
pnpm --filter @soliton/web validate:catalog
pnpm --filter @soliton/web validate:seo
pnpm --filter @soliton/web validate:schema
pnpm --filter @soliton/web smoke:public-pages
```

## Локальные URL

- Public site: `http://localhost:3000/`
- Payload admin: `http://localhost:3000/admin/`
- RFQ: `http://localhost:3000/b2b/request-quote/`
- Catalog: `http://localhost:3000/catalog/pdu/`
- Product sample: `http://localhost:3000/product/sp-8/`

## Payload Collections

Базовые:

- `users`
- `rfq-requests`

Agent-ready catalog/admin layer:

- `products`
- `categories`
- `attribute-groups`
- `attributes`
- `attribute-options`
- `filter-groups`
- `filter-fields`
- `filter-options`
- `filter-presets`
- `media`
- `documents`
- `admin-change-log`

## Следующие Шаги

1. Закрыть спринт 0 `specs/017-media-and-documents-migration` — выкачать ассеты с `soliton1.ru` и переключить компоненты на Payload-backed URL.
2. Поднять `specs/015-sitewide-public-copy-qa` до Implementation, параллельно начать `specs/018-company-contacts` и `specs/019-organization-jsonld`.
3. После спринтов 0–1 — `specs/020-homepage-product-first` и спринт 3 (`021`, `022`, `023`).
4. Параллельно с этим: переключить публичные карточки и каталог на Payload (см. `agent-project-context.md` исторический пункт 1).
5. Реализовать полноценный agent propose/apply workflow с diff, preview и audit log.
6. Реализовать реальные validation scripts (`specs/028-seo-canonical-check`) вместо placeholder-команд.
7. После стабилизации решить, нужен ли MCP.
