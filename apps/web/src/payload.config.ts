import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { en } from "@payloadcms/translations/languages/en";
import { ru } from "@payloadcms/translations/languages/ru";
import { buildConfig } from "payload";

import { AdminChangeLog } from "./collections/AdminChangeLog.js";
import { AgentExecutionLog } from "./collections/AgentExecutionLog";
import { AgentProposals } from "./collections/AgentProposals";
import { Annotations } from "./collections/Annotations";
import { AttributeGroups, AttributeOptions, Attributes } from "./collections/Attributes.js";
import { Categories, Documents, MediaAssets, Products } from "./collections/Catalog.js";
import { Carts } from "./collections/Carts";
import { Companies } from "./collections/Companies";
import { CrmSyncJobs } from "./collections/CrmSyncJobs";
import { Customers } from "./collections/Customers";
import { Returns } from "./collections/Returns";
import { FilterFields, FilterGroups, FilterOptions, FilterPresets } from "./collections/Filters.js";
import { NotificationJobs } from "./collections/NotificationJobs";
import { Orders } from "./collections/Orders.js";
import { PaymentEvents } from "./collections/PaymentEvents";
import { RfqRequests } from "./collections/RfqRequests.js";
import { ShippingCalculations } from "./collections/ShippingCalculations";
import { ShippingLogs } from "./collections/ShippingLogs";
import { StaticPages } from "./collections/StaticPages";
import { Users } from "./collections/Users.js";
import { AnalyticsSettings } from "./globals/AnalyticsSettings";
import { ApiShipSettings } from "./globals/ApiShipSettings";
import { CrmSettings } from "./globals/CrmSettings";
import { NotificationsSettings } from "./globals/NotificationsSettings";
import { PaymentSettings } from "./globals/PaymentSettings";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    components: {
      actions: [
        {
          path: "./components/admin/AdminLanguageSwitcher.tsx",
          exportName: "AdminLanguageSwitcher",
        },
      ],
      beforeDashboard: [
        {
          path: "./components/admin/AdminProjectGuide.tsx",
          exportName: "AdminProjectGuide",
        },
      ],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
  },
  bin: [
    {
      key: "seed:catalog",
      scriptPath: path.resolve(dirname, "../scripts/seed-catalog-payload.mjs"),
    },
    {
      key: "seed:static-pages",
      scriptPath: path.resolve(dirname, "../scripts/seed-static-pages.mjs"),
    },
    {
      key: "seed:analytics-settings",
      scriptPath: path.resolve(dirname, "../scripts/seed-analytics-settings.mjs"),
    },
  ],
  collections: [
    Users,
    Customers,
    Companies,
    Orders,
    Carts,
    Returns,
    RfqRequests,
    Products,
    Categories,
    AttributeGroups,
    Attributes,
    AttributeOptions,
    FilterGroups,
    FilterFields,
    FilterOptions,
    FilterPresets,
    MediaAssets,
    Documents,
    StaticPages,
    AdminChangeLog,
    ShippingCalculations,
    ShippingLogs,
    CrmSyncJobs,
    NotificationJobs,
    PaymentEvents,
    AgentProposals,
    AgentExecutionLog,
    Annotations,
  ],
  globals: [AnalyticsSettings, ApiShipSettings, CrmSettings, NotificationsSettings, PaymentSettings],
  onInit: async () => {
    try {
      const { registerCoreSubscribers } = await import("./lib/lifecycle/events");
      await registerCoreSubscribers();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[payload onInit] failed to register lifecycle subscribers", err);
    }
  },
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URI ??
        "postgres://soliton:soliton_dev_password@localhost:5432/soliton",
    },
  }),
  editor: lexicalEditor({}),
  i18n: {
    fallbackLanguage: "ru",
    supportedLanguages: {
      en,
      ru,
    },
  },
  secret: process.env.PAYLOAD_SECRET ?? "development-secret",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
