-- CreateEnum
CREATE TYPE "HalisahaQuestionKind" AS ENUM ('winner', 'standard');

-- AlterTable
ALTER TABLE "halisaha_questions"
ADD COLUMN "kind" "HalisahaQuestionKind" NOT NULL DEFAULT 'standard';

-- CreateIndex
CREATE INDEX "halisaha_questions_match_id_kind_idx" ON "halisaha_questions"("match_id", "kind");
