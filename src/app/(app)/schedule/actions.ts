"use server";

import { getCurrentUser } from "@/lib/auth/get-user";
import {
  createOrUpdatePrediction,
  finalizePrediction,
  getOthersPredictions,
  unfinalizePrediction,
  resetAllPredictionsUpcoming,
  resetAllPredictionsPast,
  type PredictionError,
} from "@/lib/predictions";
import { scoreMatch, rebuildLeaderboardForCompetition } from "@/lib/scoring";
import { prisma } from "@/lib/db";
import type { PredictionDisplay } from "@/lib/prediction-values";
import { UCL_COMPETITION_ID } from "@/lib/config";

export type ScheduleActionState =
  | {
      ok: true;
      message?: string;
      others?: {
        name: string;
        surname: string;
        selectedPrediction: string;
        finalizedAt: string;
      }[];
    }
  | { ok: false; error: string };

export type ScheduleResetActionState =
  | {
      ok: true;
      count: number;
      matchIds: string[];
      competitionIds: string[];
    }
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
  matchId: string,
  value?: PredictionDisplay
): Promise<ScheduleActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const isAdmin = user.role === "admin";
  if (value) {
    const draftResult = await createOrUpdatePrediction(user.id, matchId, value, { isAdmin });
    if (!draftResult.ok) {
      return { ok: false, error: predictionErrorMessages[draftResult.error] ?? draftResult.error };
    }
  }
  const result = await finalizePrediction(user.id, matchId, { isAdmin });
  if (!result.ok) return { ok: false, error: predictionErrorMessages[result.error] ?? result.error };
  const others = await getOthersPredictions(matchId, user.id);
  return {
    ok: true,
    others: others.map((o) => ({
      ...o,
      finalizedAt: o.finalizedAt.toISOString(),
    })),
  };
}

export async function unfinalizePredictionAction(
  matchId: string
): Promise<ScheduleActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const isAdmin = user.role === "admin";
  const result = await unfinalizePrediction(user.id, matchId, { isAdmin });
  if (!result.ok) return { ok: false, error: predictionErrorMessages[result.error] ?? result.error };
  return { ok: true };
}

export async function syncPredictionDerivedDataAction(matchId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { officialResultType: true, competitionId: true },
  });
  if (!match) return;
  if (match.officialResultType != null) {
    await scoreMatch(matchId);
  }
  await rebuildLeaderboardForCompetition(match.competitionId ?? UCL_COMPETITION_ID);
}

export async function rebuildCompetitionLeaderboardsAction(
  competitionIds: string[]
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const uniqueCompetitionIds = [...new Set(competitionIds.filter(Boolean))];
  for (const competitionId of uniqueCompetitionIds) {
    await rebuildLeaderboardForCompetition(competitionId);
  }
}

/** Admin only: unfinalize all current user's predictions for upcoming matches. */
export async function resetUpcomingPredictionsAction(): Promise<ScheduleResetActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };
  if (user.role !== "admin") return { ok: false, error: "Admin only." };
  const result = await resetAllPredictionsUpcoming(user.id);
  return result;
}

/** Admin only: unfinalize all current user's predictions for past matches. */
export async function resetPastPredictionsAction(): Promise<ScheduleResetActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };
  if (user.role !== "admin") return { ok: false, error: "Admin only." };
  const result = await resetAllPredictionsPast(user.id);
  return result;
}
