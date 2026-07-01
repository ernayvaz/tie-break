import { prisma } from "@/lib/db";
import { UCL_COMPETITION_ID } from "@/lib/config";
import { toDisplay } from "@/lib/prediction-values";
import { formatStageLabel } from "@/lib/stages";

/** Matches this competition for leaderboard (UCL = "CL" or null for legacy). */
function matchCompetitionFilter(competitionId: string) {
  if (competitionId === UCL_COMPETITION_ID) {
    return { OR: [{ competitionId: UCL_COMPETITION_ID }, { competitionId: null }] };
  }
  return { competitionId };
}

export type HeadToHeadStatus = "correct" | "incorrect" | "pending";

export type HeadToHeadPrediction = {
  id: string;
  matchLabel: string;
  stageLabel: string;
  pick: string;
  scoreLabel: string | null;
  status: HeadToHeadStatus;
  isPowerPick: boolean;
  powerPickMultiplier: number | null;
  playedLabel: string;
};

export type HeadToHeadPlayer = {
  userId: string;
  name: string;
  surname: string;
  rank: number | null;
  totalPredictions: number;
  completedMatches: number;
  correct: number;
  accuracyLabel: string;
  points: number;
  powerPickUsed: number;
  powerPickHits: number;
  recent: HeadToHeadPrediction[];
};

export type HeadToHeadRankPoint = {
  label: string;
  matchIndex: number;
  /** Rank with Power Pick bonuses applied (the real leaderboard state). */
  rankA: number | null;
  rankB: number | null;
  /**
   * Hypothetical rank if NOBODY in the competition had used Power Picks — every
   * user's boosted correct pick collapses to a normal 1-point pick. This shows
   * where the two compared users would stand in a Power-Pick-free league.
   */
  rankANoPp: number | null;
  rankBNoPp: number | null;
};

export type HeadToHeadData = {
  competitionId: string;
  totalPlayers: number;
  a: HeadToHeadPlayer;
  b: HeadToHeadPlayer;
  rankHistory: HeadToHeadRankPoint[];
};

const RANK_MILESTONES = [5, 10, 20, 30, 40] as const;

function computeStatus(
  officialResultType: string | null,
  awardedPoints: number | null,
): HeadToHeadStatus {
  if (officialResultType === null) return "pending";
  return (awardedPoints ?? 0) > 0 ? "correct" : "incorrect";
}

/**
 * Builds a full head-to-head comparison between two users for one competition:
 * aggregate stats, each player's last 10 predictions, and a rank-history series
 * (their leaderboard position after the 5th, 10th, 20th, 30th, 40th completed
 * match and the latest one), ordered oldest → newest completed match.
 */
