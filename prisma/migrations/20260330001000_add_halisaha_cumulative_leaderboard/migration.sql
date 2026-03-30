-- AlterTable
ALTER TABLE "halisaha_matches"
ADD COLUMN "round_number" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "halisaha_leaderboard_rounds" (
    "id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "correct_answers" INTEGER NOT NULL DEFAULT 0,
    "answered_questions" INTEGER NOT NULL DEFAULT 0,
    "recent_answers" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "halisaha_leaderboard_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "halisaha_leaderboard_rounds_round_number_user_id_key"
ON "halisaha_leaderboard_rounds"("round_number", "user_id");

-- CreateIndex
CREATE INDEX "halisaha_leaderboard_rounds_round_number_idx"
ON "halisaha_leaderboard_rounds"("round_number");

-- CreateIndex
CREATE INDEX "halisaha_leaderboard_rounds_user_id_idx"
ON "halisaha_leaderboard_rounds"("user_id");

-- AddForeignKey
ALTER TABLE "halisaha_leaderboard_rounds"
ADD CONSTRAINT "halisaha_leaderboard_rounds_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
