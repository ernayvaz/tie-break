-- AlterEnum
ALTER TYPE "HalisahaQuestionOptionKind" ADD VALUE 'player_picker';

-- AlterTable
ALTER TABLE "halisaha_question_options"
ADD COLUMN "resolved_score_home" INTEGER,
ADD COLUMN "resolved_score_away" INTEGER;
