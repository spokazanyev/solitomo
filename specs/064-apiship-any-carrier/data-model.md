# Phase 1 Data Model: ApiShip — поддержка любого перевозчика (064)

Затрагивается **одна** существующая группа `delivery` в коллекции `orders` (Payload v3 / Postgres). Никаких новых коллекций. Backfill не нужен (на проде нет реальных заказов).

---

## 1. Группа `orders.delivery` — изменения

### 1.1. Новое поле `channel` (закрытый канал доставки)

| Атрибут | Значение |
|---------|----------|
| Payload | `{ name: "channel", type: "select", options: [pickup, service, own_carrier] }` |
| Postgres | `delivery_channel` (Payload создаст `enum_orders_delivery_channel`) |
| Семантика | Единственный драйвер поведения заказа: стоимость, примечания, блок перевозчика |
| Обязательность | Не required на уровне схемы (legacy/прямые API-клиенты), но бэкенд всегда проставляет через `normalizeDeliveryChannel` |

Опции:

```js
{
  name: "channel",
  type: "select",
  label: adminLabel("Канал доставки", "Delivery channel"),
  options: [
    { label: adminLabel("Самовывоз", "Pickup"), value: "pickup" },
    { label: adminLabel("Служба доставки (ApiShip)", "Delivery service (ApiShip)"), value: "service" },
    { label: adminLabel("Транспортной компанией покупателя", "Own carrier"), value: "own_carrier" },
  ],
}
```

### 1.2. Новое поле `providerName` (человекочитаемое имя перевозчика)

| Атрибут | Значение |
|---------|----------|
| Payload | `{ name: "providerName", type: "text", label: "Название службы" }` |
| Postgres | `delivery_provider_name text` (nullable) |
| Семантика | Имя перевозчика для счёта/админки; для `service` заполняется, иначе пусто |
| Источник | `resolveProviderName(body.providerName, providerKey)` (см. §2) |

### 1.3. Изменяемое поле `method` (enum → text, deprecated-alias)

| Было | Стало |
|------|-------|
| `type: "select"` c опциями {pickup, cdek, boxberry, russian-post, own_carrier, tc}; PG `enum_orders_delivery_method` | `type: "text"` (открытое), PG `text` |
| Дискриминатор перевозчика | **Транзитный алиас канала**: бэкенд пишет `method = channel`. Новые читатели используют `channel`. |

> `method` НЕ удаляем (дешёвая миграция, не ломаем `me/orders` API-shape и order-page разом). Перевозчик в `method` больше не хранится — он в `providerKey`/`providerName`.

### 1.4. Без изменений (существующие поля)

`address`, `city`, `cost`, `handoverNote`, `provider` (apiship/fallback), `providerKey` (text, open — **carrier code**), `tariffId`, `deliveryType` (1/2), `pickupType` (1/2), `pointId`, `pointAddress`, `etaMinDays`, `etaMaxDays`, `addressNormalized`, `priceSnapshot`, `selectedAt` — остаются как есть.

---

## 2. Чистый хелпер `lib/shipping/delivery-channel.ts` (NEW)

```ts
export type DeliveryChannel = "pickup" | "service" | "own_carrier";

const CHANNELS: readonly DeliveryChannel[] = ["pickup", "service", "own_carrier"];

/** Источник истины — присланный channel; иначе вывод из полей (страховка). */
export function normalizeDeliveryChannel(input: {
  channel?: string;
  providerKey?: string;
  tariffId?: number;
  method?: string; // legacy-тело
}): DeliveryChannel {
  if (CHANNELS.includes(input.channel as DeliveryChannel)) {
    return input.channel as DeliveryChannel;
  }
  // legacy/прямые клиенты:
  if (input.method === "pickup") return "pickup";
  if (input.method === "own_carrier" || input.method === "tc") return "own_carrier";
  if (input.providerKey || input.tariffId != null) return "service";
  if (input.method) return "service"; // method как providerKey (старый фронт)
  return "pickup"; // безопасный fallback: cost=0
}

/** FR-006: имя → код → «служба доставки», без пустот. */
export function resolveProviderName(
  providerName: string | undefined,
  providerKey: string | undefined,
): string {
  const name = (providerName ?? "").trim();
  if (name) return name;
  const key = (providerKey ?? "").trim();
  if (key && key !== "unknown") {
    return providerNameFromKey(key); // из mappers (?? key)
  }
  return "служба доставки";
}
```

