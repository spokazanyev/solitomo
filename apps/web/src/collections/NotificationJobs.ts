import type { CollectionConfig } from "payload";

import { adminGroups, adminLabel } from "./admin-i18n.js";

/**
 * Payload Collection `notification-jobs` — очередь клиентских уведомлений.
 *
 * См. specs/049-customer-notifications/data-model.md §2.
 * Каналы: email | messenger (placeholder для 050) | admin_ui | dataLayer.
 * SMS-канал не поддерживается (решение от 2026-05-23).
 *
 * Запись append-only снаружи: create/update только из сервера (доменный emitter / cron).
 */
export const NotificationJobs: CollectionConfig = {
  slug: "notification-jobs",
  labels: {
    singular: adminLabel("Уведомление", "Notification job"),
    plural: adminLabel("Уведомления", "Notification jobs"),
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  admin: {
    group: adminGroups.sales,
    defaultColumns: ["event", "channel", "status", "scheduledAt", "sentAt"],
    useAsTitle: "notificationId",
  },
  fields: [
    { name: "notificationId", type: "text", required: true, unique: true },
    {
      name: "orderId",
      type: "relationship",
      relationTo: "orders",
      required: true,
      label: adminLabel("Заказ", "Order"),
    },
    { name: "event", type: "text", required: true, label: adminLabel("Событие", "Event") },
    {
      name: "channel",
      type: "select",
      required: true,
      label: adminLabel("Канал", "Channel"),
      options: [
        { label: "email", value: "email" },
        { label: adminLabel("messenger (050)", "messenger (050)"), value: "messenger" },
        { label: "admin_ui", value: "admin_ui" },
        { label: "dataLayer", value: "dataLayer" },
      ],
    },
    { name: "template", type: "text", required: true, label: adminLabel("Шаблон", "Template") },
    { name: "recipient", type: "text", required: true, label: adminLabel("Получатель", "Recipient") },
    {
      name: "scheduledAt",
      type: "date",
      required: true,
      label: adminLabel("Запланировано", "Scheduled at"),
    },
    { name: "sentAt", type: "date", label: adminLabel("Отправлено", "Sent at") },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "queued",
      label: adminLabel("Статус", "Status"),
      options: [
        { label: adminLabel("В очереди", "Queued"), value: "queued" },
        { label: adminLabel("Отправляется", "In progress"), value: "in_progress" },
        { label: adminLabel("Отправлено", "Sent"), value: "sent" },
        { label: adminLabel("Ошибка", "Failed"), value: "failed" },
        { label: adminLabel("Пропущено", "Skipped"), value: "skipped" },
      ],
    },
    { name: "attempt", type: "number", defaultValue: 0, label: adminLabel("Попытка", "Attempt") },
    { name: "nextAttemptAt", type: "date" },
    { name: "errorMessage", type: "text", label: adminLabel("Ошибка", "Error message") },
    { name: "errorCode", type: "text" },
    {
      name: "externalRef",
      type: "text",
      label: adminLabel("MessageID провайдера", "Provider message-id"),
    },
    { name: "payload", type: "json", label: adminLabel("Payload шаблона", "Template payload") },
    {
      name: "skipReason",
      type: "text",
      label: adminLabel("Причина пропуска", "Skip reason"),
      admin: {
        description: adminLabel(
          "opt_out | duplicate | invalid_recipient | no_sender_registered | sandbox | disabled",
          "opt_out | duplicate | invalid_recipient | no_sender_registered | sandbox | disabled",
        ),
      },
    },
    {
      name: "dedupKey",
      type: "text",
      label: adminLabel("Ключ дедупликации", "Dedup key"),
      admin: { readOnly: true },
    },
  ],
  indexes: [
    { fields: ["status", "scheduledAt"] },
    { fields: ["orderId"] },
    { fields: ["dedupKey"] },
  ],
  timestamps: true,
};
