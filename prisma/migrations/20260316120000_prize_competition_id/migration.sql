-- Add competition_id to prizes for per-league prize management
ALTER TABLE "prizes" ADD COLUMN IF NOT EXISTS "competition_id" TEXT NOT NULL DEFAULT 'CL';

-- Drop old unique on place (one prize per place globally)
DROP INDEX IF EXISTS "prizes_place_key";

-- Unique per league: (competition_id, place)
CREATE UNIQUE INDEX "prizes_competition_id_place_key" ON "prizes"("competition_id", "place");

-- Index for filtering by league
CREATE INDEX IF NOT EXISTS "prizes_competition_id_idx" ON "prizes"("competition_id");
