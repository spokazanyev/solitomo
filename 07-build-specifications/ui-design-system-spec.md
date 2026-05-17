# Спецификация Визуальной Системы И UI Soliton

Дата: 2026-05-14.

SDD feature: `specs/003-visual-design-system`.

## Executive Summary

Визуальная система Soliton должна создавать ощущение современного российского производителя технического оборудования, а не маркетплейса и не типового каталога.

Дизайн должен быть:

- технически точным;
- современным;
- спокойным и уверенным;
- конверсионным;
- удобным для сравнения характеристик;
- сильным для B2B-заявок;
- пригодным для SEO-страниц с большим объемом текста и таблиц;
- визуально основанным на реальном продукте, документах и технических деталях.

Главная задача интерфейса: помочь покупателю быстро понять, какой PDU или блок розеток подходит под стойку, ток, тип розеток, ввод, монтаж и условия закупки.

## Visual Character

Характер:

- инженерный;
- чистый;
- собранный;
- уверенный;
- производственный;
- современный без декоративной перегрузки.

Сайт должен ощущаться как:

- технический производитель;
- B2B-поставщик с документами и процессом;
- удобный каталог для инженера и закупщика;
- современный ecommerce, но без "розничной игрушечности".

Сайт не должен ощущаться как:

- шаблонный маркетплейс;
- лендинг с абстрактными градиентами;
- тяжелая legacy-CMS;
- набор карточек без бренда;
- темная "киберпанель", где плохо читаются характеристики.

## Design Principles

## 1. Product First

Реальные PDU, розетки, вводы, автоматы, кабели, документы и схемы важнее абстрактных иллюстраций.

Acceptance check:

- первый экран и карточки используют продуктовые визуалы или технически корректные placeholders;
- пользователь видит, что продается, без расшифровки по тексту.

## 2. Technical Data Is A Primary UI Layer

Характеристики, таблицы, документы и бейджи не прячутся в дальние вкладки.

Acceptance check:

- на карточке товара ключевые параметры видны до длинного описания;
- таблица характеристик сканируется группами.

## 3. B2B Conversion Is Always Nearby

Для технического товара "купить" не всегда главный сценарий. "Подобрать", "Запросить КП", "Отправить ТЗ", "Получить счет" должны быть рядом с решением.

Acceptance check:

- на карточке, категории и B2B-странице есть понятный RFQ/подбор CTA.

## 4. Dense But Ordered

Интерфейс может быть плотным, но должен быть организованным.

Acceptance check:

- фильтры, характеристики и карточки не выглядят пустыми, но читаются без визуального шума.

## 5. SEO Content Must Not Look Like Footer Dump

SEO-текст, FAQ и блоки выбора должны быть встроены в страницу как полезный контент.

Acceptance check:

- текст "как выбрать" расположен после/рядом с товарным выбором и разбит на практические блоки.

## 6. No Unsupported Visual Claims

Плашки "реестр", "19 лет", "российское производство", "качество как APC" используются только в approved/proof-controlled виде.

Acceptance check:

- trust-блоки ссылаются на claim-control из `copywriting-and-positioning-spec.md`.

## Design Tokens

## Color

Рекомендуемое направление:

- base background: почти белый / холодный светлый серый;
- surface: белый;
- text primary: почти черный, не чистый #000;
- text secondary: графитовый/серый;
- border: холодный светло-серый;
- primary action: насыщенный технический синий;
- secondary action: графитовый контур;
- success/availability: зеленый;
- warning/attention: янтарный;
- danger/error: красный;
- technical accent: стальной/циановый для спецификаций и бейджей.

Запрещено как доминирующая палитра:

- фиолетово-синие SaaS-градиенты;
- бежево-кремовая палитра;
- темно-синяя монохромная панель;
- коричнево-оранжевая промышленная палитра;
- декоративные glow/orb фоны.

## Typography

Принципы:

- интерфейсный гротеск;
- высокая читаемость цифр и технических обозначений;
- без отрицательного letter-spacing;
- без масштабирования шрифтов от viewport width;
- длинные артикулы и технические названия не должны ломать layout.

Роли:

- H1: крупный, но не декоративный;
- H2: рабочие секционные заголовки;
- card title: плотный, 2-3 строки максимум;
- spec labels: малый, но контрастный;
- table text: не меньше комфортного минимума для чтения на mobile.

## Spacing And Layout

Ритм:

- 4px base unit;
- 8px для малых gap;
- 16px для групп;
- 24px для секций внутри страницы;
- 40-64px для крупных секций desktop.

Правила:

- карточки не вкладывать в карточки;
- страницы строить как full-width bands с ограниченной шириной контента;
- repeated items могут быть cards с радиусом до 8px;
- панель фильтров и таблицы должны иметь стабильную ширину/высоту состояний.

## Radius, Borders, Elevation

Radius:

