-- AlterTable: add competition_id and switch to composite primary key
ALTER TABLE "leaderboard" ADD COLUMN IF NOT EXISTS "competition_id" TEXT NOT NULL DEFAULT 'CL';

-- Ensure existing rows have competition_id
UPDATE "leaderboard" SET "competition_id" = 'CL' WHERE "competition_id" IS NULL;

-- Drop existing primary key and add composite primary key
ALTER TABLE "leaderboard" DROP CONSTRAINT IF EXISTS "leaderboard_pkey";
ALTER TABLE "leaderboard" ADD CONSTRAINT "leaderboard_pkey" PRIMARY KEY ("user_id", "competition_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "leaderboard_competition_id_idx" ON "leaderboard"("competition_id");
