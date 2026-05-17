# Конкурентный И Конверсионный Анализ Для Сайта Soliton

Дата: 2026-05-14.

SDD feature: `specs/001-competitor-conversion-research`.

## Executive Summary

Сильные производители PDU продают не "блок розеток", а управляемое питание стойки: надежность, мониторинг, контроль нагрузки, удаленное управление, плотность розеток, безопасность, документы и экспертный подбор.

Российские поставщики чаще продают через каталог: тип розеток, ток, монтаж, кабель, выключатель, защита, артикул, цена, наличие. Это полезно для структуры фильтров и карточек, но слабее для конверсии и бренда.

Для Soliton нужно соединить оба подхода:

- глобальная подача ценности: надежное питание, подбор под стойку, контроль нагрузки, документы, помощь инженера;
- локальная ясность: 19", 1U, Schuko, IEC C13/C19, 10A/16A/32A, кабель, вход, наличие, доставка, счет, КП;
- B2B-конверсия: запрос КП, подбор по ТЗ, реквизиты юрлица, доставка до объекта, документы;
- SEO: категории и посадочные по типу PDU, монтажу, току, типу розеток, сценарию применения.

## Competitor Source Table

| Source | Market Role | Reviewed Page Type | Key Observations | Source |
|---|---|---|---|---|
| Raritan PX4 | Global intelligent PDU benchmark | Product family / landing | Акцент на надежности, мониторинге, intelligence, flexibility, security, datasheet и selector. | [Raritan PX4](https://www.raritan.com/products/power/power-distribution/rack-pdu) |
| Raritan PX specs | Global technical benchmark | Technical specs | Сравнение серий по monitoring, outlet control, branch monitoring, breaker alarming, metering accuracy. | [Raritan tech specs](https://www.raritan.com/ap/products/power/power-distribution/rack-pdu/tech-specs) |
| Vertiv Geist Metered | Global PDU manufacturer | Product family | Надежное питание, real-time local display, 100% testing, warranty, tools/selectors, sales contact. | [Vertiv Geist Metered](https://www.vertiv.com/en-us/products-catalog/critical-power/power-distribution/vertiv-geist-metered-rack-pdu2/) |
| Vertiv Geist category | Global PDU manufacturer | Product family | Линейка Basic, Metered, Monitored, Switched объясняет уровни зрелости PDU. | [Vertiv Rack PDU](https://go.vertiv.com/vertiv-rack-pdu/) |
| Eaton / Tripp Lite overview | Global manufacturer | Category guide | Понятная классификация Basic, Metered, Monitored, Switched, ATS, объяснение функций каждого уровня. | [Eaton PDU overview](https://tripplite.eaton.com/pages/power-distribution-units-overview) |
| Eaton product detail | Global manufacturer | Product detail | Много документов: owner manual, brochure, drawings, Visio stencil, support contacts, pre-sales support. | [Eaton switched PDU](https://www.eaton.com/us/en-us/skuPage.PDUMV20NETLX.html) |
| Legrand / Server Technology | Global intelligent PDU benchmark | Brand/product family | Экспертность, 30 years, selectors, build-your-own PDU, support, HDOT, Cx, switched PDU. | [Server Technology](https://www.legrand.us/server-technology.aspx) |
| Legrand HDOT Cx | Global innovation benchmark | Product feature page | Упор на плотность розеток, гибкость C13/C19, упрощение выбора, снижение сложности. | [HDOT Cx](https://www.legrand.com/datacenter/gb-en/hdot-cx-data-center-pdu-data-center-power-distribution-unit-server-technology) |
| Hyperline | Russian/local supplier | Category | Каталогизация по 10"/19", горизонтальному/вертикальному монтажу, Schuko, IEC C13, C19, токам и размерам. | [Hyperline PDU](https://www.hyperline.ru/catalog/shkafy-i-stoyki/raspredelenie-pitaniya/bloki-rozetok-pdu/) |
| ITK | Russian/local supplier | Category/product | Локальная терминология: электроснабжение сетевого оборудования, защита от КЗ/перенапряжения, C13/C19, промышленные вводы. | [ITK horizontal PDU](https://itk-group.ru/products/catalog/oborudovanie_telekommunikatsionnoe/elektropitanie_i_monitoring/bloki_rozetok_pdu_base/bloki_rozetok_pdu_gorizontalnye) |
| DKC | Russian/local supplier | Category/product | Простая товарная структура: PDU 19", ток, выключатель, выходные розетки, вход, код товара. | [DKC PDU](https://www.dkc.ru/ru/catalog/794/R519SH8OPSHC14/) |

## Global Benchmark Observations

## Raritan

Raritan строит страницу PX4 как технический лендинг, а не простую карточку. Основные смыслы:

- надежное питание для критической инфраструктуры;
- monitoring and intelligence;
- гибкость и плотность;
- enterprise security;
- datasheet и PDU selector как основные CTA;
- отдельный tech specs раздел для инженерного сравнения.

Что важно для Soliton:

- нужен не только список товаров, но и объяснение классов PDU;
- CTA "Подобрать PDU" должен быть рядом с "Запросить КП";
- техническая матрица возможностей повышает доверие.

## Vertiv

Vertiv хорошо показывает продуктовую лестницу: basic, metered, monitored, switched. Для metered PDU делает акцент на real-time power data, тестировании, гарантии, вариантах монтажа и инструментах подбора.

Что важно для Soliton:

- категории Soliton должны объяснять разницу между базовыми, измерительными, мониторинговыми и управляемыми PDU;
- если у товара есть амперметр/вольтметр, мониторинг или управление, это нужно выносить в первые блоки карточки;
- "помощь в подборе" должна быть отдельным конверсионным сценарием.

## Eaton / Tripp Lite

Eaton показывает понятную классификацию PDU по функциональному уровню и усиливает карточки документами и поддержкой:

- manuals;
- brochures;
- drawings;
- stencils;
- pre-sales support;
- post-sales support;
- knowledge base.

Что важно для Soliton:

- у карточек должны быть PDF, инструкции, паспорта, сертификаты, схемы;
- если документов нет, это нужно закрывать хотя бы паспортом/таблицей характеристик;
- для B2B важно показать, что перед покупкой можно задать технический вопрос.

## Legrand / Server Technology

Legrand/Server Technology продает через экспертность и конфигурируемость:

- product selector;
- build-your-own PDU;
- support;
- HDOT/Cx как технология плотности и гибкости;
- outlet control, monitoring, environmental data, security;
- "talk to a product expert" как CTA.

Что важно для Soliton:

- нужен блок "Подбор PDU под стойку и нагрузку";
- нужно объяснять, какие розетки нужны: Schuko, C13, C19, комбинации;
- будущий конфигуратор PDU может стать сильным SEO/конверсионным инструментом.

## Russian/Local Supplier Observations

## Hyperline

Hyperline силен как каталог:

- хорошо индексируемые названия товаров;
- много технических параметров прямо в названии;
- 10"/19", горизонтальный/вертикальный монтаж;
- Schuko, IEC C13, C19;
- 10A/16A/250V;
- размеры и PDF.

Что важно для Soliton:

- длинные технические названия полезны для SEO, но на сайте их нужно дополнять нормальным H1 и коротким человеческим описанием;
- фильтры должны повторять реальные параметры спроса;
- PDF и паспорт нужно показывать заметно.

## ITK

ITK и связанные страницы хорошо отражают локальную закупочную терминологию:

- "электроснабжение сетевого оборудования";
- "шкафы и стойки";
- "защита от короткого замыкания и перенапряжения";
- "международные и российские стандарты";
- наличие C13/C19 и промышленных вводов.

Что важно для Soliton:

- на страницах нужно использовать российскую терминологию рядом с PDU-терминами;
- защита, автоматы, выключатели, индикация и тип кабеля должны быть отдельными фильтрами/бейджами;
- нужно аккуратно писать про соответствие стандартам только при наличии подтверждений.

## DKC

DKC показывает лаконичную товарную подачу:

- код товара;
- ток;
- тип входа;
- тип выхода;
- количество розеток;
- выключатель;
- товарная категория.

Что важно для Soliton:

- технические параметры должны быть первыми в карточке;
- для B2B закупщика артикул, код, наличие, цена, документы и аналог должны быть быстро доступны;
- "запросить КП" должен быть рядом с ценой/наличием.

## Marketing Patterns

| Pattern | Seen On | Buyer Need | Soliton Use | Proof Status |
|---|---|---|---|---|
| Надежное питание критической инфраструктуры | Raritan, Vertiv, Eaton | Снизить риск простоя | Главная, категории, карточки, B2B | requires_proof |
| Линейка по уровню зрелости: Basic / Metered / Monitored / Switched | Vertiv, Eaton, Raritan | Быстро выбрать класс PDU | Категории и guide-блоки | safe_now для классификации |
| Подбор/selector | Raritan, Vertiv, Legrand | Не ошибиться с током/розетками | "Подобрать PDU" CTA и будущий конфигуратор | safe_now для сервиса подбора |
| Datasheet / PDF как доверие | Raritan, Eaton, Hyperline | Проверить характеристики | Блок документов на карточке | safe_now если документ есть |
| Pre-sales / product expert | Eaton, Legrand, Vertiv | Получить инженерную помощь | CTA "Поможем подобрать" | safe_now |
| Плотность розеток | Legrand, Raritan | Больше оборудования в стойке | Категории C13/C19/вертикальные PDU | product_dependent |
| Гибкость C13/C19 | Legrand HDOT Cx | Не ошибиться с будущей конфигурацией | Можно использовать как объяснение выбора комбинированных PDU, не как claim Soliton | avoid unless product supports |
| Monitoring and real-time power data | Vertiv, Raritan | Контроль нагрузки | Для измерительных/мониторинговых моделей | product_dependent |
| Outlet-level switching | Raritan, Eaton, Legrand | Удаленная перезагрузка | Только для управляемых моделей | product_dependent |
| Overload prevention | Vertiv, Eaton | Не перегрузить стойку | Для страниц выбора и FAQ | requires_proof |
| Warranty/support | Vertiv, Eaton, Legrand | Снизить риск покупки | Страница гарантий и карточка | requires_proof |
| Product family comparison | Eaton, Raritan | Понять отличие типов | Категория PDU и база знаний | safe_now |
| Industry/application fit | Vertiv | Понять применимость | Use-case страницы: серверные, ЦОД, шкафы | safe_now |
| Build/configure your own PDU | Legrand | Подобрать нестандартную конфигурацию | Будущий B2B request flow | requires_business_process |
| Clear SKU/spec table | DKC, Hyperline, Eaton | Закупочная точность | Все карточки и листинги | safe_now |
| Local voltage/current clarity | Hyperline, DKC, ITK | Быстро проверить совместимость | Фильтры и первые строки карточки | safe_now |
| Protection devices highlighted | ITK, DKC | Безопасность | Фильтр "защита/автомат/выключатель" | product_dependent |
| Technical drawings/manuals | Eaton, DKC | Проектная документация | Документы и скачивания | requires_documents |
| Sales contact / request quote | Raritan, Vertiv, Legrand | B2B закупка | Запрос КП и подбор | safe_now |
| Knowledge base/support | Eaton, Legrand | Самостоятельное изучение | База знаний Soliton | safe_now |
| Environmental monitoring | Legrand, Raritan | Контроль условий стойки | Только если есть такие модели/датчики | product_dependent |
| Security framing | Raritan, Legrand | Enterprise confidence | Для управляемых PDU при наличии функций | product_dependent |

## Visual And UX Patterns

| Pattern | Where It Helps | Soliton Recommendation |
|---|---|---|
| Product family hero with product photo | Главная, категория PDU | Использовать реальные фото PDU/блоков розеток, не абстрактные иллюстрации. |
| Product level comparison table | Категория PDU | Таблица "Базовые / с измерением / мониторинговые / управляемые". |
| Selector CTA | Главная, категории, карточки | Кнопка "Подобрать PDU" рядом с "Запросить КП". |
| Document download block | Карточка | Видимый блок: паспорт, сертификат, инструкция, схема. |
| Technical spec table first-class | Карточка | Таблица характеристик должна быть главным элементом, не скрытым tab-only блоком. |
| Sticky RFQ/action area | Карточка desktop/mobile | Держать цену/наличие/КП доступными при скролле. |
| Use-case cards | Категории и база знаний | "Для серверного шкафа", "Для 19 стойки", "Для ЦОД", "Для ИБП". |
| Proof badges | Карточки и листинг | 19", 1U, 16A, C13, C19, Schuko, защита, выключатель, вертикальный. |
| Comparison against choice criteria | SEO-лендинги | Не сравнивать бренды агрессивно, сравнивать типы PDU и сценарии. |
| Expert contact block | B2B pages | "Пришлите ТЗ, подберем блок розеток / PDU". |

## Product Detail Page Implications

Карточка Soliton должна включать:

1. H1 с понятным типом товара, а не только длинный артикул.
2. Артикул и короткое техническое название.
3. Быстрые бейджи: монтаж, ток, напряжение, розетки, ввод, кабель, защита.
4. Цена/наличие или "запросить цену", если данные не подтверждены.
5. CTA: "В корзину", "Запросить КП", "Помочь с подбором".
6. Короткий блок "Для чего подходит".
7. Таблица характеристик.
8. Документы и PDF.
9. Доставка и оплата в кратком виде.
10. FAQ по совместимости, току, типу розеток.
11. Похожие товары и аналоги.
12. JSON-LD Product.

## Category And SEO Landing Implications

Категории должны строиться не только по текущему ассортименту, но и по спросу:

- PDU / блоки распределения питания;
- блоки розеток 19";
- блоки розеток 1U;
- PDU Schuko;
- PDU IEC C13;
- PDU IEC C19;
- PDU 16A;
- PDU 32A;
- вертикальные PDU;
- измерительные PDU;
- управляемые PDU;
- PDU для серверного шкафа;
- PDU для ЦОД;
- PDU для ИБП.

Для каждой категории:

- короткое интро;
- товарный листинг;
- фильтры;
- "как выбрать";
- FAQ;
- перелинковка на use-case страницы;
- CTA на подбор и КП.

## Homepage And B2B/RFQ Implications

Главная должна сразу отвечать:

- что продаем: PDU и блоки розеток для стоек, шкафов, серверных и ЦОД;
- кому: интеграторам, IT-службам, закупщикам, частным покупателям;
- как помогаем: подбор, КП, документы, доставка, счет;
- куда идти: категории, подбор, запрос КП.

B2B-страница должна включать:

- запрос КП;
- прикрепление ТЗ;
- реквизиты юрлица;
- поставка под проект;
- доставка по России;
- документы;
- помощь в подборе аналогов.

## Copywriting Implications

## Tone

Тон: инженерный, уверенный, без пустых обещаний.

Плохо:

- "лучшие решения для вашего бизнеса";
- "инновационные товары высокого качества";
- "широкий ассортимент по выгодным ценам".

Лучше:

- "Подберем PDU по току, типу розеток, монтажу и нагрузке стойки";
- "Сравните базовые, измерительные и управляемые PDU";
- "Запросите КП с артикулами, количеством и доставкой до объекта";
- "Покажем совместимые варианты с Schuko, IEC C13 и IEC C19".

## Required Copy Blocks

Для каждой категории:

- что это за тип PDU;
- когда его выбирают;
- какие параметры важны;
- чем отличаются модели;
- как заказать или запросить КП.

Для каждой карточки:

- одно предложение о назначении;
- 4-6 ключевых параметров;
- блок применения;
- техническая таблица;
- документы;
- CTA.

## Claim Control Table

| Claim | Status | Required Evidence | Notes |
|---|---|---|---|
| "Надежное питание критического оборудования" | requires_proof | Документы, гарантия, описание производства/контроля качества | Можно использовать мягче: "для распределения питания..." |
| "100% тестирование" | avoid | Нужны производственные подтверждения | Не использовать без фактов. |
| "Защита от перегрузки/КЗ" | product_dependent | Паспорт товара, наличие автомата/защиты | Использовать только для моделей с защитой. |
| "Мониторинг тока/напряжения" | product_dependent | Характеристики модели | Только для AV/monitoring моделей. |
| "Удаленное управление розетками" | product_dependent | Управляемая модель, интерфейс, документация | Не применять к базовым PDU. |
| "Для ЦОД" | requires_proof | Ассортимент, параметры, проектный опыт | Можно использовать как сценарий подбора. |
| "Соответствие стандартам" | requires_proof | Сертификаты/декларации | Указывать конкретные документы. |
| "Доставка по России" | safe_now if service exists | Договоры/условия доставки | Подтвердить на этапе доставки. |
| "Оплата по счету для юрлиц" | safe_now if process exists | Процесс продаж | Базовый B2B сценарий. |
| "Подбор аналогов" | safe_now if менеджерский процесс есть | Процесс обработки заявок | Сильный CTA для B2B. |

## Soliton Recommendations

| # | Recommendation | Page Type | Priority | Why It Matters | Proof Needed |
|---:|---|---|---|---|---|
| 1 | Сделать CTA "Подобрать PDU" как равный "Запросить КП" | Главная, категории, карточки | P1 | Снижает страх ошибки у технического покупателя | Процесс обработки заявок |
| 2 | Ввести классификацию PDU по уровню: базовые, с измерением, мониторинговые, управляемые | Категории, guide | P1 | Помогает пользователю понять ассортимент | Наличие таких групп в ассортименте |
| 3 | Вывести быстрые технические бейджи на карточке | Карточка, листинг | P1 | Ускоряет выбор и сравнение | Данные товара |
| 4 | Сделать таблицу характеристик центральным блоком карточки | Карточка | P1 | Инженеры и закупщики покупают по параметрам | Данные товара |
| 5 | Добавить блок документов на карточке | Карточка | P1 | Повышает доверие и помогает B2B | PDF/сертификаты/паспорта |
| 6 | Создать B2B-форму с ИНН, компанией, файлом ТЗ и комментарием | B2B, карточка, корзина | P1 | Главная конверсия для корпоративных покупателей | Форма и обработка |
| 7 | Создать страницу "PDU для серверного шкафа" | SEO landing | P1 | Сильный use-case запрос | Семантика уже подтверждена |
| 8 | Создать страницу "Блоки розеток 19 дюймов" | SEO category | P1 | Базовый категорийный спрос | Семантика уже подтверждена |
| 9 | Создать FAQ по Schuko, C13, C19, 16A, 32A | Категории, карточки | P1 | Снимает вопросы совместимости | Техническая проверка |
| 10 | Использовать реальные фото товара и крупные фрагменты розеток/ввода | Карточка, категория | P2 | Технический товар нужно видеть | Фото |
| 11 | Сделать блок "Как выбрать" для категории PDU | Категории | P2 | Повышает конверсию из SEO-трафика | Копирайтинг |
| 12 | Добавить сравнение типов PDU | Категория, база знаний | P2 | Помогает выбрать между моделями | Структура ассортимента |
| 13 | Добавить "доставка/оплата/счет" рядом с CTA | Карточка, checkout | P2 | Снижает закупочное трение | Реальные условия |
| 14 | Сделать страницу "Для интеграторов и проектных поставок" | B2B | P2 | Важный корпоративный сегмент | Процесс продаж |
| 15 | Добавить "запросить аналог" | Карточка, 404, поиск | P2 | Полезно при отсутствии нужной модели | Менеджерский процесс |
| 16 | Создать базу знаний по выбору PDU | Knowledge base | P3 | Поддерживает SEO и доверие | Контент |
| 17 | Добавить матрицу документов и сертификатов | B2B, карточка | P3 | Закупщикам нужны подтверждения | Документы |
| 18 | Сделать будущий конфигуратор PDU как отдельную feature | Подбор | P3 | Может стать сильным конверсионным инструментом | Данные ассортимента |

## Recommendations For Next SDD Features

## `positioning-copy-system`

Взять из этого документа:

- buyer needs;
- copy tone;
- required copy blocks;
- claim control;
- CTA vocabulary.

## `visual-design-system`

Взять из этого документа:

- table-first карточку;
- technical badges;
- document block;
- selector CTA;
- B2B/RFQ bands;
- product photo priority.

## `product-catalog-foundation`

Взять из этого документа:

- поля для фильтров;
- поля для бейджей;
- документы;
- proof fields;
- product-dependent claims.

## `seo-site-structure`

Взять из этого документа:

- use-case pages;
- category taxonomy;
- FAQ topics;
- internal linking requirements.

## Source Links

- [Raritan PX4 Rack PDU](https://www.raritan.com/products/power/power-distribution/rack-pdu)
- [Raritan Rack PDU Technical Specifications](https://www.raritan.com/ap/products/power/power-distribution/rack-pdu/tech-specs)
- [Vertiv Geist Metered Rack PDU](https://www.vertiv.com/en-us/products-catalog/critical-power/power-distribution/vertiv-geist-metered-rack-pdu2/)
- [Vertiv Geist Rack PDU](https://go.vertiv.com/vertiv-rack-pdu/)
- [Eaton Power Distribution Units Overview](https://tripplite.eaton.com/pages/power-distribution-units-overview)
- [Eaton Tripp Lite Switched PDU Example](https://www.eaton.com/us/en-us/skuPage.PDUMV20NETLX.html)
- [Legrand Server Technology](https://www.legrand.us/server-technology.aspx)
- [Legrand HDOT Cx](https://www.legrand.com/datacenter/gb-en/hdot-cx-data-center-pdu-data-center-power-distribution-unit-server-technology)
- [Server Technology Rack PDU Feature Options](https://www.servertech.com/products/rack_pdu_feature/)
- [Hyperline PDU](https://www.hyperline.ru/catalog/shkafy-i-stoyki/raspredelenie-pitaniya/bloki-rozetok-pdu/)
- [ITK horizontal PDU](https://itk-group.ru/products/catalog/oborudovanie_telekommunikatsionnoe/elektropitanie_i_monitoring/bloki_rozetok_pdu_base/bloki_rozetok_pdu_gorizontalnye)
- [DKC PDU example](https://www.dkc.ru/ru/catalog/794/R519SH8OPSHC14/)
