"use server";

import { getCurrentUser } from "@/lib/auth/get-user";
import {
  createOrUpdatePrediction,
  finalizePrediction,
  unfinalizePrediction,
  resetAllPredictionsUpcoming,
  resetAllPredictionsPast,
  type PredictionError,
} from "@/lib/predictions";
import { scoreMatch, rebuildLeaderboard } from "@/lib/scoring";
import { prisma } from "@/lib/db";
import type { PredictionDisplay } from "@/lib/prediction-values";

export type ScheduleActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const predictionErrorMessages: Record<PredictionError | "match_has_result" | "undo_not_allowed", string> = {
  match_locked: "Predictions are locked for this match.",
  invalid_prediction: "Invalid prediction value.",
  match_not_found: "Match not found.",
  already_finalized: "You have already finalized your prediction.",
  match_has_result: "Cannot undo after the match result is in.",
  undo_not_allowed: "You cannot undo predictions.",
};

export async function submitPredictionAction(
  matchId: string,
  value: PredictionDisplay
): Promise<ScheduleActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const isAdmin = user.role === "admin";
  const result = await createOrUpdatePrediction(user.id, matchId, value, { isAdmin });
  if (result.ok) return { ok: true };
  return { ok: false, error: predictionErrorMessages[result.error] ?? result.error };
}

export async function finalizePredictionAction(
  matchId: string
): Promise<ScheduleActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const isAdmin = user.role === "admin";
  const result = await finalizePrediction(user.id, matchId, { isAdmin });
  if (!result.ok) return { ok: false, error: predictionErrorMessages[result.error] ?? result.error };

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { officialResultType: true },
  });
  if (match?.officialResultType != null) {
    await scoreMatch(matchId);
  }
  await rebuildLeaderboard();
  return { ok: true };
}

export async function unfinalizePredictionAction(
  matchId: string
): Promise<ScheduleActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const isAdmin = user.role === "admin";
  const result = await unfinalizePrediction(user.id, matchId, { isAdmin });
  if (!result.ok) return { ok: false, error: predictionErrorMessages[result.error] ?? result.error };

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { officialResultType: true },
  });
  if (match?.officialResultType != null) await scoreMatch(matchId);
  await rebuildLeaderboard();
  return { ok: true };
}

/** Admin only: unfinalize all current user's predictions for upcoming matches. */
export async function resetUpcomingPredictionsAction(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };
  if (user.role !== "admin") return { ok: false, error: "Admin only." };
  const result = await resetAllPredictionsUpcoming(user.id);
  if (!result.ok) return result;
  await rebuildLeaderboard();
  return result;
}

/** Admin only: unfinalize all current user's predictions for past matches. */
export async function resetPastPredictionsAction(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };
  if (user.role !== "admin") return { ok: false, error: "Admin only." };
  const result = await resetAllPredictionsPast(user.id);
  if (!result.ok) return result;
  await rebuildLeaderboard();
  return result;
}
