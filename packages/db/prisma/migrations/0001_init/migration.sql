CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('owner', 'worker', 'customer');

-- CreateEnum
CREATE TYPE "worker_status" AS ENUM ('available', 'in_service', 'on_break', 'off_today', 'appointment_only');

-- CreateEnum
CREATE TYPE "checkin_status" AS ENUM ('waiting', 'assigned', 'in_service', 'ready_for_checkout', 'paid', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('scheduled', 'confirmed', 'checked_in', 'in_service', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "turn_status" AS ENUM ('assigned', 'in_service', 'completed', 'skipped', 'cancelled');

-- CreateEnum
CREATE TYPE "turn_type" AS ENUM ('walk_in', 'appointment', 'requested_worker', 'manual');

-- CreateEnum
CREATE TYPE "sale_status" AS ENUM ('draft', 'open', 'partially_paid', 'paid', 'refunded', 'voided');

-- CreateEnum
CREATE TYPE "sale_item_status" AS ENUM ('active', 'refunded', 'voided');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('cash', 'card', 'gift_card', 'other');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'approved', 'declined', 'cancelled', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('amount', 'percent');

-- CreateEnum
CREATE TYPE "gift_card_status" AS ENUM ('active', 'disabled', 'expired');

-- CreateEnum
CREATE TYPE "gift_card_tx_type" AS ENUM ('issue', 'redeem', 'refund', 'adjustment');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "role" "user_role" NOT NULL,
    "password_hash" TEXT,
    "pin_hash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "commission_rate" DECIMAL(5,4) NOT NULL,
    "current_status" "worker_status" NOT NULL DEFAULT 'available',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "turn_count" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "worker_id" UUID,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appointment_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "price_cents_at_booking" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "appointment_id" UUID,
    "status" "checkin_status" NOT NULL DEFAULT 'waiting',
    "requested_worker_id" UUID,
    "notes" TEXT,
    "checked_in_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "worker_id" UUID NOT NULL,
    "customer_id" UUID,
    "checkin_id" UUID,
    "appointment_id" UUID,
    "sale_id" UUID,
    "turn_type" "turn_type" NOT NULL DEFAULT 'manual',
    "status" "turn_status" NOT NULL DEFAULT 'assigned',
    "turn_count" INTEGER NOT NULL DEFAULT 1,
    "assigned_by_user_id" UUID,
    "suggested_worker_id" UUID,
    "owner_override_reason" TEXT,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "skipped_at" TIMESTAMPTZ,
    "skipped_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" UUID,

    CONSTRAINT "turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "appointment_id" UUID,
    "checkin_id" UUID,
    "receipt_number" TEXT,
    "status" "sale_status" NOT NULL DEFAULT 'draft',
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "discount_total_cents" INTEGER NOT NULL DEFAULT 0,
    "tax_total_cents" INTEGER NOT NULL DEFAULT 0,
    "tip_total_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "amount_paid_cents" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" UUID,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" UUID,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sale_id" UUID NOT NULL,
    "service_id" UUID,
    "worker_id" UUID NOT NULL,
    "service_name_snapshot" TEXT NOT NULL,
    "category_name_snapshot" TEXT,
    "price_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "final_service_cents" INTEGER NOT NULL,
    "commission_rate_snapshot" DECIMAL(5,4) NOT NULL,
    "worker_commission_cents" INTEGER NOT NULL DEFAULT 0,
    "tip_cents" INTEGER NOT NULL DEFAULT 0,
    "worker_total_cents" INTEGER NOT NULL DEFAULT 0,
    "business_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "sale_item_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sale_id" UUID NOT NULL,
    "method" "payment_method" NOT NULL,
    "provider" TEXT,
    "provider_payment_id" TEXT,
    "provider_order_id" TEXT,
    "idempotency_key" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "tip_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "card_brand" TEXT,
    "card_last4" TEXT,
    "auth_code" TEXT,
    "raw_provider_reference" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sale_id" UUID NOT NULL,
    "payment_id" UUID,
    "amount_cents" INTEGER NOT NULL,
    "reason" TEXT,
    "approved_by_user_id" UUID,
    "provider_refund_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sale_id" UUID NOT NULL,
    "sale_item_id" UUID,
    "type" "discount_type" NOT NULL,
    "amount_cents" INTEGER,
    "percent" DECIMAL(5,4),
    "reason" TEXT,
    "approved_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code_hash" TEXT NOT NULL,
    "balance_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "gift_card_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gift_card_id" UUID NOT NULL,
    "sale_id" UUID,
    "amount_cents" INTEGER NOT NULL,
    "transaction_type" "gift_card_tx_type" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,
    "opening_cash_cents" INTEGER NOT NULL DEFAULT 0,
    "closing_cash_cents" INTEGER,
    "status" "session_status" NOT NULL DEFAULT 'open',
    "opened_by_user_id" UUID,
    "closed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "worker_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "checked_in_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_out_at" TIMESTAMPTZ,

    CONSTRAINT "worker_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sale_id" UUID NOT NULL,
    "print_status" TEXT NOT NULL DEFAULT 'not_printed',
    "sms_status" TEXT NOT NULL DEFAULT 'not_sent',
    "email_status" TEXT NOT NULL DEFAULT 'not_sent',
    "receipt_data_json" JSONB NOT NULL,
    "printed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salon_settings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "turn_count_threshold_cents" INTEGER NOT NULL DEFAULT 3000,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salon_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Add project-level checks that Prisma does not model directly.
ALTER TABLE "workers" ADD CONSTRAINT "workers_commission_rate_check" CHECK ("commission_rate" >= 0 AND "commission_rate" <= 1);
ALTER TABLE "services" ADD CONSTRAINT "services_price_duration_turn_count_check" CHECK ("price_cents" >= 0 AND "duration_minutes" >= 0 AND "turn_count" >= 0);
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_check" CHECK ("end_time" > "start_time");
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_price_duration_check" CHECK ("price_cents_at_booking" >= 0 AND "duration_minutes" >= 0);
ALTER TABLE "turns" ADD CONSTRAINT "turns_turn_count_check" CHECK ("turn_count" >= 0);
ALTER TABLE "sales" ADD CONSTRAINT "sales_money_check" CHECK (
  "subtotal_cents" >= 0 AND
  "discount_total_cents" >= 0 AND
  "tax_total_cents" >= 0 AND
  "tip_total_cents" >= 0 AND
  "total_cents" >= 0 AND
  "amount_paid_cents" >= 0
);
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_money_check" CHECK (
  "price_cents" >= 0 AND
  "discount_cents" >= 0 AND
  "final_service_cents" >= 0 AND
  "commission_rate_snapshot" >= 0 AND
  "commission_rate_snapshot" <= 1 AND
  "worker_commission_cents" >= 0 AND
  "tip_cents" >= 0 AND
  "worker_total_cents" >= 0 AND
  "business_cents" >= 0
);
ALTER TABLE "payments" ADD CONSTRAINT "payments_money_check" CHECK ("amount_cents" >= 0 AND "tip_cents" >= 0);
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_check" CHECK ("amount_cents" > 0);
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_value_check" CHECK (("amount_cents" IS NULL OR "amount_cents" >= 0) AND ("percent" IS NULL OR ("percent" >= 0 AND "percent" <= 1)));
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_balance_check" CHECK ("balance_cents" >= 0);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cash_check" CHECK ("opening_cash_cents" >= 0 AND ("closing_cash_cents" IS NULL OR "closing_cash_cents" >= 0));
ALTER TABLE "salon_settings" ADD CONSTRAINT "salon_settings_threshold_check" CHECK ("turn_count_threshold_cents" >= 0);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workers_user_id_key" ON "workers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "appointments_worker_id_start_time_end_time_idx" ON "appointments"("worker_id", "start_time", "end_time");

-- CreateIndex
CREATE INDEX "checkins_status_checked_in_at_idx" ON "checkins"("status", "checked_in_at");

-- CreateIndex
CREATE INDEX "turns_worker_id_status_idx" ON "turns"("worker_id", "status");

-- CreateIndex
CREATE INDEX "turns_started_at_idx" ON "turns"("started_at");

-- CreateIndex
CREATE INDEX "turns_session_id_idx" ON "turns"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_receipt_number_key" ON "sales"("receipt_number");

-- CreateIndex
CREATE INDEX "sales_completed_at_idx" ON "sales"("completed_at");

-- CreateIndex
CREATE INDEX "sales_session_id_idx" ON "sales"("session_id");

-- CreateIndex
CREATE INDEX "sale_items_worker_id_idx" ON "sale_items"("worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_sale_id_idx" ON "payments"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "gift_cards_code_hash_key" ON "gift_cards"("code_hash");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE INDEX "worker_sessions_session_id_idx" ON "worker_sessions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "worker_sessions_worker_id_session_id_key" ON "worker_sessions"("worker_id", "session_id");

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_requested_worker_id_fkey" FOREIGN KEY ("requested_worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_checkin_id_fkey" FOREIGN KEY ("checkin_id") REFERENCES "checkins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_suggested_worker_id_fkey" FOREIGN KEY ("suggested_worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_checkin_id_fkey" FOREIGN KEY ("checkin_id") REFERENCES "checkins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "gift_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_sessions" ADD CONSTRAINT "worker_sessions_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_sessions" ADD CONSTRAINT "worker_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

