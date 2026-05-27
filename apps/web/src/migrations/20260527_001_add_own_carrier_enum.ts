import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 062 — Step 1/2: добавляем новое значение `own_carrier` в enum
 * `enum_orders_delivery_method`.
 *
 * Postgres ограничение: после `ALTER TYPE ... ADD VALUE` новое значение
 * нельзя использовать в той же транзакции — выдаёт «unsafe use of new value».
 * Поэтому переименование `'tc' → 'own_carrier'` для существующих строк
 * вынесено в отдельную миграцию `20260527_002_rename_tc_to_own_carrier`,
 * которая выполняется уже после коммита этой.
 *
 * Idempotent: `ADD VALUE IF NOT EXISTS` — повторный прогон no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_orders_delivery_method" ADD VALUE IF NOT EXISTS 'own_carrier';
  `);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres не поддерживает DROP VALUE из enum без пересоздания типа.
  // Откат `own_carrier` — отдельная deferred-задача (см. DEFERRED-062-A).
  // Здесь down-миграция намеренно no-op.
}
