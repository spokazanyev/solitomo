import type { CollectionConfig } from "payload";

import { adminLabel } from "./admin-i18n.js";

export const CrmSyncJobs: CollectionConfig = {
  slug: "crm-sync-jobs",
  labels: {
    singular: adminLabel("CRM sync job", "CRM sync job"),
    plural: adminLabel("CRM sync jobs", "CRM sync jobs"),
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  admin: {
    defaultColumns: ["orderId", "event", "status", "attempt", "lastAttemptAt"],
    useAsTitle: "jobId",
  },
  fields: [
    { name: "jobId", type: "text", required: true, unique: true },
    { name: "orderId", type: "text", required: true },
    { name: "event", type: "text", required: true },
    { name: "payload", type: "json" },
    { name: "attempt", type: "number", defaultValue: 0 },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "queued",
      options: ["queued", "in_progress", "success", "failed", "quarantined"].map((v) => ({ label: v, value: v })),
    },
    { name: "lastAttemptAt", type: "date" },
    { name: "nextAttemptAt", type: "date" },
    { name: "errorMessage", type: "text" },
    { name: "errorCode", type: "text" },
    { name: "twentyRef", type: "json" },
  ],
  indexes: [{ fields: ["status", "nextAttemptAt"] }, { fields: ["orderId"] }],
};
