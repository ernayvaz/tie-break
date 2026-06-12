/**
 * One-off bulk sync for World Cup 2026 Match Center data.
 *
 * Runs the existing targeted sync in small chunks so the built-in
 * football-data.org rate limiter (≈9.5 req/min) stays well under the
 * free-tier ceiling and never trips an account disable.
 *
 * Usage: npx tsx scripts/sync-wc-stats.ts [chunkSize] [startIndex]
 */
import { PrismaClient } from "@prisma/client";
import { syncMatchStatisticsCache } from "../src/lib/api/sync-match-stats";
import { WORLD_CUP_2026_COMPETITION_ID } from "../src/lib/config";

const prisma = new PrismaClient();

async function main() {
  const chunkSize = Number(process.argv[2] ?? "2") || 2;
  const startIndex = Number(process.argv[3] ?? "0") || 0;

  const matches = await prisma.match.findMany({
    where: {
      competitionId: WORLD_CUP_2026_COMPETITION_ID,
      homeTeamName: { not: "TBD" },
      awayTeamName: { not: "TBD" },
    },
    orderBy: { matchDatetime: "asc" },
    select: { id: true, homeTeamName: true, awayTeamName: true },
  });

  const ids = matches.map((m) => m.id).slice(startIndex);
  console.log(
    `[wc-sync] ${matches.length} WC matches with determined teams; syncing ${ids.length} from index ${startIndex} in chunks of ${chunkSize}.`
  );

  let synced = 0;
  let unavailable = 0;
  let chunkNo = 0;
  const totalChunks = Math.ceil(ids.length / chunkSize);

  for (let i = 0; i < ids.length; i += chunkSize) {
    chunkNo += 1;
    const chunk = ids.slice(i, i + chunkSize);
    const startedAt = Date.now();
    const result = await syncMatchStatisticsCache({ matchIds: chunk });
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

    if (result.ok) {
      synced += result.syncedCount;
      unavailable += result.unavailableCount;
      console.log(
        `[wc-sync] chunk ${chunkNo}/${totalChunks} ok in ${elapsed}s — synced=${result.syncedCount} unavailable=${result.unavailableCount} (running synced=${synced})`
      );
    } else {
      console.error(
        `[wc-sync] chunk ${chunkNo}/${totalChunks} FAILED in ${elapsed}s — ${result.error}`
      );
      const waitMatch = /wait\s+(\d+)\s+seconds?/i.exec(result.error ?? "");
      if (waitMatch) {
        const waitMs = Number(waitMatch[1]) * 1000 + 1000;
        console.log(`[wc-sync] rate limited; waiting ${waitMs}ms then retrying chunk.`);
        await new Promise((r) => setTimeout(r, waitMs));
        const retry = await syncMatchStatisticsCache({ matchIds: chunk });
        if (retry.ok) {
          synced += retry.syncedCount;
          unavailable += retry.unavailableCount;
          console.log(`[wc-sync] chunk ${chunkNo} retry ok — synced=${retry.syncedCount}`);
        } else {
          console.error(`[wc-sync] chunk ${chunkNo} retry FAILED — ${retry.error}`);
        }
      }
    }
  }

  console.log(`[wc-sync] DONE — total synced=${synced} unavailable=${unavailable}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("[wc-sync] fatal", error);
  await prisma.$disconnect();
  process.exit(1);
});
