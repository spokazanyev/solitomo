import { consentField } from "../lib/consent/consent-field";
import { withDiscardChangesControl } from "./admin-components.js";
import { adminGroups, adminLabel, commonLabels } from "./admin-i18n.js";

/** @type {import('payload').CollectionConfig} */
export const RfqRequests = {
  slug: "rfq-requests",
  labels: {
    plural: adminLabel("Заявки на КП", "RFQ requests"),
    singular: adminLabel("Заявка на КП", "RFQ request"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["companyName", "contactName", "email", "phone", "status", "priority", "assignedManager", "createdAt"],
    group: adminGroups.sales,
    useAsTitle: "companyName",
  }),
  access: {
    create: () => true,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "status",
      type: "select",
      defaultValue: "new",
      label: commonLabels.status,
      options: [
        { label: adminLabel("Новая", "New"), value: "new" },
        { label: adminLabel("В работе", "In progress"), value: "in_progress" },
        { label: adminLabel("Требуется уточнение", "Needs clarification"), value: "needs_clarification" },
        { label: adminLabel("КП готовится", "Quote preparing"), value: "quote_preparing" },
        { label: adminLabel("КП отправлено", "Quoted"), value: "quoted" },
        { label: adminLabel("Заказ получен", "Won"), value: "won" },
        { label: adminLabel("Закрыта без заказа", "Lost"), value: "lost" },
        { label: adminLabel("Спам/дубль", "Spam/duplicate"), value: "spam" },
      ],
      required: true,
    },
    {
      name: "priority",
      type: "select",
      defaultValue: "normal",
      label: adminLabel("Приоритет", "Priority"),
      options: [
        { label: adminLabel("Низкий", "Low"), value: "low" },
        { label: adminLabel("Обычный", "Normal"), value: "normal" },
        { label: adminLabel("Высокий", "High"), value: "high" },
        { label: adminLabel("Срочно", "Urgent"), value: "urgent" },
      ],
    },
    {
      name: "assignedManager",
      type: "relationship",
      label: adminLabel("Ответственный менеджер", "Assigned manager"),
      relationTo: "users",
    },
    {
      name: "sourcePage",
      type: "text",
      label: adminLabel("Страница-источник", "Source page"),
    },
    {
      name: "utmSource",
      type: "text",
      label: adminLabel("UTM source", "UTM source"),
    },
    {
      name: "utmMedium",
      type: "text",
      label: adminLabel("UTM medium", "UTM medium"),
    },
    {
      name: "utmCampaign",
      type: "text",
      label: adminLabel("UTM campaign", "UTM campaign"),
    },
    {
      name: "customerType",
      type: "select",
      defaultValue: "company",
      label: adminLabel("Тип клиента", "Customer type"),
      options: [
        { label: adminLabel("Юрлицо", "Company"), value: "company" },
        { label: adminLabel("Физлицо", "Individual"), value: "person" },
        { label: adminLabel("Интегратор", "Integrator"), value: "integrator" },
      ],
    },
    {
      name: "companyName",
      type: "text",
      label: adminLabel("Компания", "Company name"),
    },
    {
      name: "inn",
      type: "text",
      label: adminLabel("ИНН", "Tax ID"),
    },
    {
      name: "contactName",
      type: "text",
      label: adminLabel("Контактное лицо", "Contact name"),
      required: true,
    },
    {
      name: "email",
      type: "email",
      label: adminLabel("Email", "Email"),
    },
    {
      name: "phone",
      type: "text",
      label: adminLabel("Телефон", "Phone"),
    },
    {
      name: "city",
      type: "text",
      label: adminLabel("Город", "City"),
    },
    // 057: Embedded consent record (152-ФЗ Art. 9)
    consentField(),
    {
      name: "deadline",
      type: "text",
      label: adminLabel("Срок", "Deadline"),
    },
    {
      name: "items",
      type: "textarea",
      label: adminLabel("Позиции legacy", "Legacy items"),
      admin: {
        description: adminLabel(
          "Legacy JSON со SKU, названием и количеством позиций из формы.",
          "Legacy JSON with SKU, name, and quantity from the form.",
        ),
      },
    },
    {
      name: "requestedItems",
      type: "array",
      label: adminLabel("Позиции заявки", "Requested items"),
      fields: [
        { name: "sku", type: "text", label: adminLabel("Артикул", "SKU") },
        { name: "name", type: "text", label: adminLabel("Название", "Name") },
        { name: "quantity", type: "text", label: adminLabel("Количество", "Quantity") },
        {
          name: "product",
          type: "relationship",
          label: adminLabel("Товар", "Product"),
          relationTo: "products",
        },
      ],
    },
    {
      name: "message",
      type: "textarea",
      label: adminLabel("Сообщение", "Message"),
    },
    {
      name: "technicalSpec",
      type: "textarea",
      label: adminLabel("Техническое задание", "Technical specification"),
    },
    {
      name: "analytics",
      type: "textarea",
      label: adminLabel("Аналитика", "Analytics"),
      admin: {
        description: adminLabel("JSON с источником заявки и техническими метками.", "JSON with request source and technical metadata."),
      },
    },
    {
      name: "internalComment",
      type: "textarea",
      label: adminLabel("Внутренний комментарий", "Internal comment"),
    },
    {
      name: "nextActionAt",
      type: "date",
      label: adminLabel("Следующее действие", "Next action at"),
    },
    {
      name: "quoteSentAt",
      type: "date",
      label: adminLabel("КП отправлено", "Quote sent at"),
    },
    {
      name: "quoteNumber",
      type: "text",
      label: adminLabel("Номер КП", "Quote number"),
    },
    {
      name: "expectedBudget",
      type: "number",
      label: adminLabel("Ожидаемый бюджет", "Expected budget"),
    },
    {
      name: "decisionStatus",
      type: "select",
      label: adminLabel("Статус решения", "Decision status"),
      options: [
        { label: adminLabel("Неизвестно", "Unknown"), value: "unknown" },
        { label: adminLabel("В выборе", "Evaluating"), value: "evaluating" },
        { label: adminLabel("Ждет КП", "Waiting for quote"), value: "waiting_quote" },
        { label: adminLabel("Согласование", "Approval"), value: "approval" },
        { label: adminLabel("Выиграно", "Won"), value: "won" },
        { label: adminLabel("Проиграно", "Lost"), value: "lost" },
      ],
    },
    {
      name: "closeReason",
      type: "textarea",
      label: adminLabel("Причина закрытия", "Close reason"),
    },
  ],
  timestamps: true,
};
