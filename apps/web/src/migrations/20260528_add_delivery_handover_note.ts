import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 062 — добавляем колонку `delivery_handover_note` (textarea) в таблицу `orders`.
 *
 * На dev Payload autopush добавляет колонку автоматически при изменении схемы
 * в коллекции, но на production NODE_ENV=production autopush выключен, поэтому
 * требуется формальная миграция.
 *
 * Тип `varchar` без ограничения длины — соответствует всем остальным textarea-
 * колонкам коллекции `orders` (delivery_address, customer_legal_address,
 * internal_comment), которые тоже без `character_maximum_length`. Длина ≤1000
 * проверяется в Payload-валидаторе (Orders.js) и серверно в /api/orders.
 *
 * Idempotent: `ADD COLUMN IF NOT EXISTS` — повторный прогон no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_handover_note" varchar;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_handover_note";
  `);
}
