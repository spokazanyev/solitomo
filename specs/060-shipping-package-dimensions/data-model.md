# Phase 1 Data Model — Shipping Package Dimensions (060)

**Date**: 2026-05-27
**Plan**: [plan.md](./plan.md)
**Research**: [research.md](./research.md)

## Сводка изменений

Затрагивается **одна** существующая сущность: `Product` (Payload-коллекция `products`). Расширяется опциональной group-секцией `physicalPackaging` с четырьмя number-полями. Никаких новых таблиц, никаких изменений в сущностях `Cart`, `Order`, `Customer`, `RfqRequest`.

---

## Entity: Product (расширение)

**Payload collection**: `products`
**Postgres table**: `products`

### Существующие поля — не трогаем

`status`, `qualityStatus`, `sku`, `slug`, `externalId`, `title`, `h1`, `shortDescription`, `description`, `productType`, `primaryCategory`, `categories`, `price`, `availabilityStatus`, `technicalAttributes`, `ctaMode`, `rfqEnabled`, `sourceUrl`, ... — остаются без изменений.

### Новая группа полей: `physicalPackaging`

**Семантика**: физические параметры единицы товара в готовой к отправке упаковке (с транспортной коробкой / паллетой / стяжкой). Не «голый» вес устройства из техпаспорта.

| Поле | Тип | Хранение | Валидация | Required | Описание |
|---|---|---|---|---|---|
| `physicalPackaging.weightGrams` | `number` (integer) | `int` | `min: 1, max: 200000` | optional | Масса единицы в граммах. 200 кг — верхний предел для тяжёлых стоечных PDU. |
| `physicalPackaging.lengthMm` | `number` (integer) | `int` | `min: 1, max: 2000` | optional | Длина упаковки в миллиметрах. 2 м покрывает вертикальные стоечные блоки. |
| `physicalPackaging.widthMm` | `number` (integer) | `int` | `min: 1, max: 2000` | optional | Ширина упаковки в миллиметрах. |
| `physicalPackaging.heightMm` | `number` (integer) | `int` | `min: 1, max: 2000` | optional | Высота упаковки в миллиметрах. |

**Правило заполненности**: товар считается «с заполненными физическими параметрами» только если **все 4 поля** заполнены валидными значениями. Если хотя бы одно пустое — товар считается «без physical» → используются дефолты из `apiship-settings.defaults`.

### Validation rules

1. **Range check**: каждое поле должно быть в указанном диапазоне (см. таблицу выше). Реализуется через Payload built-in `min`/`max`. При нарушении — сохранение карточки отклоняется с inline-ошибкой возле поля.
2. **Integer-only**: значения округляются вниз при вводе. UI Payload number-field с `admin.step: 1` помогает админу понять что дробные не нужны.
3. **No cross-field validation в admin**: даже если заполнено только 3 из 4 полей — сохраняется, но в runtime все 4 нужны (товар будет работать на дефолтах). Это ОК потому что админ может постепенно заполнять.

### State / lifecycle

Поля не имеют state-machine — это статические atributes. Можно поменять в любой момент через admin-API; кеш расчётов инвалидируется автоматически благодаря fingerprint (см. R8).

### Связи

Группа `physicalPackaging` — embedded на Product. Никаких связей с другими сущностями.

---

## Entity: Shipping Defaults (без изменений)

**Payload global**: `apiship-settings`
**Field path**: `defaults`

Существующая структура остаётся:

```
{
  length: 30,    // см (целое)
  width: 20,     // см
  height: 15,    // см
  weight: 1500,  // г
  deliveryCostVat: '20',
  isCod: false,
}
```

Используется как fallback в mappers, когда у товара отсутствуют физические параметры. **Семантика и единицы измерения дефолтов не меняются** (см и г), потому что они уже глубоко интегрированы в существующие код. Mapper при чтении из item делает конверсию mm → cm для отправки в ApiShip, но defaults остаются в cm.

---

## Entity: Shipping Place (внутренний derived type)

**Не сохраняется в БД**, только в runtime — это объект для запроса в ApiShip API.

**Origin**: один на каждую единицу товара в корзине. Если в корзине 2 SKU с qty 3 и 2 соответственно, формируется 5 мест.

**Fields**:

