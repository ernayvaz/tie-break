-- AlterEnum
ALTER TYPE "HalisahaQuestionKind" ADD VALUE IF NOT EXISTS 'mvp_prediction';
ALTER TYPE "HalisahaQuestionKind" ADD VALUE IF NOT EXISTS 'score_prediction';

-- CreateEnum
CREATE TYPE "HalisahaQuestionOptionKind" AS ENUM ('standard', 'custom_score');

-- AlterTable
ALTER TABLE "halisaha_matches"
ADD COLUMN "match_duration_minutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN "mvp_resolved_participant_id" TEXT,
ADD COLUMN "mvp_resolved_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "halisaha_questions"
ADD COLUMN "score_home_result" INTEGER,
ADD COLUMN "score_away_result" INTEGER;

-- AlterTable
ALTER TABLE "halisaha_question_options"
ADD COLUMN "kind" "HalisahaQuestionOptionKind" NOT NULL DEFAULT 'standard',
ADD COLUMN "participant_id" TEXT;

-- AlterTable
ALTER TABLE "halisaha_answers"
ADD COLUMN "custom_score_home" INTEGER,
ADD COLUMN "custom_score_away" INTEGER;

-- CreateTable
CREATE TABLE "halisaha_mvp_votes" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "halisaha_mvp_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "halisaha_question_options_question_id_kind_idx" ON "halisaha_question_options"("question_id", "kind");

-- CreateIndex
CREATE INDEX "halisaha_question_options_participant_id_idx" ON "halisaha_question_options"("participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "halisaha_mvp_votes_match_id_user_id_key" ON "halisaha_mvp_votes"("match_id", "user_id");

-- CreateIndex
CREATE INDEX "halisaha_mvp_votes_match_id_created_at_idx" ON "halisaha_mvp_votes"("match_id", "created_at");

-- CreateIndex
CREATE INDEX "halisaha_mvp_votes_match_id_participant_id_idx" ON "halisaha_mvp_votes"("match_id", "participant_id");

-- AddForeignKey
ALTER TABLE "halisaha_matches" ADD CONSTRAINT "halisaha_matches_mvp_resolved_participant_id_fkey" FOREIGN KEY ("mvp_resolved_participant_id") REFERENCES "halisaha_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halisaha_question_options" ADD CONSTRAINT "halisaha_question_options_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "halisaha_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halisaha_mvp_votes" ADD CONSTRAINT "halisaha_mvp_votes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "halisaha_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halisaha_mvp_votes" ADD CONSTRAINT "halisaha_mvp_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halisaha_mvp_votes" ADD CONSTRAINT "halisaha_mvp_votes_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "halisaha_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
