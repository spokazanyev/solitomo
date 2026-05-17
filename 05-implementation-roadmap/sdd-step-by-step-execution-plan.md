# Пошаговый SDD-План Выполнения Проекта Soliton

Дата: 2026-05-14.

## Назначение

Этот документ задает последовательность работ по созданию нового сайта Soliton. Каждый шаг выполняется по методологии SDD через GitHub Spec Kit:

```text
1. Создать feature specification
2. Уточнить неоднозначности
3. Создать implementation plan
4. Создать tasks
5. Выполнить implementation
6. Проверить acceptance criteria
7. Обновить проектные документы
8. Перейти к следующему шагу
```

Разработка не должна начинаться с кода. Код появляется только после `spec.md`, `plan.md` и `tasks.md`.

## Главный Принцип

Сайт Soliton должен быть не просто технически работающим магазином. Он должен быть:

- современным визуально;
- убедительным для B2B и B2C покупателей;
- сильным по SEO;
- точным по техническим характеристикам;
- удобным для подбора PDU;
- готовым к интеграциям оплаты, доставки и МойСклад;
- измеримым через Яндекс Метрику, GA4, Яндекс Вебмастер и Google Search Console.

Копирайтинг, визуал, структура карточек, технические детали, документы, FAQ и конверсионные блоки являются обязательной частью продукта.

## Общий SDD-Цикл Для Каждого Шага

Для каждого шага используется один feature-каталог в `specs/`.

Пример:

```text
specs/001-competitor-conversion-research/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/
  quickstart.md
  tasks.md
```

Команды/навыки:

```text
$speckit-specify
$speckit-clarify
$speckit-plan
$speckit-tasks
$speckit-analyze
$speckit-implement
```

`$speckit-clarify` и `$speckit-analyze` используются там, где есть риск неоднозначности или рассинхронизации документов.

## Маркетинговая Рамка От Конкурентов

Предварительное изучение APC/Schneider, Raritan, Vertiv, Eaton, Legrand/Server Technology, Hyperline и DKC показывает, что сильные страницы PDU обычно делают акцент на:

- надежности питания и uptime;
- мониторинге тока, напряжения, мощности и энергии;
- управлении розетками и удаленной перезагрузке оборудования;
- плотности розеток и гибкости конфигураций;
- безопасности и предотвращении перегрузок;
- сертификации, тестировании и гарантиях;
- подборе PDU под стойку, ток, тип розеток и сценарий;
- datasheet, manuals, PDF-документах;
- таблицах характеристик;
- FAQ и помощи инженера;
- B2B-заявке, sales contact или request quote.

Эти паттерны должны быть адаптированы для Soliton: не копировать чужие формулировки, а использовать правильные смысловые блоки.

## Этап 0. SDD И Правила Проекта

Feature: `sdd-project-governance`

Цель: зафиксировать правила разработки, качество, последовательность работ и acceptance gates.

Уже создано:

- `.specify/memory/constitution.md`
- `05-implementation-roadmap/sdd-speckit-methodology.md`

Нужно выполнить:

1. Обсудить конституцию проекта.
2. Утвердить обязательность SDD для всех крупных функций.
3. Зафиксировать, что без spec/plan/tasks Codex не начинает имплементацию.

Результат:

- SDD является официальным процессом проекта.

Критерий перехода:

- пользователь подтверждает, что порядок работ принят.

## Этап 1. Конкурентный И Конверсионный Анализ

Feature: `competitor-conversion-research`

Зачем нужен: перед дизайном и текстами нужно понять, какие аргументы и структуры используют сильные производители PDU и российские конкуренты.

Что должна описать спецификация:

- список конкурентов;
- какие страницы изучаем;
- какие блоки фиксируем;
- какие офферы и CTA анализируем;
- какие технические аргументы повторяются;
- какие элементы можно адаптировать для Soliton;
- какие элементы нельзя использовать из-за отсутствия фактов/подтверждений.

Основные источники для изучения:

