-- DropForeignKey
ALTER TABLE "revenue_records" DROP CONSTRAINT "revenue_records_paid_in_cycle_id_fkey";

-- AddForeignKey
ALTER TABLE "revenue_records" ADD CONSTRAINT "revenue_records_paid_in_cycle_id_fkey" FOREIGN KEY ("paid_in_cycle_id") REFERENCES "revenue_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
