import { prisma } from "@/lib/db";
import { fetchUclMatches, getResultTypeFromScore, getScoreFromApi } from "./football-data";
import { UCL_COMPETITION_ID, UCL_SEASON } from "@/lib/config";
import type { PredictionValue } from "@prisma/client";

const LOCK_MINUTES_BEFORE = 5;

function mapStage(apiStage: string | undefined): string {
  if (!apiStage) return "GROUP_STAGE";
  const u = apiStage.toUpperCase().replace(/\s+/g, "_");
  if (u.includes("GROUP") || u === "LEAGUE_STAGE") return "GROUP_STAGE";
  if (u.includes("ROUND_OF_16") || u.includes("ROUND_16") || u === "LAST_16") return "ROUND_16";
  if (u.includes("QUARTER")) return "QUARTER_FINAL";
  if (u.includes("SEMI")) return "SEMI_FINAL";
  if (u.includes("FINAL")) return "FINAL";
  if (u.includes("PLAYOFF")) return "PLAYOFFS";
  return apiStage;
}

function lockAt(matchDatetime: Date): Date {
  const t = new Date(matchDatetime);
  t.setMinutes(t.getMinutes() - LOCK_MINUTES_BEFORE);
  return t;
}

export type SyncResult = { ok: true; count: number } | { ok: false; error: string };

export async function syncMatchesFromApi(): Promise<SyncResult> {
  const result = await fetchUclMatches(UCL_COMPETITION_ID, UCL_SEASON);

  if (!result.ok) {
    await prisma.apiSyncLog.create({
      data: {
        provider: "football-data.org",
        action: "sync_matches",
        status: "error",
        errorMessage: result.error,
      },
    });
    return { ok: false, error: result.error };
  }

  const now = new Date();
  let count = 0;

  for (const m of result.matches) {
    const matchDatetime = new Date(m.utcDate);
    const lockAtDate = lockAt(matchDatetime);
    const stage = mapStage(m.stage);
    const isFinished = String(m.status).toUpperCase() === "FINISHED";
    const resultType: PredictionValue | null = isFinished
      ? getResultTypeFromScore(m.score)
      : null;
    const scoreFromApi = isFinished ? getScoreFromApi(m.score) : null;

    const homeTeamName = (m.homeTeam?.name ?? "").trim() || "TBD";
    const awayTeamName = (m.awayTeam?.name ?? "").trim() || "TBD";

    const extId = String(m.id);
    const existing = await prisma.match.findFirst({
      where: { externalApiId: extId },
    });

    const data = {
      competitionId: UCL_COMPETITION_ID,
      stage,
      matchDatetime,
      lockAt: lockAtDate,
      homeTeamName,
      awayTeamName,
      homeTeamLogo: m.homeTeam?.crest ?? null,
      awayTeamLogo: m.awayTeam?.crest ?? null,
      ...(isFinished && resultType !== null
        ? {
            officialResultType: resultType,
            isLocked: true,
            ...(scoreFromApi
              ? { homeScore: scoreFromApi.home, awayScore: scoreFromApi.away }
              : {}),
          }
        : { isLocked: now >= lockAtDate }),
      sourceStatus: "api" as const,
      syncedAt: now,
    };

    if (existing) {
      await prisma.match.update({ where: { id: existing.id }, data });
    } else {
      await prisma.match.create({
        data: {
          externalApiId: extId,
          ...data,
        },
      });
    }
    count++;
  }

  await prisma.apiSyncLog.create({
    data: {
      provider: "football-data.org",
      action: "sync_matches",
      status: "success",
      errorMessage: null,
    },
  });

  return { ok: true, count };
}
