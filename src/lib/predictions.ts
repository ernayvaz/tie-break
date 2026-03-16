import { prisma } from "@/lib/db";
import { fromDisplay, toDisplay, type PredictionDisplay } from "@/lib/prediction-values";
import type { Match } from "@prisma/client";

export type PredictionError =
  | "match_locked"
  | "invalid_prediction"
  | "match_not_found"
  | "already_finalized";

export type PredictionResult =
  | { ok: true }
  | { ok: false; error: PredictionError };

/**
 * Check if predictions are still allowed for this match (before lock time).
 */
export function canPredict(match: Match, now: Date): boolean {
  if (match.isLocked) return false;
  return now < match.lockAt;
}

export type PredictionOptions = { isAdmin?: boolean };

/**
 * Create or update a draft prediction. Fails if match is locked or already finalized.
 * When isAdmin is true, lock and already-finalized checks are skipped (for testing on past matches).
 */
export async function createOrUpdatePrediction(
  userId: string,
  matchId: string,
  displayValue: PredictionDisplay,
  options?: PredictionOptions
): Promise<PredictionResult> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { ok: false, error: "match_not_found" };

  const allowLocked = options?.isAdmin === true;
  if (!allowLocked && !canPredict(match, new Date())) return { ok: false, error: "match_locked" };

  const value = fromDisplay(displayValue);

  const existing = await prisma.prediction.findUnique({
    where: { userId_matchId: { userId, matchId } },
  });
  if (!allowLocked && existing?.isFinal) {
    if (existing.selectedPrediction === value) return { ok: true };
    return { ok: false, error: "already_finalized" };
  }

  await prisma.prediction.upsert({
    where: { userId_matchId: { userId, matchId } },
    create: { userId, matchId, selectedPrediction: value, isFinal: false },
    update: { selectedPrediction: value },
  });
  return { ok: true };
}

/**
 * Finalize the current prediction for a match. Locks it so it cannot be changed.
 * When isAdmin is true, lock check is skipped (admin can finalize on past matches for testing).
 */
export async function finalizePrediction(
  userId: string,
  matchId: string,
  options?: PredictionOptions
): Promise<PredictionResult> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { ok: false, error: "match_not_found" };

  const allowLocked = options?.isAdmin === true;
  if (!allowLocked && !canPredict(match, new Date())) return { ok: false, error: "match_locked" };

  const existing = await prisma.prediction.findUnique({
    where: { userId_matchId: { userId, matchId } },
  });
  if (!existing) return { ok: false, error: "match_not_found" };
  if (existing.isFinal) return { ok: true };

  await prisma.prediction.update({
    where: { id: existing.id },
    data: { isFinal: true, finalizedAt: new Date() },
  });
  return { ok: true };
}

export type UnfinalizeError = PredictionError | "match_has_result" | "undo_not_allowed";

/**
 * Undo finalize: set prediction back to draft.
 * Only admin can undo; normal users cannot take back their predictions.
 * Admin is allowed even when match has result (for testing / corrections).
 */
export async function unfinalizePrediction(
  userId: string,
  matchId: string,
  options?: PredictionOptions
): Promise<{ ok: true } | { ok: false; error: UnfinalizeError }> {
  if (options?.isAdmin !== true) return { ok: false, error: "undo_not_allowed" };

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { ok: false, error: "match_not_found" };
  const allowWithResult = true; // admin only reaches here
  if (!allowWithResult && match.officialResultType !== null) return { ok: false, error: "match_has_result" };

  const existing = await prisma.prediction.findUnique({
    where: { userId_matchId: { userId, matchId } },
  });
  if (!existing) return { ok: false, error: "match_not_found" };
  if (!existing.isFinal) return { ok: true };

  await prisma.prediction.update({
    where: { id: existing.id },
    data: { isFinal: false, finalizedAt: null, awardedPoints: 0 },
  });
  return { ok: true };
}

/**
 * Reset all predictions for the user: unfinalize every prediction where the match has no official result yet.
 * Already scored matches are left as-is.
 */
