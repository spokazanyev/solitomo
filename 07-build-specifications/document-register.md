# Реестр Документов И Спецификаций Для Разработки Soliton

Дата: 2026-05-15.

## Назначение

Этот реестр задает список документов, которые нужно создать, обсудить и утвердить перед разработкой или по ходу разработки.

Codex должен использовать эти документы как основной источник требований.

## Статусы

- `готово` - документ уже создан и может использоваться.
- `нужно уточнить` - документ есть, но требует обсуждения.
- `создать` - документ нужно подготовить.
- `после MVP` - документ нужен позже.

## 1. Стратегия И Управление Проектом

| Документ | Файл | Статус | Зачем нужен |
|---|---|---|---|
| Мастер-план проекта | `05-implementation-roadmap/master-project-plan.md` | готово | Общая рамка проекта, этапы, цели, стек. |
| Реестр документов | `07-build-specifications/document-register.md` | готово | Управление спецификациями. |
| Roadmap разработки | `05-implementation-roadmap/development-roadmap.md` | готово | Порядок разработки для Codex. |
| SDD + GitHub Spec Kit | `05-implementation-roadmap/sdd-speckit-methodology.md` | готово | Методология разработки через Spec Kit. |
| Пошаговый SDD-план | `05-implementation-roadmap/sdd-step-by-step-execution-plan.md` | готово | Последовательность feature-спецификаций, планов, задач и имплементации. |
| Конституция Spec Kit | `.specify/memory/constitution.md` | готово | Обязательные принципы проекта и quality gates. |
| Решение по платформе | `05-implementation-roadmap/platform-evaluation.md` | готово | Выбор Next.js/Payload или альтернатив. |
| Технический фундамент проекта | `07-build-specifications/technical-project-foundation.md` | готово | Реализованный Next.js/Payload/PostgreSQL workspace и результаты проверок. |
| Риски и решения | `07-build-specifications/risks-and-decisions.md` | создать | Фиксация спорных решений и рисков. |

## 2. Данные И Каталог

| Документ | Файл | Статус | Зачем нужен |
|---|---|---|---|
| Карта ассортимента | `06-reports/01-assortment-map.md` | готово | Исходная структура товаров Soliton. |
| Нормализация товаров | `07-build-specifications/product-data-spec.md` | готово | Какие поля должны быть у товара, как чистить данные. |
| Нормализация атрибутов товаров | `07-build-specifications/product-attributes-normalization-spec.md` | готово | Controlled values для фильтров, карточек и будущего импорта. |
| Модель характеристик | `07-build-specifications/product-attributes-spec.md` | готово | Единый справочник характеристик PDU и блоков розеток. |
| Модель категорий | `01-site-structure/site-map.md` | нужно уточнить | Финальная структура категорий и URL. |
| Импорт товаров | `07-build-specifications/product-import-spec.md` | готово | Формат импорта из JSON/CSV/МойСклад в Payload. |
| Карточка товара | `07-build-specifications/product-detail-page-spec.md` | готово | Реализованный product page template, Product schema и sitemap для 66 товаров. |
| Категории и фильтры | `07-build-specifications/category-filter-pages-spec.md` | готово | Route-based SEO-фильтры, реальные товарные листинги и ItemList schema. |
| Конфигурация админки | `07-build-specifications/admin-configuration-spec.md` | нужно уточнить | Что должно управляться через Payload admin: товары, категории, SEO, контент, документы, заявки, настройки. |

## 3. Сайт И UX

