# Contract: POST `/api/orders` — расширение для invoice-checkout с 3 режимами доставки

**Branch**: `062-invoice-shipping-unify` | **Phase**: 1 — Design | **Date**: 2026-05-27

Расширение существующего endpoint [/api/orders/route.ts](../../../apps/web/src/app/api/orders/route.ts) (без breaking changes для physical-flow).

---

## Request

`POST /api/orders` с JSON-body. Заголовки и аутентификация — без изменений.

### Изменения в `IncomingPayload`

#### Поле `delivery` (расширено)

| Поле | Тип | Required | Описание |
|------|-----|----------|----------|
| `method` | enum | yes | `pickup` \| `cdek` \| `boxberry` \| `russian-post` \| `own_carrier`. Whitelist обновлён: `tc` → `own_carrier`. |
| `address` | string | conditional | Required для ApiShip-режима; ignored для `pickup`/`own_carrier`. |
| `city` | string | conditional | Required для ApiShip-режима. |
| `cost` | number | conditional | Для ApiShip — реальная стоимость (≥0). Для `pickup`/`own_carrier` — игнорируется сервером, всегда нормализуется в 0. |
| **`handoverNote`** | string | conditional (NEW) | **Обязательное для `pickup` и `own_carrier`** (server-side validation R7). Опциональное для ApiShip (ignored, не сохраняется). Trim перед валидацией. Длина: 5+ для `pickup`, 10+ для `own_carrier`, ≤1000. |
| `provider` | string | optional | Для ApiShip: `apiship` или `fallback`. Для остальных режимов — ignored. |
| `providerKey` | string | optional | Для ApiShip — `cdek_door`/`boxberry_point` и т.п. |
| `tariffId` | number | optional | Для ApiShip — численный ID тарифа. |
| `deliveryType` | string | optional | "1" (до двери) или "2" (до ПВЗ). |
| `pickupType` | string | optional | "1" или "2". |
| `pointId` | string | optional | Required, если `deliveryType="2"` в ApiShip-режиме. |
| `pointAddress` | string | optional | Адрес выбранного ПВЗ. |
| `etaMinDays` | number | optional | Срок доставки мин. |
| `etaMaxDays` | number | optional | Срок доставки макс. |
| `addressNormalized` | object | optional | DaData normalized address (postalCode, city, region, street, house, flat, kladrId, fiasId, isValid). |

#### Остальные поля payload — без изменений

`type`, `items`, `customer`, `cartToken`, `sourcePage`, `consent` — как сейчас.

---

## Server-side validation (новые правила)

### Шаг 1: Whitelist enum

```ts
const METHOD_WHITELIST = ["pickup", "cdek", "boxberry", "russian-post", "own_carrier"] as const;

const method = METHOD_WHITELIST.includes(body.delivery?.method as never)
  ? body.delivery!.method as typeof METHOD_WHITELIST[number]
  : undefined;
```

**Note**: `tc` НЕ включён в whitelist для новых записей (legacy-значение принимается только read-path в коллекции). Если клиент случайно прислал `tc` — `method` будет `undefined`, что приведёт к provider-defaulted `fallback` и явной ошибке Payload-валидации.

### Шаг 2: handoverNote validation

```ts
const note = typeof body.delivery?.handoverNote === "string"
  ? body.delivery.handoverNote.trim()
  : "";

if ((method === "own_carrier" || method === "pickup") && note.length === 0) {
  return NextResponse.json(
    { error: "MISSING_HANDOVER_NOTE", message: "handoverNote required for pickup/own_carrier" },
    { status: 400 },
  );
}

if (method === "own_carrier" && note.length < 10) {
  return NextResponse.json(
    { error: "HANDOVER_NOTE_TOO_SHORT", message: "handoverNote must be at least 10 chars for own_carrier" },
    { status: 400 },
  );
}

if (method === "pickup" && note.length < 5) {
  return NextResponse.json(
    { error: "HANDOVER_NOTE_TOO_SHORT", message: "handoverNote must be at least 5 chars for pickup" },
    { status: 400 },
  );
}

if (note.length > 1000) {
  return NextResponse.json(
    { error: "HANDOVER_NOTE_TOO_LONG", message: "handoverNote exceeds 1000 chars" },
    { status: 400 },
  );
}
```

