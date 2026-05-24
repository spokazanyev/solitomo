import type { CollectionConfig } from "payload";

import { adminGroups, adminLabel } from "./admin-i18n.js";

/**
 * Returns collection (053 data-model §1).
 *
 * Lifecycle: requested → approved → received → refunded (+ rejected/cancelled).
 * Atomic RT-YYYY-NNNN numbering via PG SEQUENCE.
 *
 * Source of truth for refund tracking; Orders.{hasReturns, returnsCount,
 * totalRefunded, disputeFlag} are computed aggregates synced via afterChange.
 */
export const Returns: CollectionConfig = {
  slug: "returns",
  labels: {
    plural: adminLabel("Возвраты", "Returns"),
    singular: adminLabel("Возврат", "Return"),
  },
  admin: {
    group: adminGroups.sales,
    useAsTitle: "returnNumber",
    defaultColumns: ["returnNumber", "orderId", "status", "refundAmount", "requestedAt"],
    description: adminLabel(
      "Возвраты и refund'ы. Жизненный цикл и интеграции в spec 053.",
      "Returns and refunds. Lifecycle and integrations per spec 053.",
    ),
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: () => false,
  },
  fields: [
    // ─── Identity ───
    {
      name: "returnNumber",
      type: "text",
      unique: true,
      index: true,
      label: adminLabel("Номер возврата", "Return number"),
      admin: {
        readOnly: true,
        description: adminLabel(
          "Формат RT-YYYY-NNNN, генерируется автоматически через PG SEQUENCE.",
          "Format RT-YYYY-NNNN, auto-generated via PG SEQUENCE.",
        ),
      },
    },
    {
      name: "orderId",
      type: "relationship",
      relationTo: "orders",
      required: true,
      index: true,
      label: adminLabel("Заказ", "Order"),
    },
    {
      name: "orderNumberSnapshot",
      type: "text",
      label: adminLabel("Snapshot номера заказа", "Order number snapshot"),
      admin: {
        readOnly: true,
        description: adminLabel(
          "Snapshot Order.clientNumber на момент создания (immutable).",
          "Order.clientNumber snapshot at creation time (immutable).",
        ),
      },
    },

    // ─── Items ───
    {
      name: "items",
      type: "array",
      required: true,
      minRows: 1,
      label: adminLabel("Позиции возврата", "Return items"),
      fields: [
        { name: "orderItemSku", type: "text", required: true, label: adminLabel("Артикул", "SKU") },
        { name: "productName", type: "text", label: adminLabel("Название", "Product name") },
        { name: "qty", type: "number", required: true, min: 1, label: adminLabel("Количество", "Quantity") },
        {
          name: "priceSnapshot",
          type: "number",
          required: true,
          label: adminLabel("Цена за единицу", "Price per unit"),
          admin: {
            description: adminLabel(
              "Цена за 1 шт в копейках, snapshot из Order.",
              "Per-unit price in kopecks, snapshot from Order.",
            ),
          },
        },
        {
          name: "vatRate",
          type: "text",
          label: adminLabel("Ставка НДС", "VAT rate"),
          admin: { description: adminLabel("Snapshot ('20', '10', '0', '-1' без НДС).", "Snapshot ('20', '10', '0', '-1' no VAT).") },
        },
        { name: "reason", type: "text", label: adminLabel("Причина (по позиции)", "Reason (per item)") },
        {
          name: "condition",
          type: "select",
          label: adminLabel("Состояние", "Condition"),
          options: [
            { label: adminLabel("Не вскрывался", "Unopened"), value: "unopened" },
            { label: adminLabel("Вскрыт, не использовался", "Opened, unused"), value: "opened_unused" },
            { label: adminLabel("Использовался", "Used"), value: "used" },
            { label: adminLabel("С дефектом", "Defective"), value: "defective" },
          ],
        },
        {
          name: "photos",
          type: "upload",
          relationTo: "media",
          hasMany: true,
          label: adminLabel("Фото", "Photos"),
        },
      ],
    },

    // ─── Reasons ───
    {
      name: "reasonCategory",
      type: "select",
      required: true,
      label: adminLabel("Категория причины", "Reason category"),
      options: [
        { label: adminLabel("Дефект / брак", "Defect"), value: "defect" },
        { label: adminLabel("Не то прислали", "Wrong item"), value: "wrong-item" },
        { label: adminLabel("Передумал / не нужен", "Not needed"), value: "not-needed" },
        { label: adminLabel("Другое", "Other"), value: "other" },
      ],
      index: true,
    },
    { name: "customerNotes", type: "textarea", label: adminLabel("Комментарий клиента", "Customer notes") },
    { name: "managerNotes", type: "textarea", label: adminLabel("Внутренний комментарий менеджера", "Manager notes") },

    // ─── Refund ───
    {
      name: "refundAmount",
      type: "number",
      required: true,
      label: adminLabel("Сумма возврата", "Refund amount"),
      admin: { description: adminLabel("В копейках.", "In kopecks.") },
    },
    {
      name: "refundMethod",
      type: "select",
      required: true,
      defaultValue: "card-original",
      label: adminLabel("Способ возврата", "Refund method"),
      options: [
        { label: adminLabel("На карту оплаты (ЮKassa)", "Card (YooKassa)"), value: "card-original" },
        { label: adminLabel("Банковский перевод", "Bank transfer"), value: "bank-transfer" },
        { label: adminLabel("Другое", "Other"), value: "other" },
      ],
    },
    {
      name: "refundProviderRef",
      type: "text",
      label: adminLabel("ID refund у провайдера", "Provider refund ID"),
      admin: { readOnly: true },
    },
    {
      name: "manualRefundConfirmation",
      type: "group",
      label: adminLabel("Ручное подтверждение возврата", "Manual refund confirmation"),
      admin: { condition: (data) => data?.refundMethod !== "card-original" },
      fields: [
        { name: "byUser", type: "relationship", relationTo: "users" },
        { name: "at", type: "date" },
        { name: "paymentDoc", type: "text", label: adminLabel("Номер платёжки", "Payment doc number") },
        { name: "bankAccount", type: "text", label: adminLabel("Расчётный счёт", "Bank account") },
        { name: "bik", type: "text", label: adminLabel("БИК", "BIK") },
        { name: "recipientName", type: "text", label: adminLabel("Наименование получателя", "Recipient name") },
        { name: "purpose", type: "text", label: adminLabel("Назначение платежа", "Payment purpose") },
      ],
    },

    // ─── Return shipment (ApiShip) ───
    {
      name: "returnMethod",
      type: "select",
      defaultValue: "self_post",
      label: adminLabel("Способ возврата товара", "Return shipment method"),
      options: [
        { label: adminLabel("Самостоятельная отправка почтой", "Self-post"), value: "self_post" },
        { label: adminLabel("Через службу доставки (ApiShip)", "Pickup via courier"), value: "pickup_via_courier" },
        { label: adminLabel("Самопривоз в офис", "Drop-off"), value: "drop_off" },
      ],
    },
    { name: "apiShipReturnOrderId", type: "text", admin: { readOnly: true } },
    { name: "returnLabelUrl", type: "text", admin: { readOnly: true } },

    // ─── Credit memo (юрлицо) ───
    { name: "creditMemoNumber", type: "text", index: true, admin: { readOnly: true } },
    { name: "creditMemoPdfUrl", type: "text", admin: { readOnly: true } },
    { name: "creditMemoIssuedAt", type: "date", admin: { readOnly: true } },
    {
      name: "documentsError",
      type: "text",
      label: adminLabel("Ошибка генерации документов", "Documents error"),
      admin: { readOnly: true },
    },

    // ─── Fiscal (54-ФЗ) ───
    {
      name: "correctionReceiptStatus",
      type: "select",
      defaultValue: "pending",
      label: adminLabel("Статус чека коррекции", "Correction receipt status"),
      options: [
        { label: adminLabel("В очереди", "Pending"), value: "pending" },
        { label: adminLabel("Сформирован", "Issued"), value: "issued" },
        { label: adminLabel("Не требуется", "Not required"), value: "not_required" },
        { label: adminLabel("Ошибка", "Error"), value: "error" },
      ],
    },
    { name: "correctionReceiptRef", type: "text", admin: { readOnly: true } },

    // ─── Status & lifecycle ───
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "requested",
      index: true,
      label: adminLabel("Статус", "Status"),
      options: [
        { label: adminLabel("Запрошен", "Requested"), value: "requested" },
        { label: adminLabel("Одобрен", "Approved"), value: "approved" },
        { label: adminLabel("Товар принят", "Received"), value: "received" },
        { label: adminLabel("Деньги возвращены", "Refunded"), value: "refunded" },
        { label: adminLabel("Отклонён", "Rejected"), value: "rejected" },
        { label: adminLabel("Отменён", "Cancelled"), value: "cancelled" },
      ],
    },
    {
      name: "statusReason",
      type: "textarea",
      label: adminLabel("Обоснование статуса", "Status reason"),
      admin: {
        description: adminLabel(
          "Обязательно при rejected; для approved содержит пометки (например, outside_short_window).",
          "Required for rejected; for approved may contain markers (e.g. outside_short_window).",
        ),
      },
    },

    { name: "requestedAt", type: "date", required: true, defaultValue: () => new Date().toISOString() },
    { name: "approvedAt", type: "date", admin: { readOnly: true } },
    { name: "receivedAt", type: "date", admin: { readOnly: true } },
    { name: "refundedAt", type: "date", admin: { readOnly: true } },
    { name: "rejectedAt", type: "date", admin: { readOnly: true } },
    { name: "cancelledAt", type: "date", admin: { readOnly: true } },

    // ─── Idempotency / audit ───
    // M3 fix: unique constraint enforces dedup at the DB level — eliminates the
    // find→create race window for double-submit protection.
    {
      name: "clientRequestId",
      type: "text",
      index: true,
      unique: true,
      admin: {
        readOnly: true,
        description: adminLabel(
          "UUID от клиента — окно дедупликации 10 минут. DB-уникальный.",
          "Client-side UUID — 10 min deduplication window. DB-unique.",
        ),
      },
    },
    {
      name: "createdVia",
      type: "select",
      defaultValue: "customer-public",
      label: adminLabel("Источник создания", "Created via"),
      options: [
        { label: adminLabel("Публичная форма", "Customer public form"), value: "customer-public" },
        { label: adminLabel("Менеджером вручную", "Manager manual"), value: "manager-manual" },
        { label: adminLabel("API", "API"), value: "api" },
      ],
    },
    {
      name: "history",
      type: "array",
      label: adminLabel("История переходов", "Transition history"),
      admin: { readOnly: true },
      fields: [
        { name: "at", type: "date" },
        { name: "fromStatus", type: "text" },
        { name: "toStatus", type: "text" },
        { name: "byUser", type: "relationship", relationTo: "users" },
        { name: "reason", type: "text" },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        // On create: generate returnNumber + capture orderNumberSnapshot
        if (operation === "create") {
          if (!data.returnNumber) {
            try {
              const { generateReturnNumber } = await import("../lib/returns/number-generator");
              const result = await generateReturnNumber(req.payload);
              data.returnNumber = result.returnNumber;
            } catch (err) {
              req.payload.logger.error(
                `[returns] number generation failed: ${(err as Error)?.message ?? String(err)}`,
              );
              throw err;
            }
          }
          if (!data.requestedAt) data.requestedAt = new Date().toISOString();
          if (!data.status) data.status = "requested";

          // Snapshot orderNumber
          if (data.orderId && !data.orderNumberSnapshot) {
            try {
              const order = (await req.payload.findByID({
                collection: "orders",
                id: typeof data.orderId === "string" ? data.orderId : String(data.orderId),
              })) as unknown as Record<string, unknown>;
              if (typeof order.clientNumber === "string") {
                data.orderNumberSnapshot = order.clientNumber;
              }
            } catch {
              // Order may not exist yet under some test flows — let the relationship validation fail later
            }
          }
        }

        // On update: validate state-machine transition
        if (operation === "update" && originalDoc) {
          const prevStatus = originalDoc.status;
          const newStatus = data.status;
          if (prevStatus && newStatus && prevStatus !== newStatus) {
            const { assertTransition } = await import("../lib/returns/state-machine");
            try {
              assertTransition(prevStatus, newStatus, data.statusReason);
            } catch (err) {
              req.payload.logger.error(
                `[returns] invalid transition ${prevStatus} → ${newStatus}: ${(err as Error)?.message}`,
              );
              throw err;
            }

            // Auto-fill the corresponding *At timestamp
            const now = new Date().toISOString();
            if (newStatus === "approved" && !data.approvedAt) data.approvedAt = now;
            if (newStatus === "received" && !data.receivedAt) data.receivedAt = now;
            if (newStatus === "refunded" && !data.refundedAt) data.refundedAt = now;
            if (newStatus === "rejected" && !data.rejectedAt) data.rejectedAt = now;
            if (newStatus === "cancelled" && !data.cancelledAt) data.cancelledAt = now;

            // Append to history
            const prevHistory = Array.isArray(data.history) ? data.history : [];
            data.history = [
              ...prevHistory,
              {
                at: now,
                fromStatus: prevStatus,
                toStatus: newStatus,
                byUser: req.user?.id,
                reason: data.statusReason ?? null,
              },
            ];
          }
        }

        return data;
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        try {
          const { buildReturnSnapshot, emitReturnEvent } = await import(
            "../lib/returns/events"
          );
          const { recomputeOrderReturnAggregates, maybeMarkOrderReturned, maybeReopenCompletedOrder } =
            await import("../lib/returns/repository");

          const orderId = typeof doc.orderId === "string"
            ? doc.orderId
            : typeof doc.orderId === "number"
              ? String(doc.orderId)
              : (doc.orderId as { id?: string | number })?.id !== undefined
                ? String((doc.orderId as { id?: string | number }).id)
                : undefined;

          // C3 fix: eagerly load Order so the snapshot carries customerEmail + clientNumber
          // (without this, customer-recipient rules T-011..T-014 never resolve a recipient).
          let customerEmail: string | undefined;
          let orderClientNumber: string | undefined;
          if (orderId) {
            try {
              const order = (await req.payload.findByID({
                collection: "orders",
                id: orderId,
              })) as unknown as Record<string, unknown>;
              const customer = order.customer as { email?: string } | undefined;
              customerEmail = customer?.email;
              if (typeof order.clientNumber === "string") orderClientNumber = order.clientNumber;
            } catch {
              // Order load failure shouldn't block event emission; templates degrade gracefully
            }
          }
          const snapshot = buildReturnSnapshot(doc, { customerEmail, orderClientNumber });

          if (operation === "create") {
            // FR-5316: reopen completed → delivered when first Return is filed
            if (orderId) await maybeReopenCompletedOrder(req.payload, orderId);
            await emitReturnEvent("return.created", snapshot);
          } else if (previousDoc && previousDoc.status !== doc.status) {
            const kindMap: Record<string, Parameters<typeof emitReturnEvent>[0]> = {
              approved: "return.approved",
              rejected: "return.rejected",
              received: "return.received",
              refunded: "return.refunded",
              cancelled: "return.cancelled",
            };
            const kind = kindMap[doc.status as string];
            if (kind) {
              await emitReturnEvent(kind, snapshot, {
                statusFrom: previousDoc.status as string,
                statusTo: doc.status as string,
              });
            }
          }

          // Re-sync Order aggregates (every change — hook is idempotent).
          // M7 fix: skip if caller passed `skipAggregateRecompute` context
          // (e.g. cron history-only updates).
          if (orderId && !req.context?.skipAggregateRecompute) {
            const agg = await recomputeOrderReturnAggregates(req.payload, orderId);
            // FR-5315: full refund → Order.status = returned
            if (doc.status === "refunded") {
              await maybeMarkOrderReturned(req.payload, orderId, agg);
            }
          }
        } catch (err) {
          req.payload.logger.error(
            `[returns] afterChange failed: ${(err as Error)?.message ?? String(err)}`,
          );
        }
      },
    ],
  },
  timestamps: true,
};

export default Returns;
