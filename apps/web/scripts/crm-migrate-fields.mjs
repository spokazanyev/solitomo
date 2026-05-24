#!/usr/bin/env node
/**
 * crm:migrate-fields — создаёт кастомные поля в Twenty workspace через GraphQL.
 *
 * Использование:
 *   pnpm --filter @soliton/web crm:migrate-fields           # dry-run (по умолчанию)
 *   pnpm --filter @soliton/web crm:migrate-fields --apply   # реальные изменения
 *
 * Источник полей: specs/048-twenty-crm-sync/contracts/twenty-fields.md
 *
 * ENV:
 *   TWENTY_API_URL, TWENTY_API_KEY, TWENTY_WORKSPACE_ID
 */

const TWENTY_API_URL = process.env.TWENTY_API_URL ?? "https://crm.soliton.ru";
const TWENTY_API_KEY = process.env.TWENTY_API_KEY ?? "";
const TWENTY_WORKSPACE_ID = process.env.TWENTY_WORKSPACE_ID ?? "";

const APPLY = process.argv.includes("--apply");

const FIELDS = [
  { object: "opportunity", key: "externalId", type: "TEXT", required: true, description: "Soliton Order.id (unique)" },
  { object: "opportunity", key: "externalToken", type: "TEXT", description: "Order.publicToken" },
  { object: "opportunity", key: "orderUrl", type: "URL", description: "Прямая ссылка на страницу заказа" },
  { object: "opportunity", key: "shippingProvider", type: "TEXT" },
  { object: "opportunity", key: "shippingCost", type: "CURRENCY" },
  { object: "opportunity", key: "trackingNumber", type: "TEXT" },
  { object: "opportunity", key: "trackingUrl", type: "URL" },
  { object: "opportunity", key: "shippingAddress", type: "TEXT" },
  { object: "opportunity", key: "pickupPointAddress", type: "TEXT" },
  { object: "opportunity", key: "pickupExpiresAt", type: "DATE" },
  {
    object: "opportunity",
    key: "fulfillmentStage",
    type: "SELECT",
    options: ["New", "Quote", "Paid", "In fulfillment", "In transit", "At point", "Delivered", "Closed", "Returned", "Cancelled"],
  },
  { object: "opportunity", key: "deliveredAt", type: "DATE" },
  { object: "opportunity", key: "closedAt", type: "DATE" },
  { object: "opportunity", key: "disputeFlag", type: "BOOLEAN" },
  { object: "opportunity", key: "nps", type: "NUMBER" },
  { object: "company", key: "taxId", type: "TEXT", required: true, description: "ИНН" },
  { object: "company", key: "kpp", type: "TEXT" },
  { object: "company", key: "ogrn", type: "TEXT" },
  { object: "company", key: "legalAddress", type: "TEXT" },
  { object: "person", key: "sourceUtm", type: "TEXT" },
  { object: "person", key: "marketingOptIn", type: "BOOLEAN" },
  { object: "person", key: "messengerOptIn", type: "BOOLEAN" },
  { object: "person", key: "customerType", type: "SELECT", options: ["individual", "company-contact"] },
];

async function gqlRequest(query, variables) {
  const res = await fetch(`${TWENTY_API_URL.replace(/\/$/, "")}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TWENTY_API_KEY}`,
      ...(TWENTY_WORKSPACE_ID ? { "X-Workspace-Id": TWENTY_WORKSPACE_ID } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.errors) throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  return data.data;
}

async function listExistingFields(objectName) {
  // NOTE: точные имена query/mutation зависят от версии Twenty. Здесь — best-effort.
  // При апгрейде Twenty актуализировать.
  try {
    const q = `query Fields($object: String!) { objectMetadataFields(filter: { objectName: { eq: $object } }) { name dataType } }`;
    const data = await gqlRequest(q, { object: objectName });
    return data.objectMetadataFields ?? [];
  } catch {
    return [];
  }
}

async function createField(field) {
  const m = `
    mutation CreateField($input: CreateFieldMetadataInput!) {
      createFieldMetadata(input: $input) { name }
    }
  `;
  await gqlRequest(m, { input: field });
}

async function run() {
  if (!TWENTY_API_KEY) {
    console.error("ERROR: TWENTY_API_KEY is not set.");
    process.exit(1);
  }
  console.log(`Twenty migration ${APPLY ? "[APPLY]" : "[DRY-RUN]"} → ${TWENTY_API_URL}`);
  const byObject = FIELDS.reduce((acc, f) => {
    (acc[f.object] ??= []).push(f);
    return acc;
  }, {});

  for (const [object, fields] of Object.entries(byObject)) {
    const existing = await listExistingFields(object);
    const existingNames = new Set(existing.map((f) => f.name));
    console.log(`\n[${object}] existing fields: ${existingNames.size}`);
    for (const field of fields) {
      const status = existingNames.has(field.key) ? "skip (exists)" : "create";
      console.log(`  - ${field.key.padEnd(24)} ${field.type.padEnd(10)} ${status}`);
      if (APPLY && status === "create") {
        try {
          await createField({ ...field, objectName: object });
          console.log("      ✓ created");
        } catch (err) {
          console.log(`      ✗ failed: ${err.message}`);
        }
      }
    }
  }
  console.log(`\nDone. ${APPLY ? "Changes applied." : "Run with --apply to apply changes."}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
