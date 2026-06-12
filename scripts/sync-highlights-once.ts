/**
 * One-off highlights sync (ScoreBat → local fixtures) for all tracked
 * competitions (World Cup + Champions League).
 *
 * Usage: npx tsx --env-file=.env scripts/sync-highlights-once.ts
 */
import { prisma } from "../src/lib/db";
import { syncHighlightsFromApi } from "../src/lib/api/sync-highlights";
import { WORLD_CUP_2026_COMPETITION_ID, UCL_COMPETITION_ID } from "../src/lib/config";

async function main() {
  const result = await syncHighlightsFromApi();
  console.log("[highlights] result:", JSON.stringify(result));

  for (const competitionId of [WORLD_CUP_2026_COMPETITION_ID, UCL_COMPETITION_ID]) {
    const count = await prisma.matchHighlight.count({ where: { competitionId } });
    const available = await prisma.matchHighlight.count({
      where: { competitionId, syncStatus: "available" },
    });
    console.log(`[highlights] ${competitionId}: total=${count} available=${available}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