| Поле | Источник | Конверсия |
|---|---|---|
| `cost` | `item.price` | — (валюта = RUB, целые рубли) |
| `weight` | `item.weightGrams` или `settings.defaults.weight` | в граммах, как есть |
| `length` | `item.lengthMm / 10` или `settings.defaults.length` | mm → cm, round to integer |
| `width` | `item.widthMm / 10` или `settings.defaults.width` | mm → cm, round |
| `height` | `item.heightMm / 10` или `settings.defaults.height` | mm → cm, round |

**Builder pattern** (упрощённо):

```typescript
function buildPlace(item: EnrichedCartItem, defaults: ShippingDefaults): Place {
  return {
    cost: item.price,
    weight: item.weightGrams ?? defaults.weight,
    length: item.lengthMm != null ? Math.round(item.lengthMm / 10) : defaults.length,
    width:  item.widthMm  != null ? Math.round(item.widthMm  / 10) : defaults.width,
    height: item.heightMm != null ? Math.round(item.heightMm / 10) : defaults.height,
  };
}
```

---

## Type changes (TypeScript)

### `apps/web/src/lib/shipping/types.ts`

Текущий `CartItemForShipping`:

```typescript
export interface CartItemForShipping {
  sku: string;
  name?: string;
  quantity: number;
  price: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}
```

**Изменение**: переименовать поля для ясности единиц измерения, оставив старые как deprecated alias **или** просто переименовать (single-developer проект, не страшно). Решение: переименовать.

```typescript
export interface CartItemForShipping {
  sku: string;
  name?: string;
  quantity: number;
  price: number;
  /** Масса единицы товара в граммах. Если undefined — используется defaults.weight (тоже в граммах). */
  weightGrams?: number;
  /** Длина упаковки в миллиметрах. Конвертируется в см при отправке. */
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
}
```

Поля `weight`/`length`/`width`/`height` нигде в проекте не задействованы (фронт их не отправляет, мы только что проверили) → переименование безопасно.

### `apps/web/src/payload-types.ts`

Автогенерируется через `pnpm --filter @soliton/web generate:types` после изменения collection. Появятся типы для `Product.physicalPackaging.weightGrams | null` и т.д.

---

## Migration

**File**: `apps/web/src/migrations/YYYYMMDDHHMMSS_add_product_physical.ts`

Создаётся через `pnpm exec payload migrate:create add_product_physical` (после того как изменили collection и dev-сервер запустил auto-push).

**Schema changes**:

```sql
ALTER TABLE products
  ADD COLUMN physical_packaging_weight_grams INTEGER,
  ADD COLUMN physical_packaging_length_mm    INTEGER,
  ADD COLUMN physical_packaging_width_mm     INTEGER,
  ADD COLUMN physical_packaging_height_mm    INTEGER;

ALTER TABLE _products_v
  ADD COLUMN version_physical_packaging_weight_grams INTEGER,
  ADD COLUMN version_physical_packaging_length_mm    INTEGER,
  ADD COLUMN version_physical_packaging_width_mm     INTEGER,
  ADD COLUMN version_physical_packaging_height_mm    INTEGER;
```

`_products_v` — таблица версий Payload (versioned collection). Тоже добавляем колонки.

**Rollback** (`down`):

```sql
ALTER TABLE products DROP COLUMN physical_packaging_weight_grams;
ALTER TABLE products DROP COLUMN physical_packaging_length_mm;
ALTER TABLE products DROP COLUMN physical_packaging_width_mm;
ALTER TABLE products DROP COLUMN physical_packaging_height_mm;

-- та же логика для _products_v
```

**Backward compatibility**: все новые колонки nullable. Существующие 66 продуктов остаются с NULL — что эквивалентно «без physical» → fallback на defaults.

---

## Indexes

Нет необходимости в индексах по physical-полям — мы не делаем поиск/фильтрацию по ним. Поля используются:
1. При чтении карточки товара (admin) — primary key access по id.
2. При lookup batch в API расчёта — `WHERE sku IN (...)` уже использует существующий unique index на `sku`.

---

## Audit / change tracking

Payload versioning уже включён для `products` (видно из `_products_v` таблицы). Изменения physical-полей будут попадать в историю версий автоматически — это даёт админам аудит «кто и когда заполнил/изменил физпараметры».

---

## Summary

- **1 collection** изменена (`products`).
- **2 таблицы** Postgres расширены (`products`, `_products_v`), все колонки nullable.
- **1 TS interface** переименован (`CartItemForShipping` — поля в mm/g).
- **0 новых сущностей**, **0 новых связей**.
- **0 breaking changes** для существующих 66 продуктов, существующих корзин и заказов.
