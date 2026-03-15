"use server";

import { getCurrentUser } from "@/lib/auth/get-user";
import { unfinalizePrediction, resetAllPredictions } from "@/lib/predictions";
import { rebuildLeaderboard } from "@/lib/scoring";

export type PredictionsActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const unfinalizeErrorMessages: Record<string, string> = {
  match_not_found: "Match not found.",
  match_has_result: "Cannot undo after the match result is in.",
  undo_not_allowed: "You cannot undo predictions.",
};

export async function unfinalizePredictionAction(
  matchId: string
): Promise<PredictionsActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const isAdmin = user.role === "admin";
  const result = await unfinalizePrediction(user.id, matchId, { isAdmin });
  if (!result.ok) return { ok: false, error: unfinalizeErrorMessages[result.error] ?? result.error };

  await rebuildLeaderboard();
  return { ok: true };
}

export async function resetAllPredictionsAction(): Promise<
  | { ok: true; count: number }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };
  if (user.role !== "admin") return { ok: false, error: "Only admins can reset predictions." };

  const result = await resetAllPredictions(user.id);
  if (!result.ok) return result;

  await rebuildLeaderboard();
  return result;
}
