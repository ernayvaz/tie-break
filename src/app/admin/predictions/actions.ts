"use server";

import { prisma } from "@/lib/db";
import { createAdminLog } from "@/lib/admin-log";
import { requireAdmin } from "@/lib/auth/get-user";
import { rebuildLeaderboard, scoreMatch } from "@/lib/scoring";
import { revalidatePath } from "next/cache";
import {
  createOrUpdatePrediction,
  finalizePrediction,
  unfinalizePrediction,
  resetAllPredictionsUpcoming,
} from "@/lib/predictions";
import { isValidDisplay, type PredictionDisplay } from "@/lib/prediction-values";

export type PredictionActionState = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Manually set awarded points for a prediction (0 or 1). Only for finalized predictions.
 * Rebuilds leaderboard after update and logs to AdminLog.
 */
export async function setPredictionPointsAction(
  predictionId: string,
  awardedPoints: 0 | 1
): Promise<PredictionActionState> {
  const admin = await requireAdmin();
  const prediction = await prisma.prediction.findUnique({
    where: { id: predictionId },
    select: { id: true, userId: true, matchId: true, isFinal: true, awardedPoints: true },
  });
  if (!prediction) return { ok: false, error: "Prediction not found." };
  if (!prediction.isFinal) return { ok: false, error: "Only finalized predictions can be adjusted." };

  const previous = String(prediction.awardedPoints);
  await prisma.prediction.update({
    where: { id: predictionId },
    data: { awardedPoints },
  });
  await rebuildLeaderboard();
  await createAdminLog(
    admin.id,
    "prediction_points_override",
    "prediction",
    predictionId,
    previous,
    String(awardedPoints)
  );
  revalidatePath("/admin/predictions");
  return { ok: true, message: "Points updated. Leaderboard refreshed." };
}

/**
 * Admin: Unfinalize (reset) one user's prediction for one match.
 */
export async function adminResetUserPredictionAction(
  targetUserId: string,
  matchId: string
): Promise<PredictionActionState> {
  await requireAdmin();
  const result = await unfinalizePrediction(targetUserId, matchId, { isAdmin: true });
  if (!result.ok) {
    const msg = result.error === "match_not_found" ? "Prediction or match not found." : result.error;
    return { ok: false, error: msg };
  }
  await rebuildLeaderboard();
  revalidatePath("/admin/predictions");
  return { ok: true, message: "Prediction reset to draft. Leaderboard refreshed." };
}

/**
 * Admin: Unfinalize all upcoming predictions for a user.
 */
export async function adminResetUserUpcomingPredictionsAction(
  targetUserId: string
): Promise<PredictionActionState> {
  await requireAdmin();
  const result = await resetAllPredictionsUpcoming(targetUserId);
  if (!result.ok) return { ok: false, error: result.error };
  await rebuildLeaderboard();
  revalidatePath("/admin/predictions");
  return { ok: true, message: `Reset ${result.count} upcoming prediction(s). Leaderboard refreshed.` };
}

/**
 * Admin: create/update a prediction for any user and any match (bypasses lock).
 * Optionally finalize; if the match already has an official result, points are recalculated for that match.
 */
export async function adminSetPredictionForUserAction(
  targetUserId: string,
  matchId: string,
  pick: PredictionDisplay,
  finalize: boolean
): Promise<PredictionActionState> {
  const admin = await requireAdmin();

  if (!isValidDisplay(pick)) {
    return { ok: false, error: "Pick must be 1, X, or 2." };
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, status: true },
  });
  if (!user) return { ok: false, error: "User not found." };
  if (user.status === "blocked") {
    return { ok: false, error: "Cannot set prediction for a blocked user." };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, officialResultType: true },
  });
  if (!match) return { ok: false, error: "Match not found." };

  const before = await prisma.prediction.findUnique({
    where: { userId_matchId: { userId: targetUserId, matchId } },
    select: {
      id: true,
      selectedPrediction: true,
      isFinal: true,
      awardedPoints: true,
    },
  });
  const oldSummary = before
    ? `${before.selectedPrediction}/${before.isFinal ? "final" : "draft"}/pts:${before.awardedPoints}`
    : "(none)";

  const upsert = await createOrUpdatePrediction(targetUserId, matchId, pick, {
    isAdmin: true,
  });
  if (!upsert.ok) {
    const msg =
      upsert.error === "match_not_found"
        ? "Match not found."
        : upsert.error === "match_locked"
          ? "Unexpected lock error."
          : upsert.error === "already_finalized"
            ? "Could not update prediction."
            : upsert.error;
    return { ok: false, error: msg };
  }

  if (finalize) {
    const fin = await finalizePrediction(targetUserId, matchId, { isAdmin: true });
    if (!fin.ok) {
      return { ok: false, error: "Could not finalize prediction." };
    }
    if (match.officialResultType !== null) {
      await scoreMatch(matchId);
    }
  } else {
    await prisma.prediction.update({
      where: { userId_matchId: { userId: targetUserId, matchId } },
      data: {
        isFinal: false,
        finalizedAt: null,
        awardedPoints: 0,
      },
    });
  }

  await rebuildLeaderboard();

  const predictionRow = await prisma.prediction.findUnique({
    where: { userId_matchId: { userId: targetUserId, matchId } },
    select: { id: true },
  });

  await createAdminLog(
    admin.id,
    "admin_set_prediction",
    "prediction",
    predictionRow?.id ?? `${targetUserId}:${matchId}`,
    oldSummary,
    `${pick}/${finalize ? "final" : "draft"}`
  );

  revalidatePath("/admin/predictions");
  revalidatePath("/schedule");
  revalidatePath("/predictions");
  revalidatePath("/leaderboard");

  return {
    ok: true,
    message: finalize
      ? "Prediction saved and finalized. Leaderboard refreshed."
      : "Prediction saved as draft.",
  };
}
