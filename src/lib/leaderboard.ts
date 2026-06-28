import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/get-user";
import { getLeaderboardStatsForUser } from "@/lib/scoring";
import { normalizeCompetitionId, UCL_COMPETITION_ID } from "@/lib/config";
import { toDisplay } from "@/lib/prediction-values";
import { formatStageLabel } from "@/lib/stages";

export type RecentPredictionStatus = "correct" | "incorrect" | "pending";

export type LeaderboardRecentPredictionItem = {
  id: string;
  status: RecentPredictionStatus;
  isPowerPick: boolean;
  /** The user's 1 / X / 2 pick. */
  pick: string;
  /** "Home vs Away" of the predicted match. */
  matchLabel: string;
  /** Premium stage label, e.g. "Round of 32". */
  stageLabel: string;
  /** Full-time score once the match has completed, e.g. "2 – 1" (null otherwise). */
  scoreLabel: string | null;
  /** "Correct (+3)", "Incorrect", "Pending"… */
  statusLabel: string;
  /** Localised finalize timestamp. */
  finalizedLabel: string;
  /** Single-line accessible fallback summary. */
  label: string;
};

export type LeaderboardPrizeItem = {
  id: string;
  competitionId: string;
  place: number;
  title: string;
  description: string | null;
};

export type LeaderboardBoardEntry = {
  userId: string;
  competitionId: string;
  name: string;
  surname: string;
  isAdminRow: boolean;
  rank: number | null;
  podiumPlace?: 1 | 2 | 3;
  finalizedPredictionCount: number;
  completedMatchCount: number;
  correctCalls: number;
  accuracyLabel: string;
  totalPoints: number;
  recentPredictions: LeaderboardRecentPredictionItem[];
};

export type LeaderboardBoardData = {
  competitionId: string;
  isAdmin: boolean;
  adminHasLiveRow: boolean;
  hasAdminRows: boolean;
  entries: LeaderboardBoardEntry[];
  prizes: LeaderboardPrizeItem[];
};

function matchCompetitionFilter(competitionId: string) {
  if (competitionId === UCL_COMPETITION_ID) {
    return { OR: [{ competitionId: UCL_COMPETITION_ID }, { competitionId: null }] };
  }
  return { competitionId };
}

function getCorrectCalls(entry: {
  totalPoints: number;
  finalizedPredictionCount: number;
  accuracyRate: number;
}) {
  if (entry.finalizedPredictionCount <= 0 || !Number.isFinite(entry.accuracyRate)) {
    return Math.max(0, entry.totalPoints);
  }

  return Math.max(
    0,
    Math.min(
      entry.finalizedPredictionCount,
      Math.round(entry.accuracyRate * entry.finalizedPredictionCount),
    ),
  );
}

