#!/usr/bin/env node
/**
 * backfill-client-numbers — assign clientNumber to all existing orders that lack one.
 *
 * Usage:
 *   pnpm --filter @soliton/web backfill:client-numbers           # dry-run (default)
 *   pnpm --filter @soliton/web backfill:client-numbers --apply   # write to DB
 *   pnpm --filter @soliton/web backfill:client-numbers --year=2025  # scope to one year
 *
 * Process:
 *   1. Reads orders without clientNumber, sorted by createdAt ASC.
 *   2. Groups by business year (Europe/Moscow TZ).
 *   3. For each year: lazy-creates PG SEQUENCE, calls nextval().
 *   4. Formats as SO-YYYY-NNNN and writes to DB (only with --apply).
 *
 * Idempotent: re-running does nothing if all orders already have clientNumber.
 *
 * Source: spec 051, T014.
 */

const APPLY = process.argv.includes("--apply");
const YEAR_FLAG = process.argv.find((a) => a.startsWith("--year="));
const SCOPE_YEAR = YEAR_FLAG ? Number(YEAR_FLAG.split("=")[1]) : null;

const TZ = "Europe/Moscow";

function getBusinessYear(date) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
    }).format(new Date(date)),
  );
}

function formatSequence(n) {
  return n < 10000 ? String(n).padStart(4, "0") : String(n);
}

async function main() {
  console.log("=== Backfill Client Numbers (051) ===");
  console.log(`Mode: ${APPLY ? "APPLY (writing to DB)" : "DRY-RUN (read-only)"}`);
  if (SCOPE_YEAR) console.log(`Scope: year ${SCOPE_YEAR} only`);
  console.log();

  // Dynamic import of Payload (ESM)
  const { getPayload } = await import("payload");

  // We need to resolve the Payload config
  // In scripts, we typically set PAYLOAD_CONFIG_PATH env var
  // or import directly. Let's use the standard approach:
  let configPromise;
  try {
    configPromise = (await import("@payload-config")).default;
  } catch {
    // Fallback: try relative path
    try {
      configPromise = (await import("../src/payload.config.ts")).default;
    } catch (e2) {
      console.error("Cannot load payload config. Run from the web app directory.");
      console.error("Set PAYLOAD_CONFIG_PATH if needed.", e2.message);
      process.exit(1);
    }
  }

  const payload = await getPayload({ config: configPromise });

  // Step 1: Find orders without clientNumber
  console.log("Fetching orders without clientNumber...");

  /** @type {Array<{ id: string; createdAt: string; status: string }>} */
  const orders = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const result = await payload.find({
      collection: "orders",
      where: {
        clientNumber: { exists: false },
      },
      sort: "createdAt",
      limit,
      page,
    });

    for (const doc of result.docs) {
      orders.push({
        id: String(doc.id),
        createdAt: String(doc.createdAt ?? new Date().toISOString()),
        status: String(doc.status ?? "unknown"),
      });
    }

    if (!result.hasNextPage) break;
    page++;
  }

  // Also include orders where clientNumber is empty string
  page = 1;
  while (true) {
    const result = await payload.find({
      collection: "orders",
      where: {
        clientNumber: { equals: "" },
      },
      sort: "createdAt",
      limit,
      page,
    });

    for (const doc of result.docs) {
      if (!orders.some((o) => o.id === String(doc.id))) {
        orders.push({
          id: String(doc.id),
          createdAt: String(doc.createdAt ?? new Date().toISOString()),
          status: String(doc.status ?? "unknown"),
        });
      }
    }

    if (!result.hasNextPage) break;
    page++;
  }

  if (orders.length === 0) {
    console.log("All orders already have clientNumber. Nothing to do.");
    process.exit(0);
  }

  // Sort by createdAt ASC
  orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Step 2: Group by business year
  /** @type {Map<number, typeof orders>} */
  const byYear = new Map();
  for (const order of orders) {
    const year = getBusinessYear(order.createdAt);
    if (SCOPE_YEAR && year !== SCOPE_YEAR) continue;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(order);
  }

  const totalScoped = [...byYear.values()].reduce((sum, arr) => sum + arr.length, 0);
  console.log(`Found ${orders.length} orders without clientNumber (${totalScoped} in scope).`);
  console.log();

  // Step 3: Process each year
  const db = payload.db.drizzle;
  let totalAssigned = 0;

  for (const [year, yearOrders] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const seqName = `order_seq_${year}`;

    console.log(`--- Year ${year}: ${yearOrders.length} orders ---`);

    if (APPLY) {
      // Lazy-create sequence
      await db.execute({ sql: `CREATE SEQUENCE IF NOT EXISTS ${seqName} START 1`, params: [] });
    }

    for (const order of yearOrders) {
      let seqValue;
      let clientNumber;

      if (APPLY) {
        const result = await db.execute({ sql: `SELECT nextval('${seqName}') AS seq`, params: [] });
        seqValue = Number(result.rows?.[0]?.seq ?? result[0]?.seq);
        clientNumber = `SO-${year}-${formatSequence(seqValue)}`;

        await payload.update({
          collection: "orders",
          id: order.id,
          data: { clientNumber },
          context: { skipImmutability: true },
        });
      } else {
        // Dry-run: simulate numbering
        seqValue = totalAssigned + 1;
        clientNumber = `SO-${year}-${formatSequence(seqValue)}`;
      }

      console.log(`  ${APPLY ? "✓" : "→"} ${order.id} (${order.status}) → ${clientNumber}`);
      totalAssigned++;
    }
  }

  console.log();
  console.log(`${APPLY ? "Assigned" : "Would assign"} ${totalAssigned} clientNumbers.`);

  if (!APPLY && totalAssigned > 0) {
    console.log();
    console.log("Run with --apply to write changes to the database.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
