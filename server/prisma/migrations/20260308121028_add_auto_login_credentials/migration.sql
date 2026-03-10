-- AlterTable
ALTER TABLE "youtube_sessions" ADD COLUMN     "auto_login_at" TIMESTAMPTZ,
ADD COLUMN     "auto_login_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auto_login_result" VARCHAR(200),
ADD COLUMN     "google_email" VARCHAR(255),
ADD COLUMN     "google_password_enc" VARCHAR(1000);
