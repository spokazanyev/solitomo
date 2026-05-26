import type { CollectionConfig } from "payload";

import { consentField } from "../lib/consent/consent-field";
import { adminGroups, adminLabel } from "./admin-i18n.js";

/**
 * Carts collection (052 data-model §1).
 *
 * Cart lives 30 days from last activity, then expires; 90 days after that, hard-deleted (GDPR).
 * Token in HTTP-only cookie. Items snapshot priceAtAdd. Conversion → Order, recoverable.
 */
export const Carts: CollectionConfig = {
  slug: "carts",
  labels: {
    plural: adminLabel("Корзины", "Carts"),
    singular: adminLabel("Корзина", "Cart"),
  },
  admin: {
    group: adminGroups.sales,
    useAsTitle: "cartToken",
    defaultColumns: [
      "cartToken",
      "customerEmail",
      "status",
      "lastActivityAt",
      "sourcePage",
    ],
    description: adminLabel(
      "Корзины покупателей. После 30 дней без активности → expired, через 90 дней → hard delete (GDPR).",
      "Customer carts. After 30 days idle → expired, 90 days later → hard delete (GDPR).",
    ),
  },
  access: {
    // Admin (Payload session) sees all. Public access happens through dedicated API routes
    // that use local Payload API (which bypasses access control with overrideAccess: true).
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    // -------- Identity --------
    {
      name: "cartToken",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: adminLabel("Токен корзины", "Cart token"),
      admin: {
        readOnly: true,
        description: adminLabel(
          "URL-safe 128-bit random; HTTP-only cookie на клиенте.",
          "URL-safe 128-bit random; HTTP-only cookie on client.",
        ),
      },
    },

    // -------- Owner (optional, forward-ref для 054) --------
    {
      name: "customerEmail",
      type: "email",
      index: true,
      label: adminLabel("Email клиента", "Customer email"),
      admin: {
        description: adminLabel(
          "Привязка по email из checkout (если введён).",
          "Linked email from checkout (if provided).",
        ),
      },
    },
    // 054 FR-5404: upgraded from forward-ref text → real relationships now that
    // Customers/Companies collections exist.
    {
      name: "customerId",
      type: "relationship",
      relationTo: "customers",
      label: adminLabel("Клиент", "Customer"),
      admin: {
        description: adminLabel(
          "FK на customers. Null для гостевых корзин до merge при логине.",
          "FK to customers. Null for guest carts before merge on login.",
        ),
      },
    },
    {
      name: "companyId",
      type: "relationship",
      relationTo: "companies",
      label: adminLabel("Компания", "Company"),
      admin: {
        description: adminLabel(
          "FK на companies. Nullable.",
          "FK to companies. Nullable.",
        ),
      },
    },

    // 057: Embedded consent record (152-ФЗ Art. 9)
    consentField(),

    // -------- Consent --------
    {
      name: "marketingOptIn",
      type: "checkbox",
      defaultValue: false,
      label: adminLabel("Согласие на маркетинговые рассылки", "Marketing opt-in"),
      admin: {
        description: adminLabel(
          "152-ФЗ согласие. Источники: checkbox в checkout S04 ИЛИ consent-banner на /cart/restore/. FR-5224a.",
          "GDPR/Russian PD law consent. Sources: checkout S04 checkbox OR restore-page banner.",
        ),
      },
    },

    // -------- Analytics flag --------
    {
      name: "synthetic",
      type: "checkbox",
      defaultValue: false,
      index: true,
      label: adminLabel("Синтетическая (legacy)", "Synthetic (legacy)"),
      admin: {
        readOnly: true,
        description: adminLabel(
          "Создана автоматически в /api/orders для legacy-флоу (без cartToken). " +
            "Должна исключаться из funnel-аналитики (createdAt==convertedAt).",
          "Auto-created by /api/orders for legacy flow (no cartToken). Exclude from funnel analytics.",
        ),
      },
    },

    // -------- Items --------
    {
      name: "items",
      type: "array",
      minRows: 0,
      maxRows: 100,
      label: adminLabel("Позиции", "Items"),
      fields: [
        { name: "sku", type: "text", required: true, label: adminLabel("Артикул", "SKU") },
        { name: "name", type: "text", required: true, label: adminLabel("Название", "Name") },
        { name: "qty", type: "number", required: true, min: 1, max: 9999, label: adminLabel("Количество", "Quantity") },
        {
          name: "priceAtAdd",
          type: "number",
          label: adminLabel("Цена на момент добавления, ₽", "Price at add, ₽"),
          admin: {
            description: adminLabel(
              "Snapshot цены на момент добавления; null если RFQ-only.",
              "Snapshot of price at add time; null for RFQ-only.",
            ),
          },
        },
        { name: "addedAt", type: "date", required: true, label: adminLabel("Добавлен", "Added at") },
        {
          name: "productId",
          type: "relationship",
          relationTo: "products",
          label: adminLabel("Товар", "Product"),
        },
        { name: "slug", type: "text" },
        { name: "image", type: "text" },
        {
          name: "warning",
          type: "select",
          defaultValue: "none",
          options: [
            { label: adminLabel("Нет", "None"), value: "none" },
            { label: adminLabel("Удалён из каталога", "Removed"), value: "removed" },
            { label: adminLabel("Цена изменилась", "Price changed"), value: "price_changed" },
            { label: adminLabel("Мало на складе", "Stock low"), value: "stock_low" },
          ],
          admin: {
            description: adminLabel(
              "Выставляется при GET, если каталог изменился. FR-5232.",
              "Set on GET if catalog has changed. FR-5232.",
            ),
          },
        },
      ],
    },

    // -------- Totals (denormalized) --------
    {
      type: "group",
      name: "totals",
      label: adminLabel("Итоги", "Totals"),
      admin: { readOnly: true },
      fields: [
        { name: "itemCount", type: "number", defaultValue: 0, label: adminLabel("Количество позиций", "Item count") },
        { name: "subtotal", type: "number", defaultValue: 0, label: adminLabel("Сумма, ₽", "Subtotal, ₽") },
        { name: "knownPriceCount", type: "number", defaultValue: 0 },
        { name: "unknownPriceCount", type: "number", defaultValue: 0 },
      ],
    },

    // -------- Lifecycle --------
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      index: true,
      label: adminLabel("Статус", "Status"),
      options: [
        { label: adminLabel("Активна", "Active"), value: "active" },
        { label: adminLabel("Покинута", "Abandoned"), value: "abandoned" },
        { label: adminLabel("Конвертирована в заказ", "Converted"), value: "converted" },
        { label: adminLabel("Устарела", "Expired"), value: "expired" },
        { label: adminLabel("Слита", "Merged"), value: "merged" },
      ],
    },
    {
      name: "convertedToOrderId",
      type: "relationship",
      relationTo: "orders",
      label: adminLabel("Конвертирован в заказ", "Converted to order"),
      admin: { description: adminLabel("Заполняется при status=converted.", "Set when status=converted.") },
    },
    {
      name: "mergedIntoId",
      type: "relationship",
      relationTo: "carts",
      label: adminLabel("Слит в", "Merged into"),
      admin: { description: adminLabel("US6 (054): target cart при merge'е.", "US6 (054): merge target.") },
    },

    // -------- Timestamps --------
    {
      name: "lastActivityAt",
      type: "date",
      required: true,
      index: true,
      label: adminLabel("Последняя активность", "Last activity at"),
      defaultValue: () => new Date().toISOString(),
    },
    { name: "abandonedAt", type: "date", label: adminLabel("Покинут в", "Abandoned at") },
    { name: "convertedAt", type: "date", label: adminLabel("Конвертирован в", "Converted at") },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      index: true,
      label: adminLabel("Истекает", "Expires at"),
      admin: { description: adminLabel("Вычисляется как lastActivityAt + 30d.", "Computed as lastActivityAt + 30d.") },
      defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },

    // -------- Attribution --------
    {
      name: "sourcePage",
      type: "text",
      label: adminLabel("Страница-источник", "Source page"),
      admin: { description: adminLabel("Pathname, где произошёл первый add_to_cart.", "Pathname of first add_to_cart.") },
    },
    {
      type: "group",
      name: "utm",
      label: adminLabel("UTM", "UTM"),
      fields: [
        { name: "source", type: "text" },
        { name: "medium", type: "text" },
        { name: "campaign", type: "text" },
        { name: "term", type: "text" },
        { name: "content", type: "text" },
      ],
    },

    // -------- Audit (PII-safe) --------
    {
      name: "userAgent",
      type: "text",
      label: adminLabel("User Agent", "User Agent"),
      admin: { description: adminLabel("Маскированный UA первого add'а.", "Masked UA of first add.") },
    },
    {
      name: "ipHash",
      type: "text",
      label: adminLabel("IP hash", "IP hash"),
      admin: { description: adminLabel("SHA-256 от IP — GDPR-friendly.", "SHA-256 of IP — GDPR-friendly.") },
    },
    // 058 T005: attribution + cohort data (FR-031, FR-180, FR-022)
    {
      type: "group",
      name: "attributionFirstTouch",
      label: adminLabel("Атрибуция: первое касание", "Attribution: first touch"),
      admin: {
        description: adminLabel(
          "FR-031: копируется из cookie _solitomo_attribution при создании корзины. Не перезаписывается.",
          "FR-031: copied from _solitomo_attribution cookie on cart creation.",
        ),
      },
      fields: [
        { name: "utmSource", type: "text" },
        { name: "utmMedium", type: "text" },
        { name: "utmCampaign", type: "text" },
        { name: "utmContent", type: "text" },
        { name: "utmTerm", type: "text" },
        { name: "yclid", type: "text" },
        { name: "gclid", type: "text" },
        { name: "openstat", type: "text" },
        { name: "from", type: "text" },
        { name: "refererHost", type: "text" },
        { name: "acquisitionChannel", type: "text" },
        { name: "acquisitionQuery", type: "text", maxLength: 200 },
        { name: "capturedAt", type: "date" },
      ],
    },
    {
      name: "ymClientId",
      type: "text",
      label: adminLabel("Yandex.Metrika _ym_uid", "Yandex.Metrika _ym_uid"),
    },
    {
      name: "gaClientId",
      type: "text",
      label: adminLabel("GA _ga client id", "GA _ga client id"),
    },
    {
      name: "firstSeenAt",
      type: "date",
      label: adminLabel("Первое касание (cookie)", "First seen (cookie)"),
    },
    {
      name: "userTypeAtCreation",
      type: "select",
      options: [
        { label: "anonymous", value: "anonymous" },
        { label: "customer", value: "customer" },
        { label: "legal_entity", value: "legal_entity" },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        // Recompute totals from items (server-side authoritative)
        if (Array.isArray(data.items)) {
          let itemCount = 0;
          let subtotal = 0;
          let knownPriceCount = 0;
          let unknownPriceCount = 0;
          for (const item of data.items as Array<{ qty?: number; priceAtAdd?: number | null }>) {
            const qty = Number.isFinite(item.qty) ? Math.max(0, Math.floor(item.qty ?? 0)) : 0;
            itemCount += qty;
            if (typeof item.priceAtAdd === "number" && Number.isFinite(item.priceAtAdd)) {
              subtotal += item.priceAtAdd * qty;
              knownPriceCount += 1;
            } else {
              unknownPriceCount += 1;
            }
          }
          subtotal = Math.round(subtotal * 100) / 100;
          data.totals = { itemCount, subtotal, knownPriceCount, unknownPriceCount };
        }

        // Maintain expiresAt = lastActivityAt + 30d
        if (data.lastActivityAt) {
          const days = Number(process.env.CART_EXPIRY_DAYS ?? 30);
          data.expiresAt = new Date(
            new Date(data.lastActivityAt as string).getTime() + days * 24 * 60 * 60 * 1000,
          ).toISOString();
        }

        // On create — ensure required defaults
        if (operation === "create") {
          if (!data.lastActivityAt) data.lastActivityAt = new Date().toISOString();
          if (!data.status) data.status = "active";

          // 058 T038: copy attribution from cookies (FR-031) — first-touch фиксируется при создании корзины.
          // PayloadRequest не имеет .cookies, читаем через headers.get('cookie') и парсим.
          if (!data.attributionFirstTouch && req?.headers?.get) {
            try {
              const cookieHeader = req.headers.get("cookie") ?? "";
              const getCookie = (name: string): string | null => {
                const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
                return m && m[1] ? m[1] : null;
              };
              const attrVal = getCookie("_solitomo_attribution");
              if (attrVal) {
                const { decodeAttributionCookie } = await import(
                  "../lib/analytics/attribution.ts"
                );
                const touchpoint = decodeAttributionCookie(attrVal);
                if (touchpoint) {
                  data.attributionFirstTouch = {
                    ...(touchpoint.utmSource ? { utmSource: touchpoint.utmSource } : {}),
                    ...(touchpoint.utmMedium ? { utmMedium: touchpoint.utmMedium } : {}),
                    ...(touchpoint.utmCampaign ? { utmCampaign: touchpoint.utmCampaign } : {}),
                    ...(touchpoint.utmContent ? { utmContent: touchpoint.utmContent } : {}),
                    ...(touchpoint.utmTerm ? { utmTerm: touchpoint.utmTerm } : {}),
                    ...(touchpoint.yclid ? { yclid: touchpoint.yclid } : {}),
                    ...(touchpoint.gclid ? { gclid: touchpoint.gclid } : {}),
                    ...(touchpoint.openstat ? { openstat: touchpoint.openstat } : {}),
                    ...(touchpoint.from ? { from: touchpoint.from } : {}),
                    ...(touchpoint.refererHost ? { refererHost: touchpoint.refererHost } : {}),
                    ...(touchpoint.acquisitionChannel
                      ? { acquisitionChannel: touchpoint.acquisitionChannel }
                      : {}),
                    ...(touchpoint.acquisitionQuery
                      ? { acquisitionQuery: touchpoint.acquisitionQuery }
                      : {}),
                    capturedAt: touchpoint.capturedAt,
                  };
                }
              }
              const firstSeenVal = getCookie("_solitomo_first_seen");
              if (firstSeenVal && !data.firstSeenAt) {
                data.firstSeenAt = decodeURIComponent(firstSeenVal);
              }
              if (getCookie("_solitomo_legal_entity_flag") && !data.userTypeAtCreation) {
                data.userTypeAtCreation = "legal_entity";
              }
            } catch {
              // ignore — не блокируем создание корзины
            }
          }
        }

        return data;
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // Emit cart.* domain events
        try {
          const { emitDomainEvent } = await import("../lib/lifecycle/events");
          const cartSnapshot = {
            id: String(doc.id),
            cartToken: String(doc.cartToken ?? ""),
            status: String(doc.status ?? "active"),
            customerEmail: doc.customerEmail as string | undefined,
            customerId: doc.customerId as string | undefined,
            // C1 fix: include marketingOptIn so notification emitter can check consent
            marketingOptIn: Boolean(doc.marketingOptIn),
            itemCount: (doc.totals as { itemCount?: number } | undefined)?.itemCount ?? 0,
            totalAmount: (doc.totals as { subtotal?: number } | undefined)?.subtotal ?? 0,
            lastActivityAt: doc.lastActivityAt as string | undefined,
            abandonedAt: doc.abandonedAt as string | undefined,
            convertedToOrderId: doc.convertedToOrderId as string | undefined,
          };

          if (operation === "create") {
            await emitDomainEvent({ kind: "cart.created", cart: cartSnapshot });
          } else if (previousDoc) {
            const prevStatus = previousDoc.status as string | undefined;
            const newStatus = doc.status as string | undefined;
            if (prevStatus !== newStatus) {
              const kindMap: Record<string, "cart.abandoned" | "cart.converted" | "cart.expired" | "cart.merged" | "cart.recovered"> = {
                abandoned: "cart.abandoned",
                converted: "cart.converted",
                expired: "cart.expired",
                merged: "cart.merged",
              };
              const kind = newStatus ? kindMap[newStatus] : undefined;
              if (kind) {
                await emitDomainEvent({ kind, cart: cartSnapshot });
              } else if (prevStatus === "abandoned" && newStatus === "active") {
                await emitDomainEvent({ kind: "cart.recovered", cart: cartSnapshot });
              }
            } else {
              await emitDomainEvent({ kind: "cart.updated", cart: cartSnapshot });
            }
          }
        } catch (err) {
          req.payload.logger.error(`[carts] afterChange emit failed: ${(err as Error)?.message ?? String(err)}`);
        }
      },
    ],
  },
  timestamps: true,
};

export default Carts;
