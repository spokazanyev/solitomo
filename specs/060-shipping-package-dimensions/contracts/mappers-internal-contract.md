# Contract: ApiShip mappers — internal contract

**Type**: Internal library contract
**File**: `apps/web/src/lib/shipping/apiship/mappers.ts`
**Status**: Modified

## Что меняется

Два маппера расширяют поведение на учёт `physical` параметров и `quantity` expansion:

1. `toCalculatorRequest(input, type, settings)` — формирует запрос для `/v1/calculator`.
2. `toOrderRequest(order, settings)` — формирует запрос для `/v1/orders` (создание waybill).

Третий маппер (`toShippingRate`, `pickBestTariffs`, `toPickupPoints`) — без изменений.

---

## Function: `toCalculatorRequest`

### Signature (без изменений)

```typescript
function toCalculatorRequest(
  input: CalculationInput,
  type: DeliveryTypeCode,
  settings: ApiShipSettings,
): CalculatorRequest;
```

### Поведение — изменения

**Было** (упрощённо):
```typescript
places: input.items.map((item) => ({
  cost: item.price * item.quantity,
  weight: item.weight ?? settings.defaults.weight,
  length: item.length ?? settings.defaults.length,
  width:  item.width  ?? settings.defaults.width,
  height: item.height ?? settings.defaults.height,
})),
```

**Станет**:
```typescript
places: input.items.flatMap((item) => {
  const weight = item.weightGrams ?? settings.defaults.weight;
  const lengthCm = item.lengthMm != null
    ? Math.max(1, Math.round(item.lengthMm / 10))
    : settings.defaults.length;
  const widthCm = item.widthMm != null
    ? Math.max(1, Math.round(item.widthMm / 10))
    : settings.defaults.width;
  const heightCm = item.heightMm != null
    ? Math.max(1, Math.round(item.heightMm / 10))
    : settings.defaults.height;
  return Array.from({ length: item.quantity }, () => ({
    cost: item.price,
    weight,
    length: lengthCm,
    width: widthCm,
    height: heightCm,
  }));
}),
```

### Контрактные инварианты

| # | Инвариант | Тест |
|---|---|---|
| C1 | `places.length === sum(items[i].quantity)` | Cart с qty=[3, 2] → places.length === 5 |
| C2 | Если у item все 4 physical-поля заполнены → каждый соответствующий place использует именно эти значения | item.weightGrams=8000 → place.weight===8000 (для каждой копии) |
| C3 | Если у item хоть одно physical-поле undefined → ВСЕ 4 размера для этого item берутся из defaults (item не «частично с physical») | item.weightGrams=8000, lengthMm=null → place.weight=8000, place.length=defaults.length |
| C3a | **Уточнение**: physical берутся per-axis. weightGrams=8000 пройдёт даже если lengthMm пустой. То есть каждое поле независимо. | item.weightGrams=8000, остальные undefined → place.weight=8000, length/width/height=defaults |
| C4 | Все измерения конвертируются из мм в см с округлением. Минимум 1 см. | lengthMm=15 → place.length=Math.round(15/10)=2 (но max(1, 2)=2). lengthMm=4 → place.length=max(1, 0)=1 |
| C5 | `cost` — это цена за единицу (`item.price`), не за всё количество. ApiShip ожидает per-place cost. | item.price=12500, qty=3 → каждый из 3 places имеет cost=12500 |

> **Важное изменение в C5**: раньше `cost: item.price * item.quantity` суммировал по всем единицам в одно место. Теперь места разделены — `cost: item.price` на каждое. Это правильно семантически: «cost place» это страховая стоимость **одного** места.

### Backward compatibility

Поля типа `CartItemForShipping` переименовываются: `weight` → `weightGrams`, `length` → `lengthMm`, и т.д. Это breaking change на уровне типа, но в проекте сейчас НИКТО не передаёт эти поля во фронте (`PhysicalCheckoutForm` и `CheckoutShippingClient` шлют только `{sku, quantity, price}`). Refactor локализован в lib/shipping и в новых строках в API route (enrichment).

---

## Function: `toOrderRequest`

### Signature (без изменений)

```typescript
function toOrderRequest(
  order: OrderForShipment,
  settings: ApiShipSettings,
): OrderRequest;
```

### Поведение — изменения

**Было**: один `place` на каждый item, с суммированным весом и фиксированными dimensions (по `settings.defaults` или item).

**Станет**: то же что в `toCalculatorRequest` — flatMap по `item.quantity`, каждая единица → отдельное место. `OrderForShipment.items` тоже должен принимать опциональные поля `weightGrams/lengthMm/widthMm/heightMm`.

### Контрактные инварианты

| # | Инвариант |
|---|---|
| O1 | `places.length === sum(order.items[i].quantity)` |
| O2 | Описание места (`description`) — `item.name ?? item.sku` (как было) |
| O3 | `place.items[0].quantity` всегда `1` (одна штука в одном месте), `place.items[0].cost = item.price`, `place.items[0].weight = item.weightGrams ?? defaults.weight` |
| O4 | Top-level `order.weight` (для запроса) — сумма весов всех places (т.е. для qty=3 weight=2000 → order.weight=6000). Это нужно для top-level field в OrderRequest. |
| O5 | Top-level `order.length/width/height` — для multi-place заказа это габариты ОДНОГО (наибольшего?) места. Решение: берём дефолтные из settings (как сейчас). Это поле ApiShip не требует точности для multi-place. |

