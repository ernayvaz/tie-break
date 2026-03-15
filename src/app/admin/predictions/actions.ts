"use server";

import { prisma } from "@/lib/db";
import { createAdminLog } from "@/lib/admin-log";
import { requireAdmin } from "@/lib/auth/get-user";
import { rebuildLeaderboard } from "@/lib/scoring";
import { revalidatePath } from "next/cache";

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
