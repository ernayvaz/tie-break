"use server";

import { prisma } from "@/lib/db";
import { createAdminLog } from "@/lib/admin-log";
import { requireAdmin } from "@/lib/auth/get-user";
import { scoreMatch, rebuildLeaderboard } from "@/lib/scoring";
import { fromDisplay, isValidDisplay } from "@/lib/prediction-values";
import type { PredictionDisplay } from "@/lib/prediction-values";
import { revalidatePath } from "next/cache";

export type MatchActionState = { ok: true; message?: string } | { ok: false; error: string };

export async function setMatchResultAction(
  matchId: string,
  resultType: PredictionDisplay,
  homeScore?: number | null,
  awayScore?: number | null
): Promise<MatchActionState> {
  const admin = await requireAdmin();
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, officialResultType: true, homeScore: true, awayScore: true },
  });
  if (!match) return { ok: false, error: "Match not found." };

  const value = fromDisplay(resultType);
  const home = homeScore != null && homeScore >= 0 ? homeScore : null;
  const away = awayScore != null && awayScore >= 0 ? awayScore : null;

  const oldVal = match.officialResultType
    ? `${match.officialResultType}${match.homeScore != null ? ` ${match.homeScore}-${match.awayScore}` : ""}`
    : null;
  const newVal = `${value}${home != null && away != null ? ` ${home}-${away}` : ""}`;

  await prisma.match.update({
    where: { id: matchId },
    data: {
      officialResultType: value,
      homeScore: home,
      awayScore: away,
      sourceStatus: "mixed" as const,
    },
  });

  await scoreMatch(matchId);
  await rebuildLeaderboard();
  await createAdminLog(admin.id, "match_result_manual", "match", matchId, oldVal, newVal);
  revalidatePath("/admin/matches");
  return { ok: true, message: "Result saved. Predictions and leaderboard updated." };
}

export async function createMatchAction(data: {
  stage: string;
  matchDatetime: string;
  homeTeamName: string;
  awayTeamName: string;
  lockAt?: string | null;
}): Promise<MatchActionState> {
  const admin = await requireAdmin();
  const stage = data.stage.trim();
  const homeTeamName = data.homeTeamName.trim();
  const awayTeamName = data.awayTeamName.trim();
  if (!stage || !homeTeamName || !awayTeamName) return { ok: false, error: "Stage and both team names are required." };

  const matchDatetime = new Date(data.matchDatetime);
  if (isNaN(matchDatetime.getTime())) return { ok: false, error: "Invalid date/time." };

  const lockAt = data.lockAt ? new Date(data.lockAt) : new Date(matchDatetime.getTime() - 5 * 60 * 1000);
  if (isNaN(lockAt.getTime())) return { ok: false, error: "Invalid lock time." };

  const match = await prisma.match.create({
    data: {
      competitionId: "CL",
      stage,
      matchDatetime,
      homeTeamName,
      awayTeamName,
      lockAt,
      sourceStatus: "manual",
    },
  });
  await createAdminLog(admin.id, "match_created", "match", match.id, null, `${stage} ${homeTeamName} vs ${awayTeamName}`);
  revalidatePath("/admin/matches");
  return { ok: true, message: "Match created." };
}

export async function updateMatchAction(
  matchId: string,
  data: {
    stage?: string;
    matchDatetime?: string;
    homeTeamName?: string;
    awayTeamName?: string;
    lockAt?: string | null;
    officialResultType?: PredictionDisplay | null;
    homeScore?: number | null;
    awayScore?: number | null;
  }
): Promise<MatchActionState> {
  const admin = await requireAdmin();
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, stage: true, matchDatetime: true, homeTeamName: true, awayTeamName: true, lockAt: true, officialResultType: true, homeScore: true, awayScore: true },
  });
  if (!match) return { ok: false, error: "Match not found." };

  type UpdateData = Parameters<typeof prisma.match.update>[0]["data"];
  const update: UpdateData = {};
  let resultUpdated = false;

  if (data.stage !== undefined) update.stage = data.stage.trim();
  if (data.matchDatetime !== undefined) {
    const d = new Date(data.matchDatetime);
    if (isNaN(d.getTime())) return { ok: false, error: "Invalid date/time." };
    update.matchDatetime = d;
  }
  if (data.homeTeamName !== undefined) update.homeTeamName = data.homeTeamName.trim();
  if (data.awayTeamName !== undefined) update.awayTeamName = data.awayTeamName.trim();
  if (data.lockAt !== undefined) {
    update.lockAt = data.lockAt ? new Date(data.lockAt) : new Date((match.matchDatetime as Date).getTime() - 5 * 60 * 1000);
  }
  if (data.officialResultType !== undefined) {
    resultUpdated = true;
    if (data.officialResultType === null || data.officialResultType === "") {
      update.officialResultType = null;
      update.homeScore = null;
      update.awayScore = null;
    } else if (isValidDisplay(data.officialResultType as PredictionDisplay)) {
      update.officialResultType = fromDisplay(data.officialResultType as PredictionDisplay);
      if (data.homeScore != null && data.awayScore != null) {
        update.homeScore = data.homeScore;
        update.awayScore = data.awayScore;
      }
    }
  } else if (data.homeScore !== undefined && data.awayScore !== undefined) {
    resultUpdated = true;
    update.homeScore = data.homeScore;
    update.awayScore = data.awayScore;
  }

  if (resultUpdated) (update as Record<string, unknown>).sourceStatus = "mixed";

  await prisma.match.update({
    where: { id: matchId },
    data: update,
  });

  if (resultUpdated) {
    await scoreMatch(matchId);
    await rebuildLeaderboard();
  }
  await createAdminLog(admin.id, "match_updated", "match", matchId, null, null);
  revalidatePath("/admin/matches");
  return { ok: true, message: "Match updated." };
}

export async function deleteMatchAction(matchId: string): Promise<MatchActionState> {
  const admin = await requireAdmin();
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, homeTeamName: true, awayTeamName: true },
  });
  if (!match) return { ok: false, error: "Match not found." };

  await prisma.match.delete({ where: { id: matchId } });
  await createAdminLog(admin.id, "match_deleted", "match", matchId, `${match.homeTeamName} vs ${match.awayTeamName}`, null);
  revalidatePath("/admin/matches");
  return { ok: true, message: "Match deleted." };
}