- Raritan PX/PX4;
- Vertiv PowerIT/Geist;
- Eaton Rack PDU;
- Legrand/Server Technology;
- APC/Schneider Electric;
- Hyperline;
- DKC;
- ЦМО/ITK при необходимости.

Что имплементируется:

- `07-build-specifications/competitor-marketing-analysis.md`;
- матрица маркетинговых паттернов;
- список конверсионных блоков для Soliton;
- список технических claims, которые можно использовать только после подтверждения.

Acceptance criteria:

- есть таблица конкурентов;
- есть список паттернов;
- есть рекомендации для карточки, категории, главной, B2B-страниц;
- claims разделены на подтвержденные и требующие проверки.

## Этап 2. Позиционирование, Сообщения И Копирайтинг

Feature: `positioning-copy-system`

Зачем нужен: сайт должен продавать не только наличием товара, но и понятным обещанием ценности.

Что должна описать спецификация:

- целевые аудитории;
- Jobs To Be Done;
- боли частных покупателей;
- боли корпоративных покупателей;
- боли интеграторов и закупщиков;
- тональность текстов;
- правила технического копирайтинга;
- запрещенные маркетинговые преувеличения;
- CTA;
- структура текстов для карточек, категорий, use-case страниц и статей.

Что имплементируется:

- `07-build-specifications/copywriting-and-positioning-spec.md`;
- голос бренда;
- шаблоны H1, intro, benefits, FAQ, CTA;
- правила написания технических характеристик;
- список конверсионных формулировок.

Acceptance criteria:

- есть единый стиль текстов;
- тексты не выглядят как SEO-наполнитель;
- каждый тип страницы имеет копирайтинговый шаблон;
- технические утверждения проверяемы.

## Этап 3. Визуальная Концепция И UI-Система

Feature: `visual-design-system`

Зачем нужен: Soliton нужен современный визуал, а не типовой каталог с таблицами.

Что должна описать спецификация:

- визуальный характер бренда;
- сетка;
- типографика;
- цвета;
- компоненты;
- карточки товара;
- таблицы характеристик;
- фильтры;
- кнопки;
- формы;
- CTA-блоки;
- блоки доверия;
- адаптивность;
- требования к изображениям и схемам.

Что имплементируется:

- `07-build-specifications/ui-design-system-spec.md`;
- UI tokens;
- компонентная библиотека;
- прототипы главных типов страниц;
- правила визуального оформления технических таблиц.

Acceptance criteria:

- дизайн выглядит современно и технически уверенно;
- страницы хорошо читаются на mobile и desktop;
- таблицы характеристик не перегружают пользователя;
- CTA видны, но не мешают изучать характеристики.

## Этап 4. Модель Товарных Данных

Feature: `product-catalog-foundation`

Зачем нужен: каталог, SEO, доставка, оплата и МойСклад зависят от правильной модели товара.

Что должна описать спецификация:

- Product;
- Category;
- Attribute;
- Attribute Group;
- Product Document;
- Product Image;
- Price;
- Stock;
- SEO fields;
- delivery fields;
- payment/fiscal fields;
- relations.

Что имплементируется:

- `07-build-specifications/product-data-spec.md`;
- `07-build-specifications/product-attributes-spec.md`;
- Payload collections;
- importer for current Soliton data;
- validation rules.

Acceptance criteria:

- все 66 товаров можно импортировать;
- характеристики нормализованы;
- товар пригоден для карточки, фильтра, доставки, оплаты и SEO;
- повторный импорт не создает дубли.

## Этап 5. Технический Скелет Проекта

Feature: `technical-project-foundation`

Зачем нужен: создать кодовую базу, на которой дальше будут строиться features.

Что должна описать спецификация:

- структура репозитория;
- Next.js;
- Payload CMS;
- PostgreSQL;
- Docker;
- окружения;
- env;
- базовые scripts;
- testing baseline;
- deployment baseline.

Что имплементируется:

- Next.js app;
- Payload CMS;
- PostgreSQL;
- Docker Compose;
- базовый layout;
- healthcheck;
- README запуска.

