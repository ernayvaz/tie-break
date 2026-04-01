-- CreateEnum
CREATE TYPE "HalisahaFormation" AS ENUM (
    'f1_2_3_1',
    'f1_3_2_1',
    'f1_3_3',
    'f1_2_2_2',
    'f1_3_1_2',
    'f1_2_1_3'
);

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "HalisahaPositionKey" ADD VALUE 'center_defender';
ALTER TYPE "HalisahaPositionKey" ADD VALUE 'left_midfielder';
ALTER TYPE "HalisahaPositionKey" ADD VALUE 'right_midfielder';
ALTER TYPE "HalisahaPositionKey" ADD VALUE 'left_forward';
ALTER TYPE "HalisahaPositionKey" ADD VALUE 'right_forward';

-- CreateTable
CREATE TABLE "halisaha_guests" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "halisaha_guests_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "halisaha_matches"
ADD COLUMN "home_formation" "HalisahaFormation" NOT NULL DEFAULT 'f1_2_3_1',
ADD COLUMN "away_formation" "HalisahaFormation" NOT NULL DEFAULT 'f1_2_3_1';

-- AlterTable
ALTER TABLE "halisaha_participants"
ADD COLUMN "guest_id" TEXT;

-- Backfill guest registry rows from existing guest participants.
INSERT INTO "halisaha_guests" (
    "id",
    "display_name",
    "normalized_name",
    "is_active",
    "created_at",
    "updated_at"
)
SELECT
    CONCAT('guest_', md5(normalized.normalized_name)),
    normalized.display_name,
    normalized.normalized_name,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT
        LOWER(BTRIM("guest_name")) AS "normalized_name",
        MIN(BTRIM("guest_name")) AS "display_name"
    FROM "halisaha_participants"
    WHERE "user_id" IS NULL
      AND "guest_name" IS NOT NULL
      AND BTRIM("guest_name") <> ''
    GROUP BY LOWER(BTRIM("guest_name"))
) AS normalized;

-- Link one historical participant row per match/name pair so the new
-- unique guest-per-match constraint remains safe even if legacy duplicates exist.
WITH "rankedGuests" AS (
    SELECT
        participant."id" AS "participant_id",
        guest."id" AS "guest_id",
        ROW_NUMBER() OVER (
            PARTITION BY participant."match_id", guest."id"
            ORDER BY participant."created_at" ASC, participant."id" ASC
        ) AS "row_number"
    FROM "halisaha_participants" AS participant
    INNER JOIN "halisaha_guests" AS guest
        ON guest."normalized_name" = LOWER(BTRIM(participant."guest_name"))
    WHERE participant."user_id" IS NULL
      AND participant."guest_name" IS NOT NULL
      AND BTRIM(participant."guest_name") <> ''
)
UPDATE "halisaha_participants" AS participant
SET "guest_id" = "rankedGuests"."guest_id"
FROM "rankedGuests"
WHERE participant."id" = "rankedGuests"."participant_id"
  AND "rankedGuests"."row_number" = 1;

-- CreateIndex
CREATE UNIQUE INDEX "halisaha_guests_normalized_name_key" ON "halisaha_guests"("normalized_name");

-- CreateIndex
CREATE INDEX "halisaha_guests_is_active_display_name_idx" ON "halisaha_guests"("is_active", "display_name");

-- CreateIndex
CREATE INDEX "halisaha_participants_guest_id_idx" ON "halisaha_participants"("guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "halisaha_participants_match_id_guest_id_key" ON "halisaha_participants"("match_id", "guest_id");

-- AddForeignKey
ALTER TABLE "halisaha_participants"
ADD CONSTRAINT "halisaha_participants_guest_id_fkey"
FOREIGN KEY ("guest_id") REFERENCES "halisaha_guests"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
