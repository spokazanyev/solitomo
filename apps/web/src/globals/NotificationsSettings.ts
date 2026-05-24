import type { GlobalConfig } from "payload";

import { adminLabel } from "../collections/admin-i18n.js";

/**
 * Payload Global `notifications-settings` — управляет email-провайдером,
 * placeholder'ом для messenger-канала (спека 050) и списком менеджеров.
 *
 * См. specs/049-customer-notifications/data-model.md §1.
 * SMS-канал отсутствует осознанно (решение от 2026-05-23).
 */
export const NotificationsSettings: GlobalConfig = {
  slug: "notifications-settings",
  label: adminLabel("Уведомления", "Notifications"),
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "enabled",
      type: "checkbox",
      defaultValue: false,
      label: adminLabel("Модуль уведомлений включён", "Notifications enabled"),
      admin: {
        description: adminLabel(
          "Если выключено — jobs ставятся в очередь, но не отправляются (dry-run).",
          "If disabled — jobs are enqueued but not delivered (dry-run).",
        ),
      },
    },

    // ---------- Email ----------
    {
      type: "group",
      name: "email",
      label: adminLabel("Email-канал", "Email channel"),
      fields: [
        {
          name: "provider",
          type: "select",
          required: true,
          defaultValue: "postmark",
          label: adminLabel("Провайдер", "Provider"),
          options: [
            { label: "Postmark", value: "postmark" },
            { label: "Mailgun", value: "mailgun" },
            { label: "SendPulse", value: "sendpulse" },
          ],
        },
        {
          name: "apiKey",
          type: "text",
          label: adminLabel("API key", "API key"),
          admin: {
            description: adminLabel(
              "Хранится только на сервере. Маскируется в UI.",
              "Server-side only; masked in UI.",
            ),
          },
        },
        {
          name: "domain",
          type: "text",
          label: adminLabel("Домен (для Mailgun)", "Domain (Mailgun)"),
          admin: {
            description: adminLabel(
              "Используется только для Mailgun, например: mg.soliton.ru.",
              "Used only for Mailgun, e.g. mg.soliton.ru.",
            ),
          },
        },
        {
          name: "from",
          type: "text",
          required: true,
          defaultValue: "Soliton <orders@soliton.ru>",
          label: adminLabel("От кого", "From"),
        },
        {
          name: "replyTo",
          type: "text",
          defaultValue: "support@soliton.ru",
          label: adminLabel("Reply-To", "Reply-To"),
        },
        {
          name: "sandbox",
          type: "checkbox",
          defaultValue: true,
          label: adminLabel("Sandbox-режим", "Sandbox mode"),
          admin: {
            description: adminLabel(
              "Письма реально не отправляются, только логируются.",
              "Emails are not really sent — only logged.",
            ),
          },
        },
      ],
    },

    // ---------- Messenger (placeholder for 050) ----------
    {
      type: "group",
      name: "messenger",
      label: adminLabel("Мессенджер (placeholder для 050)", "Messenger (050 placeholder)"),
      admin: {
        description: adminLabel(
          "Архитектурный задел для спеки 050 (Telegram bot / MAX). В 049 sender не зарегистрирован.",
          "Architectural placeholder for spec 050. No sender registered in 049.",
        ),
      },
      fields: [
        {
          name: "enabled",
          type: "checkbox",
          defaultValue: false,
          label: adminLabel("Включён", "Enabled"),
          admin: {
            description: adminLabel(
              "В 049 — всегда false. Включится после реализации в спеке 050.",
              "Always false in 049; flipped on after 050.",
            ),
          },
        },
        {
          name: "provider",
          type: "select",
          defaultValue: "telegram",
          options: [
            { label: "Telegram", value: "telegram" },
            { label: "MAX", value: "max" },
            { label: "VK Messages", value: "vk_messages" },
          ],
        },
      ],
    },

    // ---------- Managers ----------
    {
      name: "managers",
      type: "array",
      label: adminLabel("Менеджеры для admin-уведомлений", "Managers"),
      admin: {
        description: adminLabel(
          "Получатели T-101..T-105 (paid, invoice, shipment error, stuck, cancelled).",
          "Recipients of T-101..T-105 admin templates.",
        ),
      },
      fields: [
        { name: "email", type: "email", required: true, label: adminLabel("Email", "Email") },
        { name: "name", type: "text", label: adminLabel("ФИО", "Full name") },
        {
          name: "events",
          type: "select",
          hasMany: true,
          defaultValue: ["everything"],
          options: [
            { label: "order.paid", value: "order.paid" },
            { label: "order.invoice_issued", value: "order.invoice_issued" },
            { label: "shipment.error", value: "shipment.error" },
            { label: "order.stuck", value: "order.stuck" },
            { label: "order.cancelled", value: "order.cancelled" },
            { label: adminLabel("Все события", "Everything"), value: "everything" },
          ],
        },
      ],
    },

    // ---------- Marketing toggles ----------
    {
      type: "group",
      name: "marketing",
      label: adminLabel("Маркетинговые сценарии", "Marketing scenarios"),
      fields: [
        {
          name: "cartAbandonmentEnabled",
          type: "checkbox",
          defaultValue: false,
          label: adminLabel("Брошенная корзина", "Cart abandonment"),
        },
        {
          name: "cartAbandonmentDelayMin",
          type: "number",
          defaultValue: 60,
          label: adminLabel("Задержка, мин.", "Delay, min."),
        },
        {
          name: "npsEnabled",
          type: "checkbox",
          defaultValue: true,
          label: adminLabel("NPS (T-008) включён", "NPS (T-008) enabled"),
        },
      ],
    },

    // ---------- Retry policy ----------
    {
      type: "group",
      name: "retry",
      label: adminLabel("Политика ретраев", "Retry policy"),
      fields: [
        {
          name: "maxAttempts",
          type: "number",
          defaultValue: 5,
          label: adminLabel("Максимум попыток", "Max attempts"),
        },
        {
          name: "baseDelaySec",
          type: "number",
          defaultValue: 30,
          label: adminLabel("Базовая задержка, сек.", "Base delay, sec."),
        },
        {
          name: "stuckQueueThreshold",
          type: "number",
          defaultValue: 100,
          label: adminLabel("Алерт при queued > N", "Alert when queued > N"),
        },
      ],
    },

    // ---------- Connection status ----------
    {
      type: "group",
      name: "connectionStatus",
      label: adminLabel("Статус подключения", "Connection status"),
      admin: { readOnly: true },
      fields: [
        { name: "lastCheckedAt", type: "date" },
        { name: "emailOk", type: "checkbox" },
        { name: "message", type: "text" },
      ],
    },
  ],
  hooks: {
    afterChange: [
      async ({ req, doc, previousDoc }) => {
        try {
          const mod = await import("../lib/notifications/settings");
          mod.invalidateNotificationsCache();
        } catch {
          // ignore
        }
        try {
          if (req?.user) {
            await req.payload.create({
              collection: "admin-change-log",
              data: {
                actorType: "user",
                actorName: req.user.email ?? "unknown",
                targetCollection: "globals/notifications-settings",
                targetLabel: "Notifications Settings",
                changeType: "update",
                diffSummary: JSON.stringify({
                  enabledFrom: (previousDoc as { enabled?: boolean })?.enabled,
                  enabledTo: (doc as { enabled?: boolean })?.enabled,
                }),
              },
            });
          }
        } catch {
          // ignore
        }
      },
    ],
  },
};
