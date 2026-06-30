/**
 * One-off results sync: mirrors /api/cron/sync-results.
 *
 * - football-data.org sync is best-effort for configured competitions.
 * - World Cup 2026 knockout fixtures + results are synced from OpenLigaDB.
 * - finalized predictions are rescored and every competition leaderboard is rebuilt.
 *
 * Mirrors what /api/cron/sync-results does, runnable locally against the
 * production Neon DB defined in .env.
 *
 * Usage: npx tsx --env-file=.env scripts/sync-results.ts
 */
import { prisma } from "../src/lib/db";
import { syncMatchesFromApi } from "../src/lib/api/sync-matches";
import { syncWorldCupFixturesFromOpenLigaDb } from "../src/lib/api/sync-wc-fixtures";
import { syncWorldCupResultsFromOpenLigaDb } from "../src/lib/api/sync-wc-results";
import { recalculateAll } from "../src/lib/scoring";

async function main() {
  console.log("[sync-results] starting fixture/score sync…");
  const footballData = await syncMatchesFromApi();
  if (footballData.ok) {
    console.log(`[sync-results] football-data ok — ${footballData.count} matches upserted.`);
  } else {
    console.warn(`[sync-results] football-data unavailable — ${footballData.error}`);
  }

  const wcFixtures = await syncWorldCupFixturesFromOpenLigaDb();
  if (wcFixtures.ok) {
    console.log(
      `[sync-results] WC fixtures ok — filled=${wcFixtures.filledCount} pendingDraw=${wcFixtures.pendingDrawCount} unmatched=${wcFixtures.unmatchedCount}.`
    );
  } else {
    console.error(`[sync-results] WC fixtures FAILED — ${wcFixtures.error}`);
    process.exitCode = 1;
  }

  const wcResults = await syncWorldCupResultsFromOpenLigaDb();
  if (wcResults.ok) {
    console.log(
      `[sync-results] WC results ok — updated=${wcResults.updatedCount} finished=${wcResults.finishedCount} unmatched=${wcResults.unmatchedCount}.`
    );
  } else {
    console.error(`[sync-results] WC results FAILED — ${wcResults.error}`);
    process.exitCode = 1;
  }

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
