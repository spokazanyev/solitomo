import type { GlobalConfig } from "payload";

import { adminLabel } from "../collections/admin-i18n.js";

/**
 * PaymentSettings (055) — global для конфигурации ЮKassa-интеграции.
 *
 * Coverage: FR-5560..5563, FR-5544a.
 * Owner может менять captureMode, paymentMethods и пр. без редеплоя.
 * Secrets (shopId/secretKey) — НЕ здесь, только в env (FR-5562, FR-5598).
 * webhookSecret хранится здесь с access.read=false (как 054 magicLinkToken).
 */
export const PaymentSettings: GlobalConfig = {
  slug: "payment-settings",
  label: adminLabel("Оплата / ЮKassa", "Payments / YooKassa"),
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "enabled",
      type: "checkbox",
      defaultValue: true,
      label: adminLabel("Интеграция включена", "Enabled"),
      admin: {
        description: adminLabel(
          "FR-5563. При выключенной интеграции все ЮKassa-API запросы и webhook'и отклоняются.",
          "FR-5563. When disabled, all ЮKassa API calls and webhooks are refused.",
        ),
      },
    },
    {
      name: "captureMode",
      type: "select",
      defaultValue: "two_stage",
      label: adminLabel("Режим списания", "Capture mode"),
      options: [
        { label: adminLabel("Двухстадийный (auth → capture)", "Two-stage (auth → capture)"), value: "two_stage" },
        { label: adminLabel("Одностадийный (auth+capture)", "One-stage"), value: "one_stage" },
      ],
      admin: {
        description: adminLabel(
          "Q2 / FR-5503. Двухстадийный безопаснее для предзаказов: ЮKassa держит hold 7 дней, мы capture'им после комплектации.",
          "Q2 / FR-5503. Two-stage holds funds for 7 days, captured after fulfillment.",
        ),
      },
    },
    {
      name: "paymentMethods",
      type: "select",
      hasMany: true,
      defaultValue: ["bank_card", "sbp"],
      label: adminLabel("Разрешённые методы оплаты", "Allowed payment methods"),
      options: [
        { label: adminLabel("Банковская карта", "Bank card"), value: "bank_card" },
        { label: adminLabel("СБП (QR-код)", "SBP (QR)"), value: "sbp" },
        { label: adminLabel("YooMoney-кошелёк", "YooMoney wallet"), value: "yoo_money" },
        { label: adminLabel("Сбербанк Онлайн", "Sberbank Online"), value: "sberbank" },
      ],
      admin: {
        description: adminLabel(
          "Q3 / FR-5505. Whitelist, передаваемый в ЮKassa. Если пуст — ЮKassa покажет все доступные методы магазина.",
          "Q3 / FR-5505. Whitelist sent to ЮKassa. If empty, ЮKassa shows all merchant methods.",
        ),
      },
    },
    {
      name: "paymentRetryWindowMin",
      type: "number",
      defaultValue: 60,
      min: 5,
      max: 1440,
      label: adminLabel("Окно retry, минут", "Retry window, minutes"),
      admin: {
        description: adminLabel(
          "OQ-4 / FR-5552. После этого окна Order переходит в expired при canceled webhook.",
          "OQ-4 / FR-5552. After this window Order transitions to expired on canceled webhook.",
        ),
      },
    },
    {
      name: "webhookSignatureMode",
      type: "select",
      defaultValue: "off",
      label: adminLabel("Режим подписи webhook", "Webhook signature mode"),
      options: [
        { label: "off (IP-allowlist only)", value: "off" },
        { label: "enforce (HMAC-SHA256, Phase 2)", value: "enforce" },
      ],
      admin: {
        description: adminLabel(
          "FR-5535. В MVP — off (IP-allowlist достаточен). enforce включаем, когда ЮKassa объявит формат подписи.",
          "FR-5535. MVP: off. Switch to enforce when ЮKassa publishes signature format.",
        ),
      },
    },
    {
      name: "webhookSecret",
      type: "text",
      label: adminLabel("Секрет HMAC webhook", "Webhook HMAC secret"),
      access: {
        // Secrets никогда не выходят к клиенту (FR-5562, паттерн 054 magicLinkToken).
        read: () => false,
      },
      admin: {
        description: adminLabel(
          "≥32 символа. Используется только при webhookSignatureMode=enforce.",
          "≥32 chars. Used only when webhookSignatureMode=enforce.",
        ),
      },
    },
    {
      name: "taxSystemCode",
      type: "number",
      defaultValue: 1,
      min: 1,
      max: 6,
      label: adminLabel("Система налогообложения", "Tax system code"),
      admin: {
        description: adminLabel(
          "OQ-1 / FR-5543. 1=ОСН, 2=УСН доходы, 3=УСН доходы-расходы, 4=ЕНВД, 5=ЕСХН, 6=ПСН.",
          "OQ-1 / FR-5543. 1=ОСН, 2=УСН-income, 3=УСН-profit, 4=ЕНВД, 5=ЕСХН, 6=ПСН.",
        ),
      },
    },
    {
      name: "defaultVatCode",
      type: "number",
      defaultValue: 12,
      min: 1,
      max: 12,
      label: adminLabel("Ставка НДС (vat_code)", "VAT code"),
      admin: {
        description: adminLabel(
          "OQ-3a / FR-5544. Default 12 = 22/122 расчётная (ФЗ-425 с 01.01.2026). Legacy: 4 = 20/120.",
          "OQ-3a / FR-5544. Default 12 = 22/122 calc (Federal Law-425 since 2026-01-01). Legacy: 4 = 20/120.",
        ),
      },
    },
    {
      name: "allowedLegacyVatCodes",
      type: "array",
      label: adminLabel("Legacy vat_codes (для возвратов)", "Legacy vat_codes (for refunds)"),
      defaultValue: [{ code: 4 }, { code: 6 }],
      fields: [{ name: "code", type: "number", required: true }],
      admin: {
        description: adminLabel(
          "FR-5544d. Vat_code'ы, разрешённые в receipt чека коррекции (refund) для legacy-заказов (НДС 20%). НЕ используются для новых платежей.",
          "FR-5544d. VAT codes accepted in refund correction receipts for legacy orders (20% VAT). NOT used for new payments.",
        ),
      },
    },
    {
      name: "sbpMaxAmount",
      type: "number",
      defaultValue: 1000000,
      label: adminLabel("Лимит СБП, ₽", "SBP max amount, ₽"),
      admin: {
        description: adminLabel(
          "Лимит ЮKassa для СБП-операций. Заказы выше — без СБП-метода в availableMethods.",
          "ЮKassa SBP transaction limit. Orders above this skip SBP in availableMethods.",
        ),
      },
    },
    {
      type: "group",
      name: "senderCompanyInfo",
      label: adminLabel("Реквизиты отправителя", "Sender company info"),
      admin: {
        description: adminLabel(
          "Defaults подставлены из 00-source-data/company/contacts.json (rusprofile.ru/id/2753855 + PDF реквизитов). Owner может скорректировать.",
          "Defaults from 00-source-data/company/contacts.json. Owner may adjust.",
        ),
      },
      fields: [
        {
          name: "inn",
          type: "text",
          required: true,
          defaultValue: "6659009140",
          label: "ИНН",
          admin: {
            description: adminLabel("10 цифр (юрлицо) или 12 (ИП)", "10 digits (LLC) or 12 (sole proprietor)"),
          },
        },
        { name: "legalName", type: "text", required: true,
          defaultValue: "ООО «НПП Солитон-1»",
          label: adminLabel("Юридическое наименование", "Legal name") },
        { name: "address", type: "text", required: true,
          defaultValue: "620034, г. Екатеринбург, ул. Колмогорова, д. 54а, кв. 54",
          label: adminLabel("Юр.адрес", "Legal address") },
        { name: "kpp", type: "text",
          defaultValue: "667801001",
          label: adminLabel("КПП (только для ООО)", "KPP (LLC only)") },
      ],
    },
    {
      type: "group",
      name: "audit",
      label: adminLabel("Аудит изменений", "Audit"),
      admin: { readOnly: true },
      fields: [
        { name: "lastChangedBy", type: "relationship", relationTo: "users" },
        { name: "lastChangedAt", type: "date" },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // FR-5544a: validate ranges before persist
        const taxSystemCode = (data as { taxSystemCode?: number }).taxSystemCode;
        if (taxSystemCode != null && (taxSystemCode < 1 || taxSystemCode > 6 || !Number.isInteger(taxSystemCode))) {
          throw new Error("paymentSettings.taxSystemCode must be an integer in {1..6}");
        }
        const defaultVatCode = (data as { defaultVatCode?: number }).defaultVatCode;
        if (defaultVatCode != null && (defaultVatCode < 1 || defaultVatCode > 12 || !Number.isInteger(defaultVatCode))) {
          throw new Error("paymentSettings.defaultVatCode must be an integer in {1..12}");
        }
        const webhookSecret = (data as { webhookSecret?: string }).webhookSecret;
        if (webhookSecret != null && webhookSecret !== "" && webhookSecret.length < 32) {
          throw new Error("paymentSettings.webhookSecret must be empty or ≥ 32 characters");
        }
        const inn = (data as { senderCompanyInfo?: { inn?: string } }).senderCompanyInfo?.inn;
        if (inn != null && inn !== "" && !/^\d{10}(\d{2})?$/.test(inn)) {
          throw new Error("paymentSettings.senderCompanyInfo.inn must be 10 or 12 digits");
        }
        return data;
      },
    ],
    afterChange: [
      async ({ req, doc, previousDoc }) => {
        // Invalidate cache in settings loader
        try {
          const mod = await import("../lib/payments/settings");
          mod.invalidatePaymentSettingsCache();
        } catch {
          // ignore — module may not be loaded yet
        }

        // Set audit fields without re-triggering hook (skipPaymentSettingsAudit)
        if (req?.user && !req.context?.skipPaymentSettingsAudit) {
          try {
            await req.payload.updateGlobal({
              slug: "payment-settings",
              data: {
                audit: {
                  lastChangedBy: req.user.id,
                  lastChangedAt: new Date().toISOString(),
                },
              },
              context: { skipPaymentSettingsAudit: true },
            });
          } catch {
            // ignore
          }

          // Persistent audit log
          try {
            await req.payload.create({
              collection: "admin-change-log",
              data: {
                actorType: "user",
                actorName: req.user.email ?? "unknown",
                targetCollection: "globals/payment-settings",
                targetLabel: "Payment Settings (ЮKassa)",
                changeType: "update",
                diffSummary: JSON.stringify({
                  enabledFrom: (previousDoc as { enabled?: boolean })?.enabled,
                  enabledTo: (doc as { enabled?: boolean })?.enabled,
                  captureModeFrom: (previousDoc as { captureMode?: string })?.captureMode,
                  captureModeTo: (doc as { captureMode?: string })?.captureMode,
                }),
              },
            });
          } catch {
            // ignore
          }
        }
      },
    ],
  },
};
