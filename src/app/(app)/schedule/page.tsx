import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/get-user";
import { getOthersPredictionsBatch } from "@/lib/predictions";
import { toDisplay } from "@/lib/prediction-values";
import { getMatchStatisticsByMatchIds } from "@/lib/match-stats/cache";
import { ScheduleTabs } from "./schedule-tabs";

export default async function SchedulePage() {
  const user = await requireAuth();

  const matches = await prisma.match.findMany({
    orderBy: { matchDatetime: "asc" },
    take: 500,
    select: {
      id: true,
      competitionId: true,
      matchDatetime: true,
      lockAt: true,
      stage: true,
      homeTeamName: true,
      awayTeamName: true,
      homeTeamLogo: true,
      awayTeamLogo: true,
      officialResultType: true,
      homeScore: true,
      awayScore: true,
    },
  });

  const matchIds = matches.map((m) => m.id);

  const userPredictions = await prisma.prediction.findMany({
    where: { userId: user.id, matchId: { in: matchIds } },
    select: {
      matchId: true,
      selectedPrediction: true,
      isFinal: true,
      finalizedAt: true,
    },
  });

  // Others' predictions: only for matches where current user (including admin) has finalized.
  // Admin can see others the same way for testing; admin can still undo their predictions anytime.
  const finalizedMatchIds = [
    ...new Set(userPredictions.filter((p) => p.isFinal).map((p) => p.matchId)),
  ];
  const othersBatch = await getOthersPredictionsBatch(finalizedMatchIds, user.id);
  const othersByMatchId: Record<
    string,
    { name: string; surname: string; selectedPrediction: string; finalizedAt: string }[]
  > = {};
  for (const [matchId, list] of Object.entries(othersBatch)) {
    othersByMatchId[matchId] = list.map((o) => ({
      ...o,
      finalizedAt: o.finalizedAt.toISOString(),
    }));
  }

  const serializedMatches = matches.map((m) => ({
    id: m.id,
    competitionId: m.competitionId ?? null,
    matchDatetime: m.matchDatetime.toISOString(),
    lockAt: m.lockAt.toISOString(),
    stage: m.stage,
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    homeTeamLogo: m.homeTeamLogo ?? null,
    awayTeamLogo: m.awayTeamLogo ?? null,
    officialResultType: m.officialResultType,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  }));

  const serializedUserPredictions = userPredictions.map((p) => ({
    matchId: p.matchId,
    selectedPrediction: toDisplay(p.selectedPrediction),
    isFinal: p.isFinal,
    finalizedAt: p.finalizedAt?.toISOString() ?? null,
  }));

  const statsByMatchId = await getMatchStatisticsByMatchIds(matchIds);

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Match schedule</h1>
      <p className="mt-1 text-sm text-nord-polarLight">
        The &quot;Result&quot; column shows the official match outcome (1 / X / 2) after the match has finished. Switch between <strong>Upcoming matches</strong> and <strong>Past matches</strong> using the tabs below.
      </p>
      {matches.length === 0 ? (
        <p className="mt-6 text-nord-polarLight text-sm">
          No matches yet. Sync from API in the admin panel.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <ScheduleTabs
            matches={serializedMatches}
            userPredictions={serializedUserPredictions}
            othersByMatchId={othersByMatchId}
            statsByMatchId={statsByMatchId}
            isAdmin={user.role === "admin"}
          />
        </div>
      )}
    </div>
  );
}
