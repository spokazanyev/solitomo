# Data Model: Returns & Refunds (053)

**Feature**: 053-returns-and-refunds

**Owner**: Soliton platform team

## Сводка

Меняются/появляются:

1. **Payload Collection `returns`** (новая) — основная сущность.
2. **Payload Collection `orders`** (расширение) — `hasReturns`, `returnsCount`, `totalRefunded` (computed), `payment.refunds[]` (real).
3. **Payload Collection `fiscal-corrections`** (новая, опционально) — журнал чеков коррекции 54-ФЗ.
4. **Sequence `returns_seq_YYYY`** в PostgreSQL — атомарная генерация `RT-YYYY-NNNN`. Lazy-init: `CREATE SEQUENCE IF NOT EXISTS returns_seq_{year} START 1`.
5. **Sequence `credit_memos_seq_YYYY`** — атомарная генерация `CM-YYYY-NNNN`. Lazy-init: `CREATE SEQUENCE IF NOT EXISTS credit_memos_seq_{year} START 1`.

Что **не входит** в эту спеку (есть только заглушки/ссылки):

- Шаблоны email T-015/T-016 — реализация в спеке 049 (matrix + templates).
- CRM-правила `return.*` — реализация в спеке 048 (расширение `crm-sync-matrix`).
- Реальный коннектор к ККТ для чеков коррекции — отдельная follow-up спека.

## 1. Payload Collection: `returns`

Файл реализации: `apps/web/src/collections/Returns.ts`.

