import { prisma } from "@/lib/db";
import { UCL_COMPETITION_ID } from "@/lib/config";

const KNOCKOUT_STAGES = ["ROUND_16", "QUARTER_FINAL", "SEMI_FINAL", "FINAL"];
const SEMI_FINAL_STAGES = ["SEMI_FINAL", "FINAL"];

/** Matches this competition for leaderboard (UCL = "CL" or null for legacy). */
function matchCompetitionFilter(competitionId: string) {
  if (competitionId === UCL_COMPETITION_ID) {
    return { OR: [{ competitionId: UCL_COMPETITION_ID }, { competitionId: null }] };
  }
  return { competitionId };
}

/**
 * Score all finalized predictions for a finished match.
 * Sets awardedPoints = 1 if prediction matches official result, else 0.
 */
export async function scoreMatch(matchId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { officialResultType: true },
  });

  if (!match) return { ok: false, error: "Match not found" };
  if (match.officialResultType === null) return { ok: false, error: "Match has no result yet" };

  await prisma.prediction.updateMany({
    where: {
      matchId,
      isFinal: true,
      selectedPrediction: match.officialResultType,
    },
    data: { awardedPoints: 1 },
  });
  await prisma.prediction.updateMany({
    where: {
      matchId,
      isFinal: true,
      NOT: { selectedPrediction: match.officialResultType },
    },
    data: { awardedPoints: 0 },
  });
  return { ok: true };
}

/**
 * Compute leaderboard stats for a single user for a given competition (e.g. admin when they have no stored entry).
 * Points are computed from match results so they are correct even if Recalculate has not been run.
 */
export async function getLeaderboardStatsForUser(
  userId: string,
  competitionId: string = UCL_COMPETITION_ID
): Promise<{
  totalPoints: number;
  finalizedPredictionCount: number;
  completedMatchCount: number;
  correctPredictionCount: number;
  accuracyRate: number;
} | null> {
  const matchWhere = matchCompetitionFilter(competitionId);
  const predictions = await prisma.prediction.findMany({
    where: { userId, isFinal: true, match: matchWhere },
    include: { match: { select: { officialResultType: true } } },
  });
  if (predictions.length === 0) return null;

  let totalPoints = 0;
  let correctCount = 0;
  let completedMatchCount = 0;

  for (const p of predictions) {
    if (p.match.officialResultType !== null) {
      completedMatchCount++;
      const points = p.selectedPrediction === p.match.officialResultType ? 1 : 0;
      totalPoints += points;
      if (points === 1) correctCount++;
    }
  }

  const accuracyRate = predictions.length > 0 ? correctCount / predictions.length : 0;
  return {
    totalPoints,
    finalizedPredictionCount: predictions.length,
    completedMatchCount,
    correctPredictionCount: correctCount,
    accuracyRate,
  };
}

/**
 * Rebuild leaderboard per competition: compute totals per user per competition, sort, assign ranks.
 */
