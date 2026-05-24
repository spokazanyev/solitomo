# Notification Events — Контракт

**Feature**: 047-delivery-checkout-apiship → FR-407..FR-412

**Полная спека шаблонизатора**: `specs/049-customer-notifications/` (будет создан).

**Canonical matrix**: `07-build-specifications/order-lifecycle-spec.md §3`.

## Event names

Все доменные события системы (используются как `notification-jobs.event` и `crm-sync-jobs.event`):

| Event                          | Триггер                                          |
|---|---|
| `cart.abandoned`               | (052) Корзина без активности 1 ч + marketingOptIn        |
| `cart.converted`               | (052) Корзина конвертирована в заказ                     |
| `cart.recovered`               | (052) Клиент вернулся в abandoned корзину                |
| `order.identified`             | Клиент идентифицирован (email + phone) в чекауте |
| `order.created`                | Order создан (любого типа)                       |
| `order.invoice_issued`         | Юрлицу выставлен счёт                            |
| `order.paid`                   | webhook ЮKassa подтвердил оплату                 |
| `order.payment_failed`         | webhook ЮKassa отклонил оплату                   |
| `shipment.created`             | Получен providerOrderId + trackingNumber         |
| `shipment.in_transit`          | webhook ApiShip → internal `in_transit`          |
| `shipment.at_point`            | webhook ApiShip → internal `at_point`            |
| `shipment.courier_today`       | webhook ApiShip → «out for delivery» (если есть) |
| `shipment.pickup_reminder_24h` | cron: ПВЗ-доставка, до конца хранения 24 ± 2 ч   |
| `shipment.delivered`           | webhook ApiShip → internal `delivered`           |
| `shipment.error`               | shipment.status → `error`                        |
| `shipment.returned`            | webhook ApiShip → internal `returned`            |
| `order.cancelled`              | Order.status → `cancelled`                        |
| `order.completed`              | cron автозакрытия (FR-903)                       |
| `order.returned`               | Order полностью возвращён (totalRefunded >= total)       |
| `order.stuck`                  | cron: статус не меняется > stuckThresholdHours   |
| `return.created`               | (053) Клиент создал заявку на возврат                    |
| `return.approved`              | (053) Менеджер одобрил возврат                           |
| `return.rejected`              | (053) Менеджер отклонил возврат                          |
| `return.received`              | (053) Товар получен на складе                            |
| `return.refunded`              | (053) Средства возвращены клиенту                        |
| `return.cancelled`             | (053) Возврат отменён                                    |
| `return.overdue`               | (053) cron: возврат просрочен (>10 дней ст.22)           |

## Job lifecycle

```text
Доменное событие (Order.afterChange / webhook / cron)
        │
        ▼
emitDomainEvent(event, order, payload)
        │
        ▼
для каждого правила из notification-matrix.ts:
        │
        ├── создать NotificationJob (status=queued)  ─→ для customer email / messenger
        ├── создать NotificationJob                  ─→ для manager email
        ├── создать NotificationJob                  ─→ для admin_ui badge
        └── создать CrmSyncJob                        ─→ для twenty

Cron каждые 30 c:
        │
        ├── notification-jobs WHERE status=queued AND scheduledAt<=now()
        │   → отправить через провайдера → status=sent/failed
        │
        └── crm-sync-jobs WHERE status=queued AND nextAttemptAt<=now()
            → выполнить GraphQL мутацию → status=success/failed (retry)
```

## Дедупликация

Перед созданием `NotificationJob` проверяется наличие записи по ключу:

```
key = orderId + ":" + event + ":" + channel + ":" + recipient + ":" + bucket(at, 24h)
```

Если есть `status in ('sent', 'queued', 'in_progress')` — новая job не создаётся, лог: `skipped (duplicate)`.

## Каналы и провайдеры

| Channel    | Провайдер (MVP)   | Out-of-scope |
|---|---|---|
| `email`    | Postmark / Mailgun / SendPulse (один, выбор Q1) | A/B шаблонов, маркетинг |
| `messenger`| ❌ нет sender'а в 049; реализация в **050** (Telegram bot / MAX) | — |
| `crm`      | Twenty GraphQL (через 048) | Salesforce, Bitrix24 |
| `admin_ui` | Payload native    | push в браузер |
| `dataLayer`| GA / Яндекс       | server-side trackers |

> **Messenger-канал** (замена SMS, решение владельца 2026-05-23): реализация в спеке 050.

## Schema NotificationJob payload

```ts
{
  order: {
    id: string;
    publicToken: string;
    type: "physical" | "legal" | "quote";
    status: string;
    customer: { fullName, email, phone, companyName? };
    totals: { subtotal, vat, deliveryCost, total };
    delivery: { providerName, providerKey, label, cost, etaMinDays, etaMaxDays, address, pointId?, pointAddress?, pickupExpiresAt? };
    shipment?: { trackingNumber, trackingUrl, labelUrl };
    items: Array<{ name, sku, quantity, unit, lineTotal }>;
  };
  event: { kind, at, statusFrom?, statusTo?, message? };
  manager?: { email, fullName };  // для admin-уведомлений
}
```

