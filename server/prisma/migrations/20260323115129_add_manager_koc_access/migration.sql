-- CreateTable
CREATE TABLE "manager_koc_access" (
    "id" UUID NOT NULL,
    "manager_id" UUID NOT NULL,
    "koc_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_koc_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manager_koc_access_manager_id_idx" ON "manager_koc_access"("manager_id");

-- CreateIndex
CREATE INDEX "manager_koc_access_koc_id_idx" ON "manager_koc_access"("koc_id");

-- CreateIndex
CREATE UNIQUE INDEX "manager_koc_access_manager_id_koc_id_key" ON "manager_koc_access"("manager_id", "koc_id");

-- AddForeignKey
ALTER TABLE "manager_koc_access" ADD CONSTRAINT "manager_koc_access_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_koc_access" ADD CONSTRAINT "manager_koc_access_koc_id_fkey" FOREIGN KEY ("koc_id") REFERENCES "kocs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
