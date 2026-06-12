/**
 * One-off: seed the World Cup 2026 leaderboard prizes (1st €100, 2nd €50, 3rd €25).
 * Idempotent — upserts by the (competitionId, place) unique key.
 *
 * Run: npx tsx --env-file=.env scripts/seed-wc-prizes.ts
 */
import { prisma } from "../src/lib/db";
import { WORLD_CUP_2026_COMPETITION_ID } from "../src/lib/config";

const PRIZES = [
  { place: 1, title: "1st prize", description: "€100" },
  { place: 2, title: "2nd prize", description: "€50" },
  { place: 3, title: "3rd prize", description: "€25" },
];

async function main() {
  const competitionId = WORLD_CUP_2026_COMPETITION_ID;
  for (const prize of PRIZES) {
    const row = await prisma.prize.upsert({
      where: { competitionId_place: { competitionId, place: prize.place } },
      update: { title: prize.title, description: prize.description },
      create: {
        competitionId,
        place: prize.place,
        title: prize.title,
        description: prize.description,
      },
    });
    console.log(`Upserted ${competitionId} #${row.place}: ${row.title} (${row.description})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
