import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/get-user";
import { MatchManagementClient } from "./match-management-client";
import type { MatchRow } from "./match-management-client";

export default async function AdminMatchesPage() {
  await requireAdmin();

  const matches = await prisma.match.findMany({
    orderBy: { matchDatetime: "asc" },
    select: {
      id: true,
      competitionId: true,
      stage: true,
      matchDatetime: true,
      homeTeamName: true,
      awayTeamName: true,
      homeTeamLogo: true,
      awayTeamLogo: true,
      lockAt: true,
      officialResultType: true,
      homeScore: true,
      awayScore: true,
    },
  });

  const rows: MatchRow[] = matches.map((m) => ({
    id: m.id,
    competitionId: m.competitionId ?? null,
    stage: m.stage,
    matchDatetime: m.matchDatetime.toISOString(),
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    homeTeamLogo: m.homeTeamLogo ?? null,
    awayTeamLogo: m.awayTeamLogo ?? null,
    lockAt: m.lockAt.toISOString(),
    officialResultType: m.officialResultType,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Match Management</h1>
      <p className="mt-2 text-sm text-nord-polarLight">
        View all matches, create or edit matches manually, and enter or override the official result (1 / X / 2) and score. Saving a result updates predictions and the leaderboard.
      </p>
      <MatchManagementClient matches={rows} />
    </div>
  );
}
