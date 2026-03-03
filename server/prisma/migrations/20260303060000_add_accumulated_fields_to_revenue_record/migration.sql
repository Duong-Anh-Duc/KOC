-- Add accumulated revenue fields and paid_in_cycle_id to revenue_records
ALTER TABLE "revenue_records"
  ADD COLUMN "accumulated_revenue_usd" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "accumulated_koc_usd"     DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "paid_in_cycle_id"        INTEGER;

-- Backfill: set accumulated = own record value for existing records
UPDATE "revenue_records"
SET
  "accumulated_revenue_usd" = "original_revenue_usd",
  "accumulated_koc_usd"     = "koc_receive_usd";

-- Foreign key to revenue_cycles
ALTER TABLE "revenue_records"
  ADD CONSTRAINT "revenue_records_paid_in_cycle_id_fkey"
  FOREIGN KEY ("paid_in_cycle_id")
  REFERENCES "revenue_cycles"("id")
  ON DELETE SET NULL;
