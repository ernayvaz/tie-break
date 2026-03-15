import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/get-user";
import { PredictionsList } from "./predictions-list";
import type { PredictionRow } from "./predictions-list";

export default async function MyPredictionsPage() {
  const user = await requireAuth();

  const predictions = await prisma.prediction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      match: {
        select: {
          id: true,
          competitionId: true,
          matchDatetime: true,
          stage: true,
          homeTeamName: true,
          awayTeamName: true,
          officialResultType: true,
        },
      },
    },
  });

  const rows: PredictionRow[] = predictions.map((p) => ({
    id: p.id,
    matchId: p.matchId,
    selectedPrediction: p.selectedPrediction,
    isFinal: p.isFinal,
    finalizedAt: p.finalizedAt?.toISOString() ?? null,
    match: {
      id: p.match.id,
      competitionId: p.match.competitionId ?? null,
      matchDatetime: p.match.matchDatetime.toISOString(),
      stage: p.match.stage,
      homeTeamName: p.match.homeTeamName,
      awayTeamName: p.match.awayTeamName,
      officialResultType: p.match.officialResultType,
    },
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">My predictions</h1>
      <p className="mt-1 text-sm text-nord-polarLight">
        Your prediction history. Once you finalize a prediction, it cannot be changed.
      </p>
      <PredictionsList predictions={rows} isAdmin={user.role === "admin"} />
    </div>
  );
}
