import { randomBytes } from "node:crypto";

import { consentField } from "../lib/consent/consent-field";
import { withDiscardChangesControl } from "./admin-components.js";
import { adminGroups, adminLabel, commonLabels } from "./admin-i18n.js";
// 051: Order numbering + immutability hooks (lazy-imported to avoid startup cost)

/** @type {import('payload').CollectionConfig} */
export const Orders = {
  slug: "orders",
  labels: {
    plural: adminLabel("Заказы", "Orders"),
    singular: adminLabel("Заказ", "Order"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: [
      "clientNumber", // 051: human-readable number first
      "type",
      "status",
      "total",
      "customerLabel",
      "createdAt",
    ],
    group: adminGroups.sales,
    useAsTitle: "clientNumber",
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
        { label: adminLabel("Черновик", "Draft"), value: "draft" },
        { label: adminLabel("Ожидает оплаты", "Pending payment"), value: "pending_payment" },
        { label: adminLabel("Ожидает оплаты счёта", "Awaiting payment"), value: "awaiting_payment" },
        { label: adminLabel("Оплачен", "Paid"), value: "paid" },
        { label: adminLabel("В обработке", "Fulfilling"), value: "fulfilling" },
        { label: adminLabel("Отправлен", "Shipped"), value: "shipped" },
        { label: adminLabel("Доставлен", "Delivered"), value: "delivered" },
        { label: adminLabel("Отменён", "Cancelled"), value: "cancelled" },
        { label: adminLabel("Просрочен", "Expired"), value: "expired" },
        { label: adminLabel("Закрыт", "Completed"), value: "completed" },
        { label: adminLabel("Возврат", "Returned"), value: "returned" },
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
        {
          name: "emailValid",
          type: "checkbox",
          defaultValue: true,
          label: adminLabel("Email валиден", "Email valid"),
          admin: {
            description: adminLabel(
              "Помечается false после 3 hard bounce от провайдера (049, FR-edge bounce).",
              "Flipped false after 3 hard bounces (049, edge case).",
            ),
          },
        },
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
        // 047: ApiShip integration
        {
          name: "provider",
          type: "select",
          defaultValue: "fallback",
          label: adminLabel("Провайдер", "Provider"),
          options: [
            { label: "ApiShip", value: "apiship" },
            { label: adminLabel("Fallback (старые опции)", "Fallback"), value: "fallback" },
          ],
        },
        { name: "providerKey", type: "text", label: adminLabel("Код службы", "Provider key") },
        { name: "tariffId", type: "number" },
        {
          name: "deliveryType",
          type: "select",
          label: adminLabel("Тип доставки", "Delivery type"),
          options: [
            { label: adminLabel("До двери", "Door"), value: "1" },
            { label: adminLabel("До ПВЗ", "Point"), value: "2" },
          ],
        },
        {
          name: "pickupType",
          type: "select",
          label: adminLabel("Тип забора", "Pickup type"),
          options: [
            { label: adminLabel("От двери", "Door"), value: "1" },
            { label: adminLabel("От ПВЗ", "Point"), value: "2" },
          ],
        },
        { name: "pointId", type: "text", label: adminLabel("ID ПВЗ", "Pickup point ID") },
        { name: "pointAddress", type: "text", label: adminLabel("Адрес ПВЗ", "Pickup point address") },
        { name: "etaMinDays", type: "number", label: adminLabel("Срок мин, дн.", "ETA min days") },
        { name: "etaMaxDays", type: "number", label: adminLabel("Срок макс, дн.", "ETA max days") },
        { name: "selectedAt", type: "date", admin: { readOnly: true } },
        { name: "addressNormalized", type: "json", label: adminLabel("Нормализованный адрес", "Normalized address") },
        {
          name: "priceSnapshot",
          type: "group",
          admin: { readOnly: true, description: adminLabel("Фиксируется на шаге Review (FR-107).", "Captured on Review step.") },
          fields: [
            { name: "cost", type: "number" },
            { name: "currency", type: "text", defaultValue: "RUB" },
            { name: "capturedAt", type: "date" },
            { name: "sourceCacheKey", type: "text" },
            { name: "refreshCheckAt", type: "date" },
          ],
        },
        { name: "pickupExpiresAt", type: "date", label: adminLabel("Срок хранения в ПВЗ", "Pickup expires at") },
      ],
    },
    {
      type: "group",
      name: "shipment",
      label: adminLabel("Отправление", "Shipment"),
      admin: { description: adminLabel("Заполняется автоматически после создания заказа в ApiShip.", "Filled after ApiShip order creation.") },
      fields: [
        { name: "providerOrderId", type: "text" },
        { name: "trackingNumber", type: "text" },
        { name: "trackingUrl", type: "text" },
        { name: "labelUrl", type: "text" },
        { name: "waybillUrl", type: "text" },
        {
          name: "status",
          type: "select",
          defaultValue: "none",
          options: [
            { label: adminLabel("Не создан", "Not created"), value: "none" },
            { label: adminLabel("Создаётся", "Pending"), value: "pending" },
            { label: adminLabel("Создан", "Created"), value: "created" },
            { label: adminLabel("Ожидает этикетки", "Pending label"), value: "pending_label" },
            { label: adminLabel("В пути", "In transit"), value: "in_transit" },
            { label: adminLabel("В ПВЗ", "At point"), value: "at_point" },
            { label: adminLabel("Доставлен", "Delivered"), value: "delivered" },
            { label: adminLabel("Возврат", "Returned"), value: "returned" },
            { label: adminLabel("Отменён", "Cancelled"), value: "cancelled" },
            { label: adminLabel("Ошибка", "Error"), value: "error" },
          ],
        },
        {
          name: "events",
          type: "array",
          fields: [
            { name: "eventId", type: "text", required: true },
            { name: "providerStatus", type: "text" },
            { name: "internalStatus", type: "text" },
            { name: "at", type: "date", required: true },
            { name: "receivedAt", type: "date" },
            { name: "message", type: "text" },
            { name: "raw", type: "json" },
          ],
        },
        { name: "createdAt", type: "date", admin: { readOnly: true } },
        { name: "cancelledAt", type: "date", admin: { readOnly: true } },
        { name: "errorMessage", type: "text", admin: { readOnly: true } },
        { name: "lastSyncedAt", type: "date", admin: { readOnly: true } },
      ],
    },
    {
      type: "group",
      name: "crmRefs",
      label: adminLabel("CRM (Twenty)", "CRM (Twenty)"),
      admin: { description: adminLabel("Заполнение — 048-twenty-crm-sync.", "Filled by 048-twenty-crm-sync.") },
      fields: [
        { name: "opportunityId", type: "text", admin: { readOnly: true } },
        { name: "personId", type: "text", admin: { readOnly: true } },
        { name: "companyId", type: "text", admin: { readOnly: true } },
        { name: "lastSyncedAt", type: "date", admin: { readOnly: true } },
        {
          name: "lastSyncStatus",
          type: "select",
          options: ["queued", "in_progress", "success", "failed", "quarantined"].map((v) => ({ label: v, value: v })),
          admin: { readOnly: true },
        },
        { name: "lastSyncError", type: "text", admin: { readOnly: true } },
        { name: "pendingCancellationFromCrm", type: "checkbox", defaultValue: false },
      ],
    },
    { name: "deliveredAt", type: "date", admin: { readOnly: true } },
    { name: "closedAt", type: "date", admin: { readOnly: true } },
    { name: "disputeFlag", type: "checkbox", defaultValue: false,
      label: adminLabel("Диспут / возврат", "Dispute"),
      admin: { description: adminLabel(
        "Derived: true ⟺ есть Return со статусом requested/approved/received. Синхронизируется из returns.afterChange (053, FR-5310).",
        "Derived: true iff active Return exists. Synced from returns.afterChange (053).",
      ) },
    },
    { name: "paymentRetryUntil", type: "date", admin: { readOnly: true } },
    // 053: Return aggregates (computed from returns collection afterChange)
    { name: "hasReturns", type: "checkbox", defaultValue: false,
      label: adminLabel("Есть возвраты", "Has returns"),
      admin: { readOnly: true, description: adminLabel("Computed из коллекции returns.", "Computed from returns collection.") },
    },
    { name: "returnsCount", type: "number", defaultValue: 0,
      label: adminLabel("Количество возвратов", "Returns count"),
      admin: { readOnly: true },
    },
    { name: "totalRefunded", type: "number", defaultValue: 0,
      label: adminLabel("Сумма возвратов, ₽", "Total refunded, ₽"),
      admin: { readOnly: true, description: adminLabel("В копейках. Computed из returns.", "In kopecks. Computed from returns.") },
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
            // 055: authorized — для two_stage capture mode (после payment.waiting_for_capture)
            { label: adminLabel("Авторизован", "Authorized"), value: "authorized" },
            { label: adminLabel("Успех", "Succeeded"), value: "succeeded" },
            { label: adminLabel("Отменён", "Canceled"), value: "canceled" },
          ],
        },
        { name: "providerRef", type: "text", label: adminLabel("ID платежа", "Provider ref"), index: true },
        { name: "paidAt", type: "date", label: adminLabel("Дата оплаты", "Paid at") },
        { name: "amount", type: "number", label: adminLabel("Сумма оплаты, ₽", "Amount paid, ₽") },
        // 055: NEW fields — see specs/055/data-model.md §3
        { name: "capturedAt", type: "date", label: adminLabel("Дата захвата", "Captured at"),
          admin: { description: adminLabel("Для two_stage: момент успешного capture (FR-5524).", "Two-stage: capture timestamp (FR-5524).") } },
        { name: "idempotenceKey", type: "text", label: adminLabel("Idempotence Key", "Idempotence Key"),
          index: true,
          admin: { readOnly: true, description: adminLabel("UUID, генерируется при первом create-payment (FR-5510).", "UUID, generated on first create-payment (FR-5510).") } },
        { name: "confirmationUrl", type: "text", label: adminLabel("URL подтверждения", "Confirmation URL"),
          admin: { readOnly: true } },
        { name: "createdAt", type: "date",
          label: adminLabel("Создан в ЮKassa", "Created at YooKassa"),
          admin: { readOnly: true, description: adminLabel("FR-5508. Момент создания платёжной сессии.", "FR-5508. Payment session created.") } },
        { name: "confirmationType", type: "select",
          options: [
            { label: "redirect", value: "redirect" },
            { label: "qr", value: "qr" },
            { label: "embedded", value: "embedded" },
          ] },
        { name: "receiptStatus", type: "select",
          label: adminLabel("Статус чека 54-ФЗ", "Receipt 54-ФЗ status"),
          options: [
            { label: "pending", value: "pending" },
            { label: "succeeded", value: "succeeded" },
            { label: "canceled", value: "canceled" },
          ],
          admin: { description: adminLabel("FR-5545. ЮKassa auto-mode receipt registration.", "FR-5545. ЮKassa auto-mode receipt registration.") } },
        { name: "vatCodeApplied", type: "number",
          label: adminLabel("vat_code на момент успеха", "vat_code on success"),
          admin: { readOnly: true, description: adminLabel("FR-5544c. Snapshot ставки для refund'ов.", "FR-5544c. Rate snapshot for refunds.") } },
        {
          name: "paymentMethodSnapshot",
          type: "group",
          label: adminLabel("Метод оплаты (snapshot)", "Payment method snapshot"),
          admin: { description: adminLabel("OQ-6. Заполняется webhook handler'ом.", "OQ-6. Filled by webhook handler.") },
          fields: [
            { name: "type", type: "select",
              options: [
                { value: "bank_card", label: "bank_card" },
                { value: "sbp", label: "sbp" },
                { value: "yoo_money", label: "yoo_money" },
                { value: "sberbank", label: "sberbank" },
              ] },
            { name: "title", type: "text" },
            { type: "group", name: "card", fields: [
              { name: "first6", type: "text" },
              { name: "last4", type: "text" },
              { name: "expiryMonth", type: "text" },
              { name: "expiryYear", type: "text" },
              { name: "cardType", type: "text" },
              { name: "issuerCountry", type: "text" },
              { name: "issuerName", type: "text" },
            ] },
            { type: "group", name: "sbp", fields: [
              { name: "bankId", type: "text" },
              { name: "bankName", type: "text" },
            ] },
            { type: "group", name: "yooMoney", fields: [
              { name: "accountNumber", type: "text" },
            ] },
            { type: "group", name: "sberbank", fields: [
              { name: "phone", type: "text" },
            ] },
          ],
        },
        {
          name: "captureAttempts",
          type: "array",
          label: adminLabel("Попытки capture", "Capture attempts"),
          admin: { readOnly: true, description: adminLabel("FR-5523a. Exponential backoff для capture retry.", "FR-5523a. Exponential backoff for capture retry.") },
          fields: [
            { name: "attemptedAt", type: "date", required: true },
            { name: "error", type: "text", required: true },
            { name: "errorCode", type: "text" },
            { name: "nextRetryAt", type: "date" },
            { name: "exhausted", type: "checkbox", defaultValue: false },
          ],
        },
        // 053: Refund records
        {
          name: "refunds",
          type: "array",
          label: adminLabel("Возвраты средств", "Refunds"),
          admin: { readOnly: true, description: adminLabel("Заполняется автоматически при возврате (053).", "Auto-filled on refund (053).") },
          fields: [
            { name: "providerRefundId", type: "text", required: true },
            { name: "returnId", type: "text" },
            { name: "amount", type: "number", required: true, admin: { description: adminLabel("В копейках.", "In kopecks.") } },
            { name: "refundedAt", type: "date", required: true },
            {
              name: "providerStatus",
              type: "select",
              options: [
                { label: "pending", value: "pending" },
                { label: "succeeded", value: "succeeded" },
                { label: "failed", value: "failed" },
                { label: "canceled", value: "canceled" },
              ],
            },
          ],
        },
        // 053: Payer bank details snapshot (для bank-transfer refunds, юрлицо)
        {
          name: "payerBankDetails",
          type: "group",
          label: adminLabel("Реквизиты плательщика", "Payer bank details"),
          admin: {
            description: adminLabel(
              "Snapshot реквизитов плательщика для bank-transfer refunds (юрлицо, 053).",
              "Payer bank details snapshot for bank-transfer refunds (legal entity, 053).",
            ),
          },
          fields: [
            { name: "bankAccount", type: "text", label: adminLabel("Расчётный счёт", "Bank account") },
            { name: "bik", type: "text", label: adminLabel("БИК", "BIK") },
            { name: "recipientName", type: "text", label: adminLabel("Наименование получателя", "Recipient name") },
            { name: "bankName", type: "text", label: adminLabel("Банк", "Bank") },
          ],
        },
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
    // 052: Cart link for funnel analytics (cart → order conversion)
    // C3 fix: unique constraint prevents two orders pointing at the same cart
    // (race-condition guard for double-click / parallel-device).
    {
      name: "cartId",
      type: "relationship",
      relationTo: "carts",
      unique: true,
      label: adminLabel("Корзина", "Cart"),
      index: true,
      admin: {
        readOnly: true,
        description: adminLabel(
          "Cart, из которого создан заказ (для funnel-аналитики). Уникален. Может быть пустым для legacy заказов.",
          "Source cart for funnel analytics. Unique. May be empty for legacy orders.",
        ),
      },
    },
    // 054: Customer / Company FKs (FR-5403)
    {
      name: "customerId",
      type: "relationship",
      relationTo: "customers",
      label: adminLabel("Клиент", "Customer"),
      index: true,
      admin: {
        description: adminLabel(
          "FK на customers. Null для guest-заказов до merge.",
          "FK to customers. Null for guest orders before merge.",
        ),
      },
    },
    {
      name: "companyId",
      type: "relationship",
      relationTo: "companies",
      label: adminLabel("Компания", "Company"),
      index: true,
      admin: {
        description: adminLabel(
          "FK на companies. Null для физлиц и личных заказов company-contact.",
          "FK to companies. Null for individuals and personal company-contact orders.",
        ),
      },
    },
    {
      name: "isPersonalOrder",
      type: "checkbox",
      defaultValue: false,
      label: adminLabel("Личный заказ", "Personal order"),
      admin: {
        description: adminLabel(
          "Toggle в чекауте (FR-5437): личный заказ company-contact, owner не видит.",
          "Checkout toggle (FR-5437): personal company-contact order, owner doesn't see.",
        ),
      },
    },
    // 057: Embedded consent record (152-ФЗ Art. 9)
    consentField(),
    // 051: Human-readable order number
    {
      name: "clientNumber",
      type: "text",
      unique: true,
      index: true,
      label: adminLabel("Номер заказа", "Order number"),
      admin: {
        readOnly: true,
        description: adminLabel(
          "Формат SO-YYYY-NNNN. Генерируется автоматически через PG SEQUENCE (051, FR-5101).",
          "Format SO-YYYY-NNNN. Auto-generated via PG SEQUENCE (051, FR-5101).",
        ),
      },
    },
    // 051: Reissue reason (audit trail, FR-5110)
    {
      name: "clientNumberReissueReason",
      type: "text",
      label: adminLabel("Причина перевыпуска номера", "Reissue reason"),
      admin: {
        readOnly: true,
        description: adminLabel(
          "Заполняется при ручном изменении clientNumber через admin-роут. ≥10 символов.",
          "Filled when reissuing number via admin route. ≥10 chars.",
        ),
        condition: (data) => Boolean(data?.clientNumberReissueReason),
      },
    },
    // 051: History of reissued client numbers (audit trail)
    {
      name: "clientNumberHistory",
      type: "array",
      label: adminLabel("История номеров", "Number history"),
      admin: { readOnly: true },
      fields: [
        { name: "oldNumber", type: "text", required: true },
        { name: "reissuedAt", type: "date", required: true },
        { name: "reason", type: "text" },
        { name: "actorEmail", type: "text" },
      ],
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
    {
      name: "marketingOptIn",
      type: "checkbox",
      defaultValue: false,
      label: adminLabel("Согласие на маркетинговые письма", "Marketing opt-in"),
      admin: {
        description: adminLabel(
          "Управляется через /preferences/[token]/. 152-ФЗ: opt-in явный, отзыв доступен в любой момент.",
          "Controlled via /preferences/[token]/.",
        ),
      },
    },
    {
      name: "messengerOptIn",
      type: "checkbox",
      defaultValue: false,
      label: adminLabel("Канал messenger (placeholder 050)", "Messenger opt-in (placeholder 050)"),
      admin: {
        description: adminLabel(
          "Согласие на messenger-канал. В 049 placeholder; реализация в спеке 050 (Telegram).",
          "Messenger consent placeholder for spec 050 (Telegram).",
        ),
      },
    },
    {
      name: "notifications",
      type: "array",
      label: adminLabel("Журнал уведомлений", "Notifications log"),
      admin: {
        description: adminLabel(
          "Зеркало notification-jobs для быстрого отображения в карточке заказа.",
          "Mirror of notification-jobs for quick lookup.",
        ),
      },
      fields: [
        { name: "notificationId", type: "text", required: true },
        { name: "event", type: "text", required: true },
        {
          name: "channel",
          type: "select",
          required: true,
          options: [
            { label: "email", value: "email" },
            { label: "messenger", value: "messenger" },
            { label: "crm", value: "crm" },
            { label: "admin_ui", value: "admin_ui" },
            { label: "dataLayer", value: "dataLayer" },
          ],
        },
        { name: "template", type: "text" },
        { name: "recipient", type: "text" },
        { name: "scheduledAt", type: "date" },
        { name: "sentAt", type: "date" },
        {
          name: "status",
          type: "select",
          required: true,
          options: [
            { label: "queued", value: "queued" },
            { label: "sent", value: "sent" },
            { label: "failed", value: "failed" },
            { label: "skipped", value: "skipped" },
          ],
        },
        { name: "errorMessage", type: "text" },
        { name: "externalRef", type: "text" },
        { name: "skipReason", type: "text" },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        // auto-fill customerLabel
        const c = data?.customer ?? originalDoc?.customer ?? {};
        const label = c.companyName?.trim() || c.fullName?.trim() || c.email?.trim() || "—";
        data.customerLabel = label;

        // generate publicToken once — 128-bit cryptographically secure (053 H5)
        if (operation === "create" && !data.publicToken) {
          // 16 bytes → 22-char URL-safe base64 (~128 bits of entropy).
          // Replaces the prior Math.random+Date.now combo which was guessable.
          data.publicToken = randomBytes(16).toString("base64url");
        }

        // 051: Generate clientNumber on create (if not already set)
        if (operation === "create" && !data.clientNumber) {
          try {
            const { generateClientNumber } = await import("../lib/lifecycle/client-number.ts");
            const result = await generateClientNumber(req.payload);
            data.clientNumber = result.clientNumber;
          } catch (err) {
            req.payload.logger.error("[orders] clientNumber generation failed:", err);
            // Don't block order creation — clientNumber can be backfilled later
          }
        }

        // 053 H4 fix: validate status transitions through the lifecycle state machine.
        // `reopenAuthorized` context flag opens completed → delivered/returned for
        // Returns.afterChange (FR-5316). Without this, leaving completed throws.
        if (operation === "update" && originalDoc && originalDoc.status && data.status && originalDoc.status !== data.status) {
          try {
            const { assertTransition } = await import("../lib/lifecycle/status-machine.ts");
            assertTransition(originalDoc.status, data.status, {
              reopenAuthorized: Boolean(req.context?.reopenAuthorized),
            });
          } catch (err) {
            req.payload.logger.error(`[orders] status transition rejected: ${err?.message ?? err}`);
            throw err;
          }
        }

        // 051: Immutability check on update (wasEverPaid guard)
        // Skip via req.context.skipImmutability for reissue endpoint and backfill
        if (operation === "update" && originalDoc && !req.context?.skipImmutability) {
          let isValidationError = false;
          try {
            const { checkPaidImmutability } = await import("../lib/lifecycle/immutability.ts");
            const result = checkPaidImmutability(data, originalDoc, operation);
            if (!result.allowed) {
              // Log the rejected mutation to admin-change-log
              try {
                await req.payload.create({
                  collection: "admin-change-log",
                  data: {
                    actorType: "system",
                    actorName: req.user?.email ?? "system:immutability-guard",
                    targetCollection: "orders",
                    targetId: String(originalDoc.id),
                    targetLabel: originalDoc.clientNumber ?? String(originalDoc.id),
                    changeType: "update",
                    diffSummary: "order_mutation_rejected",
                    afterSnapshot: {
                      violations: result.violations,
                      wasEverPaid: true,
                      attemptedFields: result.violations,
                    },
                  },
                });
              } catch {
                // AdminChangeLog may not exist yet — don't block the rejection
              }

              const { ValidationError } = await import("payload");
              isValidationError = true;
              throw new ValidationError({
                errors: result.violations.map((field) => ({
                  message: `Field "${field}" is immutable after payment`,
                  path: field,
                })),
              });
            }
          } catch (err) {
            // Re-throw ValidationError (it's the intentional block)
            if (isValidationError) throw err;
            req.payload.logger.error("[orders] immutability check failed:", err);
          }
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
        try {
          if (operation === "create") {
            req.payload.logger.info(
              `[orders] new ${doc.type} order ${doc.id} for ${doc.customerLabel ?? "—"}`,
            );

            // 054 FR-5421 + H6 fix: backfill customerId on guest-order create
            // when an existing Customer has the same email — but ONLY if the
            // creation came from a trusted source. Otherwise an anonymous POST
            // to /api/orders with someone else's email would silently attach
            // a fraudulent order to their account.
            //
            // Trust sources:
            //  - admin user (req.user) — manager-created order
            //  - customer session (req.context.customerSessionVerified) — set by
            //    the future logged-in checkout flow
            //  - trusted internal cart conversion (req.context.fromCartConversion)
            //    — set by POST /api/orders when a valid cart cookie matches
            const trusted =
              Boolean(req.user) ||
              Boolean(req.context?.customerSessionVerified) ||
              Boolean(req.context?.fromCartConversion);

            if (trusted && !doc.customerId && doc.customer?.email) {
              try {
                const normEmail = String(doc.customer.email).trim().toLowerCase();
                const found = await req.payload.find({
                  collection: "customers",
                  where: {
                    and: [
                      { email: { equals: normEmail } },
                      { deletedAt: { exists: false } },
                    ],
                  },
                  limit: 1,
                  overrideAccess: true,
                });
                const customerDoc = found.docs[0];
                if (customerDoc) {
                  await req.payload.update({
                    collection: "orders",
                    id: doc.id,
                    data: { customerId: customerDoc.id },
                    context: { skipImmutability: true },
                    overrideAccess: true,
                  });
                  req.payload.logger.info(
                    `[orders] FR-5421 backfill: linked order=${doc.id} → customer=${customerDoc.id}`,
                  );
                }
              } catch (err) {
                req.payload.logger.error(
                  `[orders] FR-5421 customerId backfill failed: ${err?.message ?? err}`,
                );
              }
            } else if (!trusted && !doc.customerId && doc.customer?.email) {
              req.payload.logger.info(
                `[orders] FR-5421 skipped: untrusted source for order=${doc.id} (anti-hijack)`,
              );
            }
          } else if (previousDoc && previousDoc.status !== doc.status) {
            req.payload.logger.info(
              `[orders] ${doc.id} status ${previousDoc.status} → ${doc.status}`,
            );
          }
        } catch (error) {
          req.payload.logger.error("[orders] afterChange notify failed:", error);
        }
      },
    ],
  },
  timestamps: true,
};