export async function getLeaderboardBoardData(
  currentUser: AuthUser,
  competitionId: string,
): Promise<LeaderboardBoardData> {
  const allEntries = await prisma.leaderboardEntry.findMany({
    where: { competitionId },
    orderBy: { currentRank: "asc" },
    include: {
      user: {
        select: {
          name: true,
          surname: true,
          role: true,
        },
      },
    },
  });

  const isAdmin = currentUser.role === "admin";
  const publicEntries = allEntries.filter((entry) => entry.user.role !== "admin");
  let adminEntries = allEntries.filter((entry) => entry.user.role === "admin");

  if (isAdmin && !adminEntries.some((entry) => entry.userId === currentUser.id)) {
    const liveStats = await getLeaderboardStatsForUser(currentUser.id, competitionId);
    if (liveStats && liveStats.finalizedPredictionCount > 0) {
      adminEntries = [
        ...adminEntries,
        {
          competitionId,
          userId: currentUser.id,
          totalPoints: liveStats.totalPoints,
          finalizedPredictionCount: liveStats.finalizedPredictionCount,
          completedMatchCount: liveStats.completedMatchCount,
          accuracyRate: liveStats.accuracyRate,
          averageFinalizedTimeMetric: null,
          currentRank: 0,
          knockoutPoints: 0,
          semifinalFinalPoints: 0,
          user: {
            name: currentUser.name,
            surname: currentUser.surname,
            role: "admin" as const,
          },
        },
      ];
    }
  }

  const visibleEntries = isAdmin
    ? [...publicEntries, ...adminEntries]
    : publicEntries;

  const podiumPlaces = new Map<string, 1 | 2 | 3>();
  publicEntries.slice(0, 3).forEach((entry, index) => {
    podiumPlaces.set(entry.userId, (index + 1) as 1 | 2 | 3);
  });

  const adminHasLiveRow =
    isAdmin &&
    adminEntries.length > 0 &&
    !allEntries.some((entry) => entry.userId === currentUser.id);

  const entryUserIds = [...new Set(visibleEntries.map((entry) => entry.userId))];
  const recentPredictionRows =
    entryUserIds.length > 0
      ? await prisma.prediction.findMany({
          where: {
            userId: { in: entryUserIds },
            isFinal: true,
            match: matchCompetitionFilter(competitionId),
          },
          orderBy: [
            { userId: "asc" },
            { finalizedAt: "desc" },
            { createdAt: "desc" },
          ],
          select: {
            id: true,
            userId: true,
            matchId: true,
            selectedPrediction: true,
            finalizedAt: true,
            awardedPoints: true,
            match: {
              select: {
                officialResultType: true,
                homeTeamName: true,
                awayTeamName: true,
                homeScore: true,
                awayScore: true,
                stage: true,
              },
            },
          },
        })
      : [];

  const boostedSelections =
    entryUserIds.length > 0
      ? await prisma.powerPickSelection.findMany({
          where: {
            userId: { in: entryUserIds },
            status: { not: "revoked" },
          },
          select: { userId: true, matchId: true },
        })
      : [];
  const boostedKeys = new Set(
    boostedSelections.map((s) => `${s.userId}:${s.matchId}`)
  );

  // Group every finalized prediction per user (rows already arrive ordered by
  // finalizedAt desc). We then prioritise decided picks (correct/incorrect) over
  // still-pending ones inside the "Last 5", so a run of recent not-yet-scored
  // matches can't push the user's decided results out of the strip.
  const rowsByUser = new Map<string, typeof recentPredictionRows>();
  for (const prediction of recentPredictionRows) {
    const rows = rowsByUser.get(prediction.userId) ?? [];
    rows.push(prediction);
    rowsByUser.set(prediction.userId, rows);
  }

  const recentPredictionsByUser = new Map<string, LeaderboardRecentPredictionItem[]>();
  for (const [userId, rows] of rowsByUser) {
    const built = rows.map((prediction) => {
      const status: RecentPredictionStatus =
        prediction.match.officialResultType === null
          ? "pending"
          : (prediction.awardedPoints ?? 0) > 0
            ? "correct"
            : "incorrect";

      const isPowerPick = boostedKeys.has(
        `${prediction.userId}:${prediction.matchId}`
      );
      const statusLabel =
        status === "correct"
          ? isPowerPick
            ? "Correct (+3)"
            : "Correct"
          : status === "incorrect"
            ? "Incorrect"
            : "Pending";
      const finalizedLabel = prediction.finalizedAt
        ? new Date(prediction.finalizedAt).toLocaleString("en-GB", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "Time unavailable";

      const pick = toDisplay(prediction.selectedPrediction);
      const matchLabel = `${prediction.match.homeTeamName} vs ${prediction.match.awayTeamName}`;
      const stageLabel = formatStageLabel(prediction.match.stage);
      const scoreLabel =
        prediction.match.homeScore != null && prediction.match.awayScore != null
          ? `${prediction.match.homeScore} – ${prediction.match.awayScore}`
          : null;
      const powerPickTag = isPowerPick ? " · x3" : "";
      return {
        item: {
          id: prediction.id,
          status,
          isPowerPick,
          pick,
          matchLabel,
          stageLabel,
          scoreLabel,
          statusLabel,
          finalizedLabel,
          label: `${matchLabel} — ${pick}${powerPickTag} · ${statusLabel} · ${finalizedLabel}`,
        } satisfies LeaderboardRecentPredictionItem,
        status,
      };
    });

    // Decided picks first (most-recent-first), then pending picks; keep 5.
    const decided = built.filter((entry) => entry.status !== "pending");
    const pending = built.filter((entry) => entry.status === "pending");
    const selected = [...decided, ...pending].slice(0, 5).map((entry) => entry.item);

    // Display newest → oldest, left to right.
    recentPredictionsByUser.set(userId, selected);
  }

  const prizes = await prisma.prize.findMany({
    where: { competitionId },
    orderBy: { place: "asc" },
  });

  return {
    competitionId,
    isAdmin,
    adminHasLiveRow,
    hasAdminRows: adminEntries.length > 0,
    entries: visibleEntries.map((entry) => {
      const correctCalls = getCorrectCalls(entry);
      // Accuracy is measured against matches that have actually completed (have an
      // official result), not against every finalized prediction — predictions on
      // not-yet-played fixtures must not dilute the rate.
      const accuracyLabel =
        entry.completedMatchCount > 0
          ? `${Math.round((correctCalls / entry.completedMatchCount) * 100)}%`
          : "–";

      return {
        userId: entry.userId,
        competitionId: entry.competitionId,
        name: entry.user.name,
        surname: entry.user.surname,
        isAdminRow: entry.user.role === "admin",
        rank: entry.user.role === "admin" ? null : entry.currentRank,
        podiumPlace: podiumPlaces.get(entry.userId),
        finalizedPredictionCount: entry.finalizedPredictionCount,
        completedMatchCount: entry.completedMatchCount,
        correctCalls,
        accuracyLabel,
        totalPoints: entry.totalPoints,
        recentPredictions: recentPredictionsByUser.get(entry.userId) ?? [],
      };
    }),
    prizes,
  };
}

export function normalizeLeaderboardCompetitionId(input?: string) {
  return normalizeCompetitionId(input);
}
