import { prisma } from "@/lib/db";
import type { MatchStatisticsPayload } from "./types";

export async function getMatchStatisticsByMatchIds(
  matchIds: string[]
): Promise<Record<string, MatchStatisticsPayload>> {
  if (matchIds.length === 0) return {};

  const rows = await prisma.matchStatsCache.findMany({
    where: { matchId: { in: matchIds } },
    select: {
      matchId: true,
      payload: true,
    },
  });

  const result: Record<string, MatchStatisticsPayload> = {};
  for (const row of rows) {
    if (!row.payload || typeof row.payload !== "object") continue;
    result[row.matchId] = row.payload as MatchStatisticsPayload;
  }

  return result;
}
