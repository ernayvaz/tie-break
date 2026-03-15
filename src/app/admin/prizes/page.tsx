import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/get-user";
import { PrizeManagementClient } from "./prize-management-client";
import type { PrizeRow } from "./prize-management-client";

export default async function AdminPrizesPage() {
  await requireAdmin();

  const prizes = await prisma.prize.findMany({
    orderBy: [{ competitionId: "asc" }, { place: "asc" }],
    select: {
      id: true,
      competitionId: true,
      place: true,
      title: true,
      description: true,
    },
  });

  const rows: PrizeRow[] = prizes.map((p) => ({
    id: p.id,
    competitionId: p.competitionId,
    place: p.place,
    title: p.title,
    description: p.description ?? null,
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Prize Management</h1>
      <p className="mt-2 text-sm text-nord-polarLight">
        Set prizes per league (UEFA Champions League / Diğer). These are shown on the Leaderboard and Rules & prizes pages. Each league can have its own place 1, 2, 3, etc.
      </p>
      <PrizeManagementClient prizes={rows} />
    </div>
  );
}
