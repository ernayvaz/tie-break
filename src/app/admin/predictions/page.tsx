import { PageHeroBand } from "@/components/page-hero-band";
import { requireAdmin } from "@/lib/auth/get-user";
import { prisma } from "@/lib/db";
import { sanitizeAdminPredictionHistoryFilters } from "@/lib/admin-prediction-history";
import { PredictionManagementClient } from "./prediction-management-client";
import type { MatchOption, PredictionRow, UserOption } from "./prediction-management-client";

type SearchParams = Promise<{
  league?: string;
  matchId?: string;
  userId?: string;
  status?: string;
  timeline?: string;
  result?: string;
  outcome?: string;
}>;

export default async function AdminPredictionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const initialFilters = sanitizeAdminPredictionHistoryFilters(await searchParams);

  const [predictions, matches, users] = await Promise.all([
    prisma.prediction.findMany({
      orderBy: [{ match: { matchDatetime: "desc" } }, { updatedAt: "desc" }],
      include: {
        match: {
          select: {
            id: true,
            competitionId: true,
            stage: true,
            matchDatetime: true,
            lockAt: true,
            homeTeamName: true,
            awayTeamName: true,
            officialResultType: true,
            homeScore: true,
            awayScore: true,
          },
        },
        user: {
          select: { id: true, name: true, surname: true, username: true },
        },
      },
    }),
    prisma.match.findMany({
      orderBy: { matchDatetime: "desc" },
      select: {
        id: true,
        competitionId: true,
        matchDatetime: true,
        homeTeamName: true,
        awayTeamName: true,
      },
    }),
    prisma.user.findMany({
      orderBy: [{ surname: "asc" }, { name: "asc" }],
      select: { id: true, name: true, surname: true, username: true },
    }),
  ]);

  const rows: PredictionRow[] = predictions.map((prediction) => ({
    id: prediction.id,
    userId: prediction.userId,
    matchId: prediction.matchId,
    selectedPrediction: prediction.selectedPrediction,
    isFinal: prediction.isFinal,
    createdAt: prediction.createdAt.toISOString(),
    updatedAt: prediction.updatedAt.toISOString(),
    finalizedAt: prediction.finalizedAt?.toISOString() ?? null,
    awardedPoints: prediction.awardedPoints,
    match: {
      id: prediction.match.id,
      competitionId: prediction.match.competitionId ?? null,
      stage: prediction.match.stage,
      matchDatetime: prediction.match.matchDatetime.toISOString(),
      lockAt: prediction.match.lockAt.toISOString(),
      homeTeamName: prediction.match.homeTeamName,
      awayTeamName: prediction.match.awayTeamName,
      officialResultType: prediction.match.officialResultType,
      homeScore: prediction.match.homeScore,
      awayScore: prediction.match.awayScore,
    },
    user: {
      id: prediction.user.id,
      name: prediction.user.name,
      surname: prediction.user.surname,
      username: prediction.user.username,
    },
  }));

  const matchOptions: MatchOption[] = matches.map((match) => ({
    id: match.id,
    competitionId: match.competitionId ?? null,
    label: `${new Date(match.matchDatetime).toLocaleDateString("en-GB", {
      dateStyle: "short",
    })} ${match.homeTeamName} vs ${match.awayTeamName}`,
  }));

  const userOptions: UserOption[] = users.map((user) => ({
    id: user.id,
    label: `${user.name} ${user.surname}`,
    username: user.username,
  }));

  return (
    <div className="space-y-6">
      <PageHeroBand
        eyebrow="TIE-BREAK Control"
        title="Prediction Management"
        description="Inspect previous-match picks with first save time, finalization time, last edit time, official result, and scoring detail in one premium control surface."
        highlights={[
          {
            label: "Coverage",
            value: `${rows.length} predictions across ${matches.length} fixtures`,
          },
          {
            label: "Time signals",
            value: "Saved, finalized, and last-updated timestamps",
          },
          {
            label: "Quick focus",
            value: "Jump in from Users or Matches with deep-linked filters",
          },
        ]}
        footerNote={
          <>
            Use the filters below to isolate <strong>previous matches</strong>, a
            single <strong>user</strong>, or an individual <strong>fixture</strong>.
            Manual point overrides still refresh the leaderboard after each change.
          </>
        }
      />
      <PredictionManagementClient
        predictions={rows}
        matchOptions={matchOptions}
        userOptions={userOptions}
        initialFilters={initialFilters}
      />
    </div>
  );
}