Acceptance criteria:

- проект запускается локально;
- админка работает;
- база подключена;
- есть базовые проверки.

## Этап 6. Информационная Архитектура И SEO-Каркас

Feature: `seo-site-structure`

Зачем нужен: структура сайта должна быть построена вокруг спроса и будущей индексации.

Что должна описать спецификация:

- структура URL;
- категории;
- подкатегории;
- use-case страницы;
- фильтры;
- страницы оплаты/доставки/B2B;
- sitemap;
- robots;
- canonical;
- breadcrumbs;
- JSON-LD;
- правила индексируемости.

Что имплементируется:

- финальный `site-map.md`;
- `seo-technical-spec.md`;
- routes;
- metadata;
- sitemap generation;
- robots;
- canonical logic;
- breadcrumbs.

Acceptance criteria:

- все приоритетные кластеры имеют целевые страницы;
- нет хаотичных URL;
- sitemap и robots валидны;
- страницы готовы к индексации.

## Этап 7. Шаблоны Страниц

Feature: `page-template-system`

Зачем нужен: Codex должен реализовывать не отдельные страницы вручную, а систему шаблонов.

Что должна описать спецификация:

- главная;
- категория;
- карточка товара;
- SEO-лендинг;
- use-case страница;
- статья базы знаний;
- оплата;
- доставка;
- B2B;
- запрос КП;
- контакты.

Что имплементируется:

- `02-page-design/page-types.md` update;
- компоненты шаблонов;
- reusable sections;
- responsive behavior;
- empty/error states.

Acceptance criteria:

- каждый тип страницы имеет структуру, цель, CTA и SEO-поля;
- шаблоны поддерживают будущий контент без переписывания кода;
- дизайн не ломается при длинных характеристиках.

## Этап 8. Карточки Товаров С Копирайтингом И Техническими Деталями

Feature: `product-detail-pages`

Зачем нужен: карточка должна убеждать, объяснять и конвертировать, а не просто показывать артикул.

Что должна описать спецификация:

- заголовок;
- артикул;
- ключевые преимущества;
- цена/наличие;
- запрос КП;
- характеристики;
- применение;
- совместимость;
- документы;
- доставка/оплата;
- FAQ;
- похожие товары;
- schema.org Product.

Что имплементируется:

- карточка товара;
- copy template;
- characteristic table;
- document block;
- CTA blocks;
- JSON-LD Product;
- тексты для первой группы товаров.

Acceptance criteria:

- карточка отвечает на вопросы инженера и закупщика;
- есть понятный путь к заказу/КП;
- технические данные структурированы;
- страница имеет уникальный SEO и конверсионный текст.

## Этап 9. Категории, Фильтры И SEO-Посадочные

Feature: `category-filter-pages`

Зачем нужен: основной органический трафик будет идти не только на товары, но и на категории/фильтры.

Что должна описать спецификация:

- категории;
- фильтры;
- индексируемые комбинации;
- неиндексируемые комбинации;
- SEO-тексты;
- FAQ;
- сортировка;
- товарные листинги;
- перелинковка.

Что имплементируется:

- category pages;
- filters;
- SEO landing matrix;
- internal linking blocks;
- category copy;
- FAQ.

Acceptance criteria:

- приоритетные запросы имеют посадочные;
- фильтры не создают SEO-мусор;
- категории конвертируют в карточки и заявки.

## Этап 10. Главная, B2B И Доверие

Feature: `homepage-b2b-trust`

Зачем нужен: сайт должен выглядеть как надежный поставщик технических решений, а не как набор карточек.

Что должна описать спецификация:

- главная страница;
- блоки для B2B;
- преимущества;
- подбор PDU;
- популярные категории;
- применение;
- документы;
- доставка и оплата;
- заявки для юрлиц;
- trust signals.

Что имплементируется:

- homepage;
- B2B landing;
- trust sections;
- request quote sections;
- visual blocks.

Acceptance criteria:

