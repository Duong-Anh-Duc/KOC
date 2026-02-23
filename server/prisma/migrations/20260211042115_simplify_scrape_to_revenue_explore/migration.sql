/*
  Warnings:

  - You are about to drop the column `audience_data` on the `youtube_scrape_results` table. All the data in the column will be lost.
  - You are about to drop the column `monthly_revenue` on the `youtube_scrape_results` table. All the data in the column will be lost.
  - You are about to drop the column `playback_based_cpm` on the `youtube_scrape_results` table. All the data in the column will be lost.
  - You are about to drop the column `rpm` on the `youtube_scrape_results` table. All the data in the column will be lost.
  - You are about to drop the column `subscribers_gained` on the `youtube_scrape_results` table. All the data in the column will be lost.
  - You are about to drop the column `top_videos` on the `youtube_scrape_results` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "youtube_scrape_results" DROP COLUMN "audience_data",
DROP COLUMN "monthly_revenue",
DROP COLUMN "playback_based_cpm",
DROP COLUMN "rpm",
DROP COLUMN "subscribers_gained",
DROP COLUMN "top_videos",
ADD COLUMN     "avg_watch_time" VARCHAR(20),
ADD COLUMN     "country_data" JSONB;