Шаблонизатор (Mustache / Handlebars / React-email — выбор в 049) рендерит из этого payload.

## Trigger map (упрощённо)

```ts
// apps/web/src/lib/notifications/matrix.ts
export const matrix: NotificationRule[] = [
  // customer email
  { event: "order.paid",                channel: "email", template: "T-001", recipient: "customer" },
  { event: "order.invoice_issued",      channel: "email", template: "T-002", recipient: "customer" },
  { event: "shipment.created",          channel: "email", template: "T-003", recipient: "customer" },
  { event: "shipment.at_point",         channel: "email", template: "T-004", recipient: "customer" },
  { event: "shipment.courier_today",    channel: "email", template: "T-006", recipient: "customer" },
  { event: "shipment.pickup_reminder_24h", channel: "email", template: "T-007", recipient: "customer" },
  { event: "shipment.delivered",        channel: "email", template: "T-005", recipient: "customer" },
  { event: "order.completed",           channel: "email", template: "T-008", recipient: "customer" },
  { event: "order.cancelled",           channel: "email", template: "T-009", recipient: "customer" },

  // cart events (052)
  { event: "cart.abandoned",              channel: "email", template: "T-010", recipient: "customer", requires: "marketingOptIn" },
  { event: "cart.abandoned",              channel: "messenger", template: "M-010", recipient: "customer", requires: "messengerOptIn" },

  // customer messenger (placeholder; реальный sender — в 050)
  { event: "order.paid",                channel: "messenger", template: "M-001", recipient: "customer", requires: "messengerOptIn" },
  { event: "shipment.created",          channel: "messenger", template: "M-003", recipient: "customer", requires: "messengerOptIn" },
  { event: "shipment.at_point",         channel: "messenger", template: "M-004", recipient: "customer", requires: "messengerOptIn" },
  { event: "shipment.delivered",        channel: "messenger", template: "M-005", recipient: "customer", requires: "messengerOptIn" },

  // return customer email (053)
  { event: "return.approved",            channel: "email", template: "T-011", recipient: "customer" },
  { event: "return.rejected",            channel: "email", template: "T-012", recipient: "customer" },
  { event: "return.refunded",            channel: "email", template: "T-013", recipient: "customer" },
  { event: "order.returned",             channel: "email", template: "T-014", recipient: "customer" },

  // manager email
  { event: "order.paid",                channel: "email", template: "T-101", recipient: "manager" },
  { event: "order.invoice_issued",      channel: "email", template: "T-102", recipient: "manager" },
  { event: "shipment.error",            channel: "email", template: "T-103", recipient: "manager" },
  { event: "order.stuck",               channel: "email", template: "T-104", recipient: "manager" },
  { event: "order.cancelled",           channel: "email", template: "T-105", recipient: "manager" },

  // return manager email (053)
  { event: "return.created",             channel: "email", template: "T-106", recipient: "manager" },
  { event: "return.refunded",            channel: "email", template: "T-107", recipient: "manager" },
  { event: "return.overdue",             channel: "email", template: "T-108", recipient: "manager" },

  // crm (через 048; если 048 не включена — sender не зарегистрирован, skipped)
  { event: "order.identified",          channel: "crm",   template: "—",     recipient: "twenty" },
  { event: "order.paid",                channel: "crm",   template: "—",     recipient: "twenty" },
  { event: "shipment.created",          channel: "crm",   template: "—",     recipient: "twenty" },
  { event: "shipment.in_transit",       channel: "crm",   template: "—",     recipient: "twenty" },
  { event: "shipment.at_point",         channel: "crm",   template: "—",     recipient: "twenty" },
  { event: "shipment.delivered",        channel: "crm",   template: "—",     recipient: "twenty" },
  { event: "order.completed",           channel: "crm",   template: "—",     recipient: "twenty" },
  { event: "order.cancelled",           channel: "crm",   template: "—",     recipient: "twenty" },

  // return CRM events (053 → 048)
  { event: "return.created",             channel: "crm",   template: "—",     recipient: "twenty" },
  { event: "return.approved",            channel: "crm",   template: "—",     recipient: "twenty" },
  { event: "return.refunded",            channel: "crm",   template: "—",     recipient: "twenty" },
  { event: "order.returned",             channel: "crm",   template: "—",     recipient: "twenty" },
];

// NOTE (054 migration): After 054 release, marketingOptIn source of truth moves to
// Customer collection. Emitter reads: customer.marketingOptIn ?? order.marketingOptIn (fallback for guests).
```

> Идентификаторы M-001/M-003/M-004/M-005/M-010 зарезервированы для messenger-шаблонов спеки 050. В MVP 049 эти job'ы становятся `skipped, reason=no_sender_registered`.

## SLA

См. `order-lifecycle-spec.md §7`. Cron должен запускаться ≤ 30 с, чтобы выдержать «email клиенту ≤ 1 минута после paid».