| Документ | Файл | Статус | Зачем нужен |
|---|---|---|---|
| Полная структура сайта | `01-site-structure/target-site-structure.md` | готово | Целевая карта сайта. |
| Типы страниц | `02-page-design/page-types.md` | готово | Шаблоны категорий, карточек, лендингов, статей. |
| Page template system | `07-build-specifications/page-template-system-spec.md` | готово | Реализованная система шаблонов страниц в Next.js. |
| Главная и B2B trust | `07-build-specifications/homepage-b2b-trust-spec.md` | готово | Главная, B2B-раздел, proof points, trust blocks и RFQ-пути. |
| UX checkout и RFQ | `07-build-specifications/checkout-rfq-spec.md` | готово | Форма запроса КП, Payload collection, API и product-to-RFQ handoff. |
| UI/design system | `07-build-specifications/ui-design-system-spec.md` | готово | Компоненты, стиль, таблицы, формы, карточки. |
| Навигация и перелинковка | `07-build-specifications/navigation-linking-spec.md` | готово | Меню, footer, хлебные крошки, блоки похожих страниц. |
| Web/content design review | `07-build-specifications/web-content-design-review.md` | готово | Дизайнерское и контентное ревью текущих страниц, скриншоты и backlog улучшений. |
| Design review methodology | `07-build-specifications/design-review-methodology.md` | готово | Новый алгоритм ревью с full-page text inventory, marker sweep и source-line traceability. |
| Homepage review v2 | `07-build-specifications/homepage-content-design-review-v2.md` | готово | Повторное ревью главной по новому алгоритму и список P1/P2 текстовых дефектов. |
| Sitewide content/design review v2 | `07-build-specifications/sitewide-content-design-review-v2.md` | готово | Ревью всех публичных страниц по новой методологии, Public Language Gate, скриншоты, отчет и план исправлений. |
| Visual/content polish feature | `specs/014-visual-content-polish/spec.md` | готово | SDD-спецификация итерации по визуальной и контентной доводке после ревью. |
| Sitewide public copy QA | `specs/015-sitewide-public-copy-qa/spec.md` | готово | SDD-спецификация для устранения внутренних SEO/прототипных терминов из публичного UI и автоматизации проверки. |
| Sitewide review v3 work plan | `07-build-specifications/sitewide-review-v3-work-plan.md` | готово | План работ по дефектам ревью v3 с разбивкой на 6 спринтов и 12 SDD-фич (017-028). |
| MVP development pass 2026-05-15 | `07-build-specifications/mvp-site-development-pass-2026-05-15.md` | готово | Последовательный проход по главной, карточке товара, каталогу, RFQ, админке и SEO-контролю. |
| Media и documents migration | `specs/017-media-and-documents-migration/spec.md` | готово | Перенос product images и PDF из `soliton1.ru` в Payload Media/Documents; собственная отдача файлов. |
| Company contacts | `specs/018-company-contacts/spec.md` | готово | Singleton-коллекция реальных контактов компании, `ContactsTemplate`, использование в шапке/футере и в Organization JSON-LD. |
| Organization JSON-LD | `specs/019-organization-jsonld/spec.md` | готово | Расширение `createOrganizationJsonLd()` логотипом, телефоном, адресом, contactPoint, sameAs; опциональный LocalBusiness. |
| Homepage product-first | `specs/020-homepage-product-first/spec.md` | готово | Hero с реальным фото, proof-метрики, TrustBand на главной, ManufacturingShowcase, удаление keyword-чипов на non-home, dynamic OG-images. |
| RFQ page focus | `specs/021-rfq-page-focus/spec.md` | готово | Разделение B2BTemplate на B2BLandingTemplate и RfqPageTemplate; success-card после отправки заявки. |
| Product detail redesign | `specs/022-product-detail-redesign/spec.md` | готово | Hero PDP с галереей рядом с ценой, breadcrumbs с категорией, mobile sticky CTA, lightbox через `<dialog>`. |
| Site shell | `specs/023-site-shell/spec.md` | готово | Единый `SiteHeader` в layout, mobile drawer, skip-link, удаление inline-шапок из страниц. |
| Catalog mobile filters | `specs/024-catalog-mobile-filters/spec.md` | готово | Mobile drawer фильтров, desktop accordion, URL-state, улучшенный empty state. |
| Solution mini finder | `specs/025-solution-mini-finder/spec.md` | готово | Форма «параметры стойки» на solution-страницах, проброс в каталог/RFQ, related-solutions на PDP. |
| Data и content polish | `specs/026-data-and-content-polish/spec.md` | готово | priceUpdatedAt, нормализация документов, FAQ на B2B/solutions, CSS-токены бренда, toast на add-to-cart. |
| Analytics verification | `specs/027-analytics-verification/spec.md` | готово | dataLayer-события `view_item/add_to_rfq/view_cart/begin_quote/quote_submitted`, server-side hit, consent. |
| SEO canonical и validation | `specs/028-seo-canonical-check/spec.md` | готово | Trailing slash redirect, реальные `validate:seo` и `validate:schema` скрипты с отчетами. |
| Cart and three checkout flows | `specs/037-cart-and-checkout-flows/spec.md` | готово | Превращение RFQ-корзины в полноценную: оплата физлицом, счёт юрлицу, запрос КП. Payload `orders`, ЮKassa, PDF-счёт, manager workflow. |
| AI-bot policy + analytics | `specs/038-ai-bot-policy-and-analytics/spec.md` | отложено | Спека готова, реализация отложена. Отслеживается в `deferred-content-track.md` п.16. |
| Product schema enrichment | `specs/039-product-schema-enrichment/spec.md` | отложено | Спека готова, реализация отложена. См. `deferred-content-track.md` п.17. |
| Machine-readable product feeds | `specs/040-machine-readable-product-feeds/spec.md` | отложено | Спека готова, реализация отложена. См. `deferred-content-track.md` п.18. |
| Yandex Business + brand presence | `specs/041-yandex-business-and-brand-presence/spec.md` | отложено | Спека готова, реализация отложена. См. `deferred-content-track.md` п.19. |
| Article schema on knowledge | `specs/042-article-schema-on-knowledge/spec.md` | отложено | Спека готова, реализация отложена. См. `deferred-content-track.md` п.20. |
| llms.txt + agent entry points | `specs/043-llms-txt-and-agent-entry/spec.md` | отложено | Спека готова, реализация отложена. См. `deferred-content-track.md` п.21. |
| MCP server for Solton catalog | `specs/044-mcp-server-soliton/spec.md` | отложено | Спека готова, реализация отложена. См. `deferred-content-track.md` п.22. |
| Public catalog from Payload | `specs/045-public-catalog-from-payload/spec.md` | готово | Публичный сайт читает товары и категории из Payload (`lib/products/catalog.ts`); JSON-файл остаётся только как input для seed-скрипта. |
| Mobile friendly refresh | `specs/046-mobile-friendly-refresh/spec.md` | готово | Сводный мобильный аудит и доработки. |
| Delivery checkout with ApiShip | `specs/047-delivery-checkout-apiship/spec.md` | создать | Модуль доставки: расчёт тарифов, snapshot цены, ПВЗ, отправления, webhook трекинга, закрытие сделки, event emitter, минимальный email-stub (4 шаблона). Ядро портировано из Medusa-плагина (MIT). |
| Twenty CRM sync | `specs/048-twenty-crm-sync/spec.md` | создать | Синхронизация Soliton Orders ↔ Twenty (Person/Company/Opportunity/Activity), маппинг стадий, миграция custom fields, авто-задачи менеджеру, очередь crm-sync-jobs с retry. Soliton → Twenty в MVP; двунаправленность во второй фазе. |
| Customer notifications | `specs/049-customer-notifications/spec.md` | создать | Модуль уведомлений: **email** (Postmark/Mailgun/SendPulse) + admin + placeholder-канал `messenger` (под 050). Матрица событий, queue notification-jobs с dedup и retry, opt-in/opt-out, React-email шаблоны, cron ПВЗ-напоминаний и stuck-alerts. **SMS не реализуется** (решение 2026-05-23). |
| Messenger notifications (Telegram/MAX) | `specs/050-messenger-notifications/spec.md` | после MVP | Второй канал клиентских уведомлений — мессенджер. Telegram-бот в первую очередь, MAX/VK Messages — позже. Подключается к event emitter из 047, регистрирует sender для канала `messenger` в 049. |
| Order numbering + items immutability | `specs/051-order-numbering-and-immutability/spec.md` | создать | Человекочитаемый номер заказа `SO-YYYY-NNNN` + блокировка изменения позиций/итогов после `paid`. Низкая стоимость, высокая ценность для UX и аудита. |
| Cart as entity | `specs/052-cart-as-entity/spec.md` | создать | Выделение корзины из localStorage в coll. `carts`: cart-abandonment, cross-device sync, конверсионная аналитика, merge при логине. |
| Returns & Refunds | `specs/053-returns-and-refunds/spec.md` | создать | Полноценный жизненный цикл возврата: coll. `returns` с `returnNumber`, частичные возвраты, ЮKassa Refund API, ApiShip return-shipment, корректировочные счёт-фактуры. |
| Customer account | `specs/054-customer-account/spec.md` | создать | Coll. `customers` + `companies`, magic-link для гостей, авторизация для зарегистрированных, личный кабинет с историей заказов, B2B-роли, GDPR-экспорт/удаление. |
| Order lifecycle (cross-cutting) | `07-build-specifications/order-lifecycle-spec.md` | создать | Канонический документ жизненного цикла заказа: state machine, snapshot цены, матрица уведомлений (отсылка к 049), маппинг в Twenty (отсылка к 048), SLA, закрытие сделки. Источник истины для 047/048/049. |
| CRM integration pattern | `07-build-specifications/crm-integration-pattern.md` | создан 2026-05-24 | Архитектурный паттерн интеграции с Twenty CRM: capability matrix (7 функциональных областей × 3 режима), 4-фазный rollout, email-policy contract, immutability guards, inbound webhook contract. Целевая архитектура; в MVP `crmSettings.enabled=false`, сервис автономен. |

