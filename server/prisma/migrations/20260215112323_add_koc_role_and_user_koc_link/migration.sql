/*
  Warnings:

  - A unique constraint covering the columns `[koc_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'KOC';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "koc_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "users_koc_id_key" ON "users"("koc_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_koc_id_fkey" FOREIGN KEY ("koc_id") REFERENCES "kocs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
