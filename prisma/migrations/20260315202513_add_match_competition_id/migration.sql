-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "competition_id" TEXT;

-- CreateIndex
CREATE INDEX "matches_competition_id_idx" ON "matches"("competition_id");
