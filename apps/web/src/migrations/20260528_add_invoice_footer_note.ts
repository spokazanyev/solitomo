import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Добавляет колонку `invoice_footer_note` в global-таблицу `payment_settings`
 * — настраиваемый текст условий внизу PDF-счёта (правится владельцем в admin
 * без редеплоя). На dev Payload autopush добавляет колонку сам; на production
 * (NODE_ENV=production) autopush выключен — нужна формальная миграция.
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS. Дефолт проставляется приложением из
 * defaultValue поля (Payload), здесь колонка nullable.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payment_settings" ADD COLUMN IF NOT EXISTS "invoice_footer_note" varchar;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payment_settings" DROP COLUMN IF EXISTS "invoice_footer_note";
  `);
}
