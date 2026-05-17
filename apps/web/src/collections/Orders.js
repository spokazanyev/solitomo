import { withDiscardChangesControl } from "./admin-components.js";
import { adminGroups, adminLabel, commonLabels } from "./admin-i18n.js";

/** @type {import('payload').CollectionConfig} */
export const Orders = {
  slug: "orders",
  labels: {
    plural: adminLabel("Заказы", "Orders"),
    singular: adminLabel("Заказ", "Order"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: [
      "id",
      "type",
      "status",
      "total",
      "customerLabel",
      "createdAt",
    ],
    group: adminGroups.sales,
    useAsTitle: "id",
  }),
  access: {
    create: () => true,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "type",
      type: "select",
      defaultValue: "physical",
      required: true,
      label: adminLabel("Тип заказа", "Order type"),
      options: [
        { label: adminLabel("Физлицо (оплата картой)", "Physical (card)"), value: "physical" },
        { label: adminLabel("Юрлицо (счёт)", "Legal (invoice)"), value: "legal" },
        { label: adminLabel("Запрос КП", "Quote"), value: "quote" },
      ],
    },
    {
      name: "status",
      type: "select",
      defaultValue: "new",
      required: true,
      label: commonLabels.status,
      options: [
        { label: adminLabel("Новый", "New"), value: "new" },
        { label: adminLabel("Ожидает оплаты", "Pending payment"), value: "pending_payment" },
        { label: adminLabel("Ожидает оплаты счёта", "Awaiting payment"), value: "awaiting_payment" },
        { label: adminLabel("Оплачен", "Paid"), value: "paid" },
        { label: adminLabel("В обработке", "Fulfilling"), value: "fulfilling" },
        { label: adminLabel("Отправлен", "Shipped"), value: "shipped" },
        { label: adminLabel("Доставлен", "Delivered"), value: "delivered" },
        { label: adminLabel("Отменён", "Cancelled"), value: "cancelled" },
        { label: adminLabel("Просрочен", "Expired"), value: "expired" },
      ],
    },
    {
      name: "customerLabel",
      type: "text",
      label: adminLabel("Кто оформил", "Customer label"),
      admin: { readOnly: true, description: adminLabel("Заполняется автоматически из contact/company.", "Auto-filled from contact/company.") },
    },
    {
      name: "items",
      type: "array",
      required: true,
      label: adminLabel("Позиции заказа", "Order items"),
      fields: [
        { name: "sku", type: "text", required: true, label: adminLabel("Артикул", "SKU") },
        { name: "name", type: "text", required: true, label: adminLabel("Название", "Name") },
        { name: "slug", type: "text", label: adminLabel("Slug", "Slug") },
        { name: "quantity", type: "number", required: true, defaultValue: 1, label: adminLabel("Количество", "Quantity") },
        { name: "price", type: "number", label: adminLabel("Цена за единицу, ₽", "Unit price, ₽") },
        { name: "lineTotal", type: "number", label: adminLabel("Сумма по позиции, ₽", "Line total, ₽") },
        {
          name: "product",
          type: "relationship",
          label: adminLabel("Товар", "Product"),
          relationTo: "products",
        },
      ],
    },
    {
      type: "group",
      name: "totals",
      label: adminLabel("Итоги", "Totals"),
      fields: [
        { name: "subtotal", type: "number", label: adminLabel("Сумма позиций, ₽", "Subtotal, ₽") },
        { name: "vat", type: "number", label: adminLabel("НДС, ₽", "VAT, ₽") },
        { name: "deliveryCost", type: "number", label: adminLabel("Доставка, ₽", "Delivery, ₽") },
        { name: "total", type: "number", label: adminLabel("Итого, ₽", "Total, ₽") },
      ],
    },
    {
      type: "group",
      name: "customer",
      label: adminLabel("Покупатель", "Customer"),
      fields: [
        { name: "fullName", type: "text", label: adminLabel("ФИО / контактное лицо", "Full name / contact") },
        { name: "email", type: "email", label: adminLabel("Email", "Email") },
        { name: "phone", type: "text", label: adminLabel("Телефон", "Phone") },
        { name: "companyName", type: "text", label: adminLabel("Юрлицо", "Company name") },
        { name: "inn", type: "text", label: adminLabel("ИНН", "Tax ID") },
        { name: "kpp", type: "text", label: adminLabel("КПП", "KPP") },
        { name: "ogrn", type: "text", label: adminLabel("ОГРН", "OGRN") },
        { name: "legalAddress", type: "textarea", label: adminLabel("Юр. адрес", "Legal address") },
      ],
    },
    {
      type: "group",
      name: "delivery",
      label: adminLabel("Доставка", "Delivery"),
      fields: [
        {
          name: "method",
          type: "select",
          label: adminLabel("Способ", "Method"),
          options: [
            { label: adminLabel("Самовывоз", "Pickup"), value: "pickup" },
            { label: adminLabel("СДЭК", "CDEK"), value: "cdek" },
            { label: adminLabel("Boxberry", "Boxberry"), value: "boxberry" },
            { label: adminLabel("Почта России", "Russian Post"), value: "russian-post" },
            { label: adminLabel("Транспортной компанией (по запросу)", "Logistics (by request)"), value: "tc" },
          ],
        },
        { name: "address", type: "textarea", label: adminLabel("Адрес доставки", "Delivery address") },
        { name: "city", type: "text", label: adminLabel("Город", "City") },
        { name: "cost", type: "number", label: adminLabel("Стоимость доставки, ₽", "Delivery cost, ₽") },
        { name: "trackNumber", type: "text", label: adminLabel("Трек-номер", "Track number") },
        { name: "shippedAt", type: "date", label: adminLabel("Отправлен", "Shipped at") },
      ],
    },
    {
      type: "group",
      name: "payment",
      label: adminLabel("Оплата", "Payment"),
      fields: [
        {
          name: "method",
          type: "select",
          label: adminLabel("Метод", "Method"),
          options: [
            { label: adminLabel("Карта (онлайн)", "Card (online)"), value: "card" },
            { label: adminLabel("По счёту", "Invoice"), value: "invoice" },
          ],
        },
        {
          name: "providerStatus",
          type: "select",
          label: adminLabel("Статус у провайдера", "Provider status"),
          options: [
            { label: adminLabel("Не оплачивался", "Not started"), value: "none" },
            { label: adminLabel("В ожидании", "Pending"), value: "pending" },
            { label: adminLabel("Успех", "Succeeded"), value: "succeeded" },
            { label: adminLabel("Отменён", "Canceled"), value: "canceled" },
          ],
        },
        { name: "providerRef", type: "text", label: adminLabel("ID платежа", "Provider ref") },
        { name: "paidAt", type: "date", label: adminLabel("Дата оплаты", "Paid at") },
        { name: "amount", type: "number", label: adminLabel("Сумма оплаты, ₽", "Amount paid, ₽") },
      ],
    },
    {
      type: "group",
      name: "invoice",
      label: adminLabel("Счёт", "Invoice"),
      admin: { description: adminLabel("Заполняется для заказов юрлица.", "Filled for legal orders.") },
      fields: [
        { name: "number", type: "text", label: adminLabel("Номер счёта", "Invoice number") },
        { name: "issuedAt", type: "date", label: adminLabel("Дата счёта", "Issued at") },
        { name: "pdfUrl", type: "text", label: adminLabel("Ссылка на PDF", "PDF URL") },
        { name: "validUntil", type: "date", label: adminLabel("Действителен до", "Valid until") },
      ],
    },
    {
      name: "sourcePage",
      type: "text",
      label: adminLabel("Страница-источник", "Source page"),
    },
    {
      name: "publicToken",
      type: "text",
      label: adminLabel("Публичный токен", "Public token"),
      admin: {
        readOnly: true,
        description: adminLabel(
          "Используется для публичной страницы заказа /cart/order/[token]/.",
          "Used for public order page /cart/order/[token]/.",
        ),
      },
    },
    {
      name: "internalComment",
      type: "textarea",
      label: adminLabel("Внутренний комментарий", "Internal comment"),
    },
    {
      name: "history",
      type: "array",
      label: adminLabel("История", "History"),
      admin: { description: adminLabel("Автособираемая история смен статусов.", "Auto-collected status history.") },
      fields: [
        { name: "at", type: "date" },
        { name: "from", type: "text" },
        { name: "to", type: "text" },
        { name: "note", type: "text" },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        // auto-fill customerLabel
        const c = data?.customer ?? originalDoc?.customer ?? {};
        const label = c.companyName?.trim() || c.fullName?.trim() || c.email?.trim() || "—";
        data.customerLabel = label;

        // generate publicToken once
        if (operation === "create" && !data.publicToken) {
          data.publicToken =
            Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        }

        // append history entry on status change
        if (operation === "update" && originalDoc && originalDoc.status !== data.status) {
          const prevHistory = Array.isArray(data.history) ? data.history : [];
          data.history = [
            ...prevHistory,
            {
              at: new Date().toISOString(),
              from: originalDoc.status,
              to: data.status,
              note: "",
            },
          ];
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // TODO(owner): подключить SMTP/transactional email-сервис.
        // Сейчас нотификации логируются на сервер. Триггеры:
        // - operation==="create" → "new order" менеджеру
        // - status change paid|shipped|delivered → клиенту
        try {
          if (operation === "create") {
            req.payload.logger.info(
              `[orders] new ${doc.type} order ${doc.id} for ${doc.customerLabel ?? "—"}`,
            );
          } else if (previousDoc && previousDoc.status !== doc.status) {
            req.payload.logger.info(
              `[orders] ${doc.id} status ${previousDoc.status} → ${doc.status}`,
            );
            // TODO(owner): sendOrderStatusEmail(doc, previousDoc.status, doc.status)
          }
        } catch (error) {
          req.payload.logger.error("[orders] afterChange notify failed:", error);
        }
      },
    ],
  },
  timestamps: true,
};