```ts
import type { CollectionConfig } from "payload";

export const Returns: CollectionConfig = {
  slug: "returns",
  labels: {
    singular: { ru: "Возврат", en: "Return" },
    plural:   { ru: "Возвраты", en: "Returns" },
  },
  access: {
    read:   ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user), // public POST создаёт через server-side action, не direct API
    update: ({ req }) => Boolean(req.user),
    delete: () => false,                     // никогда не удаляем
  },
  admin: {
    group:           "Sales",
    useAsTitle:      "returnNumber",
    defaultColumns:  ["returnNumber", "orderId", "status", "refundAmount", "requestedAt"],
  },
  fields: [
    // ─────────────────────────── Identity ───────────────────────────
    {
      name: "returnNumber", type: "text", required: true, unique: true,
      index: true,
      admin: { description: "Формат RT-YYYY-NNNN, генерируется атомарно." },
    },
    {
      name: "orderId", type: "relationship", relationTo: "orders", required: true,
      index: true,
    },
    {
      name: "orderNumberSnapshot", type: "text",
      admin: { description: "Snapshot Order.orderNumber на момент создания Return (immutable)." },
    },

    // ─────────────────────────── Items ───────────────────────────
    {
      name: "items", type: "array", required: true, minRows: 1,
      fields: [
        { name: "orderItemSku",  type: "text",     required: true },
        { name: "productName",   type: "text" }, // snapshot
        { name: "qty",           type: "number",   required: true, min: 1 },
        { name: "priceSnapshot", type: "number",   required: true,
          admin: { description: "Цена за 1 шт в копейках, snapshot из Order." } },
        { name: "vatRate",       type: "text",
          admin: { description: "Ставка НДС snapshot ('20', '10', '0', '-1' = без НДС)." } },
        { name: "reason",        type: "text" }, // свободный текст пер позицию
        { name: "condition",     type: "select",
          options: [
            { label: "Не вскрывался",        value: "unopened" },
            { label: "Вскрыт, не использовался", value: "opened_unused" },
            { label: "Использовался",         value: "used" },
            { label: "С дефектом",           value: "defective" },
          ],
        },
        { name: "photos", type: "upload", relationTo: "media", hasMany: true },
      ],
    },

    // ─────────────────────────── Reasons ───────────────────────────
    {
      name: "reasonCategory", type: "select", required: true,
      options: [
        { label: "Дефект / брак",       value: "defect" },
        { label: "Не то прислали",     value: "wrong-item" },
        { label: "Передумал / не нужен", value: "not-needed" },
        { label: "Другое",             value: "other" },
      ],
    },
    { name: "customerNotes", type: "textarea",
      admin: { description: "Комментарий клиента, видимый менеджеру." } },
    { name: "managerNotes",  type: "textarea",
      admin: { description: "Внутренний комментарий менеджера." } },

    // ─────────────────────────── Refund ───────────────────────────
    {
      name: "refundAmount", type: "number", required: true,
      admin: { description: "Итоговая сумма возврата в копейках." },
    },
    {
      name: "refundMethod", type: "select", required: true,
      defaultValue: "card-original",
      options: [
        { label: "На карту оплаты (ЮKassa)", value: "card-original" },
        { label: "Банковский перевод",        value: "bank-transfer" },
        { label: "Другое",                    value: "other" },
      ],
    },
    {
      name: "refundProviderRef", type: "text",
      admin: { description: "ID refund в ЮKassa (после успешного refund)." },
    },
    {
      name: "manualRefundConfirmation", type: "group",
      admin: { condition: (data) => data?.refundMethod !== "card-original" },
      fields: [
        { name: "byUser",        type: "relationship", relationTo: "users" },
        { name: "at",            type: "date" },
        { name: "paymentDoc",    type: "text", admin: { description: "Номер платёжки." } },
        { name: "bankAccount",   type: "text", admin: { description: "Расчётный счёт получателя." } },
        { name: "bik",           type: "text", admin: { description: "БИК банка получателя." } },
        { name: "recipientName", type: "text", admin: { description: "Наименование получателя." } },
        { name: "purpose",       type: "text", admin: { description: "Назначение платежа, формат: 'Возврат по заказу № ...'." } },
      ],
    },

    // ─────────────────────────── Return shipment (ApiShip) ───────────────────────────
    {
      name: "returnMethod", type: "select",
      defaultValue: "self_post",
      options: [
        { label: "Самостоятельная отправка почтой", value: "self_post" },
        { label: "Через службу доставки (ApiShip)", value: "pickup_via_courier" },
        { label: "Самопривоз в офис",               value: "drop_off" },
      ],
    },
    { name: "apiShipReturnOrderId", type: "text",
      admin: { description: "ID return-order в ApiShip, если оформлен через службу." } },
    { name: "returnLabelUrl", type: "text",
      admin: { description: "URL PDF обратной этикетки от ApiShip." } },

    // ─────────────────────────── Credit memo (для юрлица) ───────────────────────────
    { name: "creditMemoNumber",  type: "text", index: true,
      admin: { description: "Формат CM-YYYY-NNNN, только для Order.type=legal." } },
    { name: "creditMemoPdfUrl",  type: "text" },
    { name: "creditMemoIssuedAt", type: "date" },
    { name: "documentsError",    type: "text",
      admin: { description: "Если генерация КСФ упала — текст ошибки." } },

    // ─────────────────────────── Fiscal (54-ФЗ) ───────────────────────────
    { name: "correctionReceiptStatus", type: "select",
      defaultValue: "pending",
      options: [
        { label: "В очереди",    value: "pending" },
        { label: "Сформирован",  value: "issued" },
        { label: "Не требуется", value: "not_required" },
        { label: "Ошибка",       value: "error" },
      ],
    },
    { name: "correctionReceiptRef", type: "text",
      admin: { description: "Fiscal Drive Number / ОФД-ссылка." } },

    // ─────────────────────────── Status & lifecycle ───────────────────────────
    {
      name: "status", type: "select", required: true,
      defaultValue: "requested",
      options: [
        { label: "Запрошен",       value: "requested" },
        { label: "Одобрен",        value: "approved" },
        { label: "Товар принят",   value: "received" },
        { label: "Деньги возвращены", value: "refunded" },
        { label: "Отклонён",       value: "rejected" },
        { label: "Отменён",        value: "cancelled" },
      ],
      index: true,
    },
    { name: "statusReason", type: "textarea",
      admin: { description: "Обязательно при rejected; для approved может содержать пометки типа outside_short_window." } },

    { name: "requestedAt", type: "date", required: true, defaultValue: () => new Date() },
    { name: "approvedAt",  type: "date" },
    { name: "receivedAt",  type: "date" },
    { name: "refundedAt",  type: "date" },
    { name: "rejectedAt",  type: "date" },
    { name: "cancelledAt", type: "date" },

    // ─────────────────────────── Audit ───────────────────────────
    { name: "createdVia", type: "select",
      defaultValue: "customer-public",
      options: [
        { label: "Публичная форма",     value: "customer-public" },
        { label: "Менеджером вручную",  value: "manager-manual" },
        { label: "API",                 value: "api" },
      ],
    },
    { name: "history", type: "array",
      admin: { description: "Read-only audit trail переходов." },
      fields: [
        { name: "at",       type: "date" },
        { name: "fromStatus", type: "text" },
        { name: "toStatus",   type: "text" },
        { name: "byUser",   type: "relationship", relationTo: "users" },
        { name: "reason",   type: "text" },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      /* generate returnNumber (только при create), валидация переходов state-machine, fill snapshots */
    ],
    afterChange:  [
      /* update Order computed-fields, emit return.* events, generate creditMemo, queue fiscal job */
    ],
  },
  indexes: [
    { fields: ["orderId", "status"] },
    { fields: ["status", "requestedAt"] },
  ],
};
```