export async function getHeadToHeadData(
  userIdA: string,
  userIdB: string,
  competitionId: string,
): Promise<HeadToHeadData | null> {
  if (!userIdA || !userIdB || userIdA === userIdB) return null;

  const matchWhere = matchCompetitionFilter(competitionId);

  const [users, entries, predictions, completedMatches, boostedSelections] =
    await Promise.all([
      prisma.user.findMany({
        where: { id: { in: [userIdA, userIdB] } },
        select: { id: true, name: true, surname: true },
      }),
      prisma.leaderboardEntry.findMany({
        where: { competitionId, userId: { in: [userIdA, userIdB] } },
        select: { userId: true, currentRank: true },
      }),
      prisma.prediction.findMany({
        where: {
          isFinal: true,
          user: { status: "approved", role: { not: "admin" } },
          match: matchWhere,
        },
        select: {
          id: true,
          userId: true,
          matchId: true,
          selectedPrediction: true,
          awardedPoints: true,
          match: {
            select: {
              officialResultType: true,
              homeTeamName: true,
              awayTeamName: true,
              homeScore: true,
              awayScore: true,
              stage: true,
              matchDatetime: true,
            },
          },
        },
      }),
      prisma.match.findMany({
        where: { ...matchWhere, officialResultType: { not: null } },
        select: { id: true, matchDatetime: true },
        orderBy: { matchDatetime: "asc" },
      }),
      // Every active Power Pick in this competition (all users). The "no Power
      // Pick" scenario neutralises the whole league's boosters, so it needs the
      // full set — not just the two compared users'.
      prisma.powerPickSelection.findMany({
        where: { competitionId, status: { not: "revoked" } },
        select: { userId: true, matchId: true, multiplier: true },
      }),
    ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  if (!userById.has(userIdA) || !userById.has(userIdB)) return null;

  const rankByUser = new Map(entries.map((e) => [e.userId, e.currentRank]));
  // Every user's boosted (userId:matchId) keys — used to strip the whole league's
  // Power Picks in the "no Power Pick" rank scenario.
  const allBoostedKeys = new Set(
    boostedSelections.map((s) => `${s.userId}:${s.matchId}`),
  );
  // Only the two compared users' boosters — used for their per-player stats
  // (Power Pick hits) and Last-10 badges, which stay unchanged by the toggle.
  const boostedByKey = new Map(
    boostedSelections
      .filter((s) => s.userId === userIdA || s.userId === userIdB)
      .map((s) => [`${s.userId}:${s.matchId}`, s.multiplier]),
  );

  // ---- Per-match contributions (for cumulative rank history) ----
  const contributionsByMatch = new Map<
    string,
    { userId: string; awardedPoints: number; awardedPointsNoPp: number }[]
  >();
  const population = new Set<string>();
  for (const p of predictions) {
    population.add(p.userId);
    // "No Power Pick" scenario: strip EVERY user's boosters league-wide so the two
    // compared users are ranked against a field where nobody used Power Picks. Any
    // player's boosted correct pick (points > 0) collapses to a normal 1-point pick;
    // non-boosted picks keep their real awarded points.
    const isBoosted = allBoostedKeys.has(`${p.userId}:${p.matchId}`);
    const awardedPoints = p.awardedPoints ?? 0;
    const awardedPointsNoPp = isBoosted ? (awardedPoints > 0 ? 1 : 0) : awardedPoints;
    const list = contributionsByMatch.get(p.matchId) ?? [];
    list.push({ userId: p.userId, awardedPoints, awardedPointsNoPp });
    contributionsByMatch.set(p.matchId, list);
  }
  population.add(userIdA);
  population.add(userIdB);
  const populationIds = [...population];

  // ---- Cumulative walk over completed matches ----
  const cumPoints = new Map<string, number>();
  const cumPointsNoPp = new Map<string, number>();
  const cumCorrect = new Map<string, number>();
  const cumFinalized = new Map<string, number>();

  const totalCompleted = completedMatches.length;
  const namedMilestones = new Set<number>(
    RANK_MILESTONES.filter((m) => m <= totalCompleted),
  );
  const milestoneSet = new Set<number>(namedMilestones);
  if (totalCompleted > 0) milestoneSet.add(totalCompleted);

  // Accuracy (correct/finalized counts) is identical across scenarios — only the
  // points value of a boosted correct pick changes — so the same cumCorrect /
  // cumFinalized maps feed both rankings; only the points map differs.
  const rankAt = (userId: string, pointsMap: Map<string, number>): number => {
    const myPoints = pointsMap.get(userId) ?? 0;
    const myFinal = cumFinalized.get(userId) ?? 0;
    const myAcc = myFinal > 0 ? (cumCorrect.get(userId) ?? 0) / myFinal : 0;
    let rank = 1;
    for (const uid of populationIds) {
      if (uid === userId) continue;
      const points = pointsMap.get(uid) ?? 0;
      const finalized = cumFinalized.get(uid) ?? 0;
      const acc = finalized > 0 ? (cumCorrect.get(uid) ?? 0) / finalized : 0;
      if (points > myPoints || (points === myPoints && acc > myAcc)) rank++;
    }
    return rank;
  };

  const rankHistory: HeadToHeadRankPoint[] = [];
  for (let i = 0; i < completedMatches.length; i++) {
    const contributions = contributionsByMatch.get(completedMatches[i].id) ?? [];
    for (const c of contributions) {
      cumPoints.set(c.userId, (cumPoints.get(c.userId) ?? 0) + c.awardedPoints);
      cumPointsNoPp.set(
        c.userId,
        (cumPointsNoPp.get(c.userId) ?? 0) + c.awardedPointsNoPp,
      );
      cumFinalized.set(c.userId, (cumFinalized.get(c.userId) ?? 0) + 1);
      if (c.awardedPoints > 0) {
        cumCorrect.set(c.userId, (cumCorrect.get(c.userId) ?? 0) + 1);
      }
    }
    const matchNumber = i + 1;
    if (milestoneSet.has(matchNumber)) {
      rankHistory.push({
        label:
          matchNumber === totalCompleted && !namedMilestones.has(matchNumber)
            ? `Now (${matchNumber})`
            : `Match ${matchNumber}`,
        matchIndex: matchNumber,
        rankA: rankAt(userIdA, cumPoints),
        rankB: rankAt(userIdB, cumPoints),
        rankANoPp: rankAt(userIdA, cumPointsNoPp),
        rankBNoPp: rankAt(userIdB, cumPointsNoPp),
      });
    }
  }
  // Ensure order oldest → newest completed match.
  rankHistory.sort((a, b) => a.matchIndex - b.matchIndex);

  // ---- Per-player aggregates + last 10 ----
  const buildPlayer = (userId: string): HeadToHeadPlayer => {
    const user = userById.get(userId)!;
    const own = predictions.filter((p) => p.userId === userId);

    let completed = 0;
    let correct = 0;
    let points = 0;
    let ppUsed = 0;
    let ppHits = 0;

    for (const p of own) {
      const resultType = p.match.officialResultType;
      const isBoosted = boostedByKey.has(`${userId}:${p.matchId}`);
      if (resultType !== null) {
        completed++;
        const isCorrect = (p.awardedPoints ?? 0) > 0;
        if (isCorrect) correct++;
        points += p.awardedPoints ?? 0;
        if (isBoosted) {
          ppUsed++;
          if (isCorrect) ppHits++;
        }
      }
    }

    const recent = [...own]
      // Only decided predictions (correct/incorrect) belong in the last-10 list;
      // not-yet-played fixtures (pending) are excluded.
      .filter((p) => p.match.officialResultType !== null)
      .sort(
        (x, y) =>
          y.match.matchDatetime.getTime() - x.match.matchDatetime.getTime(),
      )
      .slice(0, 10)
      .map((p) => {
        const multiplier = boostedByKey.get(`${userId}:${p.matchId}`) ?? null;
        const scoreLabel =
          p.match.homeScore != null && p.match.awayScore != null
            ? `${p.match.homeScore} – ${p.match.awayScore}`
            : null;
        return {
          id: p.id,
          matchLabel: `${p.match.homeTeamName} vs ${p.match.awayTeamName}`,
          stageLabel: formatStageLabel(p.match.stage),
          pick: toDisplay(p.selectedPrediction),
          scoreLabel,
          status: computeStatus(p.match.officialResultType, p.awardedPoints),
          isPowerPick: multiplier != null,
          powerPickMultiplier: multiplier,
          playedLabel: new Date(p.match.matchDatetime).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          }),
        } satisfies HeadToHeadPrediction;
      });

    return {
      userId,
      name: user.name,
      surname: user.surname,
      rank: rankByUser.get(userId) ?? null,
      totalPredictions: own.length,
      completedMatches: completed,
      correct,
      accuracyLabel: completed > 0 ? `${Math.round((correct / completed) * 100)}%` : "–",
      points,
      powerPickUsed: ppUsed,
      powerPickHits: ppHits,
      recent,
    };
  };

  return {
    competitionId,
    totalPlayers: populationIds.length,
    a: buildPlayer(userIdA),
    b: buildPlayer(userIdB),
    rankHistory,
  };
}