export async function resetAllPredictions(
  userId: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const predictions = await prisma.prediction.findMany({
    where: { userId, isFinal: true },
    include: { match: { select: { officialResultType: true } } },
  });
  const toUnfinalize = predictions.filter((p) => p.match.officialResultType === null);
  for (const p of toUnfinalize) {
    await prisma.prediction.update({
      where: { id: p.id },
      data: { isFinal: false, finalizedAt: null, awardedPoints: 0 },
    });
  }
  return { ok: true, count: toUnfinalize.length };
}

/**
 * Unfinalize all of the user's predictions for upcoming matches (matchDatetime >= now).
 * Used by admin on Schedule for "Reset all (upcoming)".
 */
export async function resetAllPredictionsUpcoming(
  userId: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const now = new Date();
  const predictions = await prisma.prediction.findMany({
    where: {
      userId,
      isFinal: true,
      match: { matchDatetime: { gte: now } },
    },
    select: { id: true },
  });
  for (const p of predictions) {
    await prisma.prediction.update({
      where: { id: p.id },
      data: { isFinal: false, finalizedAt: null, awardedPoints: 0 },
    });
  }
  return { ok: true, count: predictions.length };
}

/**
 * Unfinalize all of the user's predictions for past matches (matchDatetime < now).
 * Used by admin on Schedule for "Reset all (past)".
 */
export async function resetAllPredictionsPast(
  userId: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const now = new Date();
  const predictions = await prisma.prediction.findMany({
    where: {
      userId,
      isFinal: true,
      match: { matchDatetime: { lt: now } },
    },
    select: { id: true },
  });
  for (const p of predictions) {
    await prisma.prediction.update({
      where: { id: p.id },
      data: { isFinal: false, finalizedAt: null, awardedPoints: 0 },
    });
  }
  return { ok: true, count: predictions.length };
}

/**
 * Get other users' finalized predictions for a match.
 * Only returns data when the current user has finalized their prediction for this match.
 * Match does not need to have started.
 * Returns name, surname, selectedPrediction, finalizedAt (no username).
 */
export async function getOthersPredictions(
  matchId: string,
  currentUserId: string
): Promise<
  { name: string; surname: string; selectedPrediction: string; finalizedAt: Date }[]
> {
  const byMatch = await getOthersPredictionsBatch([matchId], currentUserId);
  return byMatch[matchId] ?? [];
}

/**
 * Batch version: get others' predictions for multiple matches at once (avoids N+1).
 * Returns others' predictions only for matches where the current user has finalized.
 * Applies to admin too (for testing); admin can still undo their predictions anytime.
 * Match does not need to have started.
 */
export async function getOthersPredictionsBatch(
  matchIds: string[],
  currentUserId: string
): Promise<
  Record<
    string,
    { name: string; surname: string; selectedPrediction: string; finalizedAt: Date }[]
  >
> {
  if (matchIds.length === 0) return {};

  const currentUserFinalized = await prisma.prediction.findMany({
    where: {
      matchId: { in: matchIds },
      userId: currentUserId,
      isFinal: true,
    },
    select: { matchId: true },
  });
  const finalizedMatchIds = new Set(currentUserFinalized.map((p) => p.matchId));

  if (finalizedMatchIds.size === 0) return {};

  const others = await prisma.prediction.findMany({
    where: {
      matchId: { in: [...finalizedMatchIds] },
      userId: { not: currentUserId },
      isFinal: true,
      user: { role: { not: "admin" } },
    },
    orderBy: [{ matchId: "asc" }, { finalizedAt: "asc" }],
    select: {
      matchId: true,
      selectedPrediction: true,
      finalizedAt: true,
      user: { select: { name: true, surname: true } },
    },
  });

  const result: Record<
    string,
    { name: string; surname: string; selectedPrediction: string; finalizedAt: Date }[]
  > = {};
  for (const o of others) {
    if (!o.finalizedAt) continue;
    if (!result[o.matchId]) result[o.matchId] = [];
    result[o.matchId].push({
      name: o.user.name,
      surname: o.user.surname,
      selectedPrediction: toDisplay(o.selectedPrediction),
      finalizedAt: o.finalizedAt,
    });
  }
  return result;
}
