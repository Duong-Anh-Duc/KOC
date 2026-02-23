/*
  Warnings:

  - You are about to drop the column `sb_data` on the `channel_stats` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "channel_stats" DROP COLUMN "sb_data",
ADD COLUMN     "yt_analytics" JSONB;
