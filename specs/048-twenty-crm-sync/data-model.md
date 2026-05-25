# Data Model: Twenty CRM Sync (048)

## 1. Payload Global `crmSettings`

Файл: `apps/web/src/globals/CrmSettings.ts`.

```ts
const CrmSettings = {
  slug: "crm-settings",
  label: { ru: "CRM / Twenty", en: "CRM / Twenty" },
  access: { read: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user) },
  fields: [
    { name: "enabled", type: "checkbox", defaultValue: false },
    { name: "baseUrl", type: "text", required: true,
      defaultValue: "https://crm.soliton.ru",
      admin: { description: "Self-hosted Twenty URL. Финальный поддомен — Q6 в spec.md." } },
    { name: "apiKey", type: "text", required: true,
      admin: { description: "Маскируется в UI." } },
    { name: "workspaceId", type: "text" },
    { name: "defaultAssignee", type: "text",
      admin: { description: "userId менеджера в Twenty, на которого вешаются Tasks." } },

    { type: "group", name: "mapping", fields: [
      { name: "createCompanyForB2B", type: "checkbox", defaultValue: true },
      { name: "linkPersonByEmail",   type: "checkbox", defaultValue: true },
      { name: "linkCompanyByTaxId",  type: "checkbox", defaultValue: true },
    ]},

    { type: "group", name: "stageMap", fields: [
      { name: "draft",            type: "text", defaultValue: "New" },
      { name: "pending_payment",  type: "text", defaultValue: "Quote" },
      { name: "awaiting_payment", type: "text", defaultValue: "Quote" },
      { name: "paid",             type: "text", defaultValue: "Won" },
      { name: "fulfilling",       type: "text", defaultValue: "Won" },
      { name: "shipped",          type: "text", defaultValue: "Won" },
      { name: "delivered",        type: "text", defaultValue: "Won" },
      { name: "completed",        type: "text", defaultValue: "Won.Closed" },
      { name: "cancelled",        type: "text", defaultValue: "Lost" },
      { name: "returned",         type: "text", defaultValue: "Lost" },
      { name: "expired",          type: "text", defaultValue: "Lost" },
    ]},

    { type: "group", name: "fulfillmentSubMap", fields: [
      // orders.status / shipment.status → Opportunity.fulfillmentStage
      { name: "draft",       type: "text", defaultValue: "New" },
      { name: "pending_payment", type: "text", defaultValue: "Quote" },
      { name: "paid",        type: "text", defaultValue: "Paid" },
      { name: "fulfilling",  type: "text", defaultValue: "In fulfillment" },
      { name: "shipped_in_transit", type: "text", defaultValue: "In transit" },
      { name: "shipped_at_point", type: "text", defaultValue: "At point" },
      { name: "delivered",   type: "text", defaultValue: "Delivered" },
      { name: "completed",   type: "text", defaultValue: "Closed" },
      { name: "returned",    type: "text", defaultValue: "Returned" },
      { name: "cancelled",   type: "text", defaultValue: "Cancelled" },
    ]},

    { type: "group", name: "retry", fields: [
      { name: "maxAttempts",  type: "number", defaultValue: 5 },
      { name: "baseDelaySec", type: "number", defaultValue: 30 },
      { name: "rateLimitRpm", type: "number", defaultValue: 60 },
    ]},

    { type: "group", name: "taskRules", label: "Авто-задачи", fields: [
      { name: "createShipmentDueHours", type: "number", defaultValue: 4 },
      { name: "closeWarningDaysBefore", type: "number", defaultValue: 1 },
      { name: "lostFollowUpDueHours",   type: "number", defaultValue: 24 },
    ]},

    { name: "connectionStatus", type: "group", admin: { readOnly: true }, fields: [
      { name: "lastCheckedAt", type: "date" },
      { name: "ok", type: "checkbox" },
      { name: "message", type: "text" },
      { name: "schemaCheckOk", type: "checkbox" },
    ]},

    { name: "webhookSecret", type: "text",
      admin: { description: "Для US5 фазы 2 (Twenty → Soliton)." } },
  ],
  hooks: { afterChange: [/* запись в AdminChangeLog */] },
};
```

## 2. Расширение `orders` — группа `crmRefs`

```ts
{
  name: "crmRefs",
  type: "group",
  fields: [
    { name: "opportunityId", type: "text", admin: { readOnly: true } },
    { name: "personId",      type: "text", admin: { readOnly: true } },
    { name: "companyId",     type: "text", admin: { readOnly: true } },
    { name: "lastSyncedAt",  type: "date", admin: { readOnly: true } },
    { name: "lastSyncStatus",type: "select",
      options: ["queued","in_progress","success","failed","quarantined"],
      admin: { readOnly: true } },
    { name: "lastSyncError", type: "text", admin: { readOnly: true } },
    { name: "pendingCancellationFromCrm", type: "checkbox", defaultValue: false,
      admin: { description: "Помечается, если Twenty прислал Lost после отгрузки (US5)." } },
  ],
}
```

## 3. Новая коллекция `crm-sync-jobs`

```ts
const CrmSyncJobs = {
  slug: "crm-sync-jobs",
  access: { read: ({ req }) => Boolean(req.user), create: () => false, update: () => false, delete: ({ req }) => Boolean(req.user) },
  admin: { hidden: false, group: "Integrations", defaultColumns: ["orderId","event","status","attempt","lastAttemptAt"] },
  fields: [
    { name: "jobId",         type: "text", required: true, unique: true },
    { name: "orderId",       type: "relationship", relationTo: "orders", required: true },
    { name: "event",         type: "text", required: true },
    { name: "payload",       type: "json" },
    { name: "attempt",       type: "number", defaultValue: 0 },
    { name: "status",        type: "select",
      options: ["queued","in_progress","success","failed","quarantined"], required: true },
    { name: "lastAttemptAt", type: "date" },
    { name: "nextAttemptAt", type: "date" },
    { name: "errorMessage",  type: "text" },
    { name: "errorCode",     type: "text" },  // HTTP / GraphQL код
    { name: "twentyRef",     type: "json" },  // { opportunityId, personId, companyId, activityId }
  ],
  indexes: [
    { fields: ["status","nextAttemptAt"] },
    { fields: ["orderId"] },
  ],
};
```

TTL: 90 дней успешных, 365 дней failed/quarantined.

## 4. ENV

```bash
TWENTY_API_URL=https://crm.soliton.ru     # self-host, не cloud
TWENTY_API_KEY=...                         # генерируется в self-host UI
TWENTY_WORKSPACE_ID=...                    # default workspace из self-host
TWENTY_WEBHOOK_SECRET=...                  # для US5 фазы 2 (Twenty → Soliton)
```

Self-host деплой описан в `deploy/docker-compose.twenty.yml`.

## 5. Migration sequence

1. Создать `crmSettings` global (после деплоя выйдет с `enabled=false`).
2. Создать `crm-sync-jobs` коллекцию.
3. Расширить `orders` добавлением `crmRefs`.
4. Run `pnpm crm:migrate-fields --dry-run` → проверить.
5. Run `pnpm crm:migrate-fields --apply` → создать custom fields в Twenty.
6. Включить `crmSettings.enabled = true`.
7. Бэкфилл (опционально, отдельный one-shot скрипт): синхронизировать все существующие `paid+` заказы как `Opportunity stage=Won`.
