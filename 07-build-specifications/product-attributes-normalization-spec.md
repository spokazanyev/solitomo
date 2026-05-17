# Product Attributes Normalization Spec

Дата: 2026-05-15.

## Назначение

Документ фиксирует нормализованную модель атрибутов товара Soliton. Эта модель нужна для фильтров, карточек, SEO-посадочных, RFQ-заявок и будущего импорта из Payload/МойСклад.

## Реализованный Слой

Код:

- `apps/web/src/lib/products/product-attributes.ts`
- `apps/web/src/lib/products/source-products.ts`
- `apps/web/src/components/page-templates.tsx`
- `apps/web/src/components/product/ProductDetailPage.tsx`

Текущий источник данных все еще `00-source-data/assortment/soliton1_assortment_raw.json`, но вычисление атрибутов вынесено из UI в отдельный слой `ProductAttributes`.

## ProductAttributes

| Поле | Назначение | Пример |
|---|---|---|
| `productType` | Тип изделия | `PDU / блок розеток`, `Сетевой фильтр`, `Контроллер мониторинга` |
| `mounting` | Тип монтажа | `19 дюймов 1U`, `Вертикальный`, `DIN` |
| `outletTypes` | Типы выходных розеток | `Schuko`, `IEC C13`, `IEC C19` |
| `outletCount` | Количество розеток | `8`, `16`, `24` |
| `maxCurrent` | Максимальный ток | `16A`, `32A` |
| `voltage` | Напряжение | `230В`, `250В`, `380/400В` |
| `phase` | Фазность | `1 фаза`, `3 фазы` |
| `inputType` | Тип входа | `Schuko`, `IEC C20`, `IEC60309`, `Клеммный терминал` |
| `cableLength` | Длина кабеля | `1.8 м`, `3 м`, `Без кабеля` |
| `functions.protection` | Защитные функции | `УЗИП`, `УЗО`, `Автоматическая защита`, `Фильтр радиопомех` |
| `functions.monitoring` | Мониторинг | `Мониторинг / измерение` |
| `functions.management` | Управление | `Управление` |
| `documents` | Наличие документов в source data | `3 док.`, `Документы по запросу` |
| `availability` | Текст наличия до интеграции остатков | `Наличие и срок подтверждаются при КП` |
| `delivery` | Текст поставки до интеграции доставки | `Поставка по России по согласованию` |

Каждый основной атрибут хранит:

- `value` - машинное значение;
- `label` - отображаемое значение;
- `confidence` - `high`, `medium`, `low`;
- `source` - правило или источник обнаружения.

## Controlled Values Для Будущего Импорта

### productType

- `pdu`
- `surge_filter`
- `monitoring_controller`
- `accessory`

### mounting

- `rack_19_1u`
- `vertical`
- `din`
- `unknown`

### inputType

- `schuko`
- `iec_c14`
- `iec_c20`
- `iec60309`
- `terminal`
- `open_end`
- `unknown`

## Правила MVP

- UI больше не должен самостоятельно парсить SKU, описание или specs.
- Листинг и карточка берут параметры только из `product.attributes`.
- Значения с `confidence: low` показываются как `Уточнить`.
- `availability` не передается в schema.org Product до подключения реальных остатков.
- Документы показываются только если они есть в исходных данных; иначе пишем `Документы по запросу`.

## Что Нужно Сделать Позже

1. Создать ручной normalized CSV/JSON для 66 товаров.
2. Сверить все значения с паспортами изделий.
3. Заменить regex-нормализацию на импорт controlled values.
4. Использовать эти поля для точных фильтров, сортировки и RFQ.
5. После интеграции МойСклад получать остатки, цены и сроки из учетной системы.
