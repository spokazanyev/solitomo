import type { CollectionConfig } from "payload";

import { adminGroups, adminLabel } from "./admin-i18n.js";

/**
 * Customers collection (054 data-model §1).
 *
 * Customer-facing auth-collection (distinct from admin Users).
 * Session cookie name: `customer_session` (must be explicit per FR-5412a
 * to avoid collision with admin `payload-token`).
 *
 * Lifecycle states:
 *   - email-only      — created on first magic-link click, no password
 *   - password-set    — explicit register or "set password" from magic session
 *   - invited-stub    — B2B invitation pending acceptance (US4, deferred)
 *   - deleted         — soft-deleted, PII anonymized (GDPR)
 */
export const Customers: CollectionConfig = {
  slug: "customers",
  labels: {
    plural: adminLabel("Клиенты", "Customers"),
    singular: adminLabel("Клиент", "Customer"),
  },
  auth: {
    // 054 FR-5412 + FR-5412a: explicit cookie name to prevent collision with admin payload-token
    cookies: {
      domain: process.env.COOKIE_DOMAIN,
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
    },
    tokenExpiration: Number(process.env.CUSTOMER_SESSION_TTL_HOURS ?? 24) * 60 * 60,
    useAPIKey: false,
    verify: false, // email confirmation is optional (Q3 resolved)
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000, // 15 min lockout after 5 failed attempts (FR-5416)
  },
  admin: {
    group: adminGroups.sales,
    useAsTitle: "email",
    defaultColumns: ["email", "fullName", "customerType", "companyId", "lastLoginAt"],
    description: adminLabel(
      "Клиенты-покупатели. Отдельная auth-collection, не пересекается с admin Users.",
      "Customer-facing auth collection, separate from admin Users.",
    ),
  },
  access: {
    // Admin (Users) sees all; customer self-service uses /api/customers/me which uses local API + overrideAccess
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    // ─── Email validity (extends auth email) ───
    {
      name: "emailValid",
      type: "checkbox",
      defaultValue: true,
      label: adminLabel("Email валиден", "Email valid"),
      admin: {
        description: adminLabel(
          "Помечается false после 3 hard bounce от провайдера (049).",
          "Flipped false after 3 hard bounces (049).",
        ),
      },
    },

    // ─── Profile ───
    { name: "firstName", type: "text", label: adminLabel("Имя", "First name") },
    { name: "lastName", type: "text", label: adminLabel("Фамилия", "Last name") },
    {
      name: "fullName",
      type: "text",
      label: adminLabel("ФИО", "Full name"),
      admin: {
        readOnly: true,
        description: adminLabel("Compute из firstName + lastName.", "Computed from firstName + lastName."),
      },
    },
    { name: "phone", type: "text", label: adminLabel("Телефон", "Phone") },
    {
      name: "phoneNormalized",
      type: "text",
      admin: {
        readOnly: true,
        description: adminLabel("E.164 формат (+7XXXXXXXXXX).", "E.164 format (+7XXXXXXXXXX)."),
      },
    },

    // ─── Account state (054 FR-5401) ───
    {
      name: "accountState",
      type: "select",
      required: true,
      defaultValue: "email-only",
      label: adminLabel("Состояние аккаунта", "Account state"),
      index: true,
      options: [
        { label: adminLabel("Email-only (magic-link, без пароля)", "Email-only"), value: "email-only" },
        { label: adminLabel("Пароль установлен", "Password set"), value: "password-set" },
        { label: adminLabel("Stub (приглашён)", "Invited stub"), value: "invited-stub" },
        { label: adminLabel("Удалён (GDPR)", "Deleted"), value: "deleted" },
      ],
    },

    // ─── Type + company ───
    {
      name: "customerType",
      type: "select",
      required: true,
      defaultValue: "individual",
      label: adminLabel("Тип клиента", "Customer type"),
      options: [
        { label: adminLabel("Физлицо", "Individual"), value: "individual" },
        { label: adminLabel("Контактное лицо юрлица", "Company contact"), value: "company-contact" },
      ],
    },
    {
      name: "companyId",
      type: "relationship",
      relationTo: "companies",
      index: true,
      label: adminLabel("Компания", "Company"),
      admin: {
        description: adminLabel(
          "Required если customerType=company-contact.",
          "Required if customerType=company-contact.",
        ),
      },
    },
    {
      name: "role",
      type: "select",
      defaultValue: "contact",
      label: adminLabel("Роль в компании", "Company role"),
      options: [
        { label: adminLabel("Владелец", "Owner"), value: "owner" },
        { label: adminLabel("Бухгалтер", "Accountant"), value: "accountant" },
        { label: adminLabel("Закупщик", "Purchaser"), value: "purchaser" },
        { label: adminLabel("Контакт (default)", "Contact"), value: "contact" },
      ],
    },

    // ─── Magic-link (FR-5411, RD-1) ───
    // 054 L6: field-level access.read = false hides tokens from Admin UI / REST.
    // Auth routes use local API + overrideAccess to bypass.
    {
      name: "magicLinkToken",
      type: "text",
      index: true,
      access: { read: () => false },
      admin: { readOnly: true, hidden: true },
    },
    { name: "magicLinkExpiresAt", type: "date", admin: { readOnly: true, hidden: true } },
    { name: "magicLinkConsumedAt", type: "date", admin: { readOnly: true, hidden: true } },
    { name: "magicLinkRequestedFromIp", type: "text", admin: { readOnly: true, hidden: true } },

    // ─── Password reset (US2a) ───
    {
      name: "resetPasswordToken",
      type: "text",
      index: true,
      access: { read: () => false },
      admin: { readOnly: true, hidden: true },
    },
    { name: "resetPasswordExpiresAt", type: "date", admin: { readOnly: true, hidden: true } },

    // ─── Addresses (FR-5430) ───
    {
      name: "addresses",
      type: "array",
      maxRows: 10,
      label: adminLabel("Адреса", "Addresses"),
      fields: [
        { name: "label", type: "text", required: true, label: adminLabel("Название", "Label") },
        { name: "city", type: "text", required: true },
        { name: "fullAddress", type: "textarea", required: true },
        { name: "postalCode", type: "text" },
        { name: "addressNormalized", type: "json", admin: { hidden: true } },
        { name: "isDefault", type: "checkbox", defaultValue: false },
      ],
    },

    // ─── Preferences (FR-5431, FR-5431a) ───
    {
      name: "marketingOptIn",
      type: "checkbox",
      defaultValue: false,
      label: adminLabel("Согласие на маркетинговые рассылки", "Marketing opt-in"),
    },
    {
      name: "messengerOptIn",
      type: "checkbox",
      defaultValue: false,
      label: adminLabel("Канал messenger (050)", "Messenger opt-in"),
    },
    {
      name: "languagePreference",
      type: "select",
      defaultValue: "ru",
      options: [
        { label: "ru", value: "ru" },
        { label: "en", value: "en" },
      ],
    },

    // ─── CRM refs (Twenty) ───
    { name: "crmPersonId", type: "text", admin: { readOnly: true } },
    { name: "crmLastSyncedAt", type: "date", admin: { readOnly: true } },
    {
      name: "crmLastSyncStatus",
      type: "select",
      admin: { readOnly: true },
      options: [
        { label: "queued", value: "queued" },
        { label: "in_progress", value: "in_progress" },
        { label: "success", value: "success" },
        { label: "failed", value: "failed" },
      ],
    },

    // ─── GDPR (FR-5444) ───
    {
      name: "gdprConsentAt",
      type: "date",
      admin: { readOnly: true, description: adminLabel("Дата согласия на обработку ПДн.", "Consent timestamp.") },
    },
    {
      name: "gdprConsentVersion",
      type: "text",
      defaultValue: "1.0",
      admin: { description: adminLabel("Версия privacy policy.", "Privacy policy version.") },
    },
    {
      name: "deletedAt",
      type: "date",
      index: true,
      admin: {
        readOnly: true,
        description: adminLabel(
          "Soft delete. ПДн обнуляются. Order.customer.* snapshot сохраняется.",
          "Soft delete. PII anonymized. Order.customer.* snapshot retained.",
        ),
      },
    },

    // ─── Activity ───
    { name: "lastLoginAt", type: "date", admin: { readOnly: true } },
    { name: "lastLoginIp", type: "text", admin: { readOnly: true } },
    { name: "lastLoginUserAgent", type: "text", admin: { readOnly: true } },
    { name: "loginCount", type: "number", defaultValue: 0, admin: { readOnly: true } },

    // ─── Invitation (US4 — deferred) ───
    { name: "invitedBy", type: "relationship", relationTo: "customers", admin: { hidden: true } },
    {
      name: "inviteToken",
      type: "text",
      access: { read: () => false }, // 054 L6
      admin: { readOnly: true, hidden: true },
    },
    { name: "inviteExpiresAt", type: "date", admin: { readOnly: true, hidden: true } },
    { name: "inviteAcceptedAt", type: "date", admin: { readOnly: true, hidden: true } },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // Compute fullName
        if (data.firstName !== undefined || data.lastName !== undefined) {
          const f = data.firstName ?? "";
          const l = data.lastName ?? "";
          data.fullName = `${f} ${l}`.trim();
        }

        // Normalize phone to E.164 (basic — strip non-digits, prepend +7 if RU)
        if (data.phone && typeof data.phone === "string") {
          const digits = data.phone.replace(/\D/g, "");
          if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
            data.phoneNormalized = `+7${digits.slice(1)}`;
          } else if (digits.length === 10) {
            data.phoneNormalized = `+7${digits}`;
          } else if (digits.length > 7) {
            data.phoneNormalized = `+${digits}`;
          }
        }

        // Ensure only one default address
        if (Array.isArray(data.addresses)) {
          const defaults = data.addresses.filter((a) => a?.isDefault);
          if (defaults.length > 1) {
            const firstIdx = data.addresses.findIndex((a) => a?.isDefault);
            data.addresses = data.addresses.map((a, i) => ({
              ...a,
              isDefault: i === firstIdx,
            }));
          }
        }

        // gdprConsentAt on create
        if (operation === "create" && !data.gdprConsentAt) {
          data.gdprConsentAt = new Date().toISOString();
        }

        return data;
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        try {
          const { emitDomainEvent } = await import("../lib/lifecycle/events");
          const snapshot = {
            id: String(doc.id),
            email: String(doc.email),
            fullName: typeof doc.fullName === "string" ? doc.fullName : undefined,
            customerType: doc.customerType as "individual" | "company-contact" | undefined,
            companyId:
              typeof doc.companyId === "string"
                ? doc.companyId
                : (doc.companyId as { id?: string | number } | undefined)?.id !== undefined
                  ? String((doc.companyId as { id: string | number }).id)
                  : undefined,
            role: doc.role as "owner" | "accountant" | "purchaser" | "contact" | undefined,
            accountState: doc.accountState as
              | "email-only"
              | "password-set"
              | "invited-stub"
              | "deleted"
              | undefined,
            marketingOptIn: Boolean(doc.marketingOptIn),
            messengerOptIn: Boolean(doc.messengerOptIn),
            emailValid: Boolean(doc.emailValid),
          };

          if (operation === "create") {
            await emitDomainEvent({ kind: "customer.created", customer: snapshot });

            // 054 FR-5420: on first Customer creation, backfill historical Orders
            // (and Returns) that match this email and have no customerId yet.
            try {
              const email = String(doc.email).toLowerCase();
              const ordersResult = await req.payload.update({
                collection: "orders",
                where: {
                  and: [
                    { "customer.email": { equals: email } },
                    { customerId: { exists: false } },
                  ],
                } as never,
                data: { customerId: doc.id } as never,
                context: { skipImmutability: true } as never,
                overrideAccess: true,
              });
              const updatedCount = Array.isArray((ordersResult as { docs?: unknown[] }).docs)
                ? (ordersResult as { docs: unknown[] }).docs.length
                : 0;
              if (updatedCount > 0) {
                req.payload.logger.info(
                  `[customers] FR-5420 backfill: linked ${updatedCount} guest orders → customer=${doc.id}`,
                );
              }
            } catch (err) {
              req.payload.logger.error(
                `[customers] FR-5420 order backfill failed: ${(err as Error)?.message}`,
              );
            }
          } else if (previousDoc) {
            // Account activation (email-only → password-set)
            if (
              previousDoc.accountState === "email-only" &&
              doc.accountState === "password-set"
            ) {
              await emitDomainEvent({
                kind: "customer.activated",
                customer: { ...snapshot, isFirstActivation: true },
              });
            }
            // Email change
            if (previousDoc.email !== doc.email) {
              await emitDomainEvent({
                kind: "customer.email_changed",
                customer: snapshot,
                context: { meta: { previousEmail: maskEmail(String(previousDoc.email)) } },
              });
            }
            // Preferences updated
            if (
              previousDoc.marketingOptIn !== doc.marketingOptIn ||
              previousDoc.messengerOptIn !== doc.messengerOptIn
            ) {
              await emitDomainEvent({
                kind: "customer.preferences_updated",
                customer: snapshot,
              });
            }
            // Soft delete
            if (!previousDoc.deletedAt && doc.deletedAt) {
              await emitDomainEvent({
                kind: "customer.deleted",
                customer: { ...snapshot, accountState: "deleted" },
              });
            }
          }
        } catch (err) {
          req.payload.logger.error(
            `[customers] afterChange emit failed: ${(err as Error)?.message ?? String(err)}`,
          );
        }
      },
    ],
  },
  timestamps: true,
};

function maskEmail(email: string | undefined | null): string {
  if (!email) return "—";
  const [, domain] = email.split("@");
  return domain ? `***@${domain}` : "***";
}

export default Customers;
