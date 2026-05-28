import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 062 — Step 2/2: переименовываем все существующие записи Orders.delivery.method
 * с значения `'tc'` на `'own_carrier'`.
 *
 * Зависит от того, что предыдущая миграция `20260527_001_add_own_carrier_enum`
 * уже зафиксировала новое enum-значение в отдельной транзакции — иначе Postgres
 * выдаст «unsafe use of new value».
 *
 * Idempotent: `WHERE delivery_method = 'tc'` — повторный прогон no-op (после
 * первого запуска `tc`-строк не остаётся).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "orders" SET "delivery_method" = 'own_carrier' WHERE "delivery_method" = 'tc';
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Откат: возвращаем 'tc' (legacy-значение остаётся в enum как option).
  await db.execute(sql`
    UPDATE "orders" SET "delivery_method" = 'tc' WHERE "delivery_method" = 'own_carrier';
  `);
}
