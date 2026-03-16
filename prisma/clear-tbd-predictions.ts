import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tbdMatches = await prisma.match.findMany({
    where: {
      OR: [{ homeTeamName: "TBD" }, { awayTeamName: "TBD" }],
    },
    select: { id: true },
  });

  if (tbdMatches.length === 0) {
    console.log("No TBD matches found. Nothing to clear.");
    return;
  }

  const matchIds = tbdMatches.map((m) => m.id);

  const deleted = await prisma.prediction.deleteMany({
    where: { matchId: { in: matchIds } },
  });

  console.log(
    `Cleared ${deleted.count} prediction(s) for ${matchIds.length} TBD match(es).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