> `providerNameFromKey` сейчас приватна в `mappers.ts` — экспортировать её (или продублировать карту в хелпере; предпочтительно экспорт, чтобы не плодить дубль — Principle VI).

### Правила нормализации (таблица)

| Вход (`channel` / поля) | Результат `channel` | `deliveryCost` | Блок ApiShip + `providerName` |
|-------------------------|---------------------|----------------|-------------------------------|
| `service` + `providerKey="dpd"` | `service` | `cost` (≥0) | сохраняется; name = «DPD» |
| `service` + `providerKey="dellin"` | `service` | `cost` | сохраняется; name = «Деловые Линии» |
| `service` + `providerKey="xyz"` (нет в маппинге) | `service` | `cost` | сохраняется; name = «xyz» (fallback на код) |
| `service` + пустой/`unknown` providerKey | `service` | `cost` | сохраняется; name = «служба доставки» |
| `pickup` | `pickup` | `0` | не пишется; handoverNote ≥5 |
| `own_carrier` | `own_carrier` | `0` | не пишется; handoverNote ≥10 |
| нет channel, есть providerKey | `service` (вывод) | `cost` | сохраняется |
| нет channel, нет полей | `pickup` (fallback) | `0` | не пишется |

---

## 3. Влияние на `POST /api/orders` (логика записи)

```text
channel = normalizeDeliveryChannel(body.delivery)
isService = channel === "service"
deliveryCost = isService ? max(0, body.delivery.cost) : 0      // FR-004: НЕ обнулять для любой service
providerKey = isService ? body.delivery.providerKey : undefined
providerName = isService ? resolveProviderName(body.delivery.providerName, providerKey) : undefined

data.delivery = {
  channel,
  method: channel,                       // транзитный алиас
  address, city, cost: deliveryCost, handoverNote,
  ...(isService ? { provider, providerKey, providerName, tariffId, deliveryType,
                    pickupType, pointId, pointAddress, etaMinDays, etaMaxDays,
                    addressNormalized } : {}),
}
```

`METHOD_WHITELIST` и `isApiShipMethod` (по списку 3 кодов) — **удаляются**. handoverNote-валидация переключается с `method` на `channel`.

---

## 4. Влияние на читателей `delivery.method`

| Файл | Было | Стало |
|------|------|-------|
| `api/invoice/[orderId]/route.ts` | `isPickup = method==="pickup"`, `isOwnCarrier = method ∈ {own_carrier,tc}`, `isApiShipMethod = !pickup&&!own` | `isPickup = channel==="pickup"`, `isOwnCarrier = channel==="own_carrier"`, `isService = channel==="service"`. `carrierLabel` → сначала `providerName`, затем код |
| `(site)/cart/order/[token]/page.tsx` | `<p>{o.delivery?.method}</p>` | показать `providerName` (service) / человекочит. канал (pickup/own_carrier) |
| `api/customers/me/orders/route.ts` | `method: delivery.method` | добавить `channel` + `providerName` в ответ (method остаётся алиасом — shape не ломается) |

---

## 5. Инварианты / валидация

- `channel ∈ {pickup, service, own_carrier}` (закрыто). Любое другое → нормализуется/выводится, заказ не падает (FR-010, edge cases).
- Для `service` `deliveryCost` НЕ обнуляется ни для какого `providerKey` (FR-004, SC-002).
- `providerName` никогда не пустой при `service` (FR-006): минимум «служба доставки».
- `pickup`/`own_carrier`: `deliveryCost = 0`, без блока перевозчика (FR-008).
- Отправка в ApiShip (`toOrderRequest`) уже принимает произвольный `providerKey` — не меняется.