export async function rebuildLeaderboardForCompetition(
  competitionId: string = UCL_COMPETITION_ID
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const matchWhere = matchCompetitionFilter(competitionId);
  const hasCompletedMatches = await prisma.match.findFirst({
    where: {
      ...matchWhere,
      officialResultType: { not: null },
    },
    select: { id: true },
  });

  if (!hasCompletedMatches) {
    await prisma.leaderboardEntry.deleteMany({
      where: { competitionId },
    });
    return { ok: true, count: 0 };
  }

  type Row = {
    userId: string;
    totalPoints: number;
    knockoutPoints: number;
    semifinalFinalPoints: number;
    finalizedCount: number;
    completedMatchCount: number;
    correctCount: number;
  };

  const predictions = await prisma.prediction.findMany({
    where: {
      isFinal: true,
      user: { status: "approved", role: { not: "admin" } },
      match: matchWhere,
    },
    select: {
      userId: true,
      awardedPoints: true,
      match: { select: { stage: true, officialResultType: true } },
    },
  });

  const rowsByUser = new Map<string, Row>();
  for (const p of predictions) {
    const existing = rowsByUser.get(p.userId) ?? {
      userId: p.userId,
      totalPoints: 0,
      knockoutPoints: 0,
      semifinalFinalPoints: 0,
      finalizedCount: 0,
      completedMatchCount: 0,
      correctCount: 0,
    };

    existing.finalizedCount += 1;
    existing.totalPoints += p.awardedPoints ?? 0;
    if (p.match.officialResultType !== null) existing.completedMatchCount += 1;
    if (p.awardedPoints === 1) {
      existing.correctCount += 1;
      if (KNOCKOUT_STAGES.includes(p.match.stage)) existing.knockoutPoints += 1;
      if (SEMI_FINAL_STAGES.includes(p.match.stage)) existing.semifinalFinalPoints += 1;
    }

    rowsByUser.set(p.userId, existing);
  }

  const rowsWithPredictions = [...rowsByUser.values()];
  rowsWithPredictions.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    const accA = a.correctCount / a.finalizedCount;
    const accB = b.correctCount / b.finalizedCount;
    return accB - accA;
  });

  let rank = 1;
  for (let i = 0; i < rowsWithPredictions.length; i++) {
    const r = rowsWithPredictions[i];
    const accuracyRate = r.correctCount / r.finalizedCount;
    if (i > 0) {
      const prev = rowsWithPredictions[i - 1];
      const prevAcc = prev.correctCount / prev.finalizedCount;
      if (r.totalPoints !== prev.totalPoints || accuracyRate !== prevAcc) rank = i + 1;
    }
    await prisma.leaderboardEntry.upsert({
      where: { userId_competitionId: { userId: r.userId, competitionId } },
      create: {
        userId: r.userId,
        competitionId,
        totalPoints: r.totalPoints,
        knockoutPoints: r.knockoutPoints,
        semifinalFinalPoints: r.semifinalFinalPoints,
        finalizedPredictionCount: r.finalizedCount,
        completedMatchCount: r.completedMatchCount,
        correctPredictionCount: r.correctCount,
        accuracyRate,
        currentRank: rank,
      },
      update: {
        totalPoints: r.totalPoints,
        knockoutPoints: r.knockoutPoints,
        semifinalFinalPoints: r.semifinalFinalPoints,
        finalizedPredictionCount: r.finalizedCount,
        completedMatchCount: r.completedMatchCount,
        correctPredictionCount: r.correctCount,
        accuracyRate,
        currentRank: rank,
      },
    });
  }

  const userIdsOnBoard = new Set(rowsWithPredictions.map((r) => r.userId));
  await prisma.leaderboardEntry.deleteMany({
    where: {
      competitionId,
      ...(userIdsOnBoard.size > 0 ? { userId: { notIn: [...userIdsOnBoard] } } : {}),
    },
  });

  return { ok: true, count: rowsWithPredictions.length };
}

export async function rebuildLeaderboard(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const competitionIds = await prisma.match.findMany({
    where: { officialResultType: { not: null } },
    select: { competitionId: true },
    distinct: ["competitionId"],
  }).then((rows) => {
    const ids = rows.map((r) => r.competitionId ?? UCL_COMPETITION_ID);
    return [...new Set(ids)];
  });

  let totalCount = 0;
  for (const competitionId of competitionIds) {
    const result = await rebuildLeaderboardForCompetition(competitionId);
    if (!result.ok) return result;
    totalCount += result.count;
  }

  if (competitionIds.length > 0) {
    const existingCompetitionIds = new Set(competitionIds);
    await prisma.leaderboardEntry.deleteMany({
      where: { competitionId: { notIn: [...existingCompetitionIds] } },
    });
  }

  return { ok: true, count: totalCount };
}

/**
 * Recalculate points for all finished matches, then rebuild leaderboard.
 */
export async function recalculateAll(): Promise<
  { ok: true; matchesScored: number; leaderboardCount: number } | { ok: false; error: string }
> {
  const finishedMatches = await prisma.match.findMany({
    where: { officialResultType: { not: null } },
    select: { id: true },
  });

  for (const m of finishedMatches) {
    const res = await scoreMatch(m.id);
    if (!res.ok) return { ok: false, error: res.error };
  }

  const lb = await rebuildLeaderboard();
  if (!lb.ok) return { ok: false, error: lb.error };
  return {
    ok: true,
    matchesScored: finishedMatches.length,
    leaderboardCount: lb.count,
  };
}
