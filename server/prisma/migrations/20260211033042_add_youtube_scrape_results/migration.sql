-- CreateTable
CREATE TABLE "youtube_scrape_results" (
    "id" UUID NOT NULL,
    "koc_id" UUID NOT NULL,
    "channel_id" VARCHAR(100) NOT NULL,
    "views" BIGINT,
    "watch_time_hours" DECIMAL(14,2),
    "subscribers_gained" INTEGER,
    "estimated_revenue" DECIMAL(14,4),
    "period" VARCHAR(100),
    "rpm" DECIMAL(14,4),
    "playback_based_cpm" DECIMAL(14,4),
    "monthly_revenue" JSONB,
    "top_videos" JSONB,
    "audience_data" JSONB,
    "raw_texts" JSONB,
    "scraped_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "youtube_scrape_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "youtube_scrape_results_koc_id_scraped_at_idx" ON "youtube_scrape_results"("koc_id", "scraped_at");

-- CreateIndex
CREATE INDEX "youtube_scrape_results_koc_id_idx" ON "youtube_scrape_results"("koc_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- AddForeignKey
ALTER TABLE "youtube_scrape_results" ADD CONSTRAINT "youtube_scrape_results_koc_id_fkey" FOREIGN KEY ("koc_id") REFERENCES "kocs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
