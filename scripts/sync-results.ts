/**
 * One-off results sync: pulls fixtures/scores for all configured competitions
 * (World Cup 2026 + UCL) from football-data.org, writes official results to the
 * DB, scores finalized predictions and rebuilds every competition leaderboard.
 *
 * Mirrors what /api/cron/sync-results does, runnable locally against the
 * production Neon DB defined in .env.
 *
 * Usage: npx tsx --env-file=.env scripts/sync-results.ts
 */
import { prisma } from "../src/lib/db";
import { syncMatchesFromApi } from "../src/lib/api/sync-matches";
import { recalculateAll } from "../src/lib/scoring";

async function main() {
  console.log("[sync-results] starting fixture/score sync…");
  const sync = await syncMatchesFromApi();
  if (!sync.ok) {
    console.error(`[sync-results] sync FAILED — ${sync.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[sync-results] sync ok — ${sync.count} matches upserted.`);

  const finished = await prisma.match.findMany({
    where: { officialResultType: { not: null } },
    select: { competitionId: true, homeTeamName: true, awayTeamName: true, homeScore: true, awayScore: true },
    orderBy: { matchDatetime: "asc" },
  });
  console.log(`[sync-results] ${finished.length} finished matches with official results:`);
  for (const m of finished) {
    console.log(
      `   [${m.competitionId ?? "CL"}] ${m.homeTeamName} ${m.homeScore ?? "?"}-${m.awayScore ?? "?"} ${m.awayTeamName}`
    );
  }

  console.log("[sync-results] recalculating scores + leaderboard…");
  const recalc = await recalculateAll();
  if (!recalc.ok) {
    console.error(`[sync-results] recalc FAILED — ${recalc.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `[sync-results] DONE — matchesScored=${recalc.matchesScored} leaderboardRows=${recalc.leaderboardCount}`
  );
}

main()
  .catch((error) => {
    console.error("[sync-results] fatal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