### Уникальность и атомарность номеров

```sql
-- migration в PG (стандартизированный паттерн: returns_seq_YYYY)
CREATE SEQUENCE IF NOT EXISTS returns_seq_2026 START 1;

-- В хуке beforeChange при create:
-- SELECT nextval('returns_seq_' || EXTRACT(year FROM now()))
-- → "RT-2026-" + lpad(nextval, 4, '0')
```

При смене года — lazy-init: `CREATE SEQUENCE IF NOT EXISTS returns_seq_{year} START 1` при первом обращении в `number-generator.ts`. Аналогично для `credit_memos_seq_{year}`. Ручной SQL не требуется.

## 2. Расширение Payload Collection: `orders`

Новые поля (после существующих):

```ts
// apps/web/src/collections/Orders.js (расширение)

// ── computed-поля (заполняются хуком afterChange коллекции returns) ──
{ name: "hasReturns",   type: "checkbox", defaultValue: false,
  admin: { readOnly: true, description: "true если есть хотя бы один Return со статусом ≠ rejected/cancelled." } },
{ name: "returnsCount", type: "number",   defaultValue: 0,
  admin: { readOnly: true } },
{ name: "totalRefunded", type: "number", defaultValue: 0,
  admin: { readOnly: true, description: "Сумма всех refunded возвратов в копейках." } },

// ── payment.refunds[] — реальная история refund в провайдере ──
// (внутри уже существующей группы payment)
{
  name: "refunds", type: "array",
  admin: { description: "История refund в платёжном провайдере." },
  fields: [
    { name: "providerRefundId", type: "text", required: true },
    { name: "amount",          type: "number", required: true, admin: { description: "В копейках." } },
    { name: "refundedAt",      type: "date",   required: true },
    { name: "returnId",        type: "relationship", relationTo: "returns" },
    { name: "providerStatus",  type: "select", required: true,
      defaultValue: "succeeded",
      options: [
        { label: "Успешно",    value: "succeeded" },
        { label: "В обработке", value: "pending" },
        { label: "Отменён",    value: "canceled" },
      ],
    },
  ],
},

// ── payment.payerBankDetails — snapshot реквизитов плательщика (для bank-transfer refunds) ──
// (внутри уже существующей группы payment)
{
  name: "payerBankDetails", type: "group",
  admin: { description: "Реквизиты плательщика для bank-transfer refunds (юрлицо)." },
  fields: [
    { name: "bankAccount",    type: "text", admin: { description: "Расчётный счёт." } },
    { name: "bik",            type: "text", admin: { description: "БИК банка." } },
    { name: "recipientName",  type: "text", admin: { description: "Наименование получателя." } },
    { name: "bankName",       type: "text", admin: { description: "Название банка." } },
  ],
},
```

