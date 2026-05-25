import type { CollectionConfig } from "payload";

import { adminGroups, adminLabel } from "./admin-i18n.js";

export const ShippingLogs: CollectionConfig = {
  slug: "shipping-logs",
  labels: {
    singular: adminLabel("Лог доставки", "Shipping log"),
    plural: adminLabel("Логи доставки", "Shipping logs"),
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  admin: {
    group: adminGroups.sales,
    defaultColumns: ["endpoint", "direction", "status", "at"],
    useAsTitle: "endpoint",
  },
  fields: [
    { name: "direction", type: "select", required: true,
      options: [
        { label: adminLabel("Исходящий", "Outgoing"), value: "out" },
        { label: adminLabel("Входящий", "Incoming"), value: "in" },
      ] },
    { name: "endpoint", type: "text", required: true },
    { name: "method", type: "text" },
    { name: "status", type: "number" },
    { name: "requestId", type: "text" },
    { name: "orderId", type: "text" },
    { name: "durationMs", type: "number" },
    { name: "request", type: "json" },
    { name: "response", type: "json" },
    { name: "error", type: "text" },
    { name: "at", type: "date", required: true },
  ],
  indexes: [{ fields: ["at"] }, { fields: ["orderId"] }],
};
