import { withDiscardChangesControl } from "./admin-components.js";
import { adminGroups, adminLabel } from "./admin-i18n.js";

/** @type {import('payload').CollectionConfig} */
export const Users = {
  slug: "users",
  labels: {
    plural: adminLabel("Пользователи", "Users"),
    singular: adminLabel("Пользователь", "User"),
  },
  auth: true,
  admin: withDiscardChangesControl({
    group: adminGroups.system,
    useAsTitle: "email",
  }),
  fields: [
    {
      name: "role",
      type: "select",
      defaultValue: "admin",
      label: adminLabel("Роль", "Role"),
      options: [
        { label: adminLabel("Администратор", "Administrator"), value: "admin" },
        { label: adminLabel("Редактор", "Editor"), value: "editor" },
        { label: adminLabel("Продажи", "Sales"), value: "sales" },
        { label: adminLabel("Каталог-менеджер", "Catalog manager"), value: "catalog_manager" },
        { label: adminLabel("SEO", "SEO"), value: "seo" },
        { label: adminLabel("Агент", "Agent"), value: "agent" },
      ],
      required: true,
    },
  ],
};
