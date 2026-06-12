/**
 * Quick check: how many WC matches have squad data in stats cache.
 * Usage: npx tsx --env-file=.env scripts/check-wc-squad-coverage.ts
 */
import { prisma } from "../src/lib/db";
import { WORLD_CUP_2026_COMPETITION_ID } from "../src/lib/config";
import { getMatchStatisticsByMatchIds } from "../src/lib/match-stats/cache";

async function main() {
  const matches = await prisma.match.findMany({
    where: {
      competitionId: WORLD_CUP_2026_COMPETITION_ID,
      homeTeamName: { not: "TBD" },
      awayTeamName: { not: "TBD" },
    },
    select: { id: true, homeTeamName: true, awayTeamName: true },
    orderBy: { matchDatetime: "asc" },
  });

  const stats = await getMatchStatisticsByMatchIds(matches.map((m) => m.id));
  let withSquad = 0;
  let partial = 0;
  let none = 0;

  for (const m of matches) {
    const payload = stats[m.id];
    const home = payload?.homeTeam?.squad?.players?.length ?? 0;
    const away = payload?.awayTeam?.squad?.players?.length ?? 0;
    if (home > 0 && away > 0) withSquad += 1;
    else if (home > 0 || away > 0) partial += 1;
    else none += 1;
  }

  console.log(
    `[wc-squad] ${matches.length} WC matches — both squads=${withSquad} partial=${partial} none=${none}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
