import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/get-user";
import { PageHeroBand } from "@/components/page-hero-band";
import { PredictionsList } from "./predictions-list";
import type { PredictionRow } from "./predictions-list";

export default async function MyPredictionsPage() {
  const user = await requireAuth();

  const predictions = await prisma.prediction.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
    createdAt: p.createdAt.toISOString(),
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
    <div className="space-y-3 sm:space-y-6">
      <PageHeroBand
        eyebrow="Premium Tracking"
        title="My predictions"
        description="Review your prediction history in a cleaner premium layout with finalized picks and status changes easy to scan."
        highlights={[
          {
            label: "Lock window",
            value: "Predictions lock 5 minutes before kickoff.",
          },
          {
            label: "Finalized picks",
            value: "Once confirmed, a prediction stays locked in your history.",
          },
        ]}
      />
      <PredictionsList predictions={rows} isAdmin={user.role === "admin"} />
    </div>
  );
}
