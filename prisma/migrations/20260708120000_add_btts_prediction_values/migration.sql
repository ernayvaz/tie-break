-- Add Both-Teams-To-Score prediction options.
-- Postgres allows ALTER TYPE ... ADD VALUE inside Prisma's migration transaction as
-- long as the new value is not used in the same transaction (it is not here).
ALTER TYPE "PredictionValue" ADD VALUE IF NOT EXISTS 'BTTS_YES';
ALTER TYPE "PredictionValue" ADD VALUE IF NOT EXISTS 'BTTS_NO';
