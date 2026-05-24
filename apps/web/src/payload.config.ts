import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { en } from "@payloadcms/translations/languages/en";
import { ru } from "@payloadcms/translations/languages/ru";
import { buildConfig } from "payload";

import { AdminChangeLog } from "./collections/AdminChangeLog.js";
import { AttributeGroups, AttributeOptions, Attributes } from "./collections/Attributes.js";
import { Categories, Documents, MediaAssets, Products } from "./collections/Catalog.js";
import { Carts } from "./collections/Carts";
import { CrmSyncJobs } from "./collections/CrmSyncJobs";
import { FilterFields, FilterGroups, FilterOptions, FilterPresets } from "./collections/Filters.js";
import { NotificationJobs } from "./collections/NotificationJobs";
import { Orders } from "./collections/Orders.js";
import { RfqRequests } from "./collections/RfqRequests.js";
import { ShippingCalculations } from "./collections/ShippingCalculations";
import { ShippingLogs } from "./collections/ShippingLogs";
import { Users } from "./collections/Users.js";
import { ApiShipSettings } from "./globals/ApiShipSettings";
import { CrmSettings } from "./globals/CrmSettings";
import { NotificationsSettings } from "./globals/NotificationsSettings";

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
  ],
  collections: [
    Users,
    Orders,
    Carts,
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
    AdminChangeLog,
    ShippingCalculations,
    ShippingLogs,
    CrmSyncJobs,
    NotificationJobs,
  ],
  globals: [ApiShipSettings, CrmSettings, NotificationsSettings],
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
