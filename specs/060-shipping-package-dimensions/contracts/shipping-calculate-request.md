# Contract: POST `/api/shipping/calculate`

**Type**: HTTP endpoint contract
**Status**: Modified (backward-compatible)
**Existing spec**: `specs/047-delivery-checkout-apiship/contracts/shipping-api.openapi.yaml`

## Что меняется

**Request body type** (`CalculationInput`) — поля `items[].weight/length/width/height` остаются опциональными и не передаются фронтендом (как раньше). Бэкенд сам обогащает items данными из коллекции `products` перед передачей в провайдер.

**Никакого изменения формата request от фронтенда** — это важно для backward compatibility и для того чтобы тесты/мониторинг продолжали работать.

## Request — без изменений

```http
POST /api/shipping/calculate
Content-Type: application/json

{
  "cartId": "cart_abc123",
  "address": {
    "countryCode": "RU",
    "postalCode": "620014",
    "city": "Екатеринбург",
    "region": "Свердловская обл",
    "addressString": "г Екатеринбург, ул Хохрякова, д 48"
  },
  "items": [
    { "sku": "PDU-001", "quantity": 1, "price": 12500 },
    { "sku": "PDU-002", "quantity": 5, "price": 4200 }
  ]
}
```

## Response — без изменений (по форме)

```http
HTTP 200
Content-Type: application/json

{
  "cachedAt": "2026-05-27T13:42:00.000Z",
  "rates": [
    {
      "shippingOptionId": "apiship_doortodoor_cheapest",
      "providerKey": "cdek",
      "providerName": "СДЭК",
      "tariffId": 137,
      "tariffName": "Доставка курьером",
      "deliveryType": 1,
      "pickupType": 1,
      "cost": 1850,
      "currency": "RUB",
      "etaMinDays": 2,
      "etaMaxDays": 3,
      "badges": ["cheapest"]
    }
  ],
  "warnings": []
}
```

**Изменение по сути ответа**: `cost` теперь отражает реальные физические параметры посылки → значения могут быть выше или ниже, чем были до фичи.

## Серверная логика (новое)

1. Валидация request body (как было).
2. **Lookup продуктов** (новый шаг):
   ```typescript
   const skus = body.items.map(i => i.sku);
   const payload = await getPayload({ config });
   const productsResult = await payload.find({
     collection: 'products',
     where: { sku: { in: skus } },
     depth: 0,
     limit: 100,
   });
   const bySku = new Map(productsResult.docs.map(p => [p.sku, p.physicalPackaging ?? null]));
   ```
3. **Enrichment items** (новый шаг):
   ```typescript
   const enrichedItems = body.items.map(it => {
     const phys = bySku.get(it.sku);
     return {
       ...it,
       weightGrams: phys?.weightGrams ?? undefined,
       lengthMm: phys?.lengthMm ?? undefined,
       widthMm: phys?.widthMm ?? undefined,
       heightMm: phys?.heightMm ?? undefined,
     };
   });
   ```
4. Вызов `provider.calculate({ ...body, items: enrichedItems })` (как было, но теперь с physical).

## Behavior matrix

| Сценарий | Поведение |
|---|---|
| Все товары в корзине без physical | `provider.calculate` получает items без weight/length/etc → mapper использует `settings.defaults` → ответ как до фичи. |
| Все товары с physical | Mapper использует реальные значения для каждого item → точный расчёт. |
| Смешанная корзина | Mapper решает per-item: для одного товара берёт реальные, для другого — defaults. |
| `bySku.get(sku)` вернул `undefined` (товар удалён) | item проходит как без physical → defaults. Логируем warning. |
| `payload.find` упал (DB down) | 503 в API response (как было). Лучше пусть упадёт — заказ с неправильной ценой хуже. |

## Performance

- Один `payload.find` с `IN`-запросом на 1-3 SKU в типичной корзине — миллисекунды (unique index на sku уже есть).
- Cache check (`shipping_calculations`) идёт ДО lookup продуктов — на cache hit мы вообще не лукапим products → нулевой overhead.
- На cache miss добавляется ~5-15 ms на DB-lookup. Total ApiShip-round-trip = 700+ ms, не критично.

## Backward compatibility

- Фронт не меняется (формирует те же items).
- Контракт между API и провайдером расширяется (новые опциональные поля в items), но провайдер уже понимает их (TS-types и fallback логика добавляются в этой же фиче).
- Существующие тесты на endpoint должны продолжать проходить.