### Source for `order.items`

`OrderForShipment.items` строится в коде provider/wrapper при обработке Payload order. Сейчас у Order.items нет physical полей (см. R1 в research). Lookup делается в обёртке `createShipmentForOrder` (или внутри `ApiShipProvider.createShipment`) перед вызовом mapper'а — Logic симметрична enrichment в `/api/shipping/calculate route`.

---

## Type changes

### `apps/web/src/lib/shipping/types.ts`

```diff
 export interface CartItemForShipping {
   sku: string;
   name?: string;
   quantity: number;
   price: number;
-  weight?: number;
-  length?: number;
-  width?: number;
-  height?: number;
+  /** Масса единицы товара в граммах. Если undefined — используется defaults.weight. */
+  weightGrams?: number;
+  /** Длина упаковки в мм. Конвертируется в см при отправке в ApiShip. */
+  lengthMm?: number;
+  widthMm?: number;
+  heightMm?: number;
 }
```

Аналогично для `OrderItemForShipment` если есть отдельный тип (надо проверить в types.ts — может это alias на CartItemForShipping).

---

## Unit-test scaffold (`apps/web/src/lib/shipping/apiship/__tests__/mappers.test.ts`)

Тесты, которые должны быть добавлены:

```typescript
describe('toCalculatorRequest — quantity expansion (060)', () => {
  it('expands qty=5 into 5 identical places', () => {
    const input = { ...baseInput, items: [{ sku: 'X', quantity: 5, price: 1000,
      weightGrams: 2000, lengthMm: 400, widthMm: 200, heightMm: 150 }] };
    const req = toCalculatorRequest(input, 'doortodoor', SETTINGS);
    expect(req.places).toHaveLength(5);
    req.places.forEach(p => {
      expect(p.weight).toBe(2000);
      expect(p.length).toBe(40);
      expect(p.width).toBe(20);
      expect(p.height).toBe(15);
      expect(p.cost).toBe(1000);
    });
  });

  it('uses defaults when physical fields missing', () => {
    const input = { ...baseInput, items: [{ sku: 'X', quantity: 1, price: 5000 }] };
    const req = toCalculatorRequest(input, 'doortodoor', SETTINGS);
    expect(req.places[0].weight).toBe(SETTINGS.defaults.weight);
    expect(req.places[0].length).toBe(SETTINGS.defaults.length);
  });

  it('handles mixed cart per-axis fallback', () => {
    const input = { ...baseInput, items: [
      { sku: 'A', quantity: 1, price: 1000, weightGrams: 5000 },    // только weight
      { sku: 'B', quantity: 1, price: 2000, lengthMm: 800 },         // только length
    ] };
    const req = toCalculatorRequest(input, 'doortodoor', SETTINGS);
    expect(req.places[0].weight).toBe(5000);
    expect(req.places[0].length).toBe(SETTINGS.defaults.length); // fallback
    expect(req.places[1].weight).toBe(SETTINGS.defaults.weight); // fallback
    expect(req.places[1].length).toBe(80);
  });

  it('clamps dimensions to min 1 cm', () => {
    const input = { ...baseInput, items: [{ sku: 'tiny', quantity: 1, price: 100,
      weightGrams: 5, lengthMm: 3, widthMm: 3, heightMm: 3 }] };
    const req = toCalculatorRequest(input, 'doortodoor', SETTINGS);
    expect(req.places[0].length).toBeGreaterThanOrEqual(1);
  });
});

describe('toOrderRequest — quantity expansion (060)', () => {
  it('expands qty=3 into 3 places in waybill request', () => {
    const order = { ...baseOrder, items: [{ sku: 'X', name: 'PDU', quantity: 3,
      price: 8000, weightGrams: 4000, lengthMm: 600, widthMm: 200, heightMm: 100 }] };
    const req = toOrderRequest(order, SETTINGS);
    expect(req.places).toHaveLength(3);
    expect(req.order.weight).toBe(12000); // 3 × 4000
  });
});
```

---

## Summary

| Артефакт | Изменения |
|---|---|
| `apps/web/src/lib/shipping/types.ts` | Переименование 4 полей на CartItemForShipping в mm/g. |
| `apps/web/src/lib/shipping/apiship/mappers.ts` | `flatMap` + конверсия mm→cm в `toCalculatorRequest` и `toOrderRequest`. |
| `apps/web/src/lib/shipping/apiship/__tests__/mappers.test.ts` | +5 test cases (см. выше). |
| Frontend (`PhysicalCheckoutForm.tsx`, `CheckoutShippingClient.tsx`) | НЕ изменяются — продолжают шлать `{sku, quantity, price}`. Enrichment делается на сервере. |
