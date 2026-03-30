-- CreateTable
CREATE TABLE "halisaha_mvp_round_awards" (
    "id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "halisaha_mvp_round_awards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "halisaha_mvp_round_awards_round_number_user_id_key" ON "halisaha_mvp_round_awards"("round_number", "user_id");

-- CreateIndex
CREATE INDEX "halisaha_mvp_round_awards_user_id_idx" ON "halisaha_mvp_round_awards"("user_id");

-- AddForeignKey
ALTER TABLE "halisaha_mvp_round_awards" ADD CONSTRAINT "halisaha_mvp_round_awards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
