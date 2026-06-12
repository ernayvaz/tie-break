import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/auth/get-user";
import { getLeaderboardStatsForUser } from "@/lib/scoring";
import { normalizeCompetitionId, UCL_COMPETITION_ID } from "@/lib/config";
import { toDisplay } from "@/lib/prediction-values";

export type RecentPredictionStatus = "correct" | "incorrect" | "pending";

export type LeaderboardRecentPredictionItem = {
  id: string;
  status: RecentPredictionStatus;
  label: string;
  isPowerPick: boolean;
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

  const recentPredictionsByUser = new Map<string, LeaderboardRecentPredictionItem[]>();
  for (const prediction of recentPredictionRows) {
    const items = recentPredictionsByUser.get(prediction.userId) ?? [];
    if (items.length >= 5) continue;

    const status: RecentPredictionStatus =
      prediction.match.officialResultType === null
        ? "pending"
        : (prediction.awardedPoints ?? 0) > 0
          ? "correct"
          : "incorrect";

    const isPowerPick = boostedKeys.has(`${prediction.userId}:${prediction.matchId}`);
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

    const powerPickTag = isPowerPick ? " · x3" : "";
    items.push({
      id: prediction.id,
      status,
      isPowerPick,
      label: `${toDisplay(prediction.selectedPrediction)}${powerPickTag} - ${statusLabel} - ${finalizedLabel}`,
    });
    recentPredictionsByUser.set(prediction.userId, items);
  }

  for (const items of recentPredictionsByUser.values()) {
    items.reverse();
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
    entries: visibleEntries.map((entry) => ({
      userId: entry.userId,
      competitionId: entry.competitionId,
      name: entry.user.name,
      surname: entry.user.surname,
      isAdminRow: entry.user.role === "admin",
      rank: entry.user.role === "admin" ? null : entry.currentRank,
      podiumPlace: podiumPlaces.get(entry.userId),
      finalizedPredictionCount: entry.finalizedPredictionCount,
      completedMatchCount: entry.completedMatchCount,
      correctCalls: getCorrectCalls(entry),
      accuracyLabel:
        entry.finalizedPredictionCount > 0
          ? `${Math.round(entry.accuracyRate * 100)}%`
          : "–",
      totalPoints: entry.totalPoints,
      recentPredictions: recentPredictionsByUser.get(entry.userId) ?? [],
    })),
    prizes,
  };
}

export function normalizeLeaderboardCompetitionId(input?: string) {
  return normalizeCompetitionId(input);
}
