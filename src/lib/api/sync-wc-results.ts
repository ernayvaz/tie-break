/**
 * Sync World Cup 2026 results from OpenLigaDB onto existing local fixtures.
 *
 * Results-only: we never create fixtures or rename teams here. Each finished
 * OpenLigaDB match is matched to a local World Cup fixture by its (language-
 * independent) team pair, and only `officialResultType` / scores are written.
 * Scoring + leaderboard rebuild is run separately by the caller (recalculateAll).
 */
import { prisma } from "@/lib/db";
import { WORLD_CUP_2026_COMPETITION_ID } from "@/lib/config";
import {
  fetchOpenLigaDbWorldCupMatches,
  getOpenLigaDbFinalScore,
  normalizeTeamName,
  resolveEnglishTeamName,
} from "./openligadb";

export type SyncWcResultsResult =
  | {
      ok: true;
      finishedCount: number;
      updatedCount: number;
      unmatchedCount: number;
    }
  | { ok: false; error: string };

function resultTypeFromScores(home: number, away: number): "ONE" | "X" | "TWO" {
  if (home > away) return "ONE";
  if (away > home) return "TWO";
  return "X";
}

function pairKey(a: string, b: string): string {
  return [normalizeTeamName(a), normalizeTeamName(b)].sort().join("__vs__");
}

export async function syncWorldCupResultsFromOpenLigaDb(): Promise<SyncWcResultsResult> {
  const fetched = await fetchOpenLigaDbWorldCupMatches();
  if (!fetched.ok) {
    await prisma.apiSyncLog.create({
      data: {
        provider: "openligadb.de",
        action: "sync_wc_results",
        status: "error",
        errorMessage: fetched.error,
      },
    });
    return { ok: false, error: fetched.error };
  }

  const localMatches = await prisma.match.findMany({
    where: { competitionId: WORLD_CUP_2026_COMPETITION_ID },
    select: {
      id: true,
      homeTeamName: true,
      awayTeamName: true,
      officialResultType: true,
      homeScore: true,
      awayScore: true,
    },
  });

  // Index local fixtures by their unordered, normalized team pair.
  const localByPair = new Map<string, (typeof localMatches)[number]>();
  for (const match of localMatches) {
    if (match.homeTeamName === "TBD" || match.awayTeamName === "TBD") continue;
    localByPair.set(pairKey(match.homeTeamName, match.awayTeamName), match);
  }

  let finishedCount = 0;
  let updatedCount = 0;
  let unmatchedCount = 0;

  for (const apiMatch of fetched.matches) {
    if (!apiMatch.matchIsFinished) continue;
    const score = getOpenLigaDbFinalScore(apiMatch);
    if (!score) continue;
    finishedCount++;

    const team1English = resolveEnglishTeamName(apiMatch.team1);
    const team2English = resolveEnglishTeamName(apiMatch.team2);
    if (!team1English || !team2English) {
      unmatchedCount++;
      continue;
    }

    const local = localByPair.get(pairKey(team1English, team2English));
    if (!local) {
      unmatchedCount++;
      continue;
    }

    // Re-orient OpenLigaDB team1/team2 scores onto the local home/away orientation.
    const localHomeIsTeam1 =
      normalizeTeamName(local.homeTeamName) === normalizeTeamName(team1English);
    const homeScore = localHomeIsTeam1 ? score.team1 : score.team2;
    const awayScore = localHomeIsTeam1 ? score.team2 : score.team1;
    const resultType = resultTypeFromScores(homeScore, awayScore);

    const unchanged =
      local.officialResultType === resultType &&
      local.homeScore === homeScore &&
      local.awayScore === awayScore;
    if (unchanged) continue;

    await prisma.match.update({
      where: { id: local.id },
      data: {
        officialResultType: resultType,
        homeScore,
        awayScore,
        isLocked: true,
        sourceStatus: "mixed",
        syncedAt: new Date(),
      },
    });
    updatedCount++;
  }

  await prisma.apiSyncLog.create({
    data: {
      provider: "openligadb.de",
      action: "sync_wc_results",
      status: "success",
      errorMessage: null,
    },
  });

  return { ok: true, finishedCount, updatedCount, unmatchedCount };
}
