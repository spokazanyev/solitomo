import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * 064 — Развязка «канал доставки» (closed) и «перевозчик» (open).
 *
 * Изменения схемы `orders.delivery`:
 *  1. `delivery_method`: enum `enum_orders_delivery_method` → `varchar` (открытое
 *     значение; теперь хранит транзитный алиас канала, а перевозчик живёт в
 *     `delivery_provider_key` / `delivery_provider_name`).
 *  2. Удаляем неиспользуемый тип `enum_orders_delivery_method`.
 *  3. Новый закрытый `delivery_channel` (select → enum `enum_orders_delivery_channel`):
 *     `pickup` / `service` / `own_carrier` — единственный драйвер поведения.
 *  4. Новый `delivery_provider_name` (varchar) — человекочитаемое имя службы.
 *
 * На проде нет реальных заказов → чистая смена схемы без сохранения старых
 * значений и без backfill (spec 064 Assumptions «Хранилище»). На dev Payload
 * autopush применяет изменения автоматически; на production (autopush off)
 * нужна эта формальная миграция (`payload migrate`).
 *
 * Idempotent: `IF EXISTS`/`IF NOT EXISTS` + guarded `CREATE TYPE`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1–2. method: enum → varchar, затем убираем тип.
  await db.execute(sql`
    ALTER TABLE "orders"
      ALTER COLUMN "delivery_method" SET DATA TYPE varchar
      USING "delivery_method"::text;
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_orders_delivery_method";
  `)

  // 3. channel: закрытый enum (Payload-native для select-поля delivery.channel).
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_orders_delivery_channel" AS ENUM('pickup', 'service', 'own_carrier');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "delivery_channel" "enum_orders_delivery_channel";
  `)

  // 4. providerName: открытый varchar (как delivery_provider_key).
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "delivery_provider_name" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Best-effort откат (данных нет — полное восстановление enum_orders_delivery_method
  // не требуется; см. spec 064 Assumptions «Хранилище»).
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_provider_name";
  `)
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_channel";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_orders_delivery_channel";
  `)
  // delivery_method остаётся varchar — обратная конвертация в enum опущена (no data).
}
