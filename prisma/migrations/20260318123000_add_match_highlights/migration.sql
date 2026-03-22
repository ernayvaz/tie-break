-- CreateEnum
CREATE TYPE "HighlightSyncStatus" AS ENUM ('available', 'stale', 'unavailable');

-- CreateTable
CREATE TABLE "match_highlights" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL DEFAULT 'CL',
    "provider" TEXT NOT NULL DEFAULT 'scorebat.com',
    "provider_match_id" TEXT,
    "title" TEXT NOT NULL,
    "competition_label" TEXT NOT NULL,
    "competition_url" TEXT,
    "matchview_url" TEXT,
    "thumbnail_url" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "home_team_name" TEXT NOT NULL,
    "away_team_name" TEXT NOT NULL,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "stage" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "program_note" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sync_status" "HighlightSyncStatus" NOT NULL DEFAULT 'available',
    "provider_payload" JSONB,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_highlight_clips" (
    "id" TEXT NOT NULL,
    "highlight_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'scorebat.com',
    "external_video_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "embed_url" TEXT,
    "page_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_highlight_clips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_highlights_match_id_key" ON "match_highlights"("match_id");

-- CreateIndex
CREATE INDEX "match_highlights_competition_id_published_at_idx" ON "match_highlights"("competition_id", "published_at");

-- CreateIndex
CREATE INDEX "match_highlights_competition_id_stage_published_at_idx" ON "match_highlights"("competition_id", "stage", "published_at");

-- CreateIndex
CREATE INDEX "match_highlights_provider_provider_match_id_idx" ON "match_highlights"("provider", "provider_match_id");

-- CreateIndex
CREATE INDEX "match_highlights_sync_status_idx" ON "match_highlights"("sync_status");

-- CreateIndex
CREATE INDEX "match_highlights_is_featured_published_at_idx" ON "match_highlights"("is_featured", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "match_highlight_clips_highlight_id_external_video_id_key" ON "match_highlight_clips"("highlight_id", "external_video_id");

-- CreateIndex
CREATE INDEX "match_highlight_clips_highlight_id_sort_order_idx" ON "match_highlight_clips"("highlight_id", "sort_order");

-- AddForeignKey
ALTER TABLE "match_highlights" ADD CONSTRAINT "match_highlights_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_highlight_clips" ADD CONSTRAINT "match_highlight_clips_highlight_id_fkey" FOREIGN KEY ("highlight_id") REFERENCES "match_highlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;
