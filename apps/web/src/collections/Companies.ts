import type { CollectionConfig } from "payload";

import { adminGroups, adminLabel } from "./admin-i18n.js";

/**
 * Companies collection (054 data-model §2).
 *
 * B2B entity: one Company → many Customers (with role=owner/accountant/purchaser).
 * Deduplicated by `taxId` (ИНН). Syncs to Twenty Company via 048.
 */
export const Companies: CollectionConfig = {
  slug: "companies",
  labels: {
    plural: adminLabel("Компании", "Companies"),
    singular: adminLabel("Компания", "Company"),
  },
  admin: {
    group: adminGroups.sales,
    useAsTitle: "name",
    defaultColumns: ["name", "taxId", "kpp", "ogrn", "contactEmail"],
    description: adminLabel(
      "Юрлица-покупатели. Дедуп по ИНН. Sync c Twenty Company через 048.",
      "Legal-entity buyers. Deduped by tax ID. Synced to Twenty Company via 048.",
    ),
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      index: true,
      label: adminLabel("Название", "Name"),
    },
    {
      name: "taxId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: adminLabel("ИНН", "Tax ID"),
      admin: {
        description: adminLabel(
          "ИНН (10 или 12 цифр). Уникален. Используется для дедупа с Twenty Company.",
          "Tax ID (10 or 12 digits). Unique. Used for dedup with Twenty Company.",
        ),
      },
    },
    { name: "kpp", type: "text", label: adminLabel("КПП", "KPP") },
    { name: "ogrn", type: "text", label: adminLabel("ОГРН", "OGRN") },
    { name: "legalAddress", type: "textarea", label: adminLabel("Юр. адрес", "Legal address") },
    {
      name: "billingAddress",
      type: "textarea",
      label: adminLabel("Адрес для счетов", "Billing address"),
      admin: { description: adminLabel("Если отличается от юр. адреса.", "If different from legal address.") },
    },
    { name: "contactEmail", type: "email", label: adminLabel("Контактный email", "Contact email") },
    { name: "contactPhone", type: "text", label: adminLabel("Контактный телефон", "Contact phone") },

    // Approval limit (US7 — inert in MVP, see spec note)
    {
      name: "approvalLimit",
      type: "number",
      defaultValue: 0,
      label: adminLabel("Лимит без апрува, ₽", "Approval limit, ₽"),
      admin: {
        description: adminLabel(
          "Forward-compat поле для US7. В MVP не enforce'ится.",
          "Forward-compat field for US7. Not enforced in MVP.",
        ),
      },
    },

    // CRM refs
    { name: "crmCompanyId", type: "text", admin: { readOnly: true } },
    { name: "crmLastSyncedAt", type: "date", admin: { readOnly: true } },
    {
      name: "crmLastSyncStatus",
      type: "select",
      admin: { readOnly: true },
      options: [
        { label: "queued", value: "queued" },
        { label: "in_progress", value: "in_progress" },
        { label: "success", value: "success" },
        { label: "failed", value: "failed" },
      ],
    },

    // Lifecycle
    { name: "deletedAt", type: "date", admin: { readOnly: true } },
  ],
  timestamps: true,
};

export default Companies;
