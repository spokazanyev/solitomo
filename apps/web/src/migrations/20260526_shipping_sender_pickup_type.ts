import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_apiship_settings_sender_pickup_type"
      AS ENUM('courier', 'dropoff');

    ALTER TABLE "apiship_settings"
      ADD COLUMN IF NOT EXISTS "sender_pickup_type"
        "enum_apiship_settings_sender_pickup_type"
        NOT NULL DEFAULT 'dropoff';

    ALTER TABLE "apiship_settings"
      ADD COLUMN IF NOT EXISTS "sender_dropoff_address"
        varchar;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "apiship_settings"
      DROP COLUMN IF EXISTS "sender_pickup_type";
    ALTER TABLE "apiship_settings"
      DROP COLUMN IF EXISTS "sender_dropoff_address";
    DROP TYPE IF EXISTS "public"."enum_apiship_settings_sender_pickup_type";
  `);
}
