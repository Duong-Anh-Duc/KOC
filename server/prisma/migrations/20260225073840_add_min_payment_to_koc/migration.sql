-- Add min_payment field to KOC table (minimum payment threshold in USD)
ALTER TABLE "kocs" ADD COLUMN "min_payment" DECIMAL(14,2) NOT NULL DEFAULT 100;