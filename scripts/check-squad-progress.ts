/**
 * Counts how many WC matches now have squad data cached, to gauge re-sync
 * progress independently of the background log.
 *
 * Usage: npx tsx --env-file=.env scripts/check-squad-progress.ts
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
    orderBy: { matchDatetime: "asc" },
    select: { id: true },
  });

  const ids = matches.map((m) => m.id);
  const cached = await getMatchStatisticsByMatchIds(ids);

  let withSquad = 0;
  let recent = 0;
  const hourAgo = Date.now() - 60 * 60 * 1000;
  for (const id of ids) {
    const p = cached[id];
    if (!p) continue;
    const has =
      p.homeTeam.squad.players.length > 0 || p.awayTeam.squad.players.length > 0;
    if (has) withSquad += 1;
    if (p.syncedAt && new Date(p.syncedAt).getTime() >= hourAgo) recent += 1;
  }

  console.log(
    `WC matches=${ids.length}  withSquad=${withSquad}  syncedInLastHour=${recent}`
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