- кнопки и inputs: 6-8px;
- cards: 8px максимум;
- badges: 6px;
- таблицы: 8px контейнер, строки без избыточного скругления.

Elevation:

- минимальные shadows;
- больше reliance на border/background;
- sticky CTA может иметь легкую тень.

## Imagery And Visual Asset Rules

## Product Photos

Требования:

- реальные фотографии PDU/блоков розеток;
- крупные ракурсы розеток, вводов, выключателей, автоматов;
- фото на чистом светлом фоне;
- не использовать темные blurred stock-фоны;
- не скрывать товар декоративным crop.

## Technical Diagrams

Использовать:

- схемы подключения;
- упрощенные diagram-блоки для C13/C19/Schuko;
- визуальные сравнения Basic/Metered/Monitored/Switched;
- таблицы выбора.

## Placeholders

Если фото нет:

- использовать аккуратный placeholder с типом товара и артикулом;
- не использовать абстрактные 3D-иллюстрации;
- явно показывать "Фото уточняется".

## Trust Visuals

Возможные блоки:

- "19+ лет на рынке";
- "Российское производство";
- "Документы и паспорта";
- "Запрос КП для юрлиц";
- "Подбор по ТЗ".

Все claims должны соответствовать claim-control.

## Component Patterns

## 1. Header / Navigation

Purpose:

Быстро вести к каталогу, подбору, B2B и контактам.

Required content:

- logo;
- catalog menu;
- search;
- B2B / запрос КП;
- phone/email;
- cart/RFQ indicator.

Responsive:

- desktop: horizontal navigation;
- mobile: compact menu, search and RFQ visible.

## 2. Product Card

Required content:

- photo;
- category/type;
- title;
- SKU;
- 4-6 technical badges;
- price/status or "по запросу";
- primary CTA;
- secondary "Запросить КП".

States:

- in stock;
- by request;
- no photo;
- missing price;
- added to RFQ/cart.

No-overlap:

- title clamps cleanly;
- badges wrap without shifting card height unpredictably;
- CTA area fixed at bottom.

## 3. Technical Badge

Examples:

- `19"`
- `1U`
- `16A`
- `32A`
- `Schuko`
- `IEC C13`
- `IEC C19`
- `C14 input`
- `вертикальный`
- `с выключателем`
- `с защитой`

Rules:

- short labels;
- high contrast;
- never use badges for unsupported claims.

## 4. Filter Panel

Required filters:

- type;
- mounting;
- current;
- socket type;
- socket count;
- input;
- protection;
- monitoring/control;
- availability.

Responsive:

- desktop: left or top dense panel;
- mobile: drawer/bottom sheet;
- selected filters shown as removable chips.

## 5. Technical Specification Table

Rules:

- group rows by purpose: electrical, outlets, input, mounting, protection, dimensions, documents;
- sticky or repeated section labels for long tables;
- support long values;
- copyable SKU values;
- mobile can use stacked key/value rows.

## 6. Document Block

Required content:

- document name;
- type: passport, certificate, manual, drawing, datasheet;
- file size/date if available;
- download/open action.

States:

- documents available;
- request document;
- document pending.

## 7. RFQ / Quote CTA Block

Required content:

- short title;
- value statement;
- primary button;
- secondary contact;
- optional upload hint.

Example:

`Пришлите артикулы или ТЗ - подберем PDU и подготовим КП.`

## 8. Trust Strip

Purpose:

Show Soliton credibility without overloading.

Items:

- 15+ лет;
- российское производство;
- документы;
- реестр;
- подбор по ТЗ.

Rules:

- each item links or expands to proof when available;
- unverified items use cautious wording.

## 9. Comparison Table

Use for:

- Basic / Metered / Monitored / Switched;
- Schuko / C13 / C19;
- 16A / 32A;
- horizontal / vertical.

Rules:

- max 4-5 columns;
- clear criteria;
- avoid aggressive brand comparison without proof.

## 10. FAQ Accordion

Rules:

- practical questions;
- 40-90 word answers;
- avoid hidden SEO walls;
- one CTA after 4-6 questions.

## 11. Search Box

Purpose:

Find by SKU, socket type, 19", 1U, PDU, C13/C19, Schuko.

States:

- suggestions;
- no results with "запросить аналог";
- SKU exact match.

## 12. B2B Form

Fields:

- name;
- company;
- INN;
- phone;
- email;
- items/comment;
- file upload;
- city/delivery comment.

Rules:

- not too many required fields;
- file upload visible;
- explain response time after submit.

## Page Patterns

## 1. Homepage

Structure:

1. Hero with real product visual.
2. Primary copy: PDU and blocks for 19" racks.
3. Primary CTA: "Подобрать PDU".
4. Secondary CTA: "Запросить КП".
5. Product direction grid.
6. Selection guide.
7. Trust strip.
8. Popular categories.
9. B2B/RFQ band.
10. Knowledge links.

