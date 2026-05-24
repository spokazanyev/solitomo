import type { MigrateUpArgs, MigrateDownArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

/**
 * Migration: Add PG sequences for Return and CreditMemo numbering (053).
 *
 * The collection schema (Returns, Orders extensions) is handled by Payload's
 * schema sync. This migration creates the current-year sequences so the
 * first Return creation doesn't pay the CREATE-SEQUENCE cost.
 *
 * Subsequent years are lazy-initialized inside the generators
 * (`generateReturnNumber`, `generateCreditMemoNumber`).
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const year = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Moscow",
      year: "numeric",
    }).format(new Date()),
  );

  const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle;
  await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS returns_seq_${year} START 1`));
  await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS credit_memos_seq_${year} START 1`));

  payload.logger.info(`[migration:053] Created sequences returns_seq_${year}, credit_memos_seq_${year}`);
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Don't drop sequences — existing data may reference them
  payload.logger.info("[migration:053] Rollback: no-op (sequences preserved for data integrity)");
}
