# Feature Specification: Product Schema Enrichment + Key Facts Block

**Feature Branch**: `039-product-schema-enrichment`

**Created**: 2026-05-17

**Status**: Deferred (отложено до приоритизации — см. `07-build-specifications/deferred-content-track.md`)

**Input**: Текущий `Product` JSON-LD на PDP содержит только `name`, `sku`, `description`, `image`, `offers`. AI-агенты подбирают товары по техническим характеристикам — у нас они есть в HTML-таблице, но **не в schema**. Нужно:
1. Сделать `additionalProperty[]` со всей техспекой.
2. Добавить `manufacturer`, `brand`, `mpn`, `countryOfOrigin`, `model`.
3. Поставить «key facts» блок в начале PDP — короткий factual chunk, который агент процитирует **дословно без галлюцинации**.

## User Scenarios & Testing

### User Story 1 — LLM получает полную техспеку из JSON-LD (Priority: P1)

AI-агент (Claude, ChatGPT) парсит JSON-LD на `/product/sp-8/` и находит все характеристики как `additionalProperty[]` пары `name/value`. Например, `{ name: "Кол-во розеток", value: "8" }`, `{ name: "Ток", value: "16A" }`. Агент использует эти данные при сравнении с конкурентами.

**Independent Test**: `curl /product/sp-8/ | grep -o '"additionalProperty":\[[^]]*\]'` возвращает массив с 8+ парами.

### User Story 2 — Анти-галлюцинационный key-facts блок (Priority: P1)

Сразу после H1 на PDP стоит компактный блок с ключевыми фактами одним предложением: «**SP-8**: 8 розеток Schuko, ток 16A, ввод Schuko, монтаж 19″ 1U, ширина 482 мм, российское производство.» Это единственный текст в начале страницы, к которому агент будет обращаться как к summary — и процитирует **дословно**.

**Acceptance Scenarios**:

1. **Given** PDP, **When** виден первый visible-content блок, **Then** в нём одно предложение со всеми ключевыми параметрами, разделёнными запятыми.
2. **Given** этот блок, **When** AI агент его читает, **Then** ответ агента на вопрос «какие характеристики у SP-8» совпадает с этим текстом.

### User Story 3 — Schema MPN/manufacturer/country/brand (Priority: P1)

Schema.org Product содержит:
- `mpn`: SKU (например, "SP-8")
- `brand`: `{ @type: "Brand", name: "Солитон" }`
- `manufacturer`: ref на Organization Солитон
- `countryOfOrigin`: `{ @type: "Country", name: "Россия" }`
- `model`: серия модели если есть

**Acceptance**: `pnpm validate:schema` подтверждает наличие полей.

### Edge Cases

- **Permission to cite**: AI-агенты по факту цитируют без явного разрешения. Schema-разметка лишь увеличивает уверенность.
- **Несовпадение единиц**: «16A» vs «16 A» vs «16 А (кириллица)». Решение: канонические значения в schema, человеческие в HTML.
- **Длинные технические описания**: содержат много чисел — модели путают. Чёткая структура `propertyID` (machine-readable) + `name` (human-readable) решает.

## Requirements

### Functional Requirements

- **FR-001**: `createProductJsonLd()` MUST включать `additionalProperty[]` со всеми пунктами из `ProductAttributes` (mounting, outletTypes, outletCount, maxCurrent, productType, functions.protection/monitoring/management, voltage, и т.д.).
- **FR-002**: `Product` schema MUST содержать `mpn`, `brand`, `manufacturer`, `countryOfOrigin`, `model` (если применимо).
- **FR-003**: На PDP сразу после H1 MUST рендериться компактный «key facts» блок с одним предложением.
- **FR-004**: Текст key-facts блока MUST формироваться из тех же значений, что и `additionalProperty[]` — единая точка истины.
- **FR-005**: `additionalProperty` единицы измерения MUST использовать UN/CEFACT codes где применимо (`AMP`, `MMT`, `KGM`), либо человеческие («розетки», «юниты»).

### Quality Requirements

- **QR-001**: `pnpm validate:schema` пройти на /product/sp-8/.
- **QR-002**: Google Rich Results Test без warnings на Product entity.
- **QR-003**: Key-facts блок не дублирует H1 и не нарушает читаемость.

## Success Criteria

- **SC-001**: На PDP в JSON-LD ≥8 `additionalProperty` записей со специфическими полями.
- **SC-002**: Key-facts блок содержит конкретные числа и виден в первых 600px viewport.
- **SC-003**: AI-агент (Claude/ChatGPT, тестово) корректно отвечает на «какие характеристики у SP-8» — без галлюцинаций.

## Assumptions

- Все 66 текущих SKU имеют заполненный `ProductAttributes` (проверено в `source-products.ts`).
- Размеры и вес у части моделей не заполнены — поля опциональные, опускаются через `compactJsonLd`.
- `countryOfOrigin = Россия` для всех — это позиционирование Солитон.
