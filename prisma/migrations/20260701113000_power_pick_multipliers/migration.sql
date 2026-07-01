ALTER TABLE "user_power_pick_balances"
ADD COLUMN "multiplier" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "power_pick_selections"
ADD COLUMN "multiplier" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "admin_power_pick_grant_logs"
ADD COLUMN "multiplier" INTEGER NOT NULL DEFAULT 3;
