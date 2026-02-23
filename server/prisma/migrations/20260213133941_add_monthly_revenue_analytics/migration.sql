-- CreateTable
CREATE TABLE "monthly_revenue_analytics" (
    "id" UUID NOT NULL,
    "koc_id" UUID NOT NULL,
    "channel_id" VARCHAR(100) NOT NULL,
    "month_label" VARCHAR(100) NOT NULL,
    "month_key" VARCHAR(7) NOT NULL,
    "views" BIGINT,
    "views_percent" DECIMAL(8,2),
    "watch_time_hours" DECIMAL(14,2),
    "watch_time_percent" DECIMAL(8,2),
    "avg_watch_time" VARCHAR(20),
    "estimated_revenue" DECIMAL(14,4),
    "revenue_percent" DECIMAL(8,2),
    "scraped_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_revenue_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_revenue_analytics_koc_id_month_key_idx" ON "monthly_revenue_analytics"("koc_id", "month_key");

-- CreateIndex
CREATE INDEX "monthly_revenue_analytics_koc_id_idx" ON "monthly_revenue_analytics"("koc_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_revenue_analytics_koc_id_month_key_key" ON "monthly_revenue_analytics"("koc_id", "month_key");

-- AddForeignKey
ALTER TABLE "monthly_revenue_analytics" ADD CONSTRAINT "monthly_revenue_analytics_koc_id_fkey" FOREIGN KEY ("koc_id") REFERENCES "kocs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