## 4. Контент И SEO

| Документ | Файл | Статус | Зачем нужен |
|---|---|---|---|
| Семантическое ядро | `06-reports/03-semantic-core.md` | готово | Спрос и кластеры. |
| Валидация спроса | `06-reports/02-demand-validation-and-semantics.md` | готово | Почему эти страницы нужны. |
| Конкурентный и конверсионный анализ | `07-build-specifications/competitor-marketing-analysis.md` | готово | Паттерны маркетинга, визуала, копирайтинга и конверсии конкурентов. |
| Позиционирование и копирайтинг | `07-build-specifications/copywriting-and-positioning-spec.md` | готово | Голос бренда, аудитории, CTA, шаблоны текстов и claim-control. |
| Контентные ТЗ | `03-content/content-briefs.md` | готово | Правила написания страниц и карточек. |
| Методы SEO | `04-seo-methods/seo-methods.md` | готово | Общие SEO-методы. |
| SEO technical spec | `07-build-specifications/seo-technical-spec.md` | готово | Metadata, sitemap, robots, canonical, JSON-LD. |
| Landing page matrix | `07-build-specifications/seo-landing-matrix.md` | готово | Список SEO-посадочных по приоритетам. |
| Content production plan | `07-build-specifications/content-production-plan.md` | готово | Очередность текстов, шаблоны, claim-control и workflow производства контента. |

