-- CreateEnum
CREATE TYPE "PowerPickStatus" AS ENUM ('active', 'locked', 'revoked');

-- CreateTable
CREATE TABLE "user_power_pick_balances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "total_granted" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_power_pick_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "power_pick_selections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "status" "PowerPickStatus" NOT NULL DEFAULT 'active',
    "selected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "power_pick_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_power_pick_grant_logs" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "target_scope" TEXT NOT NULL,
    "target_user_ids" TEXT,
    "competition_id" TEXT NOT NULL,
    "amount_granted" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "affected_users" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_power_pick_grant_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_power_pick_balances_competition_id_idx" ON "user_power_pick_balances"("competition_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_power_pick_balances_user_id_competition_id_key" ON "user_power_pick_balances"("user_id", "competition_id");

-- CreateIndex
CREATE INDEX "power_pick_selections_user_id_competition_id_idx" ON "power_pick_selections"("user_id", "competition_id");

-- CreateIndex
CREATE INDEX "power_pick_selections_match_id_idx" ON "power_pick_selections"("match_id");

-- CreateIndex
CREATE INDEX "power_pick_selections_competition_id_status_idx" ON "power_pick_selections"("competition_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "power_pick_selections_user_id_match_id_key" ON "power_pick_selections"("user_id", "match_id");

-- CreateIndex
CREATE INDEX "admin_power_pick_grant_logs_created_at_idx" ON "admin_power_pick_grant_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_power_pick_grant_logs_competition_id_idx" ON "admin_power_pick_grant_logs"("competition_id");

-- AddForeignKey
ALTER TABLE "user_power_pick_balances" ADD CONSTRAINT "user_power_pick_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "power_pick_selections" ADD CONSTRAINT "power_pick_selections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "power_pick_selections" ADD CONSTRAINT "power_pick_selections_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
