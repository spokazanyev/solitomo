import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'sales', 'catalog_manager', 'seo', 'agent');
  CREATE TYPE "public"."enum_customers_account_state" AS ENUM('email-only', 'password-set', 'invited-stub', 'deleted');
  CREATE TYPE "public"."enum_customers_customer_type" AS ENUM('individual', 'company-contact');
  CREATE TYPE "public"."enum_customers_role" AS ENUM('owner', 'accountant', 'purchaser', 'contact');
  CREATE TYPE "public"."enum_customers_language_preference" AS ENUM('ru', 'en');
  CREATE TYPE "public"."enum_customers_crm_last_sync_status" AS ENUM('queued', 'in_progress', 'success', 'failed');
  CREATE TYPE "public"."enum_companies_crm_last_sync_status" AS ENUM('queued', 'in_progress', 'success', 'failed');
  CREATE TYPE "public"."enum_orders_payment_refunds_provider_status" AS ENUM('pending', 'succeeded', 'failed', 'canceled');
  CREATE TYPE "public"."enum_orders_notifications_channel" AS ENUM('email', 'messenger', 'crm', 'admin_ui', 'dataLayer');
  CREATE TYPE "public"."enum_orders_notifications_status" AS ENUM('queued', 'sent', 'failed', 'skipped');
  CREATE TYPE "public"."enum_orders_type" AS ENUM('physical', 'legal', 'quote');
  CREATE TYPE "public"."enum_orders_status" AS ENUM('new', 'draft', 'pending_payment', 'awaiting_payment', 'paid', 'fulfilling', 'shipped', 'delivered', 'cancelled', 'expired', 'completed', 'returned');
  CREATE TYPE "public"."enum_orders_delivery_method" AS ENUM('pickup', 'cdek', 'boxberry', 'russian-post', 'tc');
  CREATE TYPE "public"."enum_orders_delivery_provider" AS ENUM('apiship', 'fallback');
  CREATE TYPE "public"."enum_orders_delivery_delivery_type" AS ENUM('1', '2');
  CREATE TYPE "public"."enum_orders_delivery_pickup_type" AS ENUM('1', '2');
  CREATE TYPE "public"."enum_orders_shipment_status" AS ENUM('none', 'pending', 'created', 'pending_label', 'in_transit', 'at_point', 'delivered', 'returned', 'cancelled', 'error');
  CREATE TYPE "public"."enum_orders_crm_refs_last_sync_status" AS ENUM('queued', 'in_progress', 'success', 'failed', 'quarantined');
  CREATE TYPE "public"."enum_orders_payment_method" AS ENUM('card', 'invoice');
  CREATE TYPE "public"."enum_orders_payment_provider_status" AS ENUM('none', 'pending', 'authorized', 'succeeded', 'canceled');
  CREATE TYPE "public"."enum_orders_payment_confirmation_type" AS ENUM('redirect', 'qr', 'embedded');
  CREATE TYPE "public"."enum_orders_payment_receipt_status" AS ENUM('pending', 'succeeded', 'canceled');
  CREATE TYPE "public"."enum_orders_payment_payment_method_snapshot_type" AS ENUM('bank_card', 'sbp', 'yoo_money', 'sberbank');
  CREATE TYPE "public"."enum_carts_items_warning" AS ENUM('none', 'removed', 'price_changed', 'stock_low');
  CREATE TYPE "public"."enum_carts_status" AS ENUM('active', 'abandoned', 'converted', 'expired', 'merged');
  CREATE TYPE "public"."enum_returns_items_condition" AS ENUM('unopened', 'opened_unused', 'used', 'defective');
  CREATE TYPE "public"."enum_returns_reason_category" AS ENUM('defect', 'wrong-item', 'not-needed', 'other');
  CREATE TYPE "public"."enum_returns_refund_method" AS ENUM('card-original', 'bank-transfer', 'other');
  CREATE TYPE "public"."enum_returns_return_method" AS ENUM('self_post', 'pickup_via_courier', 'drop_off');
  CREATE TYPE "public"."enum_returns_correction_receipt_status" AS ENUM('pending', 'issued', 'not_required', 'error');
  CREATE TYPE "public"."enum_returns_status" AS ENUM('requested', 'approved', 'received', 'refunded', 'rejected', 'cancelled');
  CREATE TYPE "public"."enum_returns_created_via" AS ENUM('customer-public', 'manager-manual', 'api');
  CREATE TYPE "public"."enum_rfq_requests_status" AS ENUM('new', 'in_progress', 'needs_clarification', 'quote_preparing', 'quoted', 'won', 'lost', 'spam');
  CREATE TYPE "public"."enum_rfq_requests_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum_rfq_requests_customer_type" AS ENUM('company', 'person', 'integrator');
  CREATE TYPE "public"."enum_rfq_requests_decision_status" AS ENUM('unknown', 'evaluating', 'waiting_quote', 'approval', 'won', 'lost');
  CREATE TYPE "public"."enum_products_technical_attributes_confidence" AS ENUM('manual', 'high', 'medium', 'low');
  CREATE TYPE "public"."enum_products_image_links_role" AS ENUM('primary', 'gallery', 'diagram', 'other');
  CREATE TYPE "public"."enum_products_target_queries_intent" AS ENUM('commercial', 'technical', 'informational', 'navigational');
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'review', 'published', 'archived');
  CREATE TYPE "public"."enum_products_quality_status" AS ENUM('needs_review', 'technical_review', 'content_review', 'ready');
  CREATE TYPE "public"."enum_products_product_type" AS ENUM('pdu', 'surge_filter', 'monitoring_controller', 'accessory');
  CREATE TYPE "public"."enum_products_price_status" AS ENUM('request', 'published', 'hidden');
  CREATE TYPE "public"."enum_products_availability_status" AS ENUM('request', 'in_stock', 'preorder', 'unavailable');
  CREATE TYPE "public"."enum_products_cta_mode" AS ENUM('rfq', 'buy', 'consult');
  CREATE TYPE "public"."enum_products_indexing_policy" AS ENUM('index', 'noindex', 'canonical_only');
  CREATE TYPE "public"."enum_products_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum__products_v_version_technical_attributes_confidence" AS ENUM('manual', 'high', 'medium', 'low');
  CREATE TYPE "public"."enum__products_v_version_image_links_role" AS ENUM('primary', 'gallery', 'diagram', 'other');
  CREATE TYPE "public"."enum__products_v_version_target_queries_intent" AS ENUM('commercial', 'technical', 'informational', 'navigational');
  CREATE TYPE "public"."enum__products_v_version_status" AS ENUM('draft', 'review', 'published', 'archived');
  CREATE TYPE "public"."enum__products_v_version_quality_status" AS ENUM('needs_review', 'technical_review', 'content_review', 'ready');
  CREATE TYPE "public"."enum__products_v_version_product_type" AS ENUM('pdu', 'surge_filter', 'monitoring_controller', 'accessory');
  CREATE TYPE "public"."enum__products_v_version_price_status" AS ENUM('request', 'published', 'hidden');
  CREATE TYPE "public"."enum__products_v_version_availability_status" AS ENUM('request', 'in_stock', 'preorder', 'unavailable');
  CREATE TYPE "public"."enum__products_v_version_cta_mode" AS ENUM('rfq', 'buy', 'consult');
  CREATE TYPE "public"."enum__products_v_version_indexing_policy" AS ENUM('index', 'noindex', 'canonical_only');
  CREATE TYPE "public"."enum__products_v_version_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum_categories_target_queries_intent" AS ENUM('commercial', 'technical', 'informational', 'navigational');
  CREATE TYPE "public"."enum_categories_status" AS ENUM('draft', 'review', 'published', 'archived');
  CREATE TYPE "public"."enum_categories_quality_status" AS ENUM('needs_review', 'technical_review', 'content_review', 'ready');
  CREATE TYPE "public"."enum_categories_category_type" AS ENUM('catalog', 'seo_filter', 'use_case', 'service', 'hidden');
  CREATE TYPE "public"."enum_categories_indexing_policy" AS ENUM('index', 'noindex', 'canonical_only');
  CREATE TYPE "public"."enum_categories_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum__categories_v_version_target_queries_intent" AS ENUM('commercial', 'technical', 'informational', 'navigational');
  CREATE TYPE "public"."enum__categories_v_version_status" AS ENUM('draft', 'review', 'published', 'archived');
  CREATE TYPE "public"."enum__categories_v_version_quality_status" AS ENUM('needs_review', 'technical_review', 'content_review', 'ready');
  CREATE TYPE "public"."enum__categories_v_version_category_type" AS ENUM('catalog', 'seo_filter', 'use_case', 'service', 'hidden');
  CREATE TYPE "public"."enum__categories_v_version_indexing_policy" AS ENUM('index', 'noindex', 'canonical_only');
  CREATE TYPE "public"."enum__categories_v_version_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum_attributes_value_type" AS ENUM('option', 'multi_option', 'number', 'boolean', 'text');
  CREATE TYPE "public"."enum_filter_groups_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum_filter_fields_field_type" AS ENUM('single_select', 'multi_select', 'range', 'boolean');
  CREATE TYPE "public"."enum_filter_fields_zero_results_behavior" AS ENUM('disable', 'hide', 'show');
  CREATE TYPE "public"."enum_filter_fields_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum_filter_options_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum_filter_presets_target_queries_intent" AS ENUM('commercial', 'technical', 'informational', 'navigational');
  CREATE TYPE "public"."enum_filter_presets_status" AS ENUM('draft', 'review', 'published', 'archived');
  CREATE TYPE "public"."enum_filter_presets_indexing_policy" AS ENUM('index', 'noindex', 'canonical_only');
  CREATE TYPE "public"."enum_filter_presets_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum__filter_presets_v_version_target_queries_intent" AS ENUM('commercial', 'technical', 'informational', 'navigational');
  CREATE TYPE "public"."enum__filter_presets_v_version_status" AS ENUM('draft', 'review', 'published', 'archived');
  CREATE TYPE "public"."enum__filter_presets_v_version_indexing_policy" AS ENUM('index', 'noindex', 'canonical_only');
  CREATE TYPE "public"."enum__filter_presets_v_version_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum_media_status" AS ENUM('draft', 'review', 'published', 'archived');
  CREATE TYPE "public"."enum_media_role" AS ENUM('product_primary', 'product_gallery', 'diagram', 'drawing', 'hero', 'article');
  CREATE TYPE "public"."enum_media_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum_documents_target_queries_intent" AS ENUM('commercial', 'technical', 'informational', 'navigational');
  CREATE TYPE "public"."enum_documents_status" AS ENUM('draft', 'review', 'published', 'archived');
  CREATE TYPE "public"."enum_documents_document_type" AS ENUM('passport', 'manual', 'drawing', 'diagram', 'certificate', 'declaration', 'registry', 'datasheet', 'other');
  CREATE TYPE "public"."enum_documents_indexing_policy" AS ENUM('index', 'noindex', 'canonical_only');
  CREATE TYPE "public"."enum_documents_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum__documents_v_version_target_queries_intent" AS ENUM('commercial', 'technical', 'informational', 'navigational');
  CREATE TYPE "public"."enum__documents_v_version_status" AS ENUM('draft', 'review', 'published', 'archived');
  CREATE TYPE "public"."enum__documents_v_version_document_type" AS ENUM('passport', 'manual', 'drawing', 'diagram', 'certificate', 'declaration', 'registry', 'datasheet', 'other');
  CREATE TYPE "public"."enum__documents_v_version_indexing_policy" AS ENUM('index', 'noindex', 'canonical_only');
  CREATE TYPE "public"."enum__documents_v_version_source_of_truth" AS ENUM('payload', 'source_json', 'moysklad', 'manual_approved');
  CREATE TYPE "public"."enum_static_pages_section" AS ENUM('info', 'company', 'other');
  CREATE TYPE "public"."enum_static_pages_category" AS ENUM('policy', 'info', 'faq');
  CREATE TYPE "public"."enum_static_pages_indexing_policy" AS ENUM('index', 'noindex');
  CREATE TYPE "public"."enum_static_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__static_pages_v_version_section" AS ENUM('info', 'company', 'other');
  CREATE TYPE "public"."enum__static_pages_v_version_category" AS ENUM('policy', 'info', 'faq');
  CREATE TYPE "public"."enum__static_pages_v_version_indexing_policy" AS ENUM('index', 'noindex');
  CREATE TYPE "public"."enum__static_pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_admin_change_log_actor_type" AS ENUM('user', 'agent', 'script', 'integration');
  CREATE TYPE "public"."enum_admin_change_log_change_type" AS ENUM('create', 'update', 'publish', 'archive', 'import');
  CREATE TYPE "public"."enum_admin_change_log_approval_status" AS ENUM('not_required', 'pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_shipping_logs_direction" AS ENUM('out', 'in');
  CREATE TYPE "public"."enum_crm_sync_jobs_status" AS ENUM('queued', 'in_progress', 'success', 'failed', 'quarantined');
  CREATE TYPE "public"."enum_notification_jobs_entity_collection" AS ENUM('orders', 'carts', 'returns');
  CREATE TYPE "public"."enum_notification_jobs_channel" AS ENUM('email', 'messenger', 'admin_ui', 'dataLayer');
  CREATE TYPE "public"."enum_notification_jobs_status" AS ENUM('queued', 'in_progress', 'sent', 'failed', 'skipped');
  CREATE TYPE "public"."enum_payment_events_event_type" AS ENUM('payment.waiting_for_capture', 'payment.succeeded', 'payment.canceled', 'refund.succeeded', 'refund.canceled', 'payment.refunded', 'other');
  CREATE TYPE "public"."enum_payment_events_result" AS ENUM('success', 'rejected', 'duplicate');
  CREATE TYPE "public"."enum_payment_events_rejected_reason" AS ENUM('ip_not_allowed', 'unknown_payment', 'unknown_refund', 'amount_mismatch', 'currency_mismatch', 'signature_invalid', 'settings_disabled', 'internal_error', 'parse_error');
  CREATE TYPE "public"."enum_payment_events_source" AS ENUM('webhook', 'cron_reconciliation');
  CREATE TYPE "public"."enum_apiship_settings_allowed_delivery_types" AS ENUM('doortodoor', 'doortopoint', 'pointtodoor', 'pointtopoint');
  CREATE TYPE "public"."enum_apiship_settings_defaults_delivery_cost_vat" AS ENUM('-1', '0', '5', '7', '10', '20', '22');
  CREATE TYPE "public"."enum_apiship_settings_yandex_maps_tariff_plan" AS ENUM('free', 'basic', 'commercial');
  CREATE TYPE "public"."enum_apiship_settings_dadata_tariff_plan" AS ENUM('free', 'starter', 'business');
  CREATE TYPE "public"."enum_notifications_settings_managers_events" AS ENUM('order.paid', 'order.invoice_issued', 'shipment.error', 'order.stuck', 'order.cancelled', 'everything');
  CREATE TYPE "public"."enum_notifications_settings_email_provider" AS ENUM('postmark', 'mailgun', 'sendpulse');
  CREATE TYPE "public"."enum_notifications_settings_messenger_provider" AS ENUM('telegram', 'max', 'vk_messages');
  CREATE TYPE "public"."enum_payment_settings_payment_methods" AS ENUM('bank_card', 'sbp', 'yoo_money', 'sberbank');
  CREATE TYPE "public"."enum_payment_settings_capture_mode" AS ENUM('two_stage', 'one_stage');
  CREATE TYPE "public"."enum_payment_settings_webhook_signature_mode" AS ENUM('off', 'enforce');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum_users_role" DEFAULT 'admin' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "customers_addresses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"city" varchar NOT NULL,
  	"full_address" varchar NOT NULL,
  	"postal_code" varchar,
  	"address_normalized" jsonb,
  	"is_default" boolean DEFAULT false
  );
  
  CREATE TABLE "customers_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email_valid" boolean DEFAULT true,
  	"first_name" varchar,
  	"last_name" varchar,
  	"full_name" varchar,
  	"phone" varchar,
  	"phone_normalized" varchar,
  	"account_state" "enum_customers_account_state" DEFAULT 'email-only' NOT NULL,
  	"customer_type" "enum_customers_customer_type" DEFAULT 'individual' NOT NULL,
  	"company_id_id" integer,
  	"role" "enum_customers_role" DEFAULT 'contact',
  	"consent_consented_at" timestamp(3) with time zone,
  	"consent_policy_version_privacy" varchar,
  	"consent_policy_version_offer" varchar,
  	"consent_ip_hash" varchar,
  	"consent_user_agent" varchar,
  	"magic_link_token" varchar,
  	"magic_link_expires_at" timestamp(3) with time zone,
  	"magic_link_consumed_at" timestamp(3) with time zone,
  	"magic_link_requested_from_ip" varchar,
  	"reset_password_expires_at" timestamp(3) with time zone,
  	"marketing_opt_in" boolean DEFAULT false,
  	"messenger_opt_in" boolean DEFAULT false,
  	"language_preference" "enum_customers_language_preference" DEFAULT 'ru',
  	"crm_person_id" varchar,
  	"crm_last_synced_at" timestamp(3) with time zone,
  	"crm_last_sync_status" "enum_customers_crm_last_sync_status",
  	"gdpr_consent_at" timestamp(3) with time zone,
  	"gdpr_consent_version" varchar DEFAULT '1.0',
  	"deleted_at" timestamp(3) with time zone,
  	"last_login_at" timestamp(3) with time zone,
  	"last_login_ip" varchar,
  	"last_login_user_agent" varchar,
  	"login_count" numeric DEFAULT 0,
  	"invited_by_id" integer,
  	"invite_token" varchar,
  	"invite_expires_at" timestamp(3) with time zone,
  	"invite_accepted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "companies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"tax_id" varchar NOT NULL,
  	"kpp" varchar,
  	"ogrn" varchar,
  	"legal_address" varchar,
  	"billing_address" varchar,
  	"contact_email" varchar,
  	"contact_phone" varchar,
  	"approval_limit" numeric DEFAULT 0,
  	"crm_company_id" varchar,
  	"crm_last_synced_at" timestamp(3) with time zone,
  	"crm_last_sync_status" "enum_companies_crm_last_sync_status",
  	"deleted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sku" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"quantity" numeric DEFAULT 1 NOT NULL,
  	"price" numeric,
  	"line_total" numeric,
  	"product_id" integer
  );
  
  CREATE TABLE "orders_shipment_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"event_id" varchar NOT NULL,
  	"provider_status" varchar,
  	"internal_status" varchar,
  	"at" timestamp(3) with time zone NOT NULL,
  	"received_at" timestamp(3) with time zone,
  	"message" varchar,
  	"raw" jsonb
  );
  
  CREATE TABLE "orders_payment_capture_attempts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"attempted_at" timestamp(3) with time zone NOT NULL,
  	"error" varchar NOT NULL,
  	"error_code" varchar,
  	"next_retry_at" timestamp(3) with time zone,
  	"exhausted" boolean DEFAULT false
  );
  
  CREATE TABLE "orders_payment_refunds" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"provider_refund_id" varchar NOT NULL,
  	"return_id" varchar,
  	"amount" numeric NOT NULL,
  	"refunded_at" timestamp(3) with time zone NOT NULL,
  	"provider_status" "enum_orders_payment_refunds_provider_status"
  );
  
  CREATE TABLE "orders_client_number_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"old_number" varchar NOT NULL,
  	"reissued_at" timestamp(3) with time zone NOT NULL,
  	"reason" varchar,
  	"actor_email" varchar
  );
  
  CREATE TABLE "orders_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone,
  	"from" varchar,
  	"to" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "orders_notifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"notification_id" varchar NOT NULL,
  	"event" varchar NOT NULL,
  	"channel" "enum_orders_notifications_channel" NOT NULL,
  	"template" varchar,
  	"recipient" varchar,
  	"scheduled_at" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"status" "enum_orders_notifications_status" NOT NULL,
  	"error_message" varchar,
  	"external_ref" varchar,
  	"skip_reason" varchar
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_orders_type" DEFAULT 'physical' NOT NULL,
  	"status" "enum_orders_status" DEFAULT 'new' NOT NULL,
  	"customer_label" varchar,
  	"totals_subtotal" numeric,
  	"totals_vat" numeric,
  	"totals_delivery_cost" numeric,
  	"totals_total" numeric,
  	"customer_full_name" varchar,
  	"customer_email" varchar,
  	"customer_phone" varchar,
  	"customer_company_name" varchar,
  	"customer_inn" varchar,
  	"customer_kpp" varchar,
  	"customer_ogrn" varchar,
  	"customer_legal_address" varchar,
  	"customer_email_valid" boolean DEFAULT true,
  	"delivery_method" "enum_orders_delivery_method",
  	"delivery_address" varchar,
  	"delivery_city" varchar,
  	"delivery_cost" numeric,
  	"delivery_track_number" varchar,
  	"delivery_shipped_at" timestamp(3) with time zone,
  	"delivery_provider" "enum_orders_delivery_provider" DEFAULT 'fallback',
  	"delivery_provider_key" varchar,
  	"delivery_tariff_id" numeric,
  	"delivery_delivery_type" "enum_orders_delivery_delivery_type",
  	"delivery_pickup_type" "enum_orders_delivery_pickup_type",
  	"delivery_point_id" varchar,
  	"delivery_point_address" varchar,
  	"delivery_eta_min_days" numeric,
  	"delivery_eta_max_days" numeric,
  	"delivery_selected_at" timestamp(3) with time zone,
  	"delivery_address_normalized" jsonb,
  	"delivery_price_snapshot_cost" numeric,
  	"delivery_price_snapshot_currency" varchar DEFAULT 'RUB',
  	"delivery_price_snapshot_captured_at" timestamp(3) with time zone,
  	"delivery_price_snapshot_source_cache_key" varchar,
  	"delivery_price_snapshot_refresh_check_at" timestamp(3) with time zone,
  	"delivery_pickup_expires_at" timestamp(3) with time zone,
  	"shipment_provider_order_id" varchar,
  	"shipment_tracking_number" varchar,
  	"shipment_tracking_url" varchar,
  	"shipment_label_url" varchar,
  	"shipment_waybill_url" varchar,
  	"shipment_status" "enum_orders_shipment_status" DEFAULT 'none',
  	"shipment_created_at" timestamp(3) with time zone,
  	"shipment_cancelled_at" timestamp(3) with time zone,
  	"shipment_error_message" varchar,
  	"shipment_last_synced_at" timestamp(3) with time zone,
  	"crm_refs_opportunity_id" varchar,
  	"crm_refs_person_id" varchar,
  	"crm_refs_company_id" varchar,
  	"crm_refs_last_synced_at" timestamp(3) with time zone,
  	"crm_refs_last_sync_status" "enum_orders_crm_refs_last_sync_status",
  	"crm_refs_last_sync_error" varchar,
  	"crm_refs_pending_cancellation_from_crm" boolean DEFAULT false,
  	"delivered_at" timestamp(3) with time zone,
  	"closed_at" timestamp(3) with time zone,
  	"dispute_flag" boolean DEFAULT false,
  	"payment_retry_until" timestamp(3) with time zone,
  	"has_returns" boolean DEFAULT false,
  	"returns_count" numeric DEFAULT 0,
  	"total_refunded" numeric DEFAULT 0,
  	"payment_method" "enum_orders_payment_method",
  	"payment_provider_status" "enum_orders_payment_provider_status",
  	"payment_provider_ref" varchar,
  	"payment_paid_at" timestamp(3) with time zone,
  	"payment_amount" numeric,
  	"payment_captured_at" timestamp(3) with time zone,
  	"payment_idempotence_key" varchar,
  	"payment_confirmation_url" varchar,
  	"payment_created_at" timestamp(3) with time zone,
  	"payment_confirmation_type" "enum_orders_payment_confirmation_type",
  	"payment_receipt_status" "enum_orders_payment_receipt_status",
  	"payment_vat_code_applied" numeric,
  	"payment_payment_method_snapshot_type" "enum_orders_payment_payment_method_snapshot_type",
  	"payment_payment_method_snapshot_title" varchar,
  	"payment_payment_method_snapshot_card_first6" varchar,
  	"payment_payment_method_snapshot_card_last4" varchar,
  	"payment_payment_method_snapshot_card_expiry_month" varchar,
  	"payment_payment_method_snapshot_card_expiry_year" varchar,
  	"payment_payment_method_snapshot_card_card_type" varchar,
  	"payment_payment_method_snapshot_card_issuer_country" varchar,
  	"payment_payment_method_snapshot_card_issuer_name" varchar,
  	"payment_payment_method_snapshot_sbp_bank_id" varchar,
  	"payment_payment_method_snapshot_sbp_bank_name" varchar,
  	"payment_payment_method_snapshot_yoo_money_account_number" varchar,
  	"payment_payment_method_snapshot_sberbank_phone" varchar,
  	"payment_payer_bank_details_bank_account" varchar,
  	"payment_payer_bank_details_bik" varchar,
  	"payment_payer_bank_details_recipient_name" varchar,
  	"payment_payer_bank_details_bank_name" varchar,
  	"invoice_number" varchar,
  	"invoice_issued_at" timestamp(3) with time zone,
  	"invoice_pdf_url" varchar,
  	"invoice_valid_until" timestamp(3) with time zone,
  	"source_page" varchar,
  	"public_token" varchar,
  	"cart_id_id" integer,
  	"customer_id_id" integer,
  	"company_id_id" integer,
  	"is_personal_order" boolean DEFAULT false,
  	"consent_consented_at" timestamp(3) with time zone,
  	"consent_policy_version_privacy" varchar,
  	"consent_policy_version_offer" varchar,
  	"consent_ip_hash" varchar,
  	"consent_user_agent" varchar,
  	"client_number" varchar,
  	"client_number_reissue_reason" varchar,
  	"internal_comment" varchar,
  	"marketing_opt_in" boolean DEFAULT false,
  	"messenger_opt_in" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "carts_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sku" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"qty" numeric NOT NULL,
  	"price_at_add" numeric,
  	"added_at" timestamp(3) with time zone NOT NULL,
  	"product_id_id" integer,
  	"slug" varchar,
  	"image" varchar,
  	"warning" "enum_carts_items_warning" DEFAULT 'none'
  );
  
  CREATE TABLE "carts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cart_token" varchar NOT NULL,
  	"customer_email" varchar,
  	"customer_id_id" integer,
  	"company_id_id" integer,
  	"consent_consented_at" timestamp(3) with time zone,
  	"consent_policy_version_privacy" varchar,
  	"consent_policy_version_offer" varchar,
  	"consent_ip_hash" varchar,
  	"consent_user_agent" varchar,
  	"marketing_opt_in" boolean DEFAULT false,
  	"synthetic" boolean DEFAULT false,
  	"totals_item_count" numeric DEFAULT 0,
  	"totals_subtotal" numeric DEFAULT 0,
  	"totals_known_price_count" numeric DEFAULT 0,
  	"totals_unknown_price_count" numeric DEFAULT 0,
  	"status" "enum_carts_status" DEFAULT 'active' NOT NULL,
  	"converted_to_order_id_id" integer,
  	"merged_into_id_id" integer,
  	"last_activity_at" timestamp(3) with time zone NOT NULL,
  	"abandoned_at" timestamp(3) with time zone,
  	"converted_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"source_page" varchar,
  	"utm_source" varchar,
  	"utm_medium" varchar,
  	"utm_campaign" varchar,
  	"utm_term" varchar,
  	"utm_content" varchar,
  	"user_agent" varchar,
  	"ip_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "returns_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"order_item_sku" varchar NOT NULL,
  	"product_name" varchar,
  	"qty" numeric NOT NULL,
  	"price_snapshot" numeric NOT NULL,
  	"vat_rate" varchar,
  	"reason" varchar,
  	"condition" "enum_returns_items_condition"
  );
  
  CREATE TABLE "returns_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone,
  	"from_status" varchar,
  	"to_status" varchar,
  	"by_user_id" integer,
  	"reason" varchar
  );
  
  CREATE TABLE "returns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"return_number" varchar,
  	"order_id_id" integer NOT NULL,
  	"customer_id_id" integer,
  	"order_number_snapshot" varchar,
  	"reason_category" "enum_returns_reason_category" NOT NULL,
  	"customer_notes" varchar,
  	"manager_notes" varchar,
  	"refund_amount" numeric NOT NULL,
  	"refund_method" "enum_returns_refund_method" DEFAULT 'card-original' NOT NULL,
  	"refund_provider_ref" varchar,
  	"manual_refund_confirmation_by_user_id" integer,
  	"manual_refund_confirmation_at" timestamp(3) with time zone,
  	"manual_refund_confirmation_payment_doc" varchar,
  	"manual_refund_confirmation_bank_account" varchar,
  	"manual_refund_confirmation_bik" varchar,
  	"manual_refund_confirmation_recipient_name" varchar,
  	"manual_refund_confirmation_purpose" varchar,
  	"return_method" "enum_returns_return_method" DEFAULT 'self_post',
  	"api_ship_return_order_id" varchar,
  	"return_label_url" varchar,
  	"credit_memo_number" varchar,
  	"credit_memo_pdf_url" varchar,
  	"credit_memo_issued_at" timestamp(3) with time zone,
  	"documents_error" varchar,
  	"correction_receipt_status" "enum_returns_correction_receipt_status" DEFAULT 'pending',
  	"correction_receipt_ref" varchar,
  	"status" "enum_returns_status" DEFAULT 'requested' NOT NULL,
  	"status_reason" varchar,
  	"requested_at" timestamp(3) with time zone NOT NULL,
  	"approved_at" timestamp(3) with time zone,
  	"received_at" timestamp(3) with time zone,
  	"refunded_at" timestamp(3) with time zone,
  	"rejected_at" timestamp(3) with time zone,
  	"cancelled_at" timestamp(3) with time zone,
  	"client_request_id" varchar,
  	"created_via" "enum_returns_created_via" DEFAULT 'customer-public',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "returns_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "rfq_requests_requested_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sku" varchar,
  	"name" varchar,
  	"quantity" varchar,
  	"product_id" integer
  );
  
  CREATE TABLE "rfq_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_rfq_requests_status" DEFAULT 'new' NOT NULL,
  	"priority" "enum_rfq_requests_priority" DEFAULT 'normal',
  	"assigned_manager_id" integer,
  	"source_page" varchar,
  	"utm_source" varchar,
  	"utm_medium" varchar,
  	"utm_campaign" varchar,
  	"customer_type" "enum_rfq_requests_customer_type" DEFAULT 'company',
  	"company_name" varchar,
  	"inn" varchar,
  	"contact_name" varchar NOT NULL,
  	"email" varchar,
  	"phone" varchar,
  	"city" varchar,
  	"consent_consented_at" timestamp(3) with time zone,
  	"consent_policy_version_privacy" varchar,
  	"consent_policy_version_offer" varchar,
  	"consent_ip_hash" varchar,
  	"consent_user_agent" varchar,
  	"deadline" varchar,
  	"items" varchar,
  	"message" varchar,
  	"technical_spec" varchar,
  	"analytics" varchar,
  	"internal_comment" varchar,
  	"next_action_at" timestamp(3) with time zone,
  	"quote_sent_at" timestamp(3) with time zone,
  	"quote_number" varchar,
  	"expected_budget" numeric,
  	"decision_status" "enum_rfq_requests_decision_status",
  	"close_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_technical_attributes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"attribute_id" integer NOT NULL,
  	"option_id" integer,
  	"value_text" varchar,
  	"value_number" numeric,
  	"confidence" "enum_products_technical_attributes_confidence" DEFAULT 'manual'
  );
  
  CREATE TABLE "products_image_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"role" "enum_products_image_links_role" DEFAULT 'gallery',
  	"url" varchar NOT NULL,
  	"alt" varchar
  );
  
  CREATE TABLE "products_target_queries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"query" varchar NOT NULL,
  	"intent" "enum_products_target_queries_intent"
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_products_status" DEFAULT 'draft' NOT NULL,
  	"quality_status" "enum_products_quality_status" DEFAULT 'needs_review',
  	"sku" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"external_id" varchar,
  	"title" varchar NOT NULL,
  	"h1" varchar,
  	"short_description" varchar,
  	"description" varchar,
  	"product_type" "enum_products_product_type",
  	"primary_category_id" integer,
  	"price_amount" numeric,
  	"price_currency" varchar DEFAULT 'RUB',
  	"price_status" "enum_products_price_status" DEFAULT 'request',
  	"availability_status" "enum_products_availability_status" DEFAULT 'request',
  	"cta_mode" "enum_products_cta_mode" DEFAULT 'rfq',
  	"rfq_enabled" boolean DEFAULT true,
  	"source_url" varchar,
  	"source_raw_title" varchar,
  	"source_raw_description" varchar,
  	"last_imported_at" timestamp(3) with time zone,
  	"schema_product_enabled" boolean DEFAULT true,
  	"schema_brand" varchar DEFAULT 'Soliton',
  	"schema_manufacturer" varchar DEFAULT 'Soliton',
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"canonical_url" varchar,
  	"indexing_policy" "enum_products_indexing_policy" DEFAULT 'index',
  	"agent_editable" boolean DEFAULT true,
  	"agent_lock_reason" varchar,
  	"requires_human_approval" boolean DEFAULT false,
  	"source_of_truth" "enum_products_source_of_truth" DEFAULT 'payload',
  	"validation_errors" varchar,
  	"preview_path" varchar,
  	"revision_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"media_id" integer,
  	"documents_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "_products_v_version_technical_attributes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"attribute_id" integer NOT NULL,
  	"option_id" integer,
  	"value_text" varchar,
  	"value_number" numeric,
  	"confidence" "enum__products_v_version_technical_attributes_confidence" DEFAULT 'manual',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_image_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum__products_v_version_image_links_role" DEFAULT 'gallery',
  	"url" varchar NOT NULL,
  	"alt" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_target_queries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"query" varchar NOT NULL,
  	"intent" "enum__products_v_version_target_queries_intent",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_status" "enum__products_v_version_status" DEFAULT 'draft' NOT NULL,
  	"version_quality_status" "enum__products_v_version_quality_status" DEFAULT 'needs_review',
  	"version_sku" varchar NOT NULL,
  	"version_slug" varchar NOT NULL,
  	"version_external_id" varchar,
  	"version_title" varchar NOT NULL,
  	"version_h1" varchar,
  	"version_short_description" varchar,
  	"version_description" varchar,
  	"version_product_type" "enum__products_v_version_product_type",
  	"version_primary_category_id" integer,
  	"version_price_amount" numeric,
  	"version_price_currency" varchar DEFAULT 'RUB',
  	"version_price_status" "enum__products_v_version_price_status" DEFAULT 'request',
  	"version_availability_status" "enum__products_v_version_availability_status" DEFAULT 'request',
  	"version_cta_mode" "enum__products_v_version_cta_mode" DEFAULT 'rfq',
  	"version_rfq_enabled" boolean DEFAULT true,
  	"version_source_url" varchar,
  	"version_source_raw_title" varchar,
  	"version_source_raw_description" varchar,
  	"version_last_imported_at" timestamp(3) with time zone,
  	"version_schema_product_enabled" boolean DEFAULT true,
  	"version_schema_brand" varchar DEFAULT 'Soliton',
  	"version_schema_manufacturer" varchar DEFAULT 'Soliton',
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_canonical_url" varchar,
  	"version_indexing_policy" "enum__products_v_version_indexing_policy" DEFAULT 'index',
  	"version_agent_editable" boolean DEFAULT true,
  	"version_agent_lock_reason" varchar,
  	"version_requires_human_approval" boolean DEFAULT false,
  	"version_source_of_truth" "enum__products_v_version_source_of_truth" DEFAULT 'payload',
  	"version_validation_errors" varchar,
  	"version_preview_path" varchar,
  	"version_revision_note" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_products_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"media_id" integer,
  	"documents_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "categories_target_queries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"query" varchar NOT NULL,
  	"intent" "enum_categories_target_queries_intent"
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_categories_status" DEFAULT 'draft' NOT NULL,
  	"quality_status" "enum_categories_quality_status" DEFAULT 'needs_review',
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"category_type" "enum_categories_category_type" DEFAULT 'catalog' NOT NULL,
  	"parent_id" integer,
  	"h1" varchar,
  	"intro" varchar,
  	"bottom_seo_text" varchar,
  	"schema_item_list_enabled" boolean DEFAULT true,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"canonical_url" varchar,
  	"indexing_policy" "enum_categories_indexing_policy" DEFAULT 'index',
  	"agent_editable" boolean DEFAULT true,
  	"agent_lock_reason" varchar,
  	"requires_human_approval" boolean DEFAULT false,
  	"source_of_truth" "enum_categories_source_of_truth" DEFAULT 'payload',
  	"validation_errors" varchar,
  	"preview_path" varchar,
  	"revision_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"filter_fields_id" integer,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "_categories_v_version_target_queries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"query" varchar NOT NULL,
  	"intent" "enum__categories_v_version_target_queries_intent",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_categories_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_status" "enum__categories_v_version_status" DEFAULT 'draft' NOT NULL,
  	"version_quality_status" "enum__categories_v_version_quality_status" DEFAULT 'needs_review',
  	"version_title" varchar NOT NULL,
  	"version_slug" varchar NOT NULL,
  	"version_category_type" "enum__categories_v_version_category_type" DEFAULT 'catalog' NOT NULL,
  	"version_parent_id" integer,
  	"version_h1" varchar,
  	"version_intro" varchar,
  	"version_bottom_seo_text" varchar,
  	"version_schema_item_list_enabled" boolean DEFAULT true,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_canonical_url" varchar,
  	"version_indexing_policy" "enum__categories_v_version_indexing_policy" DEFAULT 'index',
  	"version_agent_editable" boolean DEFAULT true,
  	"version_agent_lock_reason" varchar,
  	"version_requires_human_approval" boolean DEFAULT false,
  	"version_source_of_truth" "enum__categories_v_version_source_of_truth" DEFAULT 'payload',
  	"version_validation_errors" varchar,
  	"version_preview_path" varchar,
  	"version_revision_note" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_categories_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"filter_fields_id" integer,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "attribute_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"description" varchar,
  	"sort_order" numeric DEFAULT 100,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "attributes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"group_id" integer,
  	"value_type" "enum_attributes_value_type" DEFAULT 'option',
  	"unit" varchar,
  	"is_filterable" boolean DEFAULT false,
  	"is_comparable" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 100,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "attribute_options_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "attribute_options" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"attribute_id" integer NOT NULL,
  	"sort_order" numeric DEFAULT 100,
  	"is_active" boolean DEFAULT true,
  	"indexable_allowed" boolean DEFAULT false,
  	"seo_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "filter_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 100,
  	"agent_editable" boolean DEFAULT true,
  	"agent_lock_reason" varchar,
  	"requires_human_approval" boolean DEFAULT false,
  	"source_of_truth" "enum_filter_groups_source_of_truth" DEFAULT 'payload',
  	"validation_errors" varchar,
  	"preview_path" varchar,
  	"revision_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "filter_groups_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "filter_fields" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"group_id" integer,
  	"attribute_id" integer,
  	"field_type" "enum_filter_fields_field_type" DEFAULT 'multi_select',
  	"is_active" boolean DEFAULT true,
  	"show_counters" boolean DEFAULT true,
  	"recalculate_counters" boolean DEFAULT true,
  	"allow_multiple" boolean DEFAULT true,
  	"indexable_allowed" boolean DEFAULT false,
  	"zero_results_behavior" "enum_filter_fields_zero_results_behavior" DEFAULT 'disable',
  	"sort_order" numeric DEFAULT 100,
  	"agent_editable" boolean DEFAULT true,
  	"agent_lock_reason" varchar,
  	"requires_human_approval" boolean DEFAULT false,
  	"source_of_truth" "enum_filter_fields_source_of_truth" DEFAULT 'payload',
  	"validation_errors" varchar,
  	"preview_path" varchar,
  	"revision_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "filter_fields_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "filter_options_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "filter_options" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"field_id" integer NOT NULL,
  	"attribute_option_id" integer,
  	"seo_slug" varchar,
  	"sort_order" numeric DEFAULT 100,
  	"is_active" boolean DEFAULT true,
  	"indexable_allowed" boolean DEFAULT false,
  	"agent_editable" boolean DEFAULT true,
  	"agent_lock_reason" varchar,
  	"requires_human_approval" boolean DEFAULT false,
  	"source_of_truth" "enum_filter_options_source_of_truth" DEFAULT 'payload',
  	"validation_errors" varchar,
  	"preview_path" varchar,
  	"revision_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "filter_presets_conditions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"field_id" integer NOT NULL
  );
  
  CREATE TABLE "filter_presets_related_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "filter_presets_target_queries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"query" varchar NOT NULL,
  	"intent" "enum_filter_presets_target_queries_intent"
  );
  
  CREATE TABLE "filter_presets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_filter_presets_status" DEFAULT 'draft' NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"category_id" integer NOT NULL,
  	"h1" varchar,
  	"intro" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"canonical_url" varchar,
  	"indexing_policy" "enum_filter_presets_indexing_policy" DEFAULT 'index',
  	"agent_editable" boolean DEFAULT true,
  	"agent_lock_reason" varchar,
  	"requires_human_approval" boolean DEFAULT false,
  	"source_of_truth" "enum_filter_presets_source_of_truth" DEFAULT 'payload',
  	"validation_errors" varchar,
  	"preview_path" varchar,
  	"revision_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "filter_presets_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"filter_options_id" integer
  );
  
  CREATE TABLE "_filter_presets_v_version_conditions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"field_id" integer NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_filter_presets_v_version_related_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_filter_presets_v_version_target_queries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"query" varchar NOT NULL,
  	"intent" "enum__filter_presets_v_version_target_queries_intent",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_filter_presets_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_status" "enum__filter_presets_v_version_status" DEFAULT 'draft' NOT NULL,
  	"version_title" varchar NOT NULL,
  	"version_slug" varchar NOT NULL,
  	"version_category_id" integer NOT NULL,
  	"version_h1" varchar,
  	"version_intro" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_canonical_url" varchar,
  	"version_indexing_policy" "enum__filter_presets_v_version_indexing_policy" DEFAULT 'index',
  	"version_agent_editable" boolean DEFAULT true,
  	"version_agent_lock_reason" varchar,
  	"version_requires_human_approval" boolean DEFAULT false,
  	"version_source_of_truth" "enum__filter_presets_v_version_source_of_truth" DEFAULT 'payload',
  	"version_validation_errors" varchar,
  	"version_preview_path" varchar,
  	"version_revision_note" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_filter_presets_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"filter_options_id" integer
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_media_status" DEFAULT 'draft' NOT NULL,
  	"title" varchar NOT NULL,
  	"external_url" varchar,
  	"alt" varchar,
  	"caption" varchar,
  	"role" "enum_media_role",
  	"source" varchar,
  	"sort_order" numeric DEFAULT 100,
  	"agent_editable" boolean DEFAULT true,
  	"agent_lock_reason" varchar,
  	"requires_human_approval" boolean DEFAULT false,
  	"source_of_truth" "enum_media_source_of_truth" DEFAULT 'payload',
  	"validation_errors" varchar,
  	"preview_path" varchar,
  	"revision_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "documents_target_queries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"query" varchar NOT NULL,
  	"intent" "enum_documents_target_queries_intent"
  );
  
  CREATE TABLE "documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_documents_status" DEFAULT 'draft' NOT NULL,
  	"title" varchar NOT NULL,
  	"external_url" varchar,
  	"document_type" "enum_documents_document_type",
  	"version_label" varchar,
  	"proof_role" varchar,
  	"download_cta_label" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"canonical_url" varchar,
  	"indexing_policy" "enum_documents_indexing_policy" DEFAULT 'index',
  	"agent_editable" boolean DEFAULT true,
  	"agent_lock_reason" varchar,
  	"requires_human_approval" boolean DEFAULT false,
  	"source_of_truth" "enum_documents_source_of_truth" DEFAULT 'payload',
  	"validation_errors" varchar,
  	"preview_path" varchar,
  	"revision_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "_documents_v_version_target_queries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"query" varchar NOT NULL,
  	"intent" "enum__documents_v_version_target_queries_intent",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_documents_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_status" "enum__documents_v_version_status" DEFAULT 'draft' NOT NULL,
  	"version_title" varchar NOT NULL,
  	"version_external_url" varchar,
  	"version_document_type" "enum__documents_v_version_document_type",
  	"version_version_label" varchar,
  	"version_proof_role" varchar,
  	"version_download_cta_label" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_canonical_url" varchar,
  	"version_indexing_policy" "enum__documents_v_version_indexing_policy" DEFAULT 'index',
  	"version_agent_editable" boolean DEFAULT true,
  	"version_agent_lock_reason" varchar,
  	"version_requires_human_approval" boolean DEFAULT false,
  	"version_source_of_truth" "enum__documents_v_version_source_of_truth" DEFAULT 'payload',
  	"version_validation_errors" varchar,
  	"version_preview_path" varchar,
  	"version_revision_note" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_documents_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "static_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"section" "enum_static_pages_section" DEFAULT 'info',
  	"title" varchar,
  	"subtitle" varchar,
  	"body" jsonb,
  	"category" "enum_static_pages_category" DEFAULT 'info',
  	"version" varchar,
  	"effective_from" timestamp(3) with time zone,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"indexing_policy" "enum_static_pages_indexing_policy" DEFAULT 'index',
  	"status" "enum_static_pages_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_static_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_static_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_section" "enum__static_pages_v_version_section" DEFAULT 'info',
  	"version_title" varchar,
  	"version_subtitle" varchar,
  	"version_body" jsonb,
  	"version_category" "enum__static_pages_v_version_category" DEFAULT 'info',
  	"version_version" varchar,
  	"version_effective_from" timestamp(3) with time zone,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_indexing_policy" "enum__static_pages_v_version_indexing_policy" DEFAULT 'index',
  	"version_status" "enum__static_pages_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__static_pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "admin_change_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"actor_type" "enum_admin_change_log_actor_type" DEFAULT 'agent' NOT NULL,
  	"actor_name" varchar,
  	"target_collection" varchar NOT NULL,
  	"target_id" varchar,
  	"target_label" varchar NOT NULL,
  	"change_type" "enum_admin_change_log_change_type" NOT NULL,
  	"before_snapshot" jsonb,
  	"after_snapshot" jsonb,
  	"diff_summary" varchar,
  	"reason" varchar,
  	"approval_status" "enum_admin_change_log_approval_status" DEFAULT 'not_required',
  	"approved_by" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "shipping_calculations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "shipping_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"direction" "enum_shipping_logs_direction" NOT NULL,
  	"endpoint" varchar NOT NULL,
  	"method" varchar,
  	"status" numeric,
  	"request_id" varchar,
  	"order_id" varchar,
  	"duration_ms" numeric,
  	"request" jsonb,
  	"response" jsonb,
  	"error" varchar,
  	"at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "crm_sync_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"job_id" varchar NOT NULL,
  	"order_id" varchar NOT NULL,
  	"event" varchar NOT NULL,
  	"payload" jsonb,
  	"attempt" numeric DEFAULT 0,
  	"status" "enum_crm_sync_jobs_status" DEFAULT 'queued' NOT NULL,
  	"last_attempt_at" timestamp(3) with time zone,
  	"next_attempt_at" timestamp(3) with time zone,
  	"error_message" varchar,
  	"error_code" varchar,
  	"twenty_ref" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "notification_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"notification_id" varchar NOT NULL,
  	"order_id_id" integer,
  	"entity_collection" "enum_notification_jobs_entity_collection",
  	"entity_id" varchar,
  	"event" varchar NOT NULL,
  	"channel" "enum_notification_jobs_channel" NOT NULL,
  	"template" varchar NOT NULL,
  	"recipient" varchar NOT NULL,
  	"scheduled_at" timestamp(3) with time zone NOT NULL,
  	"sent_at" timestamp(3) with time zone,
  	"status" "enum_notification_jobs_status" DEFAULT 'queued' NOT NULL,
  	"attempt" numeric DEFAULT 0,
  	"next_attempt_at" timestamp(3) with time zone,
  	"error_message" varchar,
  	"error_code" varchar,
  	"external_ref" varchar,
  	"payload" jsonb,
  	"skip_reason" varchar,
  	"dedup_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payment_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_id" varchar NOT NULL,
  	"event_type" "enum_payment_events_event_type" NOT NULL,
  	"provider_ref" varchar NOT NULL,
  	"order_id" integer,
  	"return_id" integer,
  	"payload" jsonb,
  	"truncated_at" numeric,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"processed_at" timestamp(3) with time zone,
  	"result" "enum_payment_events_result" DEFAULT 'success' NOT NULL,
  	"rejected_reason" "enum_payment_events_rejected_reason",
  	"source_ip" varchar,
  	"duplicate_count" numeric DEFAULT 0,
  	"source" "enum_payment_events_source" DEFAULT 'webhook',
  	"notification_job_id" varchar,
  	"domain_event_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"customers_id" integer,
  	"companies_id" integer,
  	"orders_id" integer,
  	"carts_id" integer,
  	"returns_id" integer,
  	"rfq_requests_id" integer,
  	"products_id" integer,
  	"categories_id" integer,
  	"attribute_groups_id" integer,
  	"attributes_id" integer,
  	"attribute_options_id" integer,
  	"filter_groups_id" integer,
  	"filter_fields_id" integer,
  	"filter_options_id" integer,
  	"filter_presets_id" integer,
  	"media_id" integer,
  	"documents_id" integer,
  	"static_pages_id" integer,
  	"admin_change_log_id" integer,
  	"shipping_calculations_id" integer,
  	"shipping_logs_id" integer,
  	"crm_sync_jobs_id" integer,
  	"notification_jobs_id" integer,
  	"payment_events_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"customers_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "apiship_settings_disabled_providers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"provider_key" varchar
  );
  
  CREATE TABLE "apiship_settings_allowed_delivery_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_apiship_settings_allowed_delivery_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "apiship_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT false,
  	"is_test" boolean DEFAULT true,
  	"token" varchar,
  	"webhook_secret" varchar,
  	"sender_country_code" varchar DEFAULT 'RU',
  	"sender_address_string" varchar,
  	"sender_contact_name" varchar,
  	"sender_phone" varchar,
  	"defaults_length" numeric DEFAULT 30,
  	"defaults_width" numeric DEFAULT 20,
  	"defaults_height" numeric DEFAULT 15,
  	"defaults_weight" numeric DEFAULT 1500,
  	"defaults_delivery_cost_vat" "enum_apiship_settings_defaults_delivery_cost_vat" DEFAULT '20',
  	"defaults_is_cod" boolean DEFAULT false,
  	"yandex_maps_api_key" varchar,
  	"yandex_maps_tariff_plan" "enum_apiship_settings_yandex_maps_tariff_plan" DEFAULT 'free',
  	"dadata_api_key" varchar,
  	"dadata_secret" varchar,
  	"dadata_tariff_plan" "enum_apiship_settings_dadata_tariff_plan" DEFAULT 'free',
  	"dadata_cache_ttl_days" numeric DEFAULT 30,
  	"lifecycle_closure_window_days" numeric DEFAULT 14,
  	"lifecycle_payment_retry_window_min" numeric DEFAULT 30,
  	"lifecycle_invoice_expires_days" numeric DEFAULT 5,
  	"lifecycle_stuck_threshold_hours_paid" numeric DEFAULT 48,
  	"lifecycle_stuck_threshold_hours_fulfilling" numeric DEFAULT 48,
  	"lifecycle_stuck_threshold_hours_shipped" numeric DEFAULT 72,
  	"lifecycle_stuck_threshold_hours_at_point" numeric DEFAULT 96,
  	"lifecycle_price_mismatch_tolerance_percent" numeric DEFAULT 5,
  	"lifecycle_price_mismatch_tolerance_absolute_r" numeric DEFAULT 100,
  	"connection_status_last_checked_at" timestamp(3) with time zone,
  	"connection_status_ok" boolean,
  	"connection_status_message" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "crm_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT false,
  	"base_url" varchar DEFAULT 'https://crm.soliton.ru' NOT NULL,
  	"api_key" varchar,
  	"workspace_id" varchar,
  	"default_assignee" varchar,
  	"webhook_secret" varchar,
  	"mapping_create_company_for_b2_b" boolean DEFAULT true,
  	"mapping_link_person_by_email" boolean DEFAULT true,
  	"mapping_link_company_by_tax_id" boolean DEFAULT true,
  	"stage_map_draft" varchar DEFAULT 'New',
  	"stage_map_pending_payment" varchar DEFAULT 'Quote',
  	"stage_map_awaiting_payment" varchar DEFAULT 'Quote',
  	"stage_map_paid" varchar DEFAULT 'Won',
  	"stage_map_fulfilling" varchar DEFAULT 'Won',
  	"stage_map_shipped" varchar DEFAULT 'Won',
  	"stage_map_delivered" varchar DEFAULT 'Won',
  	"stage_map_completed" varchar DEFAULT 'Won.Closed',
  	"stage_map_cancelled" varchar DEFAULT 'Lost',
  	"stage_map_returned" varchar DEFAULT 'Lost',
  	"stage_map_expired" varchar DEFAULT 'Lost',
  	"retry_max_attempts" numeric DEFAULT 5,
  	"retry_base_delay_sec" numeric DEFAULT 30,
  	"retry_rate_limit_rpm" numeric DEFAULT 60,
  	"connection_status_last_checked_at" timestamp(3) with time zone,
  	"connection_status_ok" boolean,
  	"connection_status_message" varchar,
  	"connection_status_schema_check_ok" boolean,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "notifications_settings_managers_events" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_notifications_settings_managers_events",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "notifications_settings_managers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "notifications_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT false,
  	"email_provider" "enum_notifications_settings_email_provider" DEFAULT 'postmark' NOT NULL,
  	"email_api_key" varchar,
  	"email_domain" varchar,
  	"email_from" varchar DEFAULT 'Soliton <orders@soliton.ru>' NOT NULL,
  	"email_reply_to" varchar DEFAULT 'support@soliton.ru',
  	"email_sandbox" boolean DEFAULT true,
  	"messenger_enabled" boolean DEFAULT false,
  	"messenger_provider" "enum_notifications_settings_messenger_provider" DEFAULT 'telegram',
  	"marketing_cart_abandonment_enabled" boolean DEFAULT false,
  	"marketing_cart_abandonment_delay_min" numeric DEFAULT 60,
  	"marketing_nps_enabled" boolean DEFAULT true,
  	"retry_max_attempts" numeric DEFAULT 5,
  	"retry_base_delay_sec" numeric DEFAULT 30,
  	"retry_stuck_queue_threshold" numeric DEFAULT 100,
  	"connection_status_last_checked_at" timestamp(3) with time zone,
  	"connection_status_email_ok" boolean,
  	"connection_status_message" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payment_settings_payment_methods" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_payment_settings_payment_methods",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payment_settings_allowed_legacy_vat_codes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" numeric NOT NULL
  );
  
  CREATE TABLE "payment_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"capture_mode" "enum_payment_settings_capture_mode" DEFAULT 'two_stage',
  	"payment_retry_window_min" numeric DEFAULT 60,
  	"webhook_signature_mode" "enum_payment_settings_webhook_signature_mode" DEFAULT 'off',
  	"webhook_secret" varchar,
  	"tax_system_code" numeric DEFAULT 1,
  	"default_vat_code" numeric DEFAULT 12,
  	"sbp_max_amount" numeric DEFAULT 1000000,
  	"sender_company_info_inn" varchar DEFAULT '6659009140' NOT NULL,
  	"sender_company_info_legal_name" varchar DEFAULT 'ООО «НПП Солитон-1»' NOT NULL,
  	"sender_company_info_address" varchar DEFAULT '620034, г. Екатеринбург, ул. Колмогорова, д. 54а, кв. 54' NOT NULL,
  	"sender_company_info_kpp" varchar DEFAULT '667801001',
  	"audit_last_changed_by_id" integer,
  	"audit_last_changed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_addresses" ADD CONSTRAINT "customers_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_sessions" ADD CONSTRAINT "customers_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_id_companies_id_fk" FOREIGN KEY ("company_id_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_invited_by_id_customers_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_shipment_events" ADD CONSTRAINT "orders_shipment_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_payment_capture_attempts" ADD CONSTRAINT "orders_payment_capture_attempts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_payment_refunds" ADD CONSTRAINT "orders_payment_refunds_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_client_number_history" ADD CONSTRAINT "orders_client_number_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_history" ADD CONSTRAINT "orders_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_notifications" ADD CONSTRAINT "orders_notifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_id_id_carts_id_fk" FOREIGN KEY ("cart_id_id") REFERENCES "public"."carts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_id_customers_id_fk" FOREIGN KEY ("customer_id_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_id_companies_id_fk" FOREIGN KEY ("company_id_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "carts_items" ADD CONSTRAINT "carts_items_product_id_id_products_id_fk" FOREIGN KEY ("product_id_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "carts_items" ADD CONSTRAINT "carts_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_id_customers_id_fk" FOREIGN KEY ("customer_id_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "carts" ADD CONSTRAINT "carts_company_id_id_companies_id_fk" FOREIGN KEY ("company_id_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "carts" ADD CONSTRAINT "carts_converted_to_order_id_id_orders_id_fk" FOREIGN KEY ("converted_to_order_id_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "carts" ADD CONSTRAINT "carts_merged_into_id_id_carts_id_fk" FOREIGN KEY ("merged_into_id_id") REFERENCES "public"."carts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "returns_items" ADD CONSTRAINT "returns_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "returns_history" ADD CONSTRAINT "returns_history_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "returns_history" ADD CONSTRAINT "returns_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_id_orders_id_fk" FOREIGN KEY ("order_id_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_id_customers_id_fk" FOREIGN KEY ("customer_id_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "returns" ADD CONSTRAINT "returns_manual_refund_confirmation_by_user_id_users_id_fk" FOREIGN KEY ("manual_refund_confirmation_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "returns_rels" ADD CONSTRAINT "returns_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "returns_rels" ADD CONSTRAINT "returns_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rfq_requests_requested_items" ADD CONSTRAINT "rfq_requests_requested_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rfq_requests_requested_items" ADD CONSTRAINT "rfq_requests_requested_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rfq_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rfq_requests" ADD CONSTRAINT "rfq_requests_assigned_manager_id_users_id_fk" FOREIGN KEY ("assigned_manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_technical_attributes" ADD CONSTRAINT "products_technical_attributes_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_technical_attributes" ADD CONSTRAINT "products_technical_attributes_option_id_attribute_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."attribute_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_technical_attributes" ADD CONSTRAINT "products_technical_attributes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_image_links" ADD CONSTRAINT "products_image_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_target_queries" ADD CONSTRAINT "products_target_queries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_technical_attributes" ADD CONSTRAINT "_products_v_version_technical_attributes_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_version_technical_attributes" ADD CONSTRAINT "_products_v_version_technical_attributes_option_id_attribute_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."attribute_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_version_technical_attributes" ADD CONSTRAINT "_products_v_version_technical_attributes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_image_links" ADD CONSTRAINT "_products_v_version_image_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_target_queries" ADD CONSTRAINT "_products_v_version_target_queries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_parent_id_products_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_primary_category_id_categories_id_fk" FOREIGN KEY ("version_primary_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_target_queries" ADD CONSTRAINT "categories_target_queries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_rels" ADD CONSTRAINT "categories_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_rels" ADD CONSTRAINT "categories_rels_filter_fields_fk" FOREIGN KEY ("filter_fields_id") REFERENCES "public"."filter_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_rels" ADD CONSTRAINT "categories_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_rels" ADD CONSTRAINT "categories_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_version_target_queries" ADD CONSTRAINT "_categories_v_version_target_queries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_parent_id_categories_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_rels" ADD CONSTRAINT "_categories_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_rels" ADD CONSTRAINT "_categories_v_rels_filter_fields_fk" FOREIGN KEY ("filter_fields_id") REFERENCES "public"."filter_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_rels" ADD CONSTRAINT "_categories_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_rels" ADD CONSTRAINT "_categories_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "attributes" ADD CONSTRAINT "attributes_group_id_attribute_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."attribute_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attribute_options_aliases" ADD CONSTRAINT "attribute_options_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."attribute_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "filter_groups_rels" ADD CONSTRAINT "filter_groups_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."filter_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "filter_groups_rels" ADD CONSTRAINT "filter_groups_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "filter_fields" ADD CONSTRAINT "filter_fields_group_id_filter_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."filter_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "filter_fields" ADD CONSTRAINT "filter_fields_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "filter_fields_rels" ADD CONSTRAINT "filter_fields_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."filter_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "filter_fields_rels" ADD CONSTRAINT "filter_fields_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "filter_options_aliases" ADD CONSTRAINT "filter_options_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."filter_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "filter_options" ADD CONSTRAINT "filter_options_field_id_filter_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."filter_fields"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "filter_options" ADD CONSTRAINT "filter_options_attribute_option_id_attribute_options_id_fk" FOREIGN KEY ("attribute_option_id") REFERENCES "public"."attribute_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "filter_presets_conditions" ADD CONSTRAINT "filter_presets_conditions_field_id_filter_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."filter_fields"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "filter_presets_conditions" ADD CONSTRAINT "filter_presets_conditions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."filter_presets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "filter_presets_related_links" ADD CONSTRAINT "filter_presets_related_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."filter_presets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "filter_presets_target_queries" ADD CONSTRAINT "filter_presets_target_queries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."filter_presets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "filter_presets" ADD CONSTRAINT "filter_presets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "filter_presets_rels" ADD CONSTRAINT "filter_presets_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."filter_presets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "filter_presets_rels" ADD CONSTRAINT "filter_presets_rels_filter_options_fk" FOREIGN KEY ("filter_options_id") REFERENCES "public"."filter_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_filter_presets_v_version_conditions" ADD CONSTRAINT "_filter_presets_v_version_conditions_field_id_filter_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."filter_fields"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_filter_presets_v_version_conditions" ADD CONSTRAINT "_filter_presets_v_version_conditions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_filter_presets_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_filter_presets_v_version_related_links" ADD CONSTRAINT "_filter_presets_v_version_related_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_filter_presets_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_filter_presets_v_version_target_queries" ADD CONSTRAINT "_filter_presets_v_version_target_queries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_filter_presets_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_filter_presets_v" ADD CONSTRAINT "_filter_presets_v_parent_id_filter_presets_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."filter_presets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_filter_presets_v" ADD CONSTRAINT "_filter_presets_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_filter_presets_v_rels" ADD CONSTRAINT "_filter_presets_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_filter_presets_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_filter_presets_v_rels" ADD CONSTRAINT "_filter_presets_v_rels_filter_options_fk" FOREIGN KEY ("filter_options_id") REFERENCES "public"."filter_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_target_queries" ADD CONSTRAINT "documents_target_queries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_rels" ADD CONSTRAINT "documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_rels" ADD CONSTRAINT "documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_rels" ADD CONSTRAINT "documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_documents_v_version_target_queries" ADD CONSTRAINT "_documents_v_version_target_queries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_documents_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_documents_v" ADD CONSTRAINT "_documents_v_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_documents_v_rels" ADD CONSTRAINT "_documents_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_documents_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_documents_v_rels" ADD CONSTRAINT "_documents_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_documents_v_rels" ADD CONSTRAINT "_documents_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_static_pages_v" ADD CONSTRAINT "_static_pages_v_parent_id_static_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."static_pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_order_id_id_orders_id_fk" FOREIGN KEY ("order_id_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_companies_fk" FOREIGN KEY ("companies_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_carts_fk" FOREIGN KEY ("carts_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_returns_fk" FOREIGN KEY ("returns_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rfq_requests_fk" FOREIGN KEY ("rfq_requests_id") REFERENCES "public"."rfq_requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_attribute_groups_fk" FOREIGN KEY ("attribute_groups_id") REFERENCES "public"."attribute_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_attributes_fk" FOREIGN KEY ("attributes_id") REFERENCES "public"."attributes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_attribute_options_fk" FOREIGN KEY ("attribute_options_id") REFERENCES "public"."attribute_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_filter_groups_fk" FOREIGN KEY ("filter_groups_id") REFERENCES "public"."filter_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_filter_fields_fk" FOREIGN KEY ("filter_fields_id") REFERENCES "public"."filter_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_filter_options_fk" FOREIGN KEY ("filter_options_id") REFERENCES "public"."filter_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_filter_presets_fk" FOREIGN KEY ("filter_presets_id") REFERENCES "public"."filter_presets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_static_pages_fk" FOREIGN KEY ("static_pages_id") REFERENCES "public"."static_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admin_change_log_fk" FOREIGN KEY ("admin_change_log_id") REFERENCES "public"."admin_change_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shipping_calculations_fk" FOREIGN KEY ("shipping_calculations_id") REFERENCES "public"."shipping_calculations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shipping_logs_fk" FOREIGN KEY ("shipping_logs_id") REFERENCES "public"."shipping_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_crm_sync_jobs_fk" FOREIGN KEY ("crm_sync_jobs_id") REFERENCES "public"."crm_sync_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_jobs_fk" FOREIGN KEY ("notification_jobs_id") REFERENCES "public"."notification_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payment_events_fk" FOREIGN KEY ("payment_events_id") REFERENCES "public"."payment_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "apiship_settings_disabled_providers" ADD CONSTRAINT "apiship_settings_disabled_providers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."apiship_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "apiship_settings_allowed_delivery_types" ADD CONSTRAINT "apiship_settings_allowed_delivery_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."apiship_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifications_settings_managers_events" ADD CONSTRAINT "notifications_settings_managers_events_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notifications_settings_managers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifications_settings_managers" ADD CONSTRAINT "notifications_settings_managers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."notifications_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payment_settings_payment_methods" ADD CONSTRAINT "payment_settings_payment_methods_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payment_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payment_settings_allowed_legacy_vat_codes" ADD CONSTRAINT "payment_settings_allowed_legacy_vat_codes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payment_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_audit_last_changed_by_id_users_id_fk" FOREIGN KEY ("audit_last_changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "customers_addresses_order_idx" ON "customers_addresses" USING btree ("_order");
  CREATE INDEX "customers_addresses_parent_id_idx" ON "customers_addresses" USING btree ("_parent_id");
  CREATE INDEX "customers_sessions_order_idx" ON "customers_sessions" USING btree ("_order");
  CREATE INDEX "customers_sessions_parent_id_idx" ON "customers_sessions" USING btree ("_parent_id");
  CREATE INDEX "customers_account_state_idx" ON "customers" USING btree ("account_state");
  CREATE INDEX "customers_company_id_idx" ON "customers" USING btree ("company_id_id");
  CREATE INDEX "customers_magic_link_token_idx" ON "customers" USING btree ("magic_link_token");
  CREATE INDEX "customers_deleted_at_idx" ON "customers" USING btree ("deleted_at");
  CREATE INDEX "customers_invited_by_idx" ON "customers" USING btree ("invited_by_id");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE INDEX "customers_reset_password_token_idx" ON "customers" USING btree ("reset_password_token");
  CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");
  CREATE UNIQUE INDEX "companies_tax_id_idx" ON "companies" USING btree ("tax_id");
  CREATE INDEX "companies_updated_at_idx" ON "companies" USING btree ("updated_at");
  CREATE INDEX "companies_created_at_idx" ON "companies" USING btree ("created_at");
  CREATE INDEX "orders_items_order_idx" ON "orders_items" USING btree ("_order");
  CREATE INDEX "orders_items_parent_id_idx" ON "orders_items" USING btree ("_parent_id");
  CREATE INDEX "orders_items_product_idx" ON "orders_items" USING btree ("product_id");
  CREATE INDEX "orders_shipment_events_order_idx" ON "orders_shipment_events" USING btree ("_order");
  CREATE INDEX "orders_shipment_events_parent_id_idx" ON "orders_shipment_events" USING btree ("_parent_id");
  CREATE INDEX "orders_payment_capture_attempts_order_idx" ON "orders_payment_capture_attempts" USING btree ("_order");
  CREATE INDEX "orders_payment_capture_attempts_parent_id_idx" ON "orders_payment_capture_attempts" USING btree ("_parent_id");
  CREATE INDEX "orders_payment_refunds_order_idx" ON "orders_payment_refunds" USING btree ("_order");
  CREATE INDEX "orders_payment_refunds_parent_id_idx" ON "orders_payment_refunds" USING btree ("_parent_id");
  CREATE INDEX "orders_client_number_history_order_idx" ON "orders_client_number_history" USING btree ("_order");
  CREATE INDEX "orders_client_number_history_parent_id_idx" ON "orders_client_number_history" USING btree ("_parent_id");
  CREATE INDEX "orders_history_order_idx" ON "orders_history" USING btree ("_order");
  CREATE INDEX "orders_history_parent_id_idx" ON "orders_history" USING btree ("_parent_id");
  CREATE INDEX "orders_notifications_order_idx" ON "orders_notifications" USING btree ("_order");
  CREATE INDEX "orders_notifications_parent_id_idx" ON "orders_notifications" USING btree ("_parent_id");
  CREATE INDEX "orders_payment_payment_provider_ref_idx" ON "orders" USING btree ("payment_provider_ref");
  CREATE INDEX "orders_payment_payment_idempotence_key_idx" ON "orders" USING btree ("payment_idempotence_key");
  CREATE UNIQUE INDEX "orders_cart_id_idx" ON "orders" USING btree ("cart_id_id");
  CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id_id");
  CREATE INDEX "orders_company_id_idx" ON "orders" USING btree ("company_id_id");
  CREATE UNIQUE INDEX "orders_client_number_idx" ON "orders" USING btree ("client_number");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE INDEX "carts_items_order_idx" ON "carts_items" USING btree ("_order");
  CREATE INDEX "carts_items_parent_id_idx" ON "carts_items" USING btree ("_parent_id");
  CREATE INDEX "carts_items_product_id_idx" ON "carts_items" USING btree ("product_id_id");
  CREATE UNIQUE INDEX "carts_cart_token_idx" ON "carts" USING btree ("cart_token");
  CREATE INDEX "carts_customer_email_idx" ON "carts" USING btree ("customer_email");
  CREATE INDEX "carts_customer_id_idx" ON "carts" USING btree ("customer_id_id");
  CREATE INDEX "carts_company_id_idx" ON "carts" USING btree ("company_id_id");
  CREATE INDEX "carts_synthetic_idx" ON "carts" USING btree ("synthetic");
  CREATE INDEX "carts_status_idx" ON "carts" USING btree ("status");
  CREATE INDEX "carts_converted_to_order_id_idx" ON "carts" USING btree ("converted_to_order_id_id");
  CREATE INDEX "carts_merged_into_id_idx" ON "carts" USING btree ("merged_into_id_id");
  CREATE INDEX "carts_last_activity_at_idx" ON "carts" USING btree ("last_activity_at");
  CREATE INDEX "carts_expires_at_idx" ON "carts" USING btree ("expires_at");
  CREATE INDEX "carts_updated_at_idx" ON "carts" USING btree ("updated_at");
  CREATE INDEX "carts_created_at_idx" ON "carts" USING btree ("created_at");
  CREATE INDEX "returns_items_order_idx" ON "returns_items" USING btree ("_order");
  CREATE INDEX "returns_items_parent_id_idx" ON "returns_items" USING btree ("_parent_id");
  CREATE INDEX "returns_history_order_idx" ON "returns_history" USING btree ("_order");
  CREATE INDEX "returns_history_parent_id_idx" ON "returns_history" USING btree ("_parent_id");
  CREATE INDEX "returns_history_by_user_idx" ON "returns_history" USING btree ("by_user_id");
  CREATE UNIQUE INDEX "returns_return_number_idx" ON "returns" USING btree ("return_number");
  CREATE INDEX "returns_order_id_idx" ON "returns" USING btree ("order_id_id");
  CREATE INDEX "returns_customer_id_idx" ON "returns" USING btree ("customer_id_id");
  CREATE INDEX "returns_reason_category_idx" ON "returns" USING btree ("reason_category");
  CREATE INDEX "returns_manual_refund_confirmation_manual_refund_confirm_idx" ON "returns" USING btree ("manual_refund_confirmation_by_user_id");
  CREATE INDEX "returns_credit_memo_number_idx" ON "returns" USING btree ("credit_memo_number");
  CREATE INDEX "returns_status_idx" ON "returns" USING btree ("status");
  CREATE UNIQUE INDEX "returns_client_request_id_idx" ON "returns" USING btree ("client_request_id");
  CREATE INDEX "returns_updated_at_idx" ON "returns" USING btree ("updated_at");
  CREATE INDEX "returns_created_at_idx" ON "returns" USING btree ("created_at");
  CREATE INDEX "returns_rels_order_idx" ON "returns_rels" USING btree ("order");
  CREATE INDEX "returns_rels_parent_idx" ON "returns_rels" USING btree ("parent_id");
  CREATE INDEX "returns_rels_path_idx" ON "returns_rels" USING btree ("path");
  CREATE INDEX "returns_rels_media_id_idx" ON "returns_rels" USING btree ("media_id");
  CREATE INDEX "rfq_requests_requested_items_order_idx" ON "rfq_requests_requested_items" USING btree ("_order");
  CREATE INDEX "rfq_requests_requested_items_parent_id_idx" ON "rfq_requests_requested_items" USING btree ("_parent_id");
  CREATE INDEX "rfq_requests_requested_items_product_idx" ON "rfq_requests_requested_items" USING btree ("product_id");
  CREATE INDEX "rfq_requests_assigned_manager_idx" ON "rfq_requests" USING btree ("assigned_manager_id");
  CREATE INDEX "rfq_requests_updated_at_idx" ON "rfq_requests" USING btree ("updated_at");
  CREATE INDEX "rfq_requests_created_at_idx" ON "rfq_requests" USING btree ("created_at");
  CREATE INDEX "products_technical_attributes_order_idx" ON "products_technical_attributes" USING btree ("_order");
  CREATE INDEX "products_technical_attributes_parent_id_idx" ON "products_technical_attributes" USING btree ("_parent_id");
  CREATE INDEX "products_technical_attributes_attribute_idx" ON "products_technical_attributes" USING btree ("attribute_id");
  CREATE INDEX "products_technical_attributes_option_idx" ON "products_technical_attributes" USING btree ("option_id");
  CREATE INDEX "products_image_links_order_idx" ON "products_image_links" USING btree ("_order");
  CREATE INDEX "products_image_links_parent_id_idx" ON "products_image_links" USING btree ("_parent_id");
  CREATE INDEX "products_target_queries_order_idx" ON "products_target_queries" USING btree ("_order");
  CREATE INDEX "products_target_queries_parent_id_idx" ON "products_target_queries" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "products_sku_idx" ON "products" USING btree ("sku");
  CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  CREATE INDEX "products_primary_category_idx" ON "products" USING btree ("primary_category_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_categories_id_idx" ON "products_rels" USING btree ("categories_id");
  CREATE INDEX "products_rels_media_id_idx" ON "products_rels" USING btree ("media_id");
  CREATE INDEX "products_rels_documents_id_idx" ON "products_rels" USING btree ("documents_id");
  CREATE INDEX "products_rels_products_id_idx" ON "products_rels" USING btree ("products_id");
  CREATE INDEX "_products_v_version_technical_attributes_order_idx" ON "_products_v_version_technical_attributes" USING btree ("_order");
  CREATE INDEX "_products_v_version_technical_attributes_parent_id_idx" ON "_products_v_version_technical_attributes" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_technical_attributes_attribute_idx" ON "_products_v_version_technical_attributes" USING btree ("attribute_id");
  CREATE INDEX "_products_v_version_technical_attributes_option_idx" ON "_products_v_version_technical_attributes" USING btree ("option_id");
  CREATE INDEX "_products_v_version_image_links_order_idx" ON "_products_v_version_image_links" USING btree ("_order");
  CREATE INDEX "_products_v_version_image_links_parent_id_idx" ON "_products_v_version_image_links" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_target_queries_order_idx" ON "_products_v_version_target_queries" USING btree ("_order");
  CREATE INDEX "_products_v_version_target_queries_parent_id_idx" ON "_products_v_version_target_queries" USING btree ("_parent_id");
  CREATE INDEX "_products_v_parent_idx" ON "_products_v" USING btree ("parent_id");
  CREATE INDEX "_products_v_version_version_sku_idx" ON "_products_v" USING btree ("version_sku");
  CREATE INDEX "_products_v_version_version_slug_idx" ON "_products_v" USING btree ("version_slug");
  CREATE INDEX "_products_v_version_version_primary_category_idx" ON "_products_v" USING btree ("version_primary_category_id");
  CREATE INDEX "_products_v_version_version_updated_at_idx" ON "_products_v" USING btree ("version_updated_at");
  CREATE INDEX "_products_v_version_version_created_at_idx" ON "_products_v" USING btree ("version_created_at");
  CREATE INDEX "_products_v_created_at_idx" ON "_products_v" USING btree ("created_at");
  CREATE INDEX "_products_v_updated_at_idx" ON "_products_v" USING btree ("updated_at");
  CREATE INDEX "_products_v_rels_order_idx" ON "_products_v_rels" USING btree ("order");
  CREATE INDEX "_products_v_rels_parent_idx" ON "_products_v_rels" USING btree ("parent_id");
  CREATE INDEX "_products_v_rels_path_idx" ON "_products_v_rels" USING btree ("path");
  CREATE INDEX "_products_v_rels_categories_id_idx" ON "_products_v_rels" USING btree ("categories_id");
  CREATE INDEX "_products_v_rels_media_id_idx" ON "_products_v_rels" USING btree ("media_id");
  CREATE INDEX "_products_v_rels_documents_id_idx" ON "_products_v_rels" USING btree ("documents_id");
  CREATE INDEX "_products_v_rels_products_id_idx" ON "_products_v_rels" USING btree ("products_id");
  CREATE INDEX "categories_target_queries_order_idx" ON "categories_target_queries" USING btree ("_order");
  CREATE INDEX "categories_target_queries_parent_id_idx" ON "categories_target_queries" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "categories_rels_order_idx" ON "categories_rels" USING btree ("order");
  CREATE INDEX "categories_rels_parent_idx" ON "categories_rels" USING btree ("parent_id");
  CREATE INDEX "categories_rels_path_idx" ON "categories_rels" USING btree ("path");
  CREATE INDEX "categories_rels_filter_fields_id_idx" ON "categories_rels" USING btree ("filter_fields_id");
  CREATE INDEX "categories_rels_products_id_idx" ON "categories_rels" USING btree ("products_id");
  CREATE INDEX "categories_rels_categories_id_idx" ON "categories_rels" USING btree ("categories_id");
  CREATE INDEX "_categories_v_version_target_queries_order_idx" ON "_categories_v_version_target_queries" USING btree ("_order");
  CREATE INDEX "_categories_v_version_target_queries_parent_id_idx" ON "_categories_v_version_target_queries" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_parent_idx" ON "_categories_v" USING btree ("parent_id");
  CREATE INDEX "_categories_v_version_version_slug_idx" ON "_categories_v" USING btree ("version_slug");
  CREATE INDEX "_categories_v_version_version_parent_idx" ON "_categories_v" USING btree ("version_parent_id");
  CREATE INDEX "_categories_v_version_version_updated_at_idx" ON "_categories_v" USING btree ("version_updated_at");
  CREATE INDEX "_categories_v_version_version_created_at_idx" ON "_categories_v" USING btree ("version_created_at");
  CREATE INDEX "_categories_v_created_at_idx" ON "_categories_v" USING btree ("created_at");
  CREATE INDEX "_categories_v_updated_at_idx" ON "_categories_v" USING btree ("updated_at");
  CREATE INDEX "_categories_v_rels_order_idx" ON "_categories_v_rels" USING btree ("order");
  CREATE INDEX "_categories_v_rels_parent_idx" ON "_categories_v_rels" USING btree ("parent_id");
  CREATE INDEX "_categories_v_rels_path_idx" ON "_categories_v_rels" USING btree ("path");
  CREATE INDEX "_categories_v_rels_filter_fields_id_idx" ON "_categories_v_rels" USING btree ("filter_fields_id");
  CREATE INDEX "_categories_v_rels_products_id_idx" ON "_categories_v_rels" USING btree ("products_id");
  CREATE INDEX "_categories_v_rels_categories_id_idx" ON "_categories_v_rels" USING btree ("categories_id");
  CREATE UNIQUE INDEX "attribute_groups_code_idx" ON "attribute_groups" USING btree ("code");
  CREATE INDEX "attribute_groups_updated_at_idx" ON "attribute_groups" USING btree ("updated_at");
  CREATE INDEX "attribute_groups_created_at_idx" ON "attribute_groups" USING btree ("created_at");
  CREATE UNIQUE INDEX "attributes_code_idx" ON "attributes" USING btree ("code");
  CREATE INDEX "attributes_group_idx" ON "attributes" USING btree ("group_id");
  CREATE INDEX "attributes_updated_at_idx" ON "attributes" USING btree ("updated_at");
  CREATE INDEX "attributes_created_at_idx" ON "attributes" USING btree ("created_at");
  CREATE INDEX "attribute_options_aliases_order_idx" ON "attribute_options_aliases" USING btree ("_order");
  CREATE INDEX "attribute_options_aliases_parent_id_idx" ON "attribute_options_aliases" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "attribute_options_code_idx" ON "attribute_options" USING btree ("code");
  CREATE INDEX "attribute_options_attribute_idx" ON "attribute_options" USING btree ("attribute_id");
  CREATE INDEX "attribute_options_updated_at_idx" ON "attribute_options" USING btree ("updated_at");
  CREATE INDEX "attribute_options_created_at_idx" ON "attribute_options" USING btree ("created_at");
  CREATE UNIQUE INDEX "filter_groups_code_idx" ON "filter_groups" USING btree ("code");
  CREATE INDEX "filter_groups_updated_at_idx" ON "filter_groups" USING btree ("updated_at");
  CREATE INDEX "filter_groups_created_at_idx" ON "filter_groups" USING btree ("created_at");
  CREATE INDEX "filter_groups_rels_order_idx" ON "filter_groups_rels" USING btree ("order");
  CREATE INDEX "filter_groups_rels_parent_idx" ON "filter_groups_rels" USING btree ("parent_id");
  CREATE INDEX "filter_groups_rels_path_idx" ON "filter_groups_rels" USING btree ("path");
  CREATE INDEX "filter_groups_rels_categories_id_idx" ON "filter_groups_rels" USING btree ("categories_id");
  CREATE UNIQUE INDEX "filter_fields_code_idx" ON "filter_fields" USING btree ("code");
  CREATE INDEX "filter_fields_group_idx" ON "filter_fields" USING btree ("group_id");
  CREATE INDEX "filter_fields_attribute_idx" ON "filter_fields" USING btree ("attribute_id");
  CREATE INDEX "filter_fields_updated_at_idx" ON "filter_fields" USING btree ("updated_at");
  CREATE INDEX "filter_fields_created_at_idx" ON "filter_fields" USING btree ("created_at");
  CREATE INDEX "filter_fields_rels_order_idx" ON "filter_fields_rels" USING btree ("order");
  CREATE INDEX "filter_fields_rels_parent_idx" ON "filter_fields_rels" USING btree ("parent_id");
  CREATE INDEX "filter_fields_rels_path_idx" ON "filter_fields_rels" USING btree ("path");
  CREATE INDEX "filter_fields_rels_categories_id_idx" ON "filter_fields_rels" USING btree ("categories_id");
  CREATE INDEX "filter_options_aliases_order_idx" ON "filter_options_aliases" USING btree ("_order");
  CREATE INDEX "filter_options_aliases_parent_id_idx" ON "filter_options_aliases" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "filter_options_code_idx" ON "filter_options" USING btree ("code");
  CREATE INDEX "filter_options_field_idx" ON "filter_options" USING btree ("field_id");
  CREATE INDEX "filter_options_attribute_option_idx" ON "filter_options" USING btree ("attribute_option_id");
  CREATE INDEX "filter_options_updated_at_idx" ON "filter_options" USING btree ("updated_at");
  CREATE INDEX "filter_options_created_at_idx" ON "filter_options" USING btree ("created_at");
  CREATE INDEX "filter_presets_conditions_order_idx" ON "filter_presets_conditions" USING btree ("_order");
  CREATE INDEX "filter_presets_conditions_parent_id_idx" ON "filter_presets_conditions" USING btree ("_parent_id");
  CREATE INDEX "filter_presets_conditions_field_idx" ON "filter_presets_conditions" USING btree ("field_id");
  CREATE INDEX "filter_presets_related_links_order_idx" ON "filter_presets_related_links" USING btree ("_order");
  CREATE INDEX "filter_presets_related_links_parent_id_idx" ON "filter_presets_related_links" USING btree ("_parent_id");
  CREATE INDEX "filter_presets_target_queries_order_idx" ON "filter_presets_target_queries" USING btree ("_order");
  CREATE INDEX "filter_presets_target_queries_parent_id_idx" ON "filter_presets_target_queries" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "filter_presets_slug_idx" ON "filter_presets" USING btree ("slug");
  CREATE INDEX "filter_presets_category_idx" ON "filter_presets" USING btree ("category_id");
  CREATE INDEX "filter_presets_updated_at_idx" ON "filter_presets" USING btree ("updated_at");
  CREATE INDEX "filter_presets_created_at_idx" ON "filter_presets" USING btree ("created_at");
  CREATE INDEX "filter_presets_rels_order_idx" ON "filter_presets_rels" USING btree ("order");
  CREATE INDEX "filter_presets_rels_parent_idx" ON "filter_presets_rels" USING btree ("parent_id");
  CREATE INDEX "filter_presets_rels_path_idx" ON "filter_presets_rels" USING btree ("path");
  CREATE INDEX "filter_presets_rels_filter_options_id_idx" ON "filter_presets_rels" USING btree ("filter_options_id");
  CREATE INDEX "_filter_presets_v_version_conditions_order_idx" ON "_filter_presets_v_version_conditions" USING btree ("_order");
  CREATE INDEX "_filter_presets_v_version_conditions_parent_id_idx" ON "_filter_presets_v_version_conditions" USING btree ("_parent_id");
  CREATE INDEX "_filter_presets_v_version_conditions_field_idx" ON "_filter_presets_v_version_conditions" USING btree ("field_id");
  CREATE INDEX "_filter_presets_v_version_related_links_order_idx" ON "_filter_presets_v_version_related_links" USING btree ("_order");
  CREATE INDEX "_filter_presets_v_version_related_links_parent_id_idx" ON "_filter_presets_v_version_related_links" USING btree ("_parent_id");
  CREATE INDEX "_filter_presets_v_version_target_queries_order_idx" ON "_filter_presets_v_version_target_queries" USING btree ("_order");
  CREATE INDEX "_filter_presets_v_version_target_queries_parent_id_idx" ON "_filter_presets_v_version_target_queries" USING btree ("_parent_id");
  CREATE INDEX "_filter_presets_v_parent_idx" ON "_filter_presets_v" USING btree ("parent_id");
  CREATE INDEX "_filter_presets_v_version_version_slug_idx" ON "_filter_presets_v" USING btree ("version_slug");
  CREATE INDEX "_filter_presets_v_version_version_category_idx" ON "_filter_presets_v" USING btree ("version_category_id");
  CREATE INDEX "_filter_presets_v_version_version_updated_at_idx" ON "_filter_presets_v" USING btree ("version_updated_at");
  CREATE INDEX "_filter_presets_v_version_version_created_at_idx" ON "_filter_presets_v" USING btree ("version_created_at");
  CREATE INDEX "_filter_presets_v_created_at_idx" ON "_filter_presets_v" USING btree ("created_at");
  CREATE INDEX "_filter_presets_v_updated_at_idx" ON "_filter_presets_v" USING btree ("updated_at");
  CREATE INDEX "_filter_presets_v_rels_order_idx" ON "_filter_presets_v_rels" USING btree ("order");
  CREATE INDEX "_filter_presets_v_rels_parent_idx" ON "_filter_presets_v_rels" USING btree ("parent_id");
  CREATE INDEX "_filter_presets_v_rels_path_idx" ON "_filter_presets_v_rels" USING btree ("path");
  CREATE INDEX "_filter_presets_v_rels_filter_options_id_idx" ON "_filter_presets_v_rels" USING btree ("filter_options_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE INDEX "media_rels_order_idx" ON "media_rels" USING btree ("order");
  CREATE INDEX "media_rels_parent_idx" ON "media_rels" USING btree ("parent_id");
  CREATE INDEX "media_rels_path_idx" ON "media_rels" USING btree ("path");
  CREATE INDEX "media_rels_products_id_idx" ON "media_rels" USING btree ("products_id");
  CREATE INDEX "media_rels_categories_id_idx" ON "media_rels" USING btree ("categories_id");
  CREATE INDEX "documents_target_queries_order_idx" ON "documents_target_queries" USING btree ("_order");
  CREATE INDEX "documents_target_queries_parent_id_idx" ON "documents_target_queries" USING btree ("_parent_id");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE INDEX "documents_rels_order_idx" ON "documents_rels" USING btree ("order");
  CREATE INDEX "documents_rels_parent_idx" ON "documents_rels" USING btree ("parent_id");
  CREATE INDEX "documents_rels_path_idx" ON "documents_rels" USING btree ("path");
  CREATE INDEX "documents_rels_products_id_idx" ON "documents_rels" USING btree ("products_id");
  CREATE INDEX "documents_rels_categories_id_idx" ON "documents_rels" USING btree ("categories_id");
  CREATE INDEX "_documents_v_version_target_queries_order_idx" ON "_documents_v_version_target_queries" USING btree ("_order");
  CREATE INDEX "_documents_v_version_target_queries_parent_id_idx" ON "_documents_v_version_target_queries" USING btree ("_parent_id");
  CREATE INDEX "_documents_v_parent_idx" ON "_documents_v" USING btree ("parent_id");
  CREATE INDEX "_documents_v_version_version_updated_at_idx" ON "_documents_v" USING btree ("version_updated_at");
  CREATE INDEX "_documents_v_version_version_created_at_idx" ON "_documents_v" USING btree ("version_created_at");
  CREATE INDEX "_documents_v_created_at_idx" ON "_documents_v" USING btree ("created_at");
  CREATE INDEX "_documents_v_updated_at_idx" ON "_documents_v" USING btree ("updated_at");
  CREATE INDEX "_documents_v_rels_order_idx" ON "_documents_v_rels" USING btree ("order");
  CREATE INDEX "_documents_v_rels_parent_idx" ON "_documents_v_rels" USING btree ("parent_id");
  CREATE INDEX "_documents_v_rels_path_idx" ON "_documents_v_rels" USING btree ("path");
  CREATE INDEX "_documents_v_rels_products_id_idx" ON "_documents_v_rels" USING btree ("products_id");
  CREATE INDEX "_documents_v_rels_categories_id_idx" ON "_documents_v_rels" USING btree ("categories_id");
  CREATE UNIQUE INDEX "static_pages_slug_idx" ON "static_pages" USING btree ("slug");
  CREATE INDEX "static_pages_updated_at_idx" ON "static_pages" USING btree ("updated_at");
  CREATE INDEX "static_pages_created_at_idx" ON "static_pages" USING btree ("created_at");
  CREATE INDEX "static_pages__status_idx" ON "static_pages" USING btree ("_status");
  CREATE INDEX "_static_pages_v_parent_idx" ON "_static_pages_v" USING btree ("parent_id");
  CREATE INDEX "_static_pages_v_version_version_slug_idx" ON "_static_pages_v" USING btree ("version_slug");
  CREATE INDEX "_static_pages_v_version_version_updated_at_idx" ON "_static_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_static_pages_v_version_version_created_at_idx" ON "_static_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_static_pages_v_version_version__status_idx" ON "_static_pages_v" USING btree ("version__status");
  CREATE INDEX "_static_pages_v_created_at_idx" ON "_static_pages_v" USING btree ("created_at");
  CREATE INDEX "_static_pages_v_updated_at_idx" ON "_static_pages_v" USING btree ("updated_at");
  CREATE INDEX "_static_pages_v_latest_idx" ON "_static_pages_v" USING btree ("latest");
  CREATE INDEX "admin_change_log_updated_at_idx" ON "admin_change_log" USING btree ("updated_at");
  CREATE INDEX "admin_change_log_created_at_idx" ON "admin_change_log" USING btree ("created_at");
  CREATE UNIQUE INDEX "shipping_calculations_key_idx" ON "shipping_calculations" USING btree ("key");
  CREATE INDEX "shipping_calculations_updated_at_idx" ON "shipping_calculations" USING btree ("updated_at");
  CREATE INDEX "shipping_calculations_created_at_idx" ON "shipping_calculations" USING btree ("created_at");
  CREATE INDEX "expiresAt_idx" ON "shipping_calculations" USING btree ("expires_at");
  CREATE INDEX "shipping_logs_updated_at_idx" ON "shipping_logs" USING btree ("updated_at");
  CREATE INDEX "shipping_logs_created_at_idx" ON "shipping_logs" USING btree ("created_at");
  CREATE INDEX "at_idx" ON "shipping_logs" USING btree ("at");
  CREATE INDEX "orderId_idx" ON "shipping_logs" USING btree ("order_id");
  CREATE UNIQUE INDEX "crm_sync_jobs_job_id_idx" ON "crm_sync_jobs" USING btree ("job_id");
  CREATE INDEX "crm_sync_jobs_updated_at_idx" ON "crm_sync_jobs" USING btree ("updated_at");
  CREATE INDEX "crm_sync_jobs_created_at_idx" ON "crm_sync_jobs" USING btree ("created_at");
  CREATE INDEX "status_nextAttemptAt_idx" ON "crm_sync_jobs" USING btree ("status","next_attempt_at");
  CREATE INDEX "orderId_1_idx" ON "crm_sync_jobs" USING btree ("order_id");
  CREATE UNIQUE INDEX "notification_jobs_notification_id_idx" ON "notification_jobs" USING btree ("notification_id");
  CREATE INDEX "notification_jobs_order_id_idx" ON "notification_jobs" USING btree ("order_id_id");
  CREATE INDEX "notification_jobs_entity_id_idx" ON "notification_jobs" USING btree ("entity_id");
  CREATE INDEX "notification_jobs_updated_at_idx" ON "notification_jobs" USING btree ("updated_at");
  CREATE INDEX "notification_jobs_created_at_idx" ON "notification_jobs" USING btree ("created_at");
  CREATE INDEX "status_scheduledAt_idx" ON "notification_jobs" USING btree ("status","scheduled_at");
  CREATE INDEX "orderId_2_idx" ON "notification_jobs" USING btree ("order_id_id");
  CREATE INDEX "dedupKey_idx" ON "notification_jobs" USING btree ("dedup_key");
  CREATE UNIQUE INDEX "payment_events_event_id_idx" ON "payment_events" USING btree ("event_id");
  CREATE INDEX "payment_events_event_type_idx" ON "payment_events" USING btree ("event_type");
  CREATE INDEX "payment_events_provider_ref_idx" ON "payment_events" USING btree ("provider_ref");
  CREATE INDEX "payment_events_order_idx" ON "payment_events" USING btree ("order_id");
  CREATE INDEX "payment_events_return_idx" ON "payment_events" USING btree ("return_id");
  CREATE INDEX "payment_events_received_at_idx" ON "payment_events" USING btree ("received_at");
  CREATE INDEX "payment_events_updated_at_idx" ON "payment_events" USING btree ("updated_at");
  CREATE INDEX "payment_events_created_at_idx" ON "payment_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_companies_id_idx" ON "payload_locked_documents_rels" USING btree ("companies_id");
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_carts_id_idx" ON "payload_locked_documents_rels" USING btree ("carts_id");
  CREATE INDEX "payload_locked_documents_rels_returns_id_idx" ON "payload_locked_documents_rels" USING btree ("returns_id");
  CREATE INDEX "payload_locked_documents_rels_rfq_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("rfq_requests_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_attribute_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("attribute_groups_id");
  CREATE INDEX "payload_locked_documents_rels_attributes_id_idx" ON "payload_locked_documents_rels" USING btree ("attributes_id");
  CREATE INDEX "payload_locked_documents_rels_attribute_options_id_idx" ON "payload_locked_documents_rels" USING btree ("attribute_options_id");
  CREATE INDEX "payload_locked_documents_rels_filter_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("filter_groups_id");
  CREATE INDEX "payload_locked_documents_rels_filter_fields_id_idx" ON "payload_locked_documents_rels" USING btree ("filter_fields_id");
  CREATE INDEX "payload_locked_documents_rels_filter_options_id_idx" ON "payload_locked_documents_rels" USING btree ("filter_options_id");
  CREATE INDEX "payload_locked_documents_rels_filter_presets_id_idx" ON "payload_locked_documents_rels" USING btree ("filter_presets_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");
  CREATE INDEX "payload_locked_documents_rels_static_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("static_pages_id");
  CREATE INDEX "payload_locked_documents_rels_admin_change_log_id_idx" ON "payload_locked_documents_rels" USING btree ("admin_change_log_id");
  CREATE INDEX "payload_locked_documents_rels_shipping_calculations_id_idx" ON "payload_locked_documents_rels" USING btree ("shipping_calculations_id");
  CREATE INDEX "payload_locked_documents_rels_shipping_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("shipping_logs_id");
  CREATE INDEX "payload_locked_documents_rels_crm_sync_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("crm_sync_jobs_id");
  CREATE INDEX "payload_locked_documents_rels_notification_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("notification_jobs_id");
  CREATE INDEX "payload_locked_documents_rels_payment_events_id_idx" ON "payload_locked_documents_rels" USING btree ("payment_events_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_rels_customers_id_idx" ON "payload_preferences_rels" USING btree ("customers_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "apiship_settings_disabled_providers_order_idx" ON "apiship_settings_disabled_providers" USING btree ("_order");
  CREATE INDEX "apiship_settings_disabled_providers_parent_id_idx" ON "apiship_settings_disabled_providers" USING btree ("_parent_id");
  CREATE INDEX "apiship_settings_allowed_delivery_types_order_idx" ON "apiship_settings_allowed_delivery_types" USING btree ("order");
  CREATE INDEX "apiship_settings_allowed_delivery_types_parent_idx" ON "apiship_settings_allowed_delivery_types" USING btree ("parent_id");
  CREATE INDEX "notifications_settings_managers_events_order_idx" ON "notifications_settings_managers_events" USING btree ("order");
  CREATE INDEX "notifications_settings_managers_events_parent_idx" ON "notifications_settings_managers_events" USING btree ("parent_id");
  CREATE INDEX "notifications_settings_managers_order_idx" ON "notifications_settings_managers" USING btree ("_order");
  CREATE INDEX "notifications_settings_managers_parent_id_idx" ON "notifications_settings_managers" USING btree ("_parent_id");
  CREATE INDEX "payment_settings_payment_methods_order_idx" ON "payment_settings_payment_methods" USING btree ("order");
  CREATE INDEX "payment_settings_payment_methods_parent_idx" ON "payment_settings_payment_methods" USING btree ("parent_id");
  CREATE INDEX "payment_settings_allowed_legacy_vat_codes_order_idx" ON "payment_settings_allowed_legacy_vat_codes" USING btree ("_order");
  CREATE INDEX "payment_settings_allowed_legacy_vat_codes_parent_id_idx" ON "payment_settings_allowed_legacy_vat_codes" USING btree ("_parent_id");
  CREATE INDEX "payment_settings_audit_audit_last_changed_by_idx" ON "payment_settings" USING btree ("audit_last_changed_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "customers_addresses" CASCADE;
  DROP TABLE "customers_sessions" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "companies" CASCADE;
  DROP TABLE "orders_items" CASCADE;
  DROP TABLE "orders_shipment_events" CASCADE;
  DROP TABLE "orders_payment_capture_attempts" CASCADE;
  DROP TABLE "orders_payment_refunds" CASCADE;
  DROP TABLE "orders_client_number_history" CASCADE;
  DROP TABLE "orders_history" CASCADE;
  DROP TABLE "orders_notifications" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "carts_items" CASCADE;
  DROP TABLE "carts" CASCADE;
  DROP TABLE "returns_items" CASCADE;
  DROP TABLE "returns_history" CASCADE;
  DROP TABLE "returns" CASCADE;
  DROP TABLE "returns_rels" CASCADE;
  DROP TABLE "rfq_requests_requested_items" CASCADE;
  DROP TABLE "rfq_requests" CASCADE;
  DROP TABLE "products_technical_attributes" CASCADE;
  DROP TABLE "products_image_links" CASCADE;
  DROP TABLE "products_target_queries" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "_products_v_version_technical_attributes" CASCADE;
  DROP TABLE "_products_v_version_image_links" CASCADE;
  DROP TABLE "_products_v_version_target_queries" CASCADE;
  DROP TABLE "_products_v" CASCADE;
  DROP TABLE "_products_v_rels" CASCADE;
  DROP TABLE "categories_target_queries" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "categories_rels" CASCADE;
  DROP TABLE "_categories_v_version_target_queries" CASCADE;
  DROP TABLE "_categories_v" CASCADE;
  DROP TABLE "_categories_v_rels" CASCADE;
  DROP TABLE "attribute_groups" CASCADE;
  DROP TABLE "attributes" CASCADE;
  DROP TABLE "attribute_options_aliases" CASCADE;
  DROP TABLE "attribute_options" CASCADE;
  DROP TABLE "filter_groups" CASCADE;
  DROP TABLE "filter_groups_rels" CASCADE;
  DROP TABLE "filter_fields" CASCADE;
  DROP TABLE "filter_fields_rels" CASCADE;
  DROP TABLE "filter_options_aliases" CASCADE;
  DROP TABLE "filter_options" CASCADE;
  DROP TABLE "filter_presets_conditions" CASCADE;
  DROP TABLE "filter_presets_related_links" CASCADE;
  DROP TABLE "filter_presets_target_queries" CASCADE;
  DROP TABLE "filter_presets" CASCADE;
  DROP TABLE "filter_presets_rels" CASCADE;
  DROP TABLE "_filter_presets_v_version_conditions" CASCADE;
  DROP TABLE "_filter_presets_v_version_related_links" CASCADE;
  DROP TABLE "_filter_presets_v_version_target_queries" CASCADE;
  DROP TABLE "_filter_presets_v" CASCADE;
  DROP TABLE "_filter_presets_v_rels" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "media_rels" CASCADE;
  DROP TABLE "documents_target_queries" CASCADE;
  DROP TABLE "documents" CASCADE;
  DROP TABLE "documents_rels" CASCADE;
  DROP TABLE "_documents_v_version_target_queries" CASCADE;
  DROP TABLE "_documents_v" CASCADE;
  DROP TABLE "_documents_v_rels" CASCADE;
  DROP TABLE "static_pages" CASCADE;
  DROP TABLE "_static_pages_v" CASCADE;
  DROP TABLE "admin_change_log" CASCADE;
  DROP TABLE "shipping_calculations" CASCADE;
  DROP TABLE "shipping_logs" CASCADE;
  DROP TABLE "crm_sync_jobs" CASCADE;
  DROP TABLE "notification_jobs" CASCADE;
  DROP TABLE "payment_events" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "apiship_settings_disabled_providers" CASCADE;
  DROP TABLE "apiship_settings_allowed_delivery_types" CASCADE;
  DROP TABLE "apiship_settings" CASCADE;
  DROP TABLE "crm_settings" CASCADE;
  DROP TABLE "notifications_settings_managers_events" CASCADE;
  DROP TABLE "notifications_settings_managers" CASCADE;
  DROP TABLE "notifications_settings" CASCADE;
  DROP TABLE "payment_settings_payment_methods" CASCADE;
  DROP TABLE "payment_settings_allowed_legacy_vat_codes" CASCADE;
  DROP TABLE "payment_settings" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_customers_account_state";
  DROP TYPE "public"."enum_customers_customer_type";
  DROP TYPE "public"."enum_customers_role";
  DROP TYPE "public"."enum_customers_language_preference";
  DROP TYPE "public"."enum_customers_crm_last_sync_status";
  DROP TYPE "public"."enum_companies_crm_last_sync_status";
  DROP TYPE "public"."enum_orders_payment_refunds_provider_status";
  DROP TYPE "public"."enum_orders_notifications_channel";
  DROP TYPE "public"."enum_orders_notifications_status";
  DROP TYPE "public"."enum_orders_type";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_delivery_method";
  DROP TYPE "public"."enum_orders_delivery_provider";
  DROP TYPE "public"."enum_orders_delivery_delivery_type";
  DROP TYPE "public"."enum_orders_delivery_pickup_type";
  DROP TYPE "public"."enum_orders_shipment_status";
  DROP TYPE "public"."enum_orders_crm_refs_last_sync_status";
  DROP TYPE "public"."enum_orders_payment_method";
  DROP TYPE "public"."enum_orders_payment_provider_status";
  DROP TYPE "public"."enum_orders_payment_confirmation_type";
  DROP TYPE "public"."enum_orders_payment_receipt_status";
  DROP TYPE "public"."enum_orders_payment_payment_method_snapshot_type";
  DROP TYPE "public"."enum_carts_items_warning";
  DROP TYPE "public"."enum_carts_status";
  DROP TYPE "public"."enum_returns_items_condition";
  DROP TYPE "public"."enum_returns_reason_category";
  DROP TYPE "public"."enum_returns_refund_method";
  DROP TYPE "public"."enum_returns_return_method";
  DROP TYPE "public"."enum_returns_correction_receipt_status";
  DROP TYPE "public"."enum_returns_status";
  DROP TYPE "public"."enum_returns_created_via";
  DROP TYPE "public"."enum_rfq_requests_status";
  DROP TYPE "public"."enum_rfq_requests_priority";
  DROP TYPE "public"."enum_rfq_requests_customer_type";
  DROP TYPE "public"."enum_rfq_requests_decision_status";
  DROP TYPE "public"."enum_products_technical_attributes_confidence";
  DROP TYPE "public"."enum_products_image_links_role";
  DROP TYPE "public"."enum_products_target_queries_intent";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum_products_quality_status";
  DROP TYPE "public"."enum_products_product_type";
  DROP TYPE "public"."enum_products_price_status";
  DROP TYPE "public"."enum_products_availability_status";
  DROP TYPE "public"."enum_products_cta_mode";
  DROP TYPE "public"."enum_products_indexing_policy";
  DROP TYPE "public"."enum_products_source_of_truth";
  DROP TYPE "public"."enum__products_v_version_technical_attributes_confidence";
  DROP TYPE "public"."enum__products_v_version_image_links_role";
  DROP TYPE "public"."enum__products_v_version_target_queries_intent";
  DROP TYPE "public"."enum__products_v_version_status";
  DROP TYPE "public"."enum__products_v_version_quality_status";
  DROP TYPE "public"."enum__products_v_version_product_type";
  DROP TYPE "public"."enum__products_v_version_price_status";
  DROP TYPE "public"."enum__products_v_version_availability_status";
  DROP TYPE "public"."enum__products_v_version_cta_mode";
  DROP TYPE "public"."enum__products_v_version_indexing_policy";
  DROP TYPE "public"."enum__products_v_version_source_of_truth";
  DROP TYPE "public"."enum_categories_target_queries_intent";
  DROP TYPE "public"."enum_categories_status";
  DROP TYPE "public"."enum_categories_quality_status";
  DROP TYPE "public"."enum_categories_category_type";
  DROP TYPE "public"."enum_categories_indexing_policy";
  DROP TYPE "public"."enum_categories_source_of_truth";
  DROP TYPE "public"."enum__categories_v_version_target_queries_intent";
  DROP TYPE "public"."enum__categories_v_version_status";
  DROP TYPE "public"."enum__categories_v_version_quality_status";
  DROP TYPE "public"."enum__categories_v_version_category_type";
  DROP TYPE "public"."enum__categories_v_version_indexing_policy";
  DROP TYPE "public"."enum__categories_v_version_source_of_truth";
  DROP TYPE "public"."enum_attributes_value_type";
  DROP TYPE "public"."enum_filter_groups_source_of_truth";
  DROP TYPE "public"."enum_filter_fields_field_type";
  DROP TYPE "public"."enum_filter_fields_zero_results_behavior";
  DROP TYPE "public"."enum_filter_fields_source_of_truth";
  DROP TYPE "public"."enum_filter_options_source_of_truth";
  DROP TYPE "public"."enum_filter_presets_target_queries_intent";
  DROP TYPE "public"."enum_filter_presets_status";
  DROP TYPE "public"."enum_filter_presets_indexing_policy";
  DROP TYPE "public"."enum_filter_presets_source_of_truth";
  DROP TYPE "public"."enum__filter_presets_v_version_target_queries_intent";
  DROP TYPE "public"."enum__filter_presets_v_version_status";
  DROP TYPE "public"."enum__filter_presets_v_version_indexing_policy";
  DROP TYPE "public"."enum__filter_presets_v_version_source_of_truth";
  DROP TYPE "public"."enum_media_status";
  DROP TYPE "public"."enum_media_role";
  DROP TYPE "public"."enum_media_source_of_truth";
  DROP TYPE "public"."enum_documents_target_queries_intent";
  DROP TYPE "public"."enum_documents_status";
  DROP TYPE "public"."enum_documents_document_type";
  DROP TYPE "public"."enum_documents_indexing_policy";
  DROP TYPE "public"."enum_documents_source_of_truth";
  DROP TYPE "public"."enum__documents_v_version_target_queries_intent";
  DROP TYPE "public"."enum__documents_v_version_status";
  DROP TYPE "public"."enum__documents_v_version_document_type";
  DROP TYPE "public"."enum__documents_v_version_indexing_policy";
  DROP TYPE "public"."enum__documents_v_version_source_of_truth";
  DROP TYPE "public"."enum_static_pages_section";
  DROP TYPE "public"."enum_static_pages_category";
  DROP TYPE "public"."enum_static_pages_indexing_policy";
  DROP TYPE "public"."enum_static_pages_status";
  DROP TYPE "public"."enum__static_pages_v_version_section";
  DROP TYPE "public"."enum__static_pages_v_version_category";
  DROP TYPE "public"."enum__static_pages_v_version_indexing_policy";
  DROP TYPE "public"."enum__static_pages_v_version_status";
  DROP TYPE "public"."enum_admin_change_log_actor_type";
  DROP TYPE "public"."enum_admin_change_log_change_type";
  DROP TYPE "public"."enum_admin_change_log_approval_status";
  DROP TYPE "public"."enum_shipping_logs_direction";
  DROP TYPE "public"."enum_crm_sync_jobs_status";
  DROP TYPE "public"."enum_notification_jobs_entity_collection";
  DROP TYPE "public"."enum_notification_jobs_channel";
  DROP TYPE "public"."enum_notification_jobs_status";
  DROP TYPE "public"."enum_payment_events_event_type";
  DROP TYPE "public"."enum_payment_events_result";
  DROP TYPE "public"."enum_payment_events_rejected_reason";
  DROP TYPE "public"."enum_payment_events_source";
  DROP TYPE "public"."enum_apiship_settings_allowed_delivery_types";
  DROP TYPE "public"."enum_apiship_settings_defaults_delivery_cost_vat";
  DROP TYPE "public"."enum_apiship_settings_yandex_maps_tariff_plan";
  DROP TYPE "public"."enum_apiship_settings_dadata_tariff_plan";
  DROP TYPE "public"."enum_notifications_settings_managers_events";
  DROP TYPE "public"."enum_notifications_settings_email_provider";
  DROP TYPE "public"."enum_notifications_settings_messenger_provider";
  DROP TYPE "public"."enum_payment_settings_payment_methods";
  DROP TYPE "public"."enum_payment_settings_capture_mode";
  DROP TYPE "public"."enum_payment_settings_webhook_signature_mode";`)
}
