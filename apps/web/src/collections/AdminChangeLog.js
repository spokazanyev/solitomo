import { withDiscardChangesControl } from "./admin-components.js";
import { adminGroups, adminLabel } from "./admin-i18n.js";
import { adminAccess } from "./shared.js";

/** @type {import('payload').CollectionConfig} */
export const AdminChangeLog = {
  slug: "admin-change-log",
  labels: {
    plural: adminLabel("Журнал изменений", "Change log"),
    singular: adminLabel("Запись журнала", "Change log entry"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["targetLabel", "targetCollection", "changeType", "actorType", "approvalStatus", "createdAt"],
    group: adminGroups.agentOperations,
    useAsTitle: "targetLabel",
  }),
  access: {
    create: adminAccess,
    read: adminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  fields: [
    {
      name: "actorType",
      type: "select",
      defaultValue: "agent",
      label: adminLabel("Тип исполнителя", "Actor type"),
      options: [
        { label: adminLabel("Пользователь", "User"), value: "user" },
        { label: adminLabel("Агент", "Agent"), value: "agent" },
        { label: adminLabel("Скрипт", "Script"), value: "script" },
        { label: adminLabel("Интеграция", "Integration"), value: "integration" },
      ],
      required: true,
    },
    {
      name: "actorName",
      type: "text",
      label: adminLabel("Имя исполнителя", "Actor name"),
    },
    {
      name: "targetCollection",
      type: "text",
      label: adminLabel("Коллекция", "Target collection"),
      required: true,
    },
    {
      name: "targetId",
      type: "text",
      label: adminLabel("ID объекта", "Target ID"),
    },
    {
      name: "targetLabel",
      type: "text",
      label: adminLabel("Название объекта", "Target label"),
      required: true,
    },
    {
      name: "changeType",
      type: "select",
      label: adminLabel("Тип изменения", "Change type"),
      options: [
        { label: adminLabel("Создание", "Create"), value: "create" },
        { label: adminLabel("Обновление", "Update"), value: "update" },
        { label: adminLabel("Публикация", "Publish"), value: "publish" },
        { label: adminLabel("Архивирование", "Archive"), value: "archive" },
        { label: adminLabel("Импорт", "Import"), value: "import" },
      ],
      required: true,
    },
    {
      name: "beforeSnapshot",
      type: "json",
      label: adminLabel("Снимок до изменения", "Before snapshot"),
    },
    {
      name: "afterSnapshot",
      type: "json",
      label: adminLabel("Снимок после изменения", "After snapshot"),
    },
    {
      name: "diffSummary",
      type: "textarea",
      label: adminLabel("Краткое описание изменений", "Diff summary"),
    },
    {
      name: "reason",
      type: "textarea",
      label: adminLabel("Причина", "Reason"),
    },
    {
      name: "approvalStatus",
      type: "select",
      defaultValue: "not_required",
      label: adminLabel("Статус подтверждения", "Approval status"),
      options: [
        { label: adminLabel("Не требуется", "Not required"), value: "not_required" },
        { label: adminLabel("Ожидает подтверждения", "Pending"), value: "pending" },
        { label: adminLabel("Подтверждено", "Approved"), value: "approved" },
        { label: adminLabel("Отклонено", "Rejected"), value: "rejected" },
      ],
    },
    {
      name: "approvedBy",
      type: "text",
      label: adminLabel("Кем подтверждено", "Approved by"),
    },
  ],
  timestamps: true,
};
