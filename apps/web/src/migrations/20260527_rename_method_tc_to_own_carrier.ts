import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Step 1: Add new enum value (idempotent via IF NOT EXISTS).
  // Postgres requires ALTER TYPE ADD VALUE to commit before the value
  // can be used in subsequent statements, so we run it in its own
  // db.execute call.
  await db.execute(sql`
    ALTER TYPE "public"."enum_orders_delivery_method" ADD VALUE IF NOT EXISTS 'own_carrier';
  `);

  // Step 2: Migrate existing rows (idempotent via WHERE clause).
  await db.execute(sql`
    UPDATE "orders" SET "delivery_method" = 'own_carrier' WHERE "delivery_method" = 'tc';
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverse: move records back to 'tc' (which is still in the enum).
  // We do not DROP VALUE 'own_carrier' here — Postgres does not support
  // removing enum values without recreating the type. Cleanup of the
  // own_carrier value (if ever needed) is a separate deferred task.
  await db.execute(sql`
    UPDATE "orders" SET "delivery_method" = 'tc' WHERE "delivery_method" = 'own_carrier';
  `);
}
