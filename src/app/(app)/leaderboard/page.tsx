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

      <div className="mt-6 overflow-x-auto">
        {entries.length === 0 ? (
          <p className="text-nord-polarLight text-sm">
            No leaderboard data yet. Make predictions and run &quot;Recalculate scores & leaderboard&quot; in the admin panel.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nord-polarLighter text-left text-nord-polarLight">
                <th className="pb-2 pr-4">Rank</th>
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Points</th>
                <th className="pb-2 pr-4">Predictions</th>
                <th className="pb-2 pr-4">Matches completed</th>
                <th className="pb-2">Accuracy</th>
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
                    <td className="py-3 text-nord-polar">
                      {e.finalizedPredictionCount > 0
                        ? `${Math.round(e.accuracyRate * 100)}%`
                        : "–"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