### Откат от `completed` к `delivered`

Хук `afterChange` коллекции `returns` при создании первого Return:

```ts
if (order.status === "completed" && newReturn.status === "requested") {
  await payload.update({
    collection: "orders",
    id: orderId,
    data: { status: "delivered", closedAt: null, disputeFlag: true },
  });
}
```

### Полный возврат → `Order.status = returned`

В afterChange коллекции `returns` при переходе → `refunded`:

```ts
const order = await payload.findByID({ collection: "orders", id: orderId });
const newTotalRefunded = computeTotalRefunded(order); // sum по всем refunded
if (newTotalRefunded >= order.total) {
  await payload.update({
    collection: "orders",
    id: orderId,
    data: { status: "returned", totalRefunded: newTotalRefunded },
  });
}
```

## 3. Payload Collection: `fiscal-corrections` (опционально)

Журнал чеков коррекции 54-ФЗ. Поскольку реальный ККТ-коннектор отложен — это «след» для ручной обработки и будущей автоматизации.

```ts
const FiscalCorrections: CollectionConfig = {
  slug: "fiscal-corrections",
  access: { read: ({req}) => Boolean(req.user), create: () => false, update: ({req}) => Boolean(req.user), delete: () => false },
  admin: { group: "Sales", defaultColumns: ["correctionType", "amount", "status", "createdAt", "issuedAt"] },
  fields: [
    { name: "returnId",   type: "relationship", relationTo: "returns", required: true, index: true },
    { name: "orderId",    type: "relationship", relationTo: "orders", required: true },
    { name: "correctionType", type: "select", required: true,
      defaultValue: "refund_income",
      options: [
        { label: "Возврат прихода", value: "refund_income" },
        { label: "Коррекция прихода", value: "correction_income" },
      ],
    },
    { name: "amount", type: "number", required: true },     // копейки
    { name: "items",  type: "json" },                        // snapshot позиций
    { name: "status", type: "select", required: true,
      defaultValue: "pending_manual",
      options: [
        { label: "Ждёт ручной обработки", value: "pending_manual" },
        { label: "Сформирован",           value: "issued" },
        { label: "Ошибка",                value: "error" },
      ],
    },
    { name: "fiscalDocNumber", type: "text", admin: { description: "ФД от ОФД." } },
    { name: "fiscalSign",      type: "text", admin: { description: "ФП." } },
    { name: "ofdUrl",          type: "text" },
    { name: "issuedBy",        type: "relationship", relationTo: "users" },
    { name: "issuedAt",        type: "date" },
    { name: "errorMessage",    type: "text" },
  ],
  indexes: [{ fields: ["status", "createdAt"] }],
};
```

## 4. State Machine — формальное определение

```ts
// apps/web/src/lib/returns/state-machine.ts
export type ReturnStatus =
  | "requested" | "approved" | "received" | "refunded" | "rejected" | "cancelled";

export const ALLOWED_TRANSITIONS = new Set<`${ReturnStatus}:${ReturnStatus}`>([
  "requested:approved",
  "requested:rejected",
  "requested:cancelled",
  "approved:received",
  "approved:rejected",
  "approved:cancelled",
  "received:refunded",
  "received:rejected",
]);

export const TERMINAL: ReadonlySet<ReturnStatus> = new Set(["refunded", "rejected", "cancelled"]);

export function assertTransition(from: ReturnStatus, to: ReturnStatus, reason?: string): void {
  if (from === to) return;
  const key = `${from}:${to}` as const;
  if (!ALLOWED_TRANSITIONS.has(key)) {
    throw new Error(`Return: запрещённый переход ${from} → ${to}`);
  }
  if (to === "rejected" && !reason?.trim()) {
    throw new Error("Return: переход в rejected требует statusReason.");
  }
}
```

## 5. Связи с другими коллекциями