- с первого экрана понятно, что продает Soliton;
- есть путь для частного и корпоративного покупателя;
- страницы выглядят современно и убедительно;
- CTA не конфликтуют с техническим контентом.

## Этап 11. Контентный Производственный Цикл

Feature: `content-production-system`

Зачем нужен: нужно создать много точных страниц без хаоса и повторов.

Что должна описать спецификация:

- очередность текстов;
- шаблоны текстов;
- требования к источникам;
- правила проверки технических claims;
- список страниц первого релиза;
- процесс ревизии текстов.

Что имплементируется:

- `content-production-plan.md`;
- тексты категорий;
- тексты карточек;
- use-case страницы;
- FAQ;
- база знаний первого релиза.

Acceptance criteria:

- у приоритетных страниц есть готовый текст;
- тексты не дублируют друг друга;
- технические утверждения проверяемы;
- тексты ведут к заявке или подбору.

## Этап 12. Корзина, Заявка И Запрос КП

Feature: `rfq-and-cart`

Зачем нужен: B2B-конверсия является ключевой для Soliton.

Что должна описать спецификация:

- корзина;
- быстрый заказ;
- запрос КП;
- форма юрлица;
- ИНН/КПП;
- файл ТЗ;
- комментарии;
- статусы;
- email-уведомления;
- аналитические события.

Что имплементируется:

- cart;
- RFQ flow;
- company form;
- upload field;
- admin records;
- notifications;
- analytics events.

Acceptance criteria:

- клиент может отправить запрос КП;
- менеджер получает все данные;
- заявка сохраняется;
- событие видно в аналитике.

## Этап 13. МойСклад

Feature: `moysklad-sync`

Статус: отложен до периода после MVP. На текущем шаге сайт должен сначала стать современной витриной с приемом заявок на КП по PDU, блокам розеток и сетевым фильтрам.

Зачем нужен: операционная часть должна быть связана с учетом.

Что должна описать спецификация:

- какие данные идут из МойСклад;
- какие данные идут в МойСклад;
- товары;
- цены;
- остатки;
- заказы;
- контрагенты;
- ошибки;
- расписание;
- idempotency.

Что имплементируется:

- integration provider;
- sync jobs;
- order export;
- counterparty mapping;
- error logs.

Acceptance criteria:

- тестовый заказ появляется в МойСклад;
- повторный запрос не создает дубль;
- ошибки диагностируются.

## Этап 14. Оплата

Feature: `payments-yookassa`

Зачем нужен: сайт должен принимать оплату и поддерживать российские требования.

Что должна описать спецификация:

- ЮKassa;
- оплата по счету;
- webhooks;
- статусы;
- 54-ФЗ;
- НДС;
- возвраты;
- события аналитики.

Что имплементируется:

- PaymentProvider;
- ЮKassa integration;
- payment status handling;
- invoice request;
- fiscal data fields.

Acceptance criteria:

- тестовый платеж проходит;
- webhook безопасен;
- статус заказа обновляется;
- данные для чека доступны.

## Этап 15. Доставка

Feature: `delivery-integrations`

Зачем нужен: доставка должна работать для B2C и B2B.

Что должна описать спецификация:

- доставка по согласованию;
- ApiShip;
- СДЭК;
- Деловые Линии;
- ПВЗ;
- курьер;
- вес/габариты;
- трекинг;
- статусы.

Что имплементируется:

- ShippingProvider;
- manual delivery;
- delivery calculation;
- pickup point selection;
- tracking fields;
- status sync.

Acceptance criteria:

- доставка рассчитывается для тестового заказа;
- ПВЗ сохраняется;
- B2B доставка может быть отправлена на согласование.

## Этап 16. Аналитика, Метрики И Поисковый Контроль

Feature: `analytics-and-search-monitoring`

Зачем нужен: без измерения невозможно улучшать SEO и конверсию.

Что должна описать спецификация:

- Яндекс Метрика;
- GA4;
- ecommerce events;
- RFQ events;
- form events;
- Яндекс Вебмастер;
- Google Search Console;
- dashboard;
- debug process.