Visual rule:

Hero text is not inside a card. Product should be visible in first viewport.

## 2. Category Page

Structure:

1. H1 and short intro.
2. Filter panel.
3. Product list/grid.
4. Category guide block.
5. Comparison block.
6. FAQ.
7. RFQ CTA.
8. Related categories/use cases.

Visual rule:

Filters and products are primary; SEO text is integrated as guidance, not dumped at bottom.

## 3. Product Detail Page

Structure:

1. Product title, SKU, badges.
2. Product media.
3. Purchase/RFQ panel.
4. Key specs.
5. Application block.
6. Full technical table.
7. Documents.
8. Delivery/payment.
9. FAQ.
10. Similar products.

Visual rule:

Technical specs and RFQ must be visible early.

## 4. Use-Case Landing

Structure:

1. User task hero.
2. Selection criteria.
3. Recommended categories.
4. Product examples.
5. Common mistakes.
6. FAQ.
7. RFQ/selection CTA.

Visual rule:

Use diagrams and criteria tables, not generic text-only blocks.

## 5. B2B / RFQ Page

Structure:

1. B2B hero.
2. What Soliton supports: КП, счет, документы, доставка, ТЗ.
3. Form.
4. Trust/proof.
5. Process steps.
6. FAQ.

Visual rule:

Form must be visible early on desktop and reachable fast on mobile.

## 6. Payment / Delivery Page

Structure:

1. Summary cards for physical persons and legal entities.
2. Payment methods.
3. Invoice process.
4. Delivery options.
5. Documents and returns.
6. CTA to ask manager.

Visual rule:

Use compact process steps; avoid legal text in the first screen.

## 7. Knowledge Article

Structure:

1. Practical question.
2. Short answer.
3. Explanation.
4. Table/checklist.
5. Related products/categories.
6. CTA.

Visual rule:

Article must be readable and conversion-aware.

## 8. Checkout / Request Flow

Structure:

1. Items.
2. Buyer type: individual/legal entity.
3. Contact fields.
4. Delivery choice/comment.
5. Payment/request mode.
6. Confirmation.

Visual rule:

RFQ and invoice request are not treated as secondary error paths; they are core flows.

## Layout And Responsive Rules

## Desktop

- content max-width around 1180-1280px;
- category pages can use sidebar filters;
- product pages can use media/spec/CTA columns;
- sticky purchase/RFQ panel allowed.

## Tablet

- filters move to top collapsible or drawer;
- product grid becomes 2 columns;
- spec table remains readable with grouped rows.

## Mobile

- product grid 1 column;
- filter drawer;
- sticky bottom action for RFQ/cart where appropriate;
- tables become stacked key/value blocks;
- no horizontal overflow except intentionally scrollable comparison tables;
- forms use single-column layout.

## Conversion Hierarchy

Primary buyer actions:

1. `Подобрать PDU`
2. `Запросить КП`
3. `Получить счет`
4. `Отправить ТЗ`

Secondary actions:

- `Добавить в корзину`
- `Уточнить наличие`
- `Скачать паспорт`
- `Подобрать аналог`
- `Задать вопрос`

Visual priority:

- Product and category pages: product decision first, CTA second, SEO guidance third.
- B2B page: request flow first, proof second, details third.
- Knowledge pages: answer first, next action second.

## Accessibility And No-Overlap Rules

- Text must not overlap icons, buttons, cards, tables, or adjacent content.
- Buttons must have stable dimensions and not resize unpredictably.
- Long technical words must wrap or truncate deliberately.
- Contrast must support reading small technical labels.
- Interactive controls must have clear hover/focus/disabled states.
- Mobile forms must be usable with keyboard and file picker.
- Tables must remain readable without tiny text.
- Do not rely on color alone for stock, warnings, or errors.

## QA Checklist

Before implementation approval, each page type must pass:

- desktop screenshot check;
- mobile screenshot check;
- no text overlap;
- no clipped buttons;
- product images visible or clear placeholder;
- CTA visible;
- filters usable;
- technical tables readable;
- RFQ form usable;
- SEO content integrated;
- trust claims match claim-control;
- analytics hooks can be attached to primary actions.

## Inputs For Next SDD Features

## `product-catalog-foundation`

Needs:

- technical badges;
- grouped specs;
- product image states;
- document availability;
- claim/proof fields.

## `seo-site-structure`

Needs:

- category page pattern;
- use-case page pattern;
- FAQ and SEO content zones;
- internal linking blocks.

## `page-template-system`

Needs:

- all page patterns;
- component rules;
- responsive behavior.

## `product-detail-pages`

Needs:

- product page structure;
- purchase/RFQ panel;
- technical tables;
- document block.

## `category-filter-pages`

Needs:

- filter panel;
- product cards;
- category guide;
- comparison block.
