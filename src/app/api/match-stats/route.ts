import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { syncMatchStatisticsCache } from "@/lib/api/sync-match-stats";
import { getMatchStatisticsByMatchIds } from "@/lib/match-stats/cache";

function toMatchId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function chunkMatchIds(matchIds: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < matchIds.length; index += chunkSize) {
    chunks.push(matchIds.slice(index, index + chunkSize));
  }
  return chunks;
}

function parseRateLimitDelayMs(message: string | null | undefined): number | null {
  if (!message) return null;
  const match = message.match(/wait\s+(\d+)\s+seconds?/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds)) return null;
  return seconds * 1000 + 1000;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const matchIds = Array.isArray((body as { matchIds?: unknown[] })?.matchIds)
    ? (body as { matchIds: unknown[] }).matchIds
        .map(toMatchId)
        .filter((matchId): matchId is string => matchId !== null)
        .slice(0, 25)
    : [];

  if (matchIds.length === 0) {
    return Response.json(
      { ok: false, error: "At least one match id is required" },
      { status: 400 }
    );
  }

  const existingStatsByMatchId = await getMatchStatisticsByMatchIds(matchIds);
  const matchIdsToRefresh = matchIds.filter((matchId) => {
    const stats = existingStatsByMatchId[matchId];
    if (!stats) return true;
    if (stats.status === "unavailable") return true;
    if (stats.status === "partial") return true;
    return (
      stats.freshness.status === "stale" ||
      stats.freshness.status === "partial" ||
      stats.freshness.status === "unavailable"
    );
  });

  let refreshError: string | null = null;
  if (matchIdsToRefresh.length > 0) {
    for (const chunk of chunkMatchIds(matchIdsToRefresh, 2)) {
      let syncResult = await syncMatchStatisticsCache({ matchIds: chunk });
      const retryDelayMs = !syncResult.ok
        ? parseRateLimitDelayMs(syncResult.error)
        : null;
      if (!syncResult.ok && retryDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        syncResult = await syncMatchStatisticsCache({ matchIds: chunk });
      }
      if (!syncResult.ok) {
        refreshError = syncResult.error;
      }
    }
  }

  const statsByMatchId = await getMatchStatisticsByMatchIds(matchIds);
  if (Object.keys(statsByMatchId).length === 0 && refreshError) {
    return Response.json(
      { ok: false, error: refreshError },
      { status: 502 }
    );
  }

  return Response.json({
    ok: true,
    statsByMatchId,
    refreshError,
    fetchedAt: new Date().toISOString(),
  });
}