```text
returns 1───* items[]              (внутренний array)
returns *───1 orders               (обязательная связь)
returns *───* media (photos)       (через items[].photos)
returns 1───1 fiscal-corrections   (опционально)

orders.returns_count, totalRefunded ← computed via afterChange of returns
orders.payment.refunds[]           ← заполняется при successful YooKassa refund

return.created  ─→ notification-jobs (T-014 manager)
                 └→ crm-sync-jobs (Twenty Activity)
return.approved ─→ notification-jobs (T-015 customer)
                 └→ crm-sync-jobs
return.refunded ─→ notification-jobs (T-016 customer + manager)
                 ├→ crm-sync-jobs (Twenty stage transition)
                 ├→ orders.afterChange (update computed + status if full)
                 ├→ documents/credit-memo (если legal)
                 └→ fiscal-corrections (54-ФЗ correction receipt)
```

## 6. Индексы

- `returns(returnNumber)` UNIQUE
- `returns(orderId, status)` — для запросов «активные возвраты по заказу»
- `returns(status, requestedAt)` — для cron-задач (auto-reminder, overdue)
- `fiscal_corrections(status, createdAt)` — для cron обработки
- `orders.payment.refunds[].providerRefundId` UNIQUE (если поддерживается)

## 7. Computed-логика на Orders (детально)

```ts
// recomputeOrderReturnAggregates(orderId) — вызывается из returns.afterChange
async function recompute(orderId: string) {
  const returns = await payload.find({
    collection: "returns",
    where: { orderId: { equals: orderId } },
    limit: 100,
  });
  const active   = returns.docs.filter(r => !["rejected","cancelled"].includes(r.status));
  const refunded = returns.docs.filter(r => r.status === "refunded");
  const totalRefunded = refunded.reduce((s, r) => s + (r.refundAmount ?? 0), 0);

  // FR-5310a: disputeFlag — derived fast-flag
  // true ⟺ существует Return со статусом ∈ {requested, approved, received}
  const openReturns = returns.docs.filter(r =>
    ["requested", "approved", "received"].includes(r.status)
  );
  const disputeFlag = openReturns.length > 0;

  await payload.update({
    collection: "orders",
    id: orderId,
    data: {
      hasReturns:    active.length > 0,
      returnsCount:  active.length,
      totalRefunded,
      disputeFlag,   // sync: при терминальных статусах всех returns → false
    },
  });
}

// FR-5343: qtyAvailableForReturn formula
// qtyAvailableForReturn(orderItem) =
//   orderItem.qty
//   - sum(returns[*].items[orderItemSku=this.sku].qty for non-terminal returns)
//   - qty в позициях, чей shipment.status ∈ {pending, created, in_transit}
function qtyAvailableForReturn(
  orderItem: { sku: string; qty: number },
  returns: Array<{ status: string; items: Array<{ orderItemSku: string; qty: number }> }>,
  shipmentItems: Array<{ sku: string; qty: number; shipmentStatus: string }>,
): number {
  const TERMINAL = ["refunded", "rejected", "cancelled"];
  const nonTerminalReturnedQty = returns
    .filter(r => !TERMINAL.includes(r.status))
    .flatMap(r => r.items)
    .filter(i => i.orderItemSku === orderItem.sku)
    .reduce((s, i) => s + i.qty, 0);
  const inTransitQty = shipmentItems
    .filter(si => si.sku === orderItem.sku && ["pending", "created", "in_transit"].includes(si.shipmentStatus))
    .reduce((s, si) => s + si.qty, 0);
  return Math.max(0, orderItem.qty - nonTerminalReturnedQty - inTransitQty);
}
```

## 8. Snapshots (важно!)

Все денежные значения в `Return.items[].priceSnapshot`, `vatRate`, `productName`, `refundAmount` — **snapshot** на момент создания возврата (читается из `Order.items[].priceSnapshot`, которое в свою очередь snapshot из 047). Никогда не пересчитываются по текущим ценам. Это критично для КСФ — позиции и НДС в корректировочном счёте-фактуре должны точно совпадать с исходным.
