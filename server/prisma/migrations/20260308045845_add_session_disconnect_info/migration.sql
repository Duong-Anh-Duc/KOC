-- AlterTable
ALTER TABLE "youtube_sessions" ADD COLUMN     "disconnect_reason" VARCHAR(500),
ADD COLUMN     "disconnect_url" VARCHAR(1000),
ADD COLUMN     "disconnected_at" TIMESTAMPTZ;
