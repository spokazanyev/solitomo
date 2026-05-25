# Data Model: Customer Notifications (049)

## 1. Payload global `notificationsSettings`

```ts
const NotificationsSettings = {
  slug: "notifications-settings",
  label: { ru: "Уведомления", en: "Notifications" },
  access: { read: ({req}) => Boolean(req.user), update: ({req}) => Boolean(req.user) },
  fields: [
    { name: "enabled", type: "checkbox", defaultValue: false },

    // ----- Email -----
    { type: "group", name: "email", fields: [
      { name: "provider", type: "select",
        options: ["postmark","mailgun","sendpulse"], required: true,
        defaultValue: "postmark" },
      { name: "apiKey", type: "text", required: true,
        admin: { description: "Маскируется в UI." } },
      { name: "domain", type: "text",
        admin: { description: "Для Mailgun." } },
      { name: "from", type: "text", required: true,
        defaultValue: "Soliton <orders@soliton.ru>" },
      { name: "replyTo", type: "text",
        defaultValue: "support@soliton.ru" },
      { name: "sandbox", type: "checkbox", defaultValue: true,
        admin: { description: "Письма реально не отправляются, логируются." } },
    ]},

    // ----- Messenger (placeholder для спеки 050) -----
    { type: "group", name: "messenger", label: "Мессенджер (placeholder для 050)", fields: [
      { name: "enabled", type: "checkbox", defaultValue: false,
        admin: { description: "В 049 всегда false. Реализация — в 050 (Telegram bot)." } },
      { name: "provider", type: "select",
        options: ["telegram","max","vk_messages"],
        defaultValue: "telegram" },
    ]},

    // ----- Recipients -----
    { name: "managers", type: "array",
      label: "Менеджеры для admin-уведомлений",
      fields: [
        { name: "email", type: "email", required: true },
        { name: "name", type: "text" },
        { name: "events", type: "select", hasMany: true,
          options: [
            "order.paid","order.invoice_issued","shipment.error",
            "order.stuck","order.cancelled","everything"
          ],
          defaultValue: ["everything"] },
      ]
    },

    // ----- Marketing -----
    { type: "group", name: "marketing", fields: [
      { name: "cartAbandonmentEnabled", type: "checkbox", defaultValue: false },
      { name: "cartAbandonmentDelayMin", type: "number", defaultValue: 60 },
      { name: "npsEnabled", type: "checkbox", defaultValue: true },
    ]},

    // ----- Connection status -----
    { name: "connectionStatus", type: "group", admin: { readOnly: true }, fields: [
      { name: "lastCheckedAt", type: "date" },
      { name: "emailOk", type: "checkbox" },
      { name: "message", type: "text" },
    ]},
  ],
  hooks: { afterChange: [/* AdminChangeLog */] },
};
```

## 2. Коллекция `notification-jobs`

```ts
const NotificationJobs = {
  slug: "notification-jobs",
  access: { read: ({req}) => Boolean(req.user), create: () => false, update: () => false, delete: ({req}) => Boolean(req.user) },
  admin: { hidden: false, group: "Sales", defaultColumns: ["event","channel","status","scheduledAt","sentAt"] },
  fields: [
    { name: "notificationId", type: "text", required: true, unique: true },
    { name: "orderId",        type: "relationship", relationTo: "orders", required: true },
    { name: "event",          type: "text", required: true },
    { name: "channel",        type: "select",
      options: ["email","messenger","admin_ui","dataLayer"], required: true },
    { name: "template",       type: "text", required: true },
    { name: "recipient",      type: "text", required: true },
    { name: "scheduledAt",    type: "date", required: true },
    { name: "sentAt",         type: "date" },
    { name: "status",         type: "select",
      options: ["queued","in_progress","sent","failed","skipped"], required: true },
    { name: "attempt",        type: "number", defaultValue: 0 },
    { name: "errorMessage",   type: "text" },
    { name: "errorCode",      type: "text" },
    { name: "externalRef",    type: "text" },  // message-id у провайдера
    { name: "payload",        type: "json" },  // вход для шаблонизатора
    { name: "skipReason",     type: "text" },  // "opt_out" | "duplicate" | "invalid_recipient"
  ],
  indexes: [
    { fields: ["status","scheduledAt"] },
    { fields: ["orderId"] },
    { fields: ["notificationId"] },
  ],
};
```

TTL: 180 дней.

## 3. Расширение `orders`

```ts
{ name: "marketingOptIn", type: "checkbox", defaultValue: false },
{ name: "messengerOptIn", type: "checkbox", defaultValue: false,
  admin: { description: "Согласие на канал messenger; placeholder для 050." } },
{ name: "customer.emailValid", type: "checkbox", defaultValue: true,
  admin: { description: "Помечается false после 3 hard bounce." } },
{ name: "notifications", type: "array",
  admin: { description: "Журнал уведомлений (дубль для быстрого доступа)." },
  fields: [
    { name: "notificationId", type: "text", required: true },
    { name: "event",          type: "text", required: true },
    { name: "channel",        type: "select", options: ["email","messenger","admin_ui","dataLayer"], required: true },
    { name: "template",       type: "text" },
    { name: "recipient",      type: "text" },
    { name: "scheduledAt",    type: "date" },
    { name: "sentAt",         type: "date" },
    { name: "status",         type: "select", options: ["queued","sent","failed","skipped"], required: true },
    { name: "errorMessage",   type: "text" },
    { name: "externalRef",    type: "text" },
    { name: "skipReason",     type: "text" },
  ]
}
```

> **Поле `Order.smsOptIn` НЕ создаётся** (решение от 2026-05-23: SMS-канал не реализуется).

## 4. ENV

```bash
# Email
EMAIL_PROVIDER=postmark|mailgun|sendpulse    # выбор не сделан (Q1)
EMAIL_API_KEY=                                # пусто = dry-run (FR-116 из 047)
EMAIL_FROM="Soliton <orders@soliton.ru>"
EMAIL_SANDBOX=true|false

# Cron schedule
NOTIFICATION_RUNNER_INTERVAL=30   # seconds
PICKUP_REMINDER_INTERVAL=3600
STUCK_ORDER_INTERVAL=21600

# Sandbox endpoints (для тестов)
EMAIL_SANDBOX_HOST=smtp.mailtrap.io

# SMS — НЕ ИСПОЛЬЗУЕТСЯ (решение от 2026-05-23). См. вместо этого спеку 050 (мессенджеры).
```
