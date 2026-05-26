import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_customers_dsar_log_type" AS ENUM('access', 'delete');
  CREATE TYPE "public"."enum_customers_dsar_log_status" AS ENUM('pending', 'completed', 'rejected');
  CREATE TYPE "public"."enum_orders_user_type_at_conversion" AS ENUM('anonymous', 'customer', 'legal_entity');
  CREATE TYPE "public"."enum_orders_server_hit_status_purchase_hit_status" AS ENUM('pending', 'sent', 'failed', 'skipped_no_consent', 'skipped_kill_switch');
  CREATE TYPE "public"."enum_orders_server_hit_status_offline_conversion_status" AS ENUM('pending', 'sent', 'failed', 'skipped_no_yclid', 'skipped_no_consent');
  CREATE TYPE "public"."enum_carts_user_type_at_creation" AS ENUM('anonymous', 'customer', 'legal_entity');
  CREATE TYPE "public"."enum_agent_proposals_created_by" AS ENUM('agent', 'mcp_tool', 'manual');
  CREATE TYPE "public"."enum_agent_proposals_type" AS ENUM('create_goal', 'update_goal', 'soft_disable_goal', 'hard_delete', 'create_filter', 'update_filter', 'update_setting', 'drift_detected', 'create_missing_goal', 'remove_unused_segment', 'adjust_qualified_visit_threshold', 'investigate_funnel_drop', 'update_config_from_drift', 'auto_approve_request');
  CREATE TYPE "public"."enum_agent_proposals_action" AS ENUM('create', 'update', 'delete', 'soft-disable');
  CREATE TYPE "public"."enum_agent_proposals_severity" AS ENUM('info', 'warning', 'critical');
  CREATE TYPE "public"."enum_agent_proposals_status" AS ENUM('pending', 'approved', 'rejected', 'executed', 'failed');
  CREATE TYPE "public"."enum_agent_execution_log_method" AS ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE');
  CREATE TYPE "public"."enum_annotations_type" AS ENUM('deploy', 'campaign', 'incident', 'manual');
  CREATE TYPE "public"."enum_annotations_environment" AS ENUM('production', 'staging');
  CREATE TYPE "public"."enum_analytics_settings_agent_review_enabled_evaluators" AS ENUM('funnel_drop_off', 'qualified_visit_rate', 'source_quality', 'zero_result_searches', 'roas_deviation', 'data_quality');
  CREATE TYPE "public"."enum_analytics_settings_referrer_patterns_channel" AS ENUM('organic_yandex', 'organic_google', 'organic_images_yandex', 'organic_images_google', 'organic_maps_yandex', 'organic_maps_google', 'organic_marketplace_yandex_market', 'organic_ai', 'paid_yandex_direct', 'paid_google_ads', 'social', 'marketplace_outbound', 'referral');
  CREATE TABLE "customers_dsar_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"requested_at" timestamp(3) with time zone NOT NULL,
  	"type" "enum_customers_dsar_log_type" NOT NULL,
  	"status" "enum_customers_dsar_log_status" NOT NULL,
  	"completed_at" timestamp(3) with time zone,
  	"completed_by_id" integer,
  	"notes" varchar
  );
  
  CREATE TABLE "agent_proposals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"created_by" "enum_agent_proposals_created_by" DEFAULT 'agent' NOT NULL,
  	"evaluator" varchar NOT NULL,
  	"type" "enum_agent_proposals_type" NOT NULL,
  	"action" "enum_agent_proposals_action" NOT NULL,
  	"target_path" varchar NOT NULL,
  	"payload" jsonb NOT NULL,
  	"reasoning" varchar NOT NULL,
  	"expected_impact" varchar,
  	"evidence" jsonb NOT NULL,
  	"severity" "enum_agent_proposals_severity" DEFAULT 'info' NOT NULL,
  	"status" "enum_agent_proposals_status" DEFAULT 'pending' NOT NULL,
  	"reviewed_by_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"reviewer_reason" varchar,
  	"executed_at" timestamp(3) with time zone,
  	"execution_result" jsonb,
  	"cooldown_until" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "agent_execution_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"timestamp" timestamp(3) with time zone NOT NULL,
  	"endpoint" varchar NOT NULL,
  	"method" "enum_agent_execution_log_method" NOT NULL,
  	"request_params" jsonb,
  	"response_status" numeric NOT NULL,
  	"response_body_summary" varchar,
  	"duration_ms" numeric NOT NULL,
  	"error_message" varchar,
  	"proposal_id_id" integer,
  	"config_apply_run_id" varchar,
  	"manual_admin_user_id_id" integer,
  	"evaluator_name" varchar,
  	"user_agent" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "annotations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_annotations_type" NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"git_ref" varchar,
  	"pr_url" varchar,
  	"environment" "enum_annotations_environment" DEFAULT 'production' NOT NULL,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "analytics_settings_agent_review_enabled_evaluators" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_analytics_settings_agent_review_enabled_evaluators",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "analytics_settings_brand_keywords" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"keyword" varchar NOT NULL
  );
  
  CREATE TABLE "analytics_settings_referrer_patterns_host_patterns" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"pattern" varchar NOT NULL
  );
  
  CREATE TABLE "analytics_settings_referrer_patterns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel" "enum_analytics_settings_referrer_patterns_channel" NOT NULL,
  	"priority" numeric DEFAULT 50 NOT NULL,
  	"enabled" boolean DEFAULT true
  );
  
  CREATE TABLE "analytics_settings_bot_user_agent_patterns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"pattern" varchar NOT NULL
  );
  
  CREATE TABLE "analytics_settings_soft404_markers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"marker" varchar NOT NULL
  );
  
  CREATE TABLE "analytics_settings_goal_mapping" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"event_name" varchar NOT NULL,
  	"metrika_goal_id" numeric,
  	"business_meaning" varchar,
  	"last_sync_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "analytics_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"activation_server_hits_enabled" boolean DEFAULT true,
  	"activation_webvisor_enabled" boolean DEFAULT true,
  	"activation_qualified_visit_goal_enabled" boolean DEFAULT true,
  	"activation_agent_enabled" boolean DEFAULT true,
  	"activation_agent_scheduler_enabled" boolean DEFAULT false,
  	"agent_review_schedule" varchar DEFAULT '0 9 * * *',
  	"agent_review_timezone" varchar DEFAULT 'Europe/Moscow',
  	"agent_review_cooldown_days" numeric DEFAULT 7,
  	"agent_review_rate_limit_max_api_calls_per_minute" numeric DEFAULT 100,
  	"agent_review_rate_limit_backoff_on_rate_limit" boolean DEFAULT true,
  	"qualified_visit_min_duration_seconds" numeric DEFAULT 30,
  	"qualified_visit_min_page_depth" numeric DEFAULT 2,
  	"qualified_visit_exclude_bounce" boolean DEFAULT true,
  	"audit_last_changed_by_id" integer,
  	"audit_last_changed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "customers" ADD COLUMN "first_seen_at" timestamp(3) with time zone;
  ALTER TABLE "customers" ADD COLUMN "ym_client_id" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_utm_source" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_utm_medium" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_utm_campaign" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_utm_content" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_utm_term" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_yclid" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_gclid" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_openstat" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_from" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_referer_host" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_acquisition_channel" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_acquisition_query" varchar;
  ALTER TABLE "orders" ADD COLUMN "attribution_first_touch_captured_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "ym_client_id" varchar;
  ALTER TABLE "orders" ADD COLUMN "first_seen_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "time_to_purchase_days" numeric;
  ALTER TABLE "orders" ADD COLUMN "visit_count_to_purchase" numeric;
  ALTER TABLE "orders" ADD COLUMN "user_type_at_conversion" "enum_orders_user_type_at_conversion";
  ALTER TABLE "orders" ADD COLUMN "server_hit_status_purchase_hit_sent_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "server_hit_status_purchase_hit_status" "enum_orders_server_hit_status_purchase_hit_status";
  ALTER TABLE "orders" ADD COLUMN "server_hit_status_purchase_hit_error" varchar;
  ALTER TABLE "orders" ADD COLUMN "server_hit_status_offline_conversion_sent_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "server_hit_status_offline_conversion_status" "enum_orders_server_hit_status_offline_conversion_status";
  ALTER TABLE "orders" ADD COLUMN "server_hit_status_offline_conversion_error" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_utm_source" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_utm_medium" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_utm_campaign" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_utm_content" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_utm_term" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_yclid" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_gclid" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_openstat" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_from" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_referer_host" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_acquisition_channel" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_acquisition_query" varchar;
  ALTER TABLE "carts" ADD COLUMN "attribution_first_touch_captured_at" timestamp(3) with time zone;
  ALTER TABLE "carts" ADD COLUMN "ym_client_id" varchar;
  ALTER TABLE "carts" ADD COLUMN "ga_client_id" varchar;
  ALTER TABLE "carts" ADD COLUMN "first_seen_at" timestamp(3) with time zone;
  ALTER TABLE "carts" ADD COLUMN "user_type_at_creation" "enum_carts_user_type_at_creation";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "agent_proposals_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "agent_execution_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "annotations_id" integer;
  ALTER TABLE "customers_dsar_log" ADD CONSTRAINT "customers_dsar_log_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers_dsar_log" ADD CONSTRAINT "customers_dsar_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agent_execution_log" ADD CONSTRAINT "agent_execution_log_proposal_id_id_agent_proposals_id_fk" FOREIGN KEY ("proposal_id_id") REFERENCES "public"."agent_proposals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agent_execution_log" ADD CONSTRAINT "agent_execution_log_manual_admin_user_id_id_users_id_fk" FOREIGN KEY ("manual_admin_user_id_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "annotations" ADD CONSTRAINT "annotations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "analytics_settings_agent_review_enabled_evaluators" ADD CONSTRAINT "analytics_settings_agent_review_enabled_evaluators_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."analytics_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "analytics_settings_brand_keywords" ADD CONSTRAINT "analytics_settings_brand_keywords_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."analytics_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "analytics_settings_referrer_patterns_host_patterns" ADD CONSTRAINT "analytics_settings_referrer_patterns_host_patterns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."analytics_settings_referrer_patterns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "analytics_settings_referrer_patterns" ADD CONSTRAINT "analytics_settings_referrer_patterns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."analytics_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "analytics_settings_bot_user_agent_patterns" ADD CONSTRAINT "analytics_settings_bot_user_agent_patterns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."analytics_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "analytics_settings_soft404_markers" ADD CONSTRAINT "analytics_settings_soft404_markers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."analytics_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "analytics_settings_goal_mapping" ADD CONSTRAINT "analytics_settings_goal_mapping_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."analytics_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "analytics_settings" ADD CONSTRAINT "analytics_settings_audit_last_changed_by_id_users_id_fk" FOREIGN KEY ("audit_last_changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "customers_dsar_log_order_idx" ON "customers_dsar_log" USING btree ("_order");
  CREATE INDEX "customers_dsar_log_parent_id_idx" ON "customers_dsar_log" USING btree ("_parent_id");
  CREATE INDEX "customers_dsar_log_completed_by_idx" ON "customers_dsar_log" USING btree ("completed_by_id");
  CREATE INDEX "agent_proposals_reviewed_by_idx" ON "agent_proposals" USING btree ("reviewed_by_id");
  CREATE INDEX "agent_proposals_updated_at_idx" ON "agent_proposals" USING btree ("updated_at");
  CREATE INDEX "agent_proposals_created_at_idx" ON "agent_proposals" USING btree ("created_at");
  CREATE INDEX "agent_execution_log_proposal_id_idx" ON "agent_execution_log" USING btree ("proposal_id_id");
  CREATE INDEX "agent_execution_log_manual_admin_user_id_idx" ON "agent_execution_log" USING btree ("manual_admin_user_id_id");
  CREATE INDEX "agent_execution_log_updated_at_idx" ON "agent_execution_log" USING btree ("updated_at");
  CREATE INDEX "agent_execution_log_created_at_idx" ON "agent_execution_log" USING btree ("created_at");
  CREATE INDEX "annotations_created_by_idx" ON "annotations" USING btree ("created_by_id");
  CREATE INDEX "annotations_updated_at_idx" ON "annotations" USING btree ("updated_at");
  CREATE INDEX "annotations_created_at_idx" ON "annotations" USING btree ("created_at");
  CREATE INDEX "analytics_settings_agent_review_enabled_evaluators_order_idx" ON "analytics_settings_agent_review_enabled_evaluators" USING btree ("order");
  CREATE INDEX "analytics_settings_agent_review_enabled_evaluators_parent_idx" ON "analytics_settings_agent_review_enabled_evaluators" USING btree ("parent_id");
  CREATE INDEX "analytics_settings_brand_keywords_order_idx" ON "analytics_settings_brand_keywords" USING btree ("_order");
  CREATE INDEX "analytics_settings_brand_keywords_parent_id_idx" ON "analytics_settings_brand_keywords" USING btree ("_parent_id");
  CREATE INDEX "analytics_settings_referrer_patterns_host_patterns_order_idx" ON "analytics_settings_referrer_patterns_host_patterns" USING btree ("_order");
  CREATE INDEX "analytics_settings_referrer_patterns_host_patterns_parent_id_idx" ON "analytics_settings_referrer_patterns_host_patterns" USING btree ("_parent_id");
  CREATE INDEX "analytics_settings_referrer_patterns_order_idx" ON "analytics_settings_referrer_patterns" USING btree ("_order");
  CREATE INDEX "analytics_settings_referrer_patterns_parent_id_idx" ON "analytics_settings_referrer_patterns" USING btree ("_parent_id");
  CREATE INDEX "analytics_settings_bot_user_agent_patterns_order_idx" ON "analytics_settings_bot_user_agent_patterns" USING btree ("_order");
  CREATE INDEX "analytics_settings_bot_user_agent_patterns_parent_id_idx" ON "analytics_settings_bot_user_agent_patterns" USING btree ("_parent_id");
  CREATE INDEX "analytics_settings_soft404_markers_order_idx" ON "analytics_settings_soft404_markers" USING btree ("_order");
  CREATE INDEX "analytics_settings_soft404_markers_parent_id_idx" ON "analytics_settings_soft404_markers" USING btree ("_parent_id");
  CREATE INDEX "analytics_settings_goal_mapping_order_idx" ON "analytics_settings_goal_mapping" USING btree ("_order");
  CREATE INDEX "analytics_settings_goal_mapping_parent_id_idx" ON "analytics_settings_goal_mapping" USING btree ("_parent_id");
  CREATE INDEX "analytics_settings_audit_audit_last_changed_by_idx" ON "analytics_settings" USING btree ("audit_last_changed_by_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_agent_proposals_fk" FOREIGN KEY ("agent_proposals_id") REFERENCES "public"."agent_proposals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_agent_execution_log_fk" FOREIGN KEY ("agent_execution_log_id") REFERENCES "public"."agent_execution_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_annotations_fk" FOREIGN KEY ("annotations_id") REFERENCES "public"."annotations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_agent_proposals_id_idx" ON "payload_locked_documents_rels" USING btree ("agent_proposals_id");
  CREATE INDEX "payload_locked_documents_rels_agent_execution_log_id_idx" ON "payload_locked_documents_rels" USING btree ("agent_execution_log_id");
  CREATE INDEX "payload_locked_documents_rels_annotations_id_idx" ON "payload_locked_documents_rels" USING btree ("annotations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "customers_dsar_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "agent_proposals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "agent_execution_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "annotations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "analytics_settings_agent_review_enabled_evaluators" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "analytics_settings_brand_keywords" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "analytics_settings_referrer_patterns_host_patterns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "analytics_settings_referrer_patterns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "analytics_settings_bot_user_agent_patterns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "analytics_settings_soft404_markers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "analytics_settings_goal_mapping" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "analytics_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "customers_dsar_log" CASCADE;
  DROP TABLE "agent_proposals" CASCADE;
  DROP TABLE "agent_execution_log" CASCADE;
  DROP TABLE "annotations" CASCADE;
  DROP TABLE "analytics_settings_agent_review_enabled_evaluators" CASCADE;
  DROP TABLE "analytics_settings_brand_keywords" CASCADE;
  DROP TABLE "analytics_settings_referrer_patterns_host_patterns" CASCADE;
  DROP TABLE "analytics_settings_referrer_patterns" CASCADE;
  DROP TABLE "analytics_settings_bot_user_agent_patterns" CASCADE;
  DROP TABLE "analytics_settings_soft404_markers" CASCADE;
  DROP TABLE "analytics_settings_goal_mapping" CASCADE;
  DROP TABLE "analytics_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_agent_proposals_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_agent_execution_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_annotations_fk";
  
  DROP INDEX "payload_locked_documents_rels_agent_proposals_id_idx";
  DROP INDEX "payload_locked_documents_rels_agent_execution_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_annotations_id_idx";
  ALTER TABLE "customers" DROP COLUMN "first_seen_at";
  ALTER TABLE "customers" DROP COLUMN "ym_client_id";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_utm_source";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_utm_medium";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_utm_campaign";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_utm_content";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_utm_term";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_yclid";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_gclid";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_openstat";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_from";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_referer_host";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_acquisition_channel";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_acquisition_query";
  ALTER TABLE "orders" DROP COLUMN "attribution_first_touch_captured_at";
  ALTER TABLE "orders" DROP COLUMN "ym_client_id";
  ALTER TABLE "orders" DROP COLUMN "first_seen_at";
  ALTER TABLE "orders" DROP COLUMN "time_to_purchase_days";
  ALTER TABLE "orders" DROP COLUMN "visit_count_to_purchase";
  ALTER TABLE "orders" DROP COLUMN "user_type_at_conversion";
  ALTER TABLE "orders" DROP COLUMN "server_hit_status_purchase_hit_sent_at";
  ALTER TABLE "orders" DROP COLUMN "server_hit_status_purchase_hit_status";
  ALTER TABLE "orders" DROP COLUMN "server_hit_status_purchase_hit_error";
  ALTER TABLE "orders" DROP COLUMN "server_hit_status_offline_conversion_sent_at";
  ALTER TABLE "orders" DROP COLUMN "server_hit_status_offline_conversion_status";
  ALTER TABLE "orders" DROP COLUMN "server_hit_status_offline_conversion_error";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_utm_source";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_utm_medium";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_utm_campaign";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_utm_content";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_utm_term";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_yclid";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_gclid";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_openstat";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_from";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_referer_host";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_acquisition_channel";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_acquisition_query";
  ALTER TABLE "carts" DROP COLUMN "attribution_first_touch_captured_at";
  ALTER TABLE "carts" DROP COLUMN "ym_client_id";
  ALTER TABLE "carts" DROP COLUMN "ga_client_id";
  ALTER TABLE "carts" DROP COLUMN "first_seen_at";
  ALTER TABLE "carts" DROP COLUMN "user_type_at_creation";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "agent_proposals_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "agent_execution_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "annotations_id";
  DROP TYPE "public"."enum_customers_dsar_log_type";
  DROP TYPE "public"."enum_customers_dsar_log_status";
  DROP TYPE "public"."enum_orders_user_type_at_conversion";
  DROP TYPE "public"."enum_orders_server_hit_status_purchase_hit_status";
  DROP TYPE "public"."enum_orders_server_hit_status_offline_conversion_status";
  DROP TYPE "public"."enum_carts_user_type_at_creation";
  DROP TYPE "public"."enum_agent_proposals_created_by";
  DROP TYPE "public"."enum_agent_proposals_type";
  DROP TYPE "public"."enum_agent_proposals_action";
  DROP TYPE "public"."enum_agent_proposals_severity";
  DROP TYPE "public"."enum_agent_proposals_status";
  DROP TYPE "public"."enum_agent_execution_log_method";
  DROP TYPE "public"."enum_annotations_type";
  DROP TYPE "public"."enum_annotations_environment";
  DROP TYPE "public"."enum_analytics_settings_agent_review_enabled_evaluators";
  DROP TYPE "public"."enum_analytics_settings_referrer_patterns_channel";`)
}
