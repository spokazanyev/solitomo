# Contract: `POST /api/orders` — delivery payload (064)

Расширение контракта приёма заказа в части `delivery`. Цель — принять и сохранить **любого** перевозчика ApiShip. Затрагивает оба фронта: `InvoiceCheckoutForm` (юрлицо) и `physical/review/page.tsx` → `ReviewClient` (физлицо).

## Request body — поле `delivery`

```jsonc
{
  "delivery": {
    "channel": "service",          // NEW (required-by-convention): pickup | service | own_carrier
    "providerKey": "dellin",        // open string (любой код от ApiShip); для service
    "providerName": "Деловые Линии",// optional; имя из rate.providerName (бэкенд всё равно резолвит)
    "provider": "apiship",          // apiship | fallback (как сейчас)
    "tariffId": 12345,
    "deliveryType": "1",            // "1" дверь / "2" ПВЗ
    "pickupType": "1",
    "pointId": "...",               // для ПВЗ
    "pointAddress": "...",          // для ПВЗ
    "cost": 740,                     // стоимость; сохраняется для ЛЮБОГО service-перевозчика
    "etaMinDays": 2,
    "etaMaxDays": 4,
    "address": "г. Москва, ...",
    "city": "Москва",
    "addressNormalized": { "...": "..." },
    "handoverNote": ""              // для pickup/own_carrier
  }
}
```

### Канал `pickup` / `own_carrier`

```jsonc
{ "delivery": { "channel": "pickup",      "handoverNote": "Иванов, +7 999 ...", "cost": 0 } }
{ "delivery": { "channel": "own_carrier", "handoverNote": "ТК «X», договор № ...", "city": "...", "address": "...", "cost": 0 } }
```

## Server behavior (нормализация)

1. `channel = normalizeDeliveryChannel(body.delivery)` — валидирует присланный `channel`; при отсутствии выводит из полей (см. data-model §2). Никогда не бросает.
2. `isService = channel === "service"`.
3. `deliveryCost = isService ? Math.max(0, Number(cost)||0) : 0`. **Не обнуляется** для перевозчиков вне прежних трёх (FR-004, SC-002).
4. `handoverNote`: правила по `channel` (pickup ≥5, own_carrier ≥10, ≤1000) — как в 062.
5. Для `service` сохраняется полный блок ApiShip + `providerName = resolveProviderName(body.providerName, providerKey)`.
6. `delivery.method = channel` (транзитный алиас, не дискриминатор).
7. Удаляются: `METHOD_WHITELIST`, `isApiShipMethod`-по-списку, `tc→own_carrier` soft-mapping (легаси-тело покрывает `normalizeDeliveryChannel`).

## Acceptance (привязка к FR)

| Сценарий | Ожидание | FR |
|----------|----------|-----|
| `channel=service`, `providerKey=dellin` | заказ сохранён: `channel=service`, `providerKey=dellin`, `providerName="Деловые Линии"`, `cost>0`, блок ApiShip | FR-001/002/004 |
| `channel=service`, `providerKey` вне маппинга | `providerName = providerKey` (fallback), без ошибки | FR-006/010 |
| `channel=service`, `providerKey` пуст/`unknown` | `providerName="служба доставки"`, заказ оформлен | FR-009 |
| `channel=service`, `deliveryType="2"` | сохранены `pointId`, `pointAddress` | FR-002 |
| `channel=service`, `deliveryType="1"` | сохранён адрес доставки (city+address) | FR-002 |
| `channel=pickup` / `own_carrier` | `cost=0`, без блока перевозчика, handoverNote по правилам | FR-008 |
| physical (card) flow с произвольным перевозчиком | то же, что invoice — полный блок сохранён | FR-010 |

## Frontend obligations

- **InvoiceCheckoutForm.tsx**: в apiship-режиме слать `channel:"service"` + `providerName: rate.providerName`; own_carrier → `channel:"own_carrier"`; pickup → `channel:"pickup"`. (Сейчас шлёт `method: rate.providerKey` — заменить на `channel` + оставить `providerKey`.)
- **physical/review/page.tsx (`orderPayload.delivery`)**: добавить `channel:"service"` + полный ApiShip-блок (`providerKey, providerName, tariffId, deliveryType, pickupType, pointId, pointAddress, cost, etaMinDays, etaMaxDays, addressNormalized`) из `draft.rate`. (Сейчас шлёт только `method/address/city/cost` → блок терялся даже для cdek.)
