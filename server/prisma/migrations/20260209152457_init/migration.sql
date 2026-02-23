-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "KOCStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('OPEN', 'LOCKED', 'PAYMENT_COMPLETED');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('PENDING', 'APPROVED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ACCOUNTANT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kocs" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "channel_name" VARCHAR(255) NOT NULL,
    "youtube_channel_id" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "bank_account_number" VARCHAR(50) NOT NULL,
    "bank_name" VARCHAR(255) NOT NULL,
    "tax_code" VARCHAR(30) NOT NULL,
    "base_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.8,
    "status" "KOCStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "kocs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_cycles" (
    "id" SERIAL NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'OPEN',
    "exchange_rate" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "revenue_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_records" (
    "id" UUID NOT NULL,
    "koc_id" UUID NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "original_revenue_usd" DECIMAL(14,2) NOT NULL,
    "us_tax_deduction" DECIMAL(14,2) NOT NULL,
    "bank_fee" DECIMAL(14,2) NOT NULL,
    "net_revenue" DECIMAL(14,2) NOT NULL,
    "company_share" DECIMAL(14,2) NOT NULL,
    "koc_share_gross" DECIMAL(14,2) NOT NULL,
    "koc_tax_deduction" DECIMAL(14,2) NOT NULL,
    "koc_receive_usd" DECIMAL(14,2) NOT NULL,
    "koc_receive_vnd" DECIMAL(18,2) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "revenue_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_stats" (
    "id" UUID NOT NULL,
    "koc_id" UUID NOT NULL,
    "view_count" BIGINT NOT NULL DEFAULT 0,
    "sub_count" BIGINT NOT NULL DEFAULT 0,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_cycles_month_key" ON "revenue_cycles"("month");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_records_koc_id_cycle_id_key" ON "revenue_records"("koc_id", "cycle_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "channel_stats_koc_id_recorded_at_idx" ON "channel_stats"("koc_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "revenue_records" ADD CONSTRAINT "revenue_records_koc_id_fkey" FOREIGN KEY ("koc_id") REFERENCES "kocs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_records" ADD CONSTRAINT "revenue_records_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "revenue_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_stats" ADD CONSTRAINT "channel_stats_koc_id_fkey" FOREIGN KEY ("koc_id") REFERENCES "kocs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