Что имплементируется:

- analytics integration;
- event layer;
- conversion goals;
- ecommerce tracking;
- search console setup checklist.

Acceptance criteria:

- события видны в debug;
- цели работают;
- формы и заявки измеряются;
- поисковые панели подключены.

## Этап 17. QA, Производительность И Запуск

Feature: `launch-qa-and-monitoring`

Зачем нужен: запуск должен быть контролируемым, а не ручным переключением домена.

Что должна описать спецификация:

- smoke tests;
- SEO QA;
- mobile QA;
- checkout QA;
- integration QA;
- performance;
- accessibility basics;
- redirects;
- monitoring after launch.

Что имплементируется:

- QA checklist;
- Playwright smoke tests;
- launch checklist;
- redirect map;
- monitoring checklist.

Acceptance criteria:

- критические сценарии проверены;
- сайт индексируем;
- формы работают;
- аналитика работает;
- нет секретов в репозитории.

## Этап 18. Пост-Запуск И Рост SEO

Feature: `post-launch-seo-growth`

Зачем нужен: органика растет итерациями после запуска.

Что должна описать спецификация:

- еженедельный SEO-ритм;
- анализ запросов;
- анализ CTR;
- доработка страниц;
- новые посадочные;
- контентные обновления;
- conversion optimization.

Что имплементируется:

- отчетный шаблон;
- backlog SEO-страниц;
- процесс обновления текстов;
- процесс A/B или последовательных UX-улучшений.

Acceptance criteria:

- есть ритм анализа;
- новые страницы создаются по данным;
- конверсия отслеживается;
- roadmap обновляется по фактическому спросу.

## Этап 19. Доводка По Sitewide Review v3 (2026-05-15)

Источник: `07-build-specifications/sitewide-review-v3-work-plan.md` и отчёт ревью v3.

Контекст:

- Sitewide content/design review v3 нашёл блокирующие дефекты: контактов компании на сайте нет; внутренние SEO-термины (`Brand trust`, `Conversion`, `B2B use-case`, `Популярные входы`, `RFQ-макет`, `Внутренняя перелинковка`) утекли в публичный UI; product images и PDF грузятся с `soliton1.ru`; главная не похожа на сайт производителя; PDP-фото оторвано от цены; на `/b2b/request-quote/` вся B2B-страница дублируется ниже формы.
- Эта работа объединена в 12 SDD-фич: `specs/017-028` плюс уже созданная `specs/015-sitewide-public-copy-qa`.

Спринт 0 — Подготовка ассетов (3–4 дня):

- `specs/017-media-and-documents-migration`: инвентаризация, скачивание, seeding в Payload, переключение компонентов, `/documents/files/[id]` route.

Спринт 1 — Public Copy Gate + контакты + Organization JSON-LD (5–7 дней):

- `specs/015-sitewide-public-copy-qa`: переписать публичные тексты, ввести `publicSummary`, удалить `RFQ-макет` и SEO-eyebrows.
- `specs/018-company-contacts`: реальные контакты, singleton-коллекция, `ContactsTemplate`.
- `specs/019-organization-jsonld`: расширить Organization schema.

Спринт 2 — Главная и trust (5 дней):

- `specs/020-homepage-product-first`: hero с фото, proof-метрики, TrustBand с proof-ссылками, ManufacturingShowcase, OG-images.

Спринт 3 — Конверсионные шаблоны (5–7 дней):

- `specs/021-rfq-page-focus`: `RfqPageTemplate`, success state.
- `specs/022-product-detail-redesign`: hero PDP с галереей+ценой, breadcrumbs с категорией, mobile sticky CTA.
- `specs/023-site-shell`: единый `SiteHeader`, mobile drawer, skip-link.

Спринт 4 — Каталог и подбор (4–5 дней):

- `specs/024-catalog-mobile-filters`: drawer, accordion, URL-state.
- `specs/025-solution-mini-finder`: интерактивная форма параметров стойки.

