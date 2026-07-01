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
import { setUserPowerPick } from "@/lib/power-pick";
import { reclaimUnusedPowerPick } from "@/lib/power-pick-admin";
import { normalizePowerPickMultiplier, POWER_PICK_COMPETITION_ID } from "@/lib/config";
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
  finalize: boolean,
  /** ISO 8601; omit or empty = now. Shown on site as finalized time (if final) or “entered” / created time (draft). */
  enteredAtIso?: string | null,
  powerPickMultiplier?: number | null
): Promise<PredictionActionState> {
  const admin = await requireAdmin();

  if (!isValidDisplay(pick)) {
    return { ok: false, error: "Pick must be 1, X, or 2." };
  }

  let effectiveEnteredAt = new Date();
  if (enteredAtIso != null && String(enteredAtIso).trim() !== "") {
    const parsed = new Date(enteredAtIso);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Invalid date/time." };
    }
    effectiveEnteredAt = parsed;
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
  const powerPickSummary =
    powerPickMultiplier == null || powerPickMultiplier < 0
      ? "unchanged"
      : powerPickMultiplier > 0
        ? `x${normalizePowerPickMultiplier(powerPickMultiplier)}`
        : "none";

  const upsert = await createOrUpdatePrediction(targetUserId, matchId, pick, {
    isAdmin: true,
    createdAt: effectiveEnteredAt,
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

  if (powerPickMultiplier != null && powerPickMultiplier >= 0) {
    const multiplier = Number(powerPickMultiplier);
    if (multiplier > 0) {
      const powerPick = await setUserPowerPick(targetUserId, matchId, true, {
        isAdmin: true,
        multiplier: normalizePowerPickMultiplier(multiplier),
      });
      if (!powerPick.ok) return { ok: false, error: `Power Pick could not be assigned: ${powerPick.error}` };
    } else {
      const powerPick = await setUserPowerPick(targetUserId, matchId, false, { isAdmin: true });
      if (!powerPick.ok) return { ok: false, error: `Power Pick could not be removed: ${powerPick.error}` };
    }
  }

  if (finalize) {
    const fin = await finalizePrediction(targetUserId, matchId, {
      isAdmin: true,
      finalizedAt: effectiveEnteredAt,
    });
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
        createdAt: effectiveEnteredAt,
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
    `${pick}/${finalize ? "final" : "draft"}/at:${effectiveEnteredAt.toISOString()}/pp:${powerPickSummary}`
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

/**
 * Admin: assign or remove a Power Pick on a single user's prediction for one match.
 * `multiplier > 0` arms the booster with that multiplier (topping up the user's
 * balance if needed, bypassing lock); `multiplier <= 0` removes it and frees the
 * right back into the user's available pool. World Cup matches only. If the match
 * already has an official result the fixture is rescored, then the leaderboard is
 * rebuilt.
 */
export async function adminSetMatchPowerPickAction(
  targetUserId: string,
  matchId: string,
  multiplier: number
): Promise<PredictionActionState> {
  const admin = await requireAdmin();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, competitionId: true, officialResultType: true },
  });
  if (!match) return { ok: false, error: "Match not found." };
  if ((match.competitionId ?? null) !== POWER_PICK_COMPETITION_ID) {
    return { ok: false, error: "Power Pick applies to World Cup matches only." };
  }

  const enable = multiplier > 0;
  if (enable) {
    const normalized = normalizePowerPickMultiplier(multiplier);
    const res = await setUserPowerPick(targetUserId, matchId, true, {
      isAdmin: true,
      multiplier: normalized,
    });
    if (!res.ok) {
      const msg =
        res.error === "no_prediction"
          ? "User has no prediction on this match yet — set a prediction first."
          : `Power Pick could not be assigned: ${res.error}`;
      return { ok: false, error: msg };
    }
  } else {
    const res = await setUserPowerPick(targetUserId, matchId, false, { isAdmin: true });
    if (!res.ok) return { ok: false, error: `Power Pick could not be removed: ${res.error}` };
  }

  // Points depend on the multiplier, so rescore completed fixtures before rebuilding.
  if (match.officialResultType !== null) {
    await scoreMatch(matchId);
  }
  await rebuildLeaderboard();

  await createAdminLog(
    admin.id,
    "admin_set_match_power_pick",
    "prediction",
    `${targetUserId}:${matchId}`,
    "power_pick",
    enable ? `x${normalizePowerPickMultiplier(multiplier)}` : "none"
  );

  revalidatePath("/admin/predictions");
  revalidatePath("/schedule");
  revalidatePath("/leaderboard");

  return {
    ok: true,
    message: enable
      ? `Power Pick x${normalizePowerPickMultiplier(multiplier)} assigned. Leaderboard refreshed.`
      : "Power Pick removed. Right returned to the user's pool.",
  };
}

/**
 * Admin: reclaim `amount` of a user's *unused* Power Pick rights (from the freed-up
 * / available pool only — committed and locked picks are never touched). Used after
 * an admin removes a Power Pick from a match to also drop the granted right.
 */
export async function adminReclaimUnusedPowerPickAction(
  targetUserId: string,
  amount: number
): Promise<PredictionActionState> {
  const admin = await requireAdmin();
  const res = await reclaimUnusedPowerPick({
    adminUserId: admin.id,
    userId: targetUserId,
    amount,
  });
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/admin/predictions");
  revalidatePath("/schedule");

  return {
    ok: true,
    message: `Reclaimed ${res.reclaimed} unused right(s). ${res.remainingAvailable} available remaining.`,
  };
}
