-- AlterTable
ALTER TABLE "revenue_records" ADD COLUMN     "pub_code_match" BOOLEAN,
ADD COLUMN     "scraped_pub_code" VARCHAR(50);
