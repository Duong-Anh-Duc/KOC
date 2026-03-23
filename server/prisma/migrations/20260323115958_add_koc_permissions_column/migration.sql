-- AlterTable
ALTER TABLE "manager_koc_access" ADD COLUMN     "permissions" JSONB NOT NULL DEFAULT '["view_info","view_revenue","view_monthly","view_stats"]';
