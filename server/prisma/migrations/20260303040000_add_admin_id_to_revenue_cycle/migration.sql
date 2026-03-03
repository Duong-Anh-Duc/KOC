-- AlterTable: Add admin_id to revenue_cycles
ALTER TABLE "revenue_cycles" ADD COLUMN "admin_id" UUID;

-- AddForeignKey
ALTER TABLE "revenue_cycles" ADD CONSTRAINT "revenue_cycles_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropIndex: Remove old unique constraint on month only
DROP INDEX IF EXISTS "revenue_cycles_month_key";

-- CreateIndex: New composite unique on (month, admin_id)
CREATE UNIQUE INDEX "revenue_cycles_month_admin_id_key" ON "revenue_cycles"("month", "admin_id");

-- CreateIndex: Index on admin_id
CREATE INDEX "revenue_cycles_admin_id_idx" ON "revenue_cycles"("admin_id");
