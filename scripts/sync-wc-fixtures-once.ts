import { syncWorldCupFixturesFromOpenLigaDb } from "@/lib/api/sync-wc-fixtures";
import { prisma } from "@/lib/db";

async function main() {
  const result = await syncWorldCupFixturesFromOpenLigaDb();
  console.log("sync-wc-fixtures result:", JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
