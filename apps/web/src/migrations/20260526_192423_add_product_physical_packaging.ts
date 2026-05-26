import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_apiship_settings_sender_pickup_type" AS ENUM('courier', 'dropoff');
  ALTER TABLE "products" ADD COLUMN "physical_packaging_weight_grams" numeric;
  ALTER TABLE "products" ADD COLUMN "physical_packaging_length_mm" numeric;
  ALTER TABLE "products" ADD COLUMN "physical_packaging_width_mm" numeric;
  ALTER TABLE "products" ADD COLUMN "physical_packaging_height_mm" numeric;
  ALTER TABLE "_products_v" ADD COLUMN "version_physical_packaging_weight_grams" numeric;
  ALTER TABLE "_products_v" ADD COLUMN "version_physical_packaging_length_mm" numeric;
  ALTER TABLE "_products_v" ADD COLUMN "version_physical_packaging_width_mm" numeric;
  ALTER TABLE "_products_v" ADD COLUMN "version_physical_packaging_height_mm" numeric;
  ALTER TABLE "apiship_settings" ADD COLUMN "sender_pickup_type" "enum_apiship_settings_sender_pickup_type" DEFAULT 'dropoff';
  ALTER TABLE "apiship_settings" ADD COLUMN "sender_dropoff_address" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" DROP COLUMN "physical_packaging_weight_grams";
  ALTER TABLE "products" DROP COLUMN "physical_packaging_length_mm";
  ALTER TABLE "products" DROP COLUMN "physical_packaging_width_mm";
  ALTER TABLE "products" DROP COLUMN "physical_packaging_height_mm";
  ALTER TABLE "_products_v" DROP COLUMN "version_physical_packaging_weight_grams";
  ALTER TABLE "_products_v" DROP COLUMN "version_physical_packaging_length_mm";
  ALTER TABLE "_products_v" DROP COLUMN "version_physical_packaging_width_mm";
  ALTER TABLE "_products_v" DROP COLUMN "version_physical_packaging_height_mm";
  ALTER TABLE "apiship_settings" DROP COLUMN "sender_pickup_type";
  ALTER TABLE "apiship_settings" DROP COLUMN "sender_dropoff_address";
  DROP TYPE "public"."enum_apiship_settings_sender_pickup_type";`)
}
