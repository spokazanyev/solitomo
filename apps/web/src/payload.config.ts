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
import { FilterFields, FilterGroups, FilterOptions, FilterPresets } from "./collections/Filters.js";
import { Orders } from "./collections/Orders.js";
import { RfqRequests } from "./collections/RfqRequests.js";
import { Users } from "./collections/Users.js";

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
  ],
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
