ALTER TABLE "halisaha_answers"
ADD COLUMN "is_final" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "finalized_at" TIMESTAMP(3);

CREATE INDEX "halisaha_answers_match_id_user_id_is_final_idx"
ON "halisaha_answers"("match_id", "user_id", "is_final");
