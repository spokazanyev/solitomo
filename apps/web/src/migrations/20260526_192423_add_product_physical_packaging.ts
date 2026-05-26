import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// 060: Idempotent migration — на dev/prod где enum sender_pickup_type или колонки
// apiship_settings.sender_* уже могли быть добавлены вручную (до formal migration),
// используем IF NOT EXISTS guard'ы вместо unconditional CREATE/ADD. Это безопасно
// для повторного запуска и не падает при diverged DB state между dev и prod.

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 060 core: physical_packaging columns на products + _products_v (versioning)
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "physical_packaging_weight_grams" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "physical_packaging_length_mm" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "physical_packaging_width_mm" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "physical_packaging_height_mm" numeric;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_physical_packaging_weight_grams" numeric;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_physical_packaging_length_mm" numeric;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_physical_packaging_width_mm" numeric;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_physical_packaging_height_mm" numeric;

    -- 058 follow-up: фиксируем sender_pickup_type / sender_dropoff_address, которые
    -- могли быть добавлены вручную на проде. На dev — auto-push уже создал.
    DO $$ BEGIN
      CREATE TYPE "public"."enum_apiship_settings_sender_pickup_type" AS ENUM('courier', 'dropoff');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    ALTER TABLE "apiship_settings" ADD COLUMN IF NOT EXISTS "sender_pickup_type" "enum_apiship_settings_sender_pickup_type" DEFAULT 'dropoff';
    ALTER TABLE "apiship_settings" ADD COLUMN IF NOT EXISTS "sender_dropoff_address" varchar;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "physical_packaging_weight_grams";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "physical_packaging_length_mm";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "physical_packaging_width_mm";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "physical_packaging_height_mm";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_physical_packaging_weight_grams";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_physical_packaging_length_mm";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_physical_packaging_width_mm";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_physical_packaging_height_mm";
    ALTER TABLE "apiship_settings" DROP COLUMN IF EXISTS "sender_pickup_type";
    ALTER TABLE "apiship_settings" DROP COLUMN IF EXISTS "sender_dropoff_address";
    DROP TYPE IF EXISTS "public"."enum_apiship_settings_sender_pickup_type";
  `)
}