Спринт 5 — Качество, аналитика, SEO-валидация (5–7 дней):

- `specs/026-data-and-content-polish`: priceUpdatedAt, dedup документов, FAQ B2B/solutions, токены, toast.
- `specs/027-analytics-verification`: dataLayer-события, server-side hit, consent.
- `specs/028-seo-canonical-check`: trailing slash redirect, реальные `validate:seo` и `validate:schema`.

Линия «MVP-ready»: спринты 0–3 + критическая часть спринта 5 (27.1 события).

Acceptance этапа:

- Public Language Gate PASS 102/102, `pnpm public-copy-audit` зелёный.
- 0 запросов к `soliton1.ru` в SSR HTML.
- `/company/contacts/` с `tel:`/`mailto:`/реквизитами.
- Organization JSON-LD валиден в Google Rich Results.
- Главная с продуктовым hero и TrustBand.
- `/b2b/request-quote/` без дублей контента.
- PDP с галереей-в-hero и категорией в breadcrumbs.
- Единый header на всех страницах.
- Catalog drawer на mobile.
- Solution mini-finder работает end-to-end до RFQ.
- Метрика видит funnel `view_item → add_to_rfq → quote_submitted`.
- `pnpm validate:seo` и `pnpm validate:schema` — реальные, зелёные.

Результат этапа фиксируется в `07-build-specifications/sitewide-content-design-review-v4.md`.

## Последовательность Выполнения

Первый рабочий порядок:

1. Этап 0 - SDD и правила проекта.
2. Этап 1 - конкурентный и конверсионный анализ.
3. Этап 2 - позиционирование и копирайтинг.
4. Этап 3 - визуальная концепция и UI-система.
5. Этап 4 - модель товарных данных.
6. Этап 5 - технический скелет.
7. Этап 6 - SEO-каркас.
8. Этап 7 - шаблоны страниц.
9. Этап 8 - карточки товаров.
10. Этап 9 - категории и фильтры.
11. Этап 10 - главная и B2B.
12. Этап 11 - контентный цикл.
13. Этап 12 - корзина и запрос КП.
14. Этап 13 - МойСклад.
15. Этап 14 - оплата.
16. Этап 15 - доставка.
17. Этап 16 - аналитика и поисковый контроль.
18. Этап 17 - QA и запуск.
19. Этап 18 - рост после запуска.
20. Этап 19 - доводка по Sitewide Review v3 (parallelisable, после этапа 13 пилотного RFQ).

## Что Делать Следующим

Следующий шаг после утверждения этого документа:

```text
$speckit-specify competitor-conversion-research
```

Цель первой feature specification: изучить конкурентов и зафиксировать маркетинговые, визуальные, технические и конверсионные паттерны, которые нужно использовать в Soliton.

После этого:

```text
$speckit-plan
$speckit-tasks
$speckit-implement
```

Результатом будет первый исполняемый артефакт: конкурентная и конверсионная матрица для дизайна, копирайтинга и структуры страниц.

## Источники Для Первого Анализа

- Raritan PX4: https://www.raritan.com/products/power/power-distribution/rack-pdu
- Vertiv PowerIT Switched Rack PDU: https://www.vertiv.com/en-us/products-catalog/critical-power/power-distribution/vertiv-geist-switched-rack-pdu/
- Vertiv product model page example: https://www.vertiv.com/en-us/products-catalog/critical-power/power-distribution/vp7n30am/
- Legrand / Server Technology feature options: https://www.legrand.com/datacenter/ae-en/rack-pdu-feature-options-server-technology
- Legrand rack PDU overview: https://www.legrand.com/datacenter/jp-en/the-rack-pdu-for-all-your-data-center-needs
- Hyperline PDU category: https://www.hyperline.ru/catalog/shkafy-i-stoyki/raspredelenie-pitaniya/bloki-rozetok-pdu/
- DKC product page example: https://www.dkc.ru/ru/catalog/1469/R519SH8OPSHC14/
