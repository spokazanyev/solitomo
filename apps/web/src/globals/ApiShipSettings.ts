import type { GlobalConfig } from "payload";

import { adminLabel } from "../collections/admin-i18n.js";

export const ApiShipSettings: GlobalConfig = {
  slug: "apiship-settings",
  label: adminLabel("Доставка / ApiShip", "Delivery / ApiShip"),
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "enabled", type: "checkbox", defaultValue: false,
      label: adminLabel("Интеграция включена", "Enabled") },
    { name: "isTest", type: "checkbox", defaultValue: true,
      label: adminLabel("Тестовый режим (api.dev.apiship.ru)", "Test mode") },
    { name: "token", type: "text",
      label: adminLabel("Токен ApiShip", "ApiShip token"),
      admin: { description: adminLabel(
        "Хранится только на сервере. При сохранении пустого — будет использован APISHIP_TOKEN из env.",
        "Server-side only. If empty — falls back to APISHIP_TOKEN env.",
      ) } },
    { name: "webhookSecret", type: "text",
      label: adminLabel("Секрет webhook", "Webhook secret"),
      admin: { description: adminLabel("Для HMAC-проверки входящих webhook'ов.", "For HMAC validation of incoming webhooks.") } },

    { type: "group", name: "sender", label: adminLabel("Отправитель по умолчанию", "Default sender"), fields: [
      { name: "countryCode", type: "text", defaultValue: "RU" },
      { name: "addressString", type: "textarea",
        label: adminLabel("Адрес одной строкой", "Address one-line") },
      { name: "contactName", type: "text",
        label: adminLabel("Контактное лицо", "Contact name") },
      { name: "phone", type: "text",
        label: adminLabel("Телефон", "Phone") },
    ]},

    { type: "group", name: "defaults", label: adminLabel("Параметры по умолчанию", "Defaults"), fields: [
      { name: "length", type: "number", defaultValue: 30 },
      { name: "width", type: "number", defaultValue: 20 },
      { name: "height", type: "number", defaultValue: 15 },
      { name: "weight", type: "number", defaultValue: 1500,
        admin: { description: adminLabel("Граммы", "Grams") } },
      { name: "deliveryCostVat", type: "select", defaultValue: "20",
        options: [
          { label: "Без НДС", value: "-1" },
          { label: "0%", value: "0" },
          { label: "5%", value: "5" },
          { label: "7%", value: "7" },
          { label: "10%", value: "10" },
          { label: "20%", value: "20" },
          { label: "22%", value: "22" },
        ] },
      { name: "isCod", type: "checkbox", defaultValue: false,
        label: adminLabel("Использовать наложенный платёж", "Use COD") },
    ]},

    {
      name: "senderPickupType",
      type: "radio",
      defaultValue: "dropoff",
      label: adminLabel("Схема отправки (откуда забирает СДЭК)", "Pickup scheme"),
      options: [
        {
          label: adminLabel(
            "Курьер СДЭК приезжает к нам (тарифы «дверь→»)",
            "CDEK courier picks up from us (door→ tariffs)",
          ),
          value: "courier",
        },
        {
          label: adminLabel(
            "Мы привозим сами в офис СДЭК (тарифы «склад→»)",
            "We drop off at CDEK office (warehouse→ tariffs)",
          ),
          value: "dropoff",
        },
      ],
      admin: {
        description: adminLabel(
          "«Курьер» — СДЭК приедет к вам; обычно дороже. «Сами» — вы везёте в офис/склад СДЭК; дешевле.",
          "Courier = CDEK comes to you (more expensive). Dropoff = you bring to CDEK office (cheaper).",
        ),
      },
    },
    {
      name: "senderDropoffAddress",
      type: "textarea",
      label: adminLabel(
        "Адрес офиса СДЭК для сдачи (памятка)",
        "Nearest CDEK drop-off office (memo)",
      ),
      admin: {
        condition: (data: Record<string, unknown>) => data.senderPickupType === "dropoff",
        description: adminLabel(
          "Только для вашего удобства — напоминание, куда везти посылки. На тарифы не влияет.",
          "Memo only — where to bring packages. Does not affect tariff calculation.",
        ),
      },
    },

    { name: "disabledProviders", type: "array",
      label: adminLabel("Отключённые провайдеры", "Disabled providers"),
      fields: [{ name: "providerKey", type: "text" }] },

    { name: "allowedDeliveryTypes", type: "select", hasMany: true,
      defaultValue: ["doortodoor", "doortopoint", "pointtodoor", "pointtopoint"],
      label: adminLabel("Разрешённые типы доставки", "Allowed delivery types"),
      options: [
        { label: adminLabel("От двери до двери", "Door to door"), value: "doortodoor" },
        { label: adminLabel("От двери до ПВЗ", "Door to point"), value: "doortopoint" },
        { label: adminLabel("От ПВЗ до двери", "Point to door"), value: "pointtodoor" },
        { label: adminLabel("От ПВЗ до ПВЗ", "Point to point"), value: "pointtopoint" },
      ] },

    { type: "group", name: "yandexMaps", label: adminLabel("Яндекс.Карты", "Yandex Maps"), fields: [
      { name: "apiKey", type: "text",
        label: adminLabel("API key", "API key") },
      { name: "tariffPlan", type: "select", defaultValue: "free",
        options: ["free", "basic", "commercial"].map((v) => ({ label: v, value: v })) },
    ]},

    { type: "group", name: "dadata", label: "DaData", fields: [
      { name: "apiKey", type: "text",
        label: adminLabel("API key", "API key") },
      { name: "secret", type: "text",
        label: adminLabel("Secret", "Secret") },
      { name: "tariffPlan", type: "select", defaultValue: "free",
        options: ["free", "starter", "business"].map((v) => ({ label: v, value: v })) },
      { name: "cacheTtlDays", type: "number", defaultValue: 30 },
    ]},

    { type: "group", name: "lifecycle", label: adminLabel("Жизненный цикл", "Lifecycle"), fields: [
      { name: "closureWindowDays", type: "number", defaultValue: 14 },
      { name: "paymentRetryWindowMin", type: "number", defaultValue: 30 },
      { name: "invoiceExpiresDays", type: "number", defaultValue: 5 },
      { type: "group", name: "stuckThresholdHours", fields: [
        { name: "paid", type: "number", defaultValue: 48 },
        { name: "fulfilling", type: "number", defaultValue: 48 },
        { name: "shipped", type: "number", defaultValue: 72 },
        { name: "atPoint", type: "number", defaultValue: 96 },
      ]},
      { type: "group", name: "priceMismatchTolerance", fields: [
        { name: "percent", type: "number", defaultValue: 5 },
        { name: "absoluteR", type: "number", defaultValue: 100 },
      ]},
    ]},

    { type: "group", name: "connectionStatus", admin: { readOnly: true }, fields: [
      { name: "lastCheckedAt", type: "date" },
      { name: "ok", type: "checkbox" },
      { name: "message", type: "text" },
    ]},
  ],
  hooks: {
    afterChange: [
      async ({ req, doc, previousDoc }) => {
        try {
          const mod = await import("../lib/shipping/apiship/settings");
          mod.invalidateSettingsCache();
        } catch {
          // ignore
        }
        try {
          if (req?.user) {
            await req.payload.create({
              collection: "admin-change-log",
              data: {
                actorType: "user",
                actorName: req.user.email ?? "unknown",
                targetCollection: "globals/apiship-settings",
                targetLabel: "ApiShip Settings",
                changeType: "update",
                diffSummary: JSON.stringify({
                  enabledFrom: (previousDoc as { enabled?: boolean })?.enabled,
                  enabledTo: (doc as { enabled?: boolean })?.enabled,
                }),
              },
            });
          }
        } catch {
          // ignore
        }
      },
    ],
  },
};
