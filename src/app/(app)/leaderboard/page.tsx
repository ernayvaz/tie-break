import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/get-user";
import { getLeaderboardStatsForUser } from "@/lib/scoring";
import { Card, CardContent } from "@/components/ui";
import { CompetitionTabs } from "@/components/competition-tabs";
import { UCL_COMPETITION_ID, OTHER_COMPETITION_ID } from "@/lib/config";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  const currentUser = await requireAuth();
  const params = await searchParams;
  const competitionId = params.competition === OTHER_COMPETITION_ID ? OTHER_COMPETITION_ID : UCL_COMPETITION_ID;

  const allEntries = await prisma.leaderboardEntry.findMany({
    where: { competitionId },
    orderBy: { currentRank: "asc" },
    include: { user: { select: { name: true, surname: true, role: true } } },
  });

  const isAdmin = currentUser.role === "admin";
  const publicEntries = allEntries.filter((e) => e.user.role !== "admin");
  let adminEntries = allEntries.filter((e) => e.user.role === "admin");

  // If admin has predictions but no leaderboard entry yet (Recalculate not run), show them at the bottom with live stats
  if (isAdmin && !adminEntries.some((e) => e.userId === currentUser.id)) {
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

  const entries = isAdmin
    ? [...publicEntries, ...adminEntries]
    : publicEntries;

  const adminHasLiveRow =
    isAdmin &&
    adminEntries.length > 0 &&
    !allEntries.some((e) => e.userId === currentUser.id);

  const prizes = await prisma.prize.findMany({
    where: { competitionId },
    orderBy: { place: "asc" },
  });

  const leaderboardUserIds = entries.map((e) => e.userId);

  const recentPredictionMap = new Map<
    string,
    { isCorrect: boolean }[]
  >();

  if (leaderboardUserIds.length > 0) {
    const predictionRows = await prisma.prediction.findMany({
      where: {
        userId: { in: leaderboardUserIds },
        isFinal: true,
        match: {
          ...(competitionId === UCL_COMPETITION_ID
            ? { OR: [{ competitionId: UCL_COMPETITION_ID }, { competitionId: null }] }
            : { competitionId }),
          officialResultType: { not: null },
        },
      },
      orderBy: { finalizedAt: "asc" },
      select: {
        userId: true,
        awardedPoints: true,
      },
    });

    for (const row of predictionRows) {
      const list = recentPredictionMap.get(row.userId) ?? [];
      list.push({ isCorrect: row.awardedPoints === 1 });
      recentPredictionMap.set(row.userId, list);
    }

    for (const [userId, list] of recentPredictionMap.entries()) {
      const lastFive = list.slice(-5);
      recentPredictionMap.set(userId, lastFive);
    }
  }

  function renderRankBadge(rank: number | null, isAdminRow: boolean) {
    if (!rank || isAdminRow) return null;
    if (rank > 3) return null;

    const baseClasses =
      "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";

    if (rank === 1) {
      return (
        <span className={`${baseClasses} bg-amber-100 text-amber-800 border border-amber-200`}>
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className={`${baseClasses} bg-slate-100 text-slate-700 border border-slate-200`}>
          2
        </span>
      );
    }
    return (
      <span className={`${baseClasses} bg-amber-50 text-amber-700 border border-amber-100`}>
        3
      </span>
    );
  }

  function renderRecentPredictionPills(userId: string) {
    const recent = recentPredictionMap.get(userId) ?? [];
    const maxCount = 5;

    return (
      <div className="flex items-center gap-1.5">
        {Array.from({ length: maxCount }).map((_, index) => {
          const pred = recent[index];
          if (!pred) {
            return (
              <span
                key={index}
                className="h-2.5 w-2.5 rounded-full border border-nord-polarLighter/40 bg-transparent"
              />
            );
          }

          return (
            <span
              key={index}
              className={`h-2.5 w-2.5 rounded-full border ${
                pred.isCorrect
                  ? "border-emerald-500 bg-emerald-500"
                  : "border-rose-400 bg-transparent"
              }`}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Leaderboard</h1>
      <p className="mt-1 text-sm text-nord-polarLight">
        Ranked by total points, then accuracy. Username is never shown.
        {isAdmin && adminEntries.length > 0 && (
          <> Admin entries are shown at the bottom for testing only; other users do not see them.</>
        )}
        {adminHasLiveRow && (
          <span className="block mt-1">
            Your row is computed from your predictions. Run <strong>Recalculate scores & leaderboard</strong> in Admin → Scoring to update the stored board.
          </span>
        )}
      </p>

      <div className="mt-6">
        <CompetitionTabs currentCompetitionId={competitionId} basePath="/leaderboard" />
      </div>

      {prizes.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {prizes.map((p) => (
            <Card key={p.id}>
              <CardContent className="py-4">
                <div className="text-sm font-medium text-nord-frostDark">
                  Place {p.place}
                </div>
                <div className="font-semibold text-nord-polar">{p.title}</div>
                {p.description && (
                  <p className="mt-1 text-sm text-nord-polarLight">{p.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6">
        {entries.length === 0 ? (
          <p className="text-nord-polarLight text-sm">
            No leaderboard data yet. Make predictions and run &quot;Recalculate scores & leaderboard&quot; in the admin panel.
          </p>
        ) : (
          <>
            <ul className="space-y-3 sm:hidden">
              {entries.map((e) => {
                const isAdminRow = e.user.role === "admin";
                return (
                  <li
                    key={`${e.userId}-${e.competitionId}-mobile`}
                    className={`rounded-xl border border-nord-polarLighter/35 bg-white/85 px-4 py-3 shadow-sm ${isAdminRow ? "bg-nord-snow/80" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wide text-nord-polarLight">
                          {isAdminRow ? "Admin row" : `Rank #${e.currentRank}`}
                        </div>
                        <div className="mt-1 truncate font-semibold text-nord-polar">
                          {e.user.name} {e.user.surname}
                          {renderRankBadge(isAdminRow ? null : e.currentRank, isAdminRow)}
                        </div>
                        {isAdminRow && (
                          <div className="mt-1 text-xs text-nord-polarLight">
                            Not visible to other users
                          </div>
                        )}
                      </div>
                      <div className="rounded-lg bg-nord-frostDark/10 px-3 py-2 text-right">
                        <div className="text-[11px] uppercase tracking-wide text-nord-polarLight">
                          Points
                        </div>
                        <div className="text-lg font-semibold text-nord-frostDark">
                          {e.totalPoints}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-nord-polarLighter/20 pt-3 text-center">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-nord-polarLight">
                          Predictions
                        </div>
                        <div className="mt-1 font-medium text-nord-polar">
                          {e.finalizedPredictionCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-nord-polarLight">
                          Completed
                        </div>
                        <div className="mt-1 font-medium text-nord-polar">
                          {e.completedMatchCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-nord-polarLight">
                          Accuracy
                        </div>
                        <div className="mt-1 font-medium text-nord-polar">
                          {e.finalizedPredictionCount > 0
                            ? `${Math.round(e.accuracyRate * 100)}%`
                            : "–"}
                        </div>
                      </div>
                      <div className="col-span-3 mt-2 flex items-center justify-center gap-2 text-[11px] text-nord-polarLight">
                        <span>Last 5</span>
                        {renderRecentPredictionPills(e.userId)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-nord-polarLighter text-left text-nord-polarLight">
                    <th className="pb-2 pr-4">Rank</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Points</th>
                    <th className="pb-2 pr-4">Predictions</th>
                    <th className="pb-2 pr-4">Matches completed</th>
                    <th className="pb-2 pr-4">Accuracy</th>
                    <th className="pb-2">Last 5</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const isAdminRow = e.user.role === "admin";
                    return (
                      <tr
                        key={`${e.userId}-${e.competitionId}`}
                        className={`border-b border-nord-polarLighter/50 ${isAdminRow ? "bg-nord-snow/60" : ""}`}
                      >
                        <td className="py-3 pr-4 font-medium text-nord-polar">
                          {isAdminRow ? "–" : e.currentRank}
                        </td>
                        <td className="py-3 pr-4 text-nord-polar">
                          {e.user.name} {e.user.surname}
                          {renderRankBadge(isAdminRow ? null : e.currentRank, isAdminRow)}
                          {isAdminRow && (
                            <span className="ml-2 text-xs text-nord-polarLight">(Admin – not visible to others)</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-nord-polar">{e.totalPoints}</td>
                        <td className="py-3 pr-4 text-nord-polarLight">
                          {e.finalizedPredictionCount}
                        </td>
                        <td className="py-3 pr-4 text-nord-polarLight">
                          {e.completedMatchCount}
                        </td>
                        <td className="py-3 pr-4 text-nord-polar">
                          {e.finalizedPredictionCount > 0
                            ? `${Math.round(e.accuracyRate * 100)}%`
                            : "–"}
                        </td>
                        <td className="py-3">
                          {renderRecentPredictionPills(e.userId)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
