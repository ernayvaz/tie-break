-- CreateTable
CREATE TABLE "match_stats_cache" (
    "match_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'football-data.org',
    "payload" JSONB,
    "error_message" TEXT,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_stats_cache_pkey" PRIMARY KEY ("match_id")
);

-- CreateIndex
CREATE INDEX "match_stats_cache_status_idx" ON "match_stats_cache"("status");

-- CreateIndex
CREATE INDEX "match_stats_cache_synced_at_idx" ON "match_stats_cache"("synced_at");

-- AddForeignKey
ALTER TABLE "match_stats_cache" ADD CONSTRAINT "match_stats_cache_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
