-- AlterTable
ALTER TABLE "kocs" ADD COLUMN     "admin_id" UUID;

-- CreateTable
CREATE TABLE "youtube_sessions" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "is_logged_in" BOOLEAN NOT NULL DEFAULT false,
    "account_email" VARCHAR(255),
    "account_name" VARCHAR(255),
    "chrome_profile" VARCHAR(255) NOT NULL,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "youtube_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "youtube_sessions_admin_id_key" ON "youtube_sessions"("admin_id");

-- CreateIndex
CREATE INDEX "kocs_admin_id_idx" ON "kocs"("admin_id");

-- AddForeignKey
ALTER TABLE "kocs" ADD CONSTRAINT "kocs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_sessions" ADD CONSTRAINT "youtube_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
