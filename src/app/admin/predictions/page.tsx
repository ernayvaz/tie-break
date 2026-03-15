import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/get-user";
import { PredictionManagementClient } from "./prediction-management-client";
import type { PredictionRow, MatchOption, UserOption } from "./prediction-management-client";

export default async function AdminPredictionsPage() {
  await requireAdmin();

  const [predictions, matches, users] = await Promise.all([
    prisma.prediction.findMany({
      orderBy: [{ match: { matchDatetime: "desc" } }, { createdAt: "desc" }],
      take: 1000,
      include: {
        match: {
          select: {
            id: true,
            competitionId: true,
            matchDatetime: true,
            homeTeamName: true,
            awayTeamName: true,
            officialResultType: true,
          },
        },
        user: {
          select: { id: true, name: true, surname: true },
        },
      },
    }),
    prisma.match.findMany({
      orderBy: { matchDatetime: "desc" },
      select: { id: true, competitionId: true, matchDatetime: true, homeTeamName: true, awayTeamName: true },
    }),
    prisma.user.findMany({
      orderBy: [{ surname: "asc" }, { name: "asc" }],
      select: { id: true, name: true, surname: true },
    }),
  ]);

  const rows: PredictionRow[] = predictions.map((p) => ({
    id: p.id,
    userId: p.userId,
    matchId: p.matchId,
    selectedPrediction: p.selectedPrediction,
    isFinal: p.isFinal,
    finalizedAt: p.finalizedAt?.toISOString() ?? null,
    awardedPoints: p.awardedPoints,
    match: {
      id: p.match.id,
      competitionId: p.match.competitionId ?? null,
      matchDatetime: p.match.matchDatetime.toISOString(),
      homeTeamName: p.match.homeTeamName,
      awayTeamName: p.match.awayTeamName,
      officialResultType: p.match.officialResultType,
    },
    user: {
      id: p.user.id,
      name: p.user.name,
      surname: p.user.surname,
    },
  }));

  const matchOptions: MatchOption[] = matches.map((m) => ({
    id: m.id,
    competitionId: m.competitionId ?? null,
    label: `${new Date(m.matchDatetime).toLocaleDateString("en-GB", { dateStyle: "short" })} ${m.homeTeamName} vs ${m.awayTeamName}`,
  }));

  const userOptions: UserOption[] = users.map((u) => ({
    id: u.id,
    label: `${u.name} ${u.surname}`,
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Prediction Management</h1>
      <p className="mt-2 text-sm text-nord-polarLight">
        View all predictions, filter by match or user, and apply manual point corrections (Set 0 / Set 1) for finalized predictions. Leaderboard is refreshed after each change. For a full recalculate, use <a href="/admin/scoring" className="text-nord-frostDark font-medium hover:underline">Scoring</a>.
      </p>
      <PredictionManagementClient
        predictions={rows}
        matchOptions={matchOptions}
        userOptions={userOptions}
      />
    </div>
  );
}