### Шаг 3: Normalize cost для не-ApiShip режимов

```ts
const isApiShipMethod = method === "cdek" || method === "boxberry" || method === "russian-post";
const deliveryCost = isApiShipMethod
  ? Math.max(0, Number(body.delivery?.cost) || 0)
  : 0;  // pickup/own_carrier → cost всегда 0
```

### Шаг 4: ApiShip-поля сохраняем только в ApiShip-режиме

```ts
const apiShipFields = isApiShipMethod
  ? {
      provider: body.delivery?.provider ?? "fallback",
      providerKey: body.delivery?.providerKey,
      tariffId: body.delivery?.tariffId,
      deliveryType: body.delivery?.deliveryType,
      pickupType: body.delivery?.pickupType,
      pointId: body.delivery?.pointId,
      pointAddress: body.delivery?.pointAddress,
      etaMinDays: body.delivery?.etaMinDays,
      etaMaxDays: body.delivery?.etaMaxDays,
      addressNormalized: body.delivery?.addressNormalized,
    }
  : {
      provider: "fallback",  // default; никаких ApiShip-данных
    };
```

---

## Response

### Success — 201 Created (без изменений)

```json
{
  "id": "<order_id>",
  "publicToken": "<public_token>",
  "status": "awaiting_payment",
  "type": "legal",
  "cartId": "<cart_id>"
}
```

### Errors — новые коды

| HTTP | Code | Описание |
|------|------|----------|
| 400 | `MISSING_HANDOVER_NOTE` | `method=pickup` или `own_carrier`, но `handoverNote` пустой/whitespace-only |
| 400 | `HANDOVER_NOTE_TOO_SHORT` | `own_carrier`: <10 chars; `pickup`: <5 chars |
| 400 | `HANDOVER_NOTE_TOO_LONG` | >1000 chars |
| 400 | (existing) `CONSENT_REQUIRED` | без изменений |
| 400 | (existing) `Invalid JSON` | без изменений |
| 409 | (existing) `cart_already_converted` / `cart_expired` / `cart_merged` | без изменений |
| 503 | (existing) `POLICY_NOT_READY` | без изменений |
| 500 | (existing) `Failed to create order` | без изменений |

---

## Backward compatibility

### Physical-checkout flow

Никаких изменений в payload для `type: "physical"`:
- `handoverNote` не приходит (или приходит как пустая строка) — игнорируется сервером, не сохраняется (`method=cdek/boxberry/...` — ApiShip-режим, `handoverNote` для них N/A).
- Все существующие поля (`provider`, `tariffId`, и т.д.) — без изменений.

### Legacy `method='tc'` в payload

Если клиент (старая версия) пришлёт `method='tc'`:
- `METHOD_WHITELIST` не содержит `tc` → `method = undefined` → Payload-схема прокинет default или поднимет error.
- На переходный период (1-2 недели после релиза) можно добавить **мягкий маппинг** `'tc' → 'own_carrier'` на входе:

  ```ts
  const rawMethod = body.delivery?.method === "tc" ? "own_carrier" : body.delivery?.method;
  ```

  Это даёт безопасный path для in-flight запросов от ещё не обновлённого SPA.

**Decision**: Включить soft-mapping `tc → own_carrier` в API. Удалить через 1-2 месяца (записать в deferred-tracker).

---

## OpenAPI-style schema fragment (informative)

```yaml
paths:
  /api/orders:
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                type:
                  type: string
                  enum: [physical, legal, quote]
                delivery:
                  type: object
                  properties:
                    method:
                      type: string
                      enum: [pickup, cdek, boxberry, russian-post, own_carrier]
                    handoverNote:
                      type: string
                      maxLength: 1000
                      description: |
                        Required for method=pickup (≥5 chars after trim) and
                        method=own_carrier (≥10 chars after trim). Ignored for
                        ApiShip methods.
                    cost:
                      type: number
                      minimum: 0
                    # ... остальные поля как сейчас
                consent:
                  type: boolean
                  enum: [true]  # 057 gate
              required: [type, items, customer, delivery, consent]
      responses:
        '201': { description: Order created }
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    enum: [MISSING_HANDOVER_NOTE, HANDOVER_NOTE_TOO_SHORT, HANDOVER_NOTE_TOO_LONG, CONSENT_REQUIRED]
                  message: { type: string }
```
