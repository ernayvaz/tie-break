-- CreateEnum
CREATE TYPE "HalisahaTeamSide" AS ENUM ('home', 'away');

-- CreateEnum
CREATE TYPE "HalisahaPositionKey" AS ENUM ('goalkeeper', 'left_defender', 'right_defender', 'left_wing', 'center_midfield', 'right_wing', 'striker');

-- CreateTable
CREATE TABLE "halisaha_matches" (
    "id" TEXT NOT NULL,
    "singleton_key" TEXT NOT NULL DEFAULT 'active',
    "title" TEXT NOT NULL DEFAULT 'RayNET Matchday Show',
    "home_team_name" TEXT NOT NULL,
    "away_team_name" TEXT NOT NULL,
    "venue_name" TEXT NOT NULL,
    "kickoff_at" TIMESTAMP(3) NOT NULL,
    "kickoff_timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "answers_resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "halisaha_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "halisaha_participants" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "user_id" TEXT,
    "guest_name" TEXT,
    "team_side" "HalisahaTeamSide",
    "position_key" "HalisahaPositionKey",
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "halisaha_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "halisaha_questions" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "halisaha_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "halisaha_question_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "halisaha_question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "halisaha_answers" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "selected_option_id" TEXT NOT NULL,
    "is_correct" BOOLEAN,
    "awarded_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "halisaha_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "halisaha_matches_singleton_key_key" ON "halisaha_matches"("singleton_key");

-- CreateIndex
CREATE INDEX "halisaha_participants_match_id_team_side_idx" ON "halisaha_participants"("match_id", "team_side");

-- CreateIndex
CREATE INDEX "halisaha_participants_match_id_display_order_idx" ON "halisaha_participants"("match_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "halisaha_participants_match_id_user_id_key" ON "halisaha_participants"("match_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "halisaha_participants_match_id_team_side_position_key_key" ON "halisaha_participants"("match_id", "team_side", "position_key");

-- CreateIndex
CREATE INDEX "halisaha_questions_match_id_sort_order_idx" ON "halisaha_questions"("match_id", "sort_order");

-- CreateIndex
CREATE INDEX "halisaha_question_options_question_id_sort_order_idx" ON "halisaha_question_options"("question_id", "sort_order");

-- CreateIndex
CREATE INDEX "halisaha_answers_match_id_user_id_idx" ON "halisaha_answers"("match_id", "user_id");

-- CreateIndex
CREATE INDEX "halisaha_answers_match_id_question_id_idx" ON "halisaha_answers"("match_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "halisaha_answers_question_id_user_id_key" ON "halisaha_answers"("question_id", "user_id");

-- AddForeignKey
ALTER TABLE "halisaha_participants" ADD CONSTRAINT "halisaha_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "halisaha_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halisaha_participants" ADD CONSTRAINT "halisaha_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halisaha_questions" ADD CONSTRAINT "halisaha_questions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "halisaha_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halisaha_question_options" ADD CONSTRAINT "halisaha_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "halisaha_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halisaha_answers" ADD CONSTRAINT "halisaha_answers_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "halisaha_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halisaha_answers" ADD CONSTRAINT "halisaha_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "halisaha_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halisaha_answers" ADD CONSTRAINT "halisaha_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halisaha_answers" ADD CONSTRAINT "halisaha_answers_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "halisaha_question_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
