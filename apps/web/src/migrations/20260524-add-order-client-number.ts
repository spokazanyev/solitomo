import type { MigrateUpArgs, MigrateDownArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

/**
 * Migration: Add PG SEQUENCE for order clientNumber generation (051).
 *
 * The schema fields (clientNumber, clientNumberReissueReason, clientNumberHistory)
 * are handled by Payload's schema sync. This migration only creates the
 * PG SEQUENCE for the current year to ensure it's ready for use.
 *
 * Note: The beforeChange hook also does lazy `CREATE SEQUENCE IF NOT EXISTS`
 * so this migration is a convenience, not a hard requirement.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  // Get current year in Europe/Moscow TZ
  const year = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Moscow",
      year: "numeric",
    }).format(new Date()),
  );

  const seqName = `order_seq_${year}`;

  // Create sequence for current year (idempotent)
  const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle;
  await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS ${seqName} START 1`));

  payload.logger.info(`[migration:051] Created sequence ${seqName}`);
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Note: We intentionally don't drop the sequence on rollback
  // because there may already be clientNumbers referencing it.
  payload.logger.info("[migration:051] Rollback: no-op (sequence preserved for data integrity)");
}
