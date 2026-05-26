# Contract: Server-side Hit Endpoint

**Spec**: [../spec.md](../spec.md) | **Requirements**: FR-040, FR-042, FR-043, FR-044, FR-114

## Назначение

Endpoint, который Order-lifecycle вызывает после успешной оплаты для отправки серверного дубля события `purchase` в Метрика Measurement Protocol. Обеспечивает учёт конверсии для пользователей с adblock (FR-040).

**v1 scope**: только `purchase`. `rfq_submit` — defer до v1.1 (FR-041).

## HTTP контракт

### `POST /api/analytics/server-hit`

**Auth**: внутренний endpoint, защищён middleware-check «вызов только из same-origin или с `CRON_SECRET`» (как другие cron-эндпоинты в проекте).

**Request body**:
```typescript
{
  hit_type: 'purchase',                  // в v1 только это значение
  transaction_id: string,                // = order.clientNumber (SO-YYYY-NNNN)
  ym_client_id: string,                  // _ym_uid из cookie, сохранённый в Cart/Order
  value: number,                         // revenue в RUB
  currency: 'RUB',
  goods: Array<{                         // structure для Метрика MP
    id: string,
    name: string,
    category: string,
    brand: string,
    price: number,
    quantity: number
  }>,
  page_url: string,                      // URL страницы конверсии (success page)
  consent_was_given: boolean             // FR-043: false → endpoint вернёт 204 без отправки
}
```

**Response**:
- `200 OK`:
  ```typescript
  {
    status: 'sent' | 'skipped_no_consent' | 'skipped_kill_switch',
    metrika_status_code?: number,
    request_id: string                   // для audit log
  }
  ```
- `400 Bad Request`: невалидный body или дубликат (тот же `transaction_id` уже отправлен — idempotency check через `serverHitStatus.purchaseHitStatus === 'sent'` в Order).
- `500 Internal Server Error`: сбой Метрики; в v1 возвращается ошибка, в v1.1 — задача попадает в `AnalyticsHitQueue`.

**Side effects**:
- Order.serverHitStatus обновляется (см. data-model.md §1.2):
  - `purchaseHitSentAt = now`
  - `purchaseHitStatus = 'sent' | 'failed' | 'skipped_no_consent' | 'skipped_kill_switch'`
  - `purchaseHitError` если failed.
- Лог в Sentry/console при failed (FR-044 — не блокирует основной flow).

## Metrika Measurement Protocol — outbound контракт

`lib/analytics/server-tracker.ts` отправляет HTTP GET на:

```
https://mc.yandex.ru/watch/<counterId>?\
  cnt-class=7\
  &page-url=<urlencoded page_url>\
  &browser-info=cv:2:la:ru:rqn:<rand>\
  &ut=noindex\
  &params=<base64(JSON: { hit_type, transaction_id, value, currency, goods, env })>\
  &ymid=<ym_client_id>
```

**Headers**:
- `User-Agent: Soliton-ServerTracker/1.0`
- `X-Real-IP: <client_ip_if_known>` (из request headers; для гео-атрибуции)

**Timeout**: 1.5 sec (FR-044, не блокирует основной flow).

**Retry в v1**: 0 (fire-and-forget). Retry-очередь — v1.1 (FR-310).

## Триггер вызова

1. **Из Order-lifecycle (server-side)**: `payments/yookassa-webhook` после успешного capture → если `order.attributionFirstTouch.ymClientId` есть → вызвать `serverTracker.sendPurchase(order)`.
2. **Из admin-panel (manual recovery)**: admin может нажать кнопку «отправить серверный hit» на странице Order, если статус `purchaseHitStatus === 'failed'`. Endpoint проверит idempotency.

## Consent проверка (FR-043)

Endpoint **отправляет hit только при выполнении ВСЕХ условий**:
1. `request.consent_was_given === true` (передаётся вызывающим — `Order.consent.acceptedAt` существует).
2. `AnalyticsSettings.activation.serverHitsEnabled === true` (kill-switch).
3. `Order.serverHitStatus.purchaseHitStatus !== 'sent'` (idempotency).

В противном случае возвращается `200 OK` со статусом `skipped_*` (не error).

## Идемпотентность (FR-114)

- Перед отправкой проверяется `Order.serverHitStatus.purchaseHitStatus === 'sent'`. Если да — return early.
- В payload — `transaction_id = order.clientNumber`, что идентично клиентскому `purchase` event'у. Метрика дедуплицирует по этому ключу.

## Тестируемость

**Unit test** (`apps/web/src/lib/analytics/tests/server-tracker.test.ts`):
- Mocked `fetch` → проверка корректного URL и параметров.
- consent_was_given=false → не вызывает fetch, возвращает skipped.
- kill-switch on → skipped.
- idempotency: повторный вызов после 'sent' status → skipped.
- timeout: simulated 2s delay → graceful failure.

**Integration test** (отдельно от smoke; ручной запуск):
- Реальный POST с тестовым transaction_id в test-Метрика-счётчик; через 24h проверка отчёта Метрики.
