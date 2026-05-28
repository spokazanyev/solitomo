# Contract: PDF-счёт и карточка заказа — рендер доставки (064)

Отображение перевозчика/типа/адреса для **любого** перевозчика. Затрагивает `api/invoice/[orderId]/route.ts` (PDF), `(site)/cart/order/[token]/page.tsx` (карточка), `api/customers/me/orders/route.ts` (API-shape).

## Источник данных (читать `channel`, не `method`)

```ts
const channel = o.delivery?.channel;            // pickup | service | own_carrier
const isPickup     = channel === "pickup";
const isOwnCarrier = channel === "own_carrier";
const isService    = channel === "service";
const providerName = o.delivery?.providerName ?? "";
const providerKey  = o.delivery?.providerKey ?? "";
const deliveryType = o.delivery?.deliveryType ?? "";   // "2" = ПВЗ
```

> Переходный период: если `channel` отсутствует (например прямой API-клиент), допускается вывод из `method`/полей тем же `normalizeDeliveryChannel`. Так как на проде нет старых заказов — это лишь страховка.

## `carrierLabel` — приоритет `providerName`

```ts
function carrierLabel(providerName?: string, providerKey?: string): string {
  const n = (providerName ?? "").trim();
  if (n) return n;                              // 1) сохранённое имя
  const k = (providerKey ?? "").trim();
  if (k && k !== "unknown") return k;           // 2) код как fallback (FR-006)
  return "служба доставки";                     // 3) запасной текст (FR-009)
}
```

> Прежний `CARRIER_LABELS = {cdek, boxberry, russian-post}` больше не нужен как основной путь — имя приходит из `providerName`. Карту можно удалить или оставить как доп. fallback; основной источник — `providerName`.

## Рендер-блоки

### `service` (FR-007)

```
Доставка:
Служба: {carrierLabel(providerName, providerKey)} · {deliveryType==="2" ? "до пункта выдачи (ПВЗ)" : "курьером до двери"}.
{deliveryType==="2" ? "Адрес ПВЗ: " + (pointAddress || address) : "Адрес доставки: " + (city + ", " + address)}
{etaMin/Max ? "Срок: N–M раб. дн." : ""}
```

- Нет `pointAddress` при ПВЗ → fallback на адрес доставки (edge case спеки), без ошибки.

### `pickup` / `own_carrier` (FR-008)

Прежний блок без изменений: адрес склада / «Примечание к отгрузке» (`handoverNote`), без блока перевозчика.

## Acceptance (привязка к FR)

| Сценарий | Ожидание | FR |
|----------|----------|-----|
| service, известное имя | в PDF/карточке: имя службы + тип + адрес | FR-006/007, SC-004 |
| service, нет имени, есть код | показывается код как fallback, без пустот | FR-006 |
| service, пустой/unknown код | «служба доставки», без ошибок | FR-009 |
| ПВЗ без pointAddress | fallback на адрес доставки | edge case |
| pickup / own_carrier | прежний блок (склад/примечание), без перевозчика | FR-008 |

## `me/orders` API-shape

В ответ добавить `channel` и `providerName` рядом с `method` (последнее остаётся алиасом — существующие клиенты не ломаются).
