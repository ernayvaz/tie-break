-- AlterTable
ALTER TABLE "halisaha_matches"
ALTER COLUMN "singleton_key" DROP NOT NULL,
ALTER COLUMN "singleton_key" DROP DEFAULT;

-- AlterTable
ALTER TABLE "halisaha_matches"
ADD COLUMN "archived_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "halisaha_matches_archived_at_idx"
ON "halisaha_matches"("archived_at");