## 5. Интеграции

| Документ | Файл | Статус | Зачем нужен |
|---|---|---|---|
| Оплата и логистика в России | `05-implementation-roadmap/russia-payments-logistics.md` | готово | Общая рамка российских платежей и доставки. |
| Агрегаторы оплаты и доставки | `05-implementation-roadmap/russian-payment-delivery-aggregators.md` | готово | Выбор ЮKassa, ApiShip, СДЭК и др. |
| Order lifecycle (cross-cutting) | `07-build-specifications/order-lifecycle-spec.md` | создать | См. полное описание в разделе 3 (Сайт и страницы) — canonical для 047/048/049. |
| МойСклад | `05-implementation-roadmap/moysklad-ecommerce-integration-evaluation.md` | готово | Роль МойСклад и варианты интеграции. |
| МойСклад API spec | `07-build-specifications/moysklad-integration-spec.md` | после MVP | Потоки товаров, остатков, заказов, контрагентов. |
| Payment integration spec | `07-build-specifications/payment-integration-spec.md` | создать | ЮKassa, счета, webhooks, 54-ФЗ. |
| Delivery integration spec | `07-build-specifications/delivery-integration-spec.md` | создать | ApiShip, СДЭК, Деловые Линии, ПВЗ. |
| Email/notifications spec | `07-build-specifications/notifications-spec.md` | создать | Письма клиенту, менеджеру, статусы. |

## 6. Аналитика И Контроль

| Документ | Файл | Статус | Зачем нужен |
|---|---|---|---|
| Analytics spec | `07-build-specifications/analytics-measurement-spec.md` | готово | Яндекс Метрика, GA4, цели, события. |
| SEO monitoring spec | `07-build-specifications/seo-monitoring-spec.md` | создать | Яндекс Вебмастер, Search Console, позиции, CTR. |
| QA checklist | `07-build-specifications/qa-acceptance-checklist.md` | готово | Проверка перед запуском и JTBD-проходы. |

## 7. Эксплуатация

| Документ | Файл | Статус | Зачем нужен |
|---|---|---|---|
| Deployment spec | `07-build-specifications/deployment-spec.md` | создать | Хостинг, env, backups, домены, SSL. |
| Security and access spec | `07-build-specifications/security-access-spec.md` | создать | Доступы, API-ключи, роли, секреты. |
| Admin operations guide | `07-build-specifications/admin-operations-guide.md` | после MVP | Как менеджеру вести товары, заказы, контент. |

## Приоритет Обсуждения

Сначала обсудить:

1. `.specify/memory/constitution.md`
2. `05-implementation-roadmap/sdd-speckit-methodology.md`
3. `05-implementation-roadmap/sdd-step-by-step-execution-plan.md`
4. первая feature spec в `specs/`: `competitor-conversion-research`
5. `copywriting-and-positioning-spec.md`
6. `ui-design-system-spec.md`
7. `product-data-spec.md`
8. `site-map.md`
9. `page-types.md`
10. `seo-technical-spec.md`
11. `checkout-rfq-spec.md`
12. `specs/013-conversion-rfq-mvp/spec.md`
13. `moysklad-integration-spec.md`
14. `payment-integration-spec.md`
15. `delivery-integration-spec.md`
16. `analytics-measurement-spec.md`

После этих документов Codex сможет начать разработку MVP с меньшим риском переделок.
