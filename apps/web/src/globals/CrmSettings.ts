import type { GlobalConfig } from "payload";

import { adminLabel } from "../collections/admin-i18n.js";

export const CrmSettings: GlobalConfig = {
  slug: "crm-settings",
  label: adminLabel("CRM / Twenty", "CRM / Twenty"),
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "enabled", type: "checkbox", defaultValue: false },
    {
      name: "baseUrl",
      type: "text",
      required: true,
      defaultValue: "https://crm.soliton.ru",
      admin: {
        description: adminLabel(
          "Self-host URL. Финальный поддомен — Q6.",
          "Self-host URL.",
        ),
      },
    },
    { name: "apiKey", type: "text", label: adminLabel("API key", "API key") },
    { name: "workspaceId", type: "text" },
    { name: "defaultAssignee", type: "text" },
    { name: "webhookSecret", type: "text" },
    { type: "group", name: "mapping", fields: [
      { name: "createCompanyForB2B", type: "checkbox", defaultValue: true },
      { name: "linkPersonByEmail", type: "checkbox", defaultValue: true },
      { name: "linkCompanyByTaxId", type: "checkbox", defaultValue: true },
    ] },
    { type: "group", name: "stageMap", fields: [
      { name: "draft", type: "text", defaultValue: "New" },
      { name: "pending_payment", type: "text", defaultValue: "Quote" },
      { name: "awaiting_payment", type: "text", defaultValue: "Quote" },
      { name: "paid", type: "text", defaultValue: "Won" },
      { name: "fulfilling", type: "text", defaultValue: "Won" },
      { name: "shipped", type: "text", defaultValue: "Won" },
      { name: "delivered", type: "text", defaultValue: "Won" },
      { name: "completed", type: "text", defaultValue: "Won.Closed" },
      { name: "cancelled", type: "text", defaultValue: "Lost" },
      { name: "returned", type: "text", defaultValue: "Lost" },
      { name: "expired", type: "text", defaultValue: "Lost" },
    ] },
    { type: "group", name: "retry", fields: [
      { name: "maxAttempts", type: "number", defaultValue: 5 },
      { name: "baseDelaySec", type: "number", defaultValue: 30 },
      { name: "rateLimitRpm", type: "number", defaultValue: 60 },
    ] },
    {
      type: "group",
      name: "connectionStatus",
      admin: { readOnly: true },
      fields: [
        { name: "lastCheckedAt", type: "date" },
        { name: "ok", type: "checkbox" },
        { name: "message", type: "text" },
        { name: "schemaCheckOk", type: "checkbox" },
      ],
    },
  ],
};
