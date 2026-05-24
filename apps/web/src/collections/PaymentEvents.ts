import type { CollectionConfig } from "payload";

import { adminLabel } from "./admin-i18n.js";

/**
 * PaymentEvents (055) — append-only журнал входящих ЮKassa webhook'ов.
 *
 * Coverage: FR-5570..5572, US6 (admin observability).
 * Каждое событие записывается ПЕРЕД любой мутацией Order/Return (FR-5555).
 * Retention 90 дней через cron-prune (FR-5572, T066).
 */

const MAX_PAYLOAD_BYTES = 16 * 1024;

export const PaymentEvents: CollectionConfig = {
  slug: "paymentEvents",
  labels: {
    singular: adminLabel("Событие ЮKassa", "ЮKassa Event"),
    plural: adminLabel("События ЮKassa", "ЮKassa Events"),
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user), // server-only in practice; UI hidden
    update: () => false, // append-only (FR-5570)
    delete: ({ req }) => {
      // Only cron-prune (server-side) and admins
      if (!req?.user) return false;
      // In Payload there's no built-in role concept — gate by user presence.
      // Cron-prune sets req.context.cronPrune=true (T066).
      return Boolean(req.context?.cronPrune || req.user);
    },
  },
  admin: {
    useAsTitle: "eventId",
    defaultColumns: ["receivedAt", "eventType", "providerRef", "result", "rejectedReason"],
    description: adminLabel(
      "Append-only журнал webhook'ов от ЮKassa. Записывается до мутаций Order/Return (FR-5555). Retention 90 дней.",
      "Append-only journal of ЮKassa webhooks. Written before Order/Return mutations (FR-5555). 90-day retention.",
    ),
  },
  fields: [
    {
      name: "eventId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: adminLabel(
          "Composite: `${object.id}:${event_type}`. См. composeEventId().",
          "Composite: `${object.id}:${event_type}`. See composeEventId().",
        ),
      },
    },
    {
      name: "eventType",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "payment.waiting_for_capture", value: "payment.waiting_for_capture" },
        { label: "payment.succeeded", value: "payment.succeeded" },
        { label: "payment.canceled", value: "payment.canceled" },
        { label: "refund.succeeded", value: "refund.succeeded" },
        { label: "refund.canceled", value: "refund.canceled" },
        { label: "payment.refunded (rare)", value: "payment.refunded" },
        { label: "other (parse error)", value: "other" },
      ],
    },
    {
      name: "providerRef",
      type: "text",
      required: true,
      index: true,
      label: adminLabel("ID платежа/возврата у ЮKassa", "ЮKassa payment/refund ID"),
    },
    {
      name: "order",
      type: "relationship",
      relationTo: "orders",
      hasMany: false,
      index: true,
      label: adminLabel("Заказ", "Order"),
    },
    {
      name: "return",
      type: "relationship",
      relationTo: "returns",
      hasMany: false,
      index: true,
      label: adminLabel("Возврат", "Return"),
    },
    {
      name: "payload",
      type: "json",
      label: adminLabel("Webhook payload", "Webhook payload"),
      admin: {
        description: adminLabel(
          "Сырой payload. Если >16KB — truncate с указанием truncatedAt.",
          "Raw payload. Truncated to 16KB with truncatedAt indicator.",
        ),
      },
    },
    {
      name: "truncatedAt",
      type: "number",
      label: adminLabel("Усечён до байт", "Truncated to bytes"),
      admin: { description: adminLabel("Original size в байтах если payload был усечён.", "Original bytes if truncated.") },
    },
    {
      name: "receivedAt",
      type: "date",
      required: true,
      index: true,
      defaultValue: () => new Date().toISOString(),
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    { name: "processedAt", type: "date" },
    {
      name: "result",
      type: "select",
      required: true,
      defaultValue: "success",
      options: [
        { label: "success", value: "success" },
        { label: "rejected", value: "rejected" },
        { label: "duplicate", value: "duplicate" },
      ],
    },
    {
      name: "rejectedReason",
      type: "select",
      options: [
        { value: "ip_not_allowed", label: "ip_not_allowed" },
        { value: "unknown_payment", label: "unknown_payment" },
        { value: "unknown_refund", label: "unknown_refund" },
        { value: "amount_mismatch", label: "amount_mismatch" },
        { value: "currency_mismatch", label: "currency_mismatch" },
        { value: "signature_invalid", label: "signature_invalid" },
        { value: "settings_disabled", label: "settings_disabled" },
        { value: "internal_error", label: "internal_error" },
        { value: "parse_error", label: "parse_error" },
      ],
    },
    {
      name: "sourceIp",
      type: "text",
      label: adminLabel("IP источника", "Source IP"),
    },
    {
      name: "duplicateCount",
      type: "number",
      defaultValue: 0,
      label: adminLabel("Повторов", "Duplicate count"),
    },
    {
      name: "source",
      type: "select",
      defaultValue: "webhook",
      options: [
        { value: "webhook", label: "webhook" },
        { value: "cron_reconciliation", label: "cron_reconciliation" },
      ],
    },
    {
      name: "notificationJobId",
      type: "text",
      label: adminLabel("ID notification job (049)", "Notification job ID (049)"),
    },
    {
      name: "domainEventId",
      type: "text",
      label: adminLabel("ID domain event", "Domain event ID"),
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // Truncate payload >16KB (FR-5570)
        if (operation === "create" && data.payload) {
          const json = JSON.stringify(data.payload);
          const bytes = Buffer.byteLength(json, "utf8");
          if (bytes > MAX_PAYLOAD_BYTES) {
            data.truncatedAt = bytes;
            data.payload = {
              _truncated: true,
              _originalBytes: bytes,
              // keep top-level keys for diagnostics
              top: Object.keys(data.payload as Record<string, unknown>),
            };
          }
        }
        return data;
      },
    ],
  },
  timestamps: true,
};
