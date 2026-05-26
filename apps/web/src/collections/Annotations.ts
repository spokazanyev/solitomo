import type { CollectionConfig } from "payload";

import { adminGroups, adminLabel } from "./admin-i18n.js";

/**
 * Annotations — timeline events для соотнесения с динамикой метрик (058 T008, FR-161-162).
 *
 * Используется в weekly-report (FR-091 «Аннотации недели») и admin-странице
 * agent-proposals/timeline. v1 — ручной ввод; v1.1 — auto-CI-hook для type=deploy.
 *
 * Только production-аннотации попадают в weekly-report.
 */
export const Annotations: CollectionConfig = {
  slug: "annotations",
  labels: {
    singular: adminLabel("Аннотация", "Annotation"),
    plural: adminLabel("Аннотации", "Annotations"),
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  admin: {
    group: adminGroups.system,
    defaultColumns: ["type", "title", "occurredAt", "environment"],
    useAsTitle: "title",
    description: adminLabel(
      "FR-161-162. Timeline-маркеры: деплои, кампании, инциденты. " +
        "Только production попадает в weekly-report.",
      "FR-161-162. Timeline markers: deploys, campaigns, incidents. " +
        "Only production goes to weekly report.",
    ),
  },
  fields: [
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: adminLabel("Деплой", "Deploy"), value: "deploy" },
        { label: adminLabel("Кампания", "Campaign"), value: "campaign" },
        { label: adminLabel("Инцидент", "Incident"), value: "incident" },
        { label: adminLabel("Ручная", "Manual"), value: "manual" },
      ],
    },
    {
      name: "occurredAt",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    { name: "title", type: "text", required: true, maxLength: 120 },
    { name: "description", type: "textarea", maxLength: 2000 },
    {
      name: "gitRef",
      type: "text",
      admin: { description: adminLabel("Required для type='deploy'.", "Required for type='deploy'.") },
    },
    { name: "prUrl", type: "text" },
    {
      name: "environment",
      type: "select",
      required: true,
      defaultValue: "production",
      options: [
        { label: "production", value: "production" },
        { label: "staging", value: "staging" },
      ],
    },
    { name: "createdBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // FR-161 validation: type=deploy требует gitRef; type=incident требует description
        const type = (data as { type?: string }).type;
        if (type === "deploy" && !(data as { gitRef?: string }).gitRef) {
          throw new Error("Annotation type='deploy' requires gitRef (FR-161).");
        }
        if (
          type === "incident" &&
          !(data as { description?: string }).description?.trim()
        ) {
          throw new Error("Annotation type='incident' requires description (root cause).");
        }
        // Set createdBy on create
        if (operation === "create") {
          // hook context doesn't have req here in pure beforeChange — caller fills
        }
        return data;
      },
    ],
  },
};
