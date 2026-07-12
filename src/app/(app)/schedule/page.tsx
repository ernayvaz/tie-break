import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/get-user";
import { getOthersPredictionsBatch } from "@/lib/predictions";
import { toDisplay } from "@/lib/prediction-values";
import {
  UCL_COMPETITION_ID,
  POWER_PICK_COMPETITION_ID,
  WORLD_CUP_2026_COMPETITION_ID,
} from "@/lib/config";
import { getUserPowerPickState } from "@/lib/power-pick";
import { PageHeroBand } from "@/components/page-hero-band";
import { ScheduleTabs } from "./schedule-tabs";

export default async function SchedulePage() {
  const user = await requireAuth();

  const matches = await prisma.match.findMany({
    orderBy: { matchDatetime: "asc" },
    take: 500,
    select: {
      id: true,
      competitionId: true,
      externalApiId: true,
      matchDatetime: true,
      lockAt: true,
      stage: true,
      homeTeamName: true,
      awayTeamName: true,
      homeTeamLogo: true,
      awayTeamLogo: true,
      officialResultType: true,
      homeScore: true,
      awayScore: true,
      highlight: {
        select: {
          matchId: true,
          syncStatus: true,
        },
      },
    },
  });

  const matchIds = matches.map((m) => m.id);

  // Match Center statistics are NOT loaded here. They are fetched lazily, per
  // fixture, only when a user opens that match's Match Center (via /api/match-stats).
  // Eagerly loading every match's (large) stats payload on each schedule render was
  // the dominant database egress source.
  const userPredictions = await prisma.prediction.findMany({
    where: { userId: user.id, matchId: { in: matchIds } },
    select: {
      matchId: true,
      selectedPrediction: true,
      isFinal: true,
      finalizedAt: true,
      createdAt: true,
    },
  });

  // Others' predictions: only for matches where current user (including admin) has finalized.
  // Admin can see others the same way for testing; admin can still undo their predictions anytime.
  const finalizedMatchIds = [
    ...new Set(userPredictions.filter((p) => p.isFinal).map((p) => p.matchId)),
  ];
  const powerPickState = await getUserPowerPickState(user.id, POWER_PICK_COMPETITION_ID);

  const othersBatch = await getOthersPredictionsBatch(finalizedMatchIds, user.id);
  const othersByMatchId: Record<
    string,
    {
      name: string;
      surname: string;
      selectedPrediction: string;
      finalizedAt: string;
      isPowerPick: boolean;
      powerPickMultiplier: number | null;
    }[]
  > = {};
  for (const [matchId, list] of Object.entries(othersBatch)) {
    othersByMatchId[matchId] = list.map((o) => ({
      ...o,
      finalizedAt: o.finalizedAt.toISOString(),
    }));
  }

  const serializedMatches = matches.map((m) => ({
    id: m.id,
    competitionId: m.competitionId ?? null,
    externalApiId: m.externalApiId ?? null,
    matchDatetime: m.matchDatetime.toISOString(),
    lockAt: m.lockAt.toISOString(),
    stage: m.stage,
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    homeTeamLogo: m.homeTeamLogo ?? null,
    awayTeamLogo: m.awayTeamLogo ?? null,
    officialResultType: m.officialResultType,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    highlightHref:
      m.competitionId === WORLD_CUP_2026_COMPETITION_ID
        ? // World Cup recaps stream from the official ScoreBat widget hub (no
          // per-match detail page / no YouTube clips any more).
          m.officialResultType != null ||
            (m.homeScore != null && m.awayScore != null)
            ? `/highlights?competition=${WORLD_CUP_2026_COMPETITION_ID}`
            : null
        : m.highlight &&
            m.highlight.syncStatus !== "unavailable" &&
            (m.officialResultType != null ||
              (m.homeScore != null && m.awayScore != null))
          ? `/highlights/${m.id}?competition=${m.competitionId ?? UCL_COMPETITION_ID}`
          : null,
  }));

  const serializedUserPredictions = userPredictions.map((p) => ({
    matchId: p.matchId,
    selectedPrediction: toDisplay(p.selectedPrediction),
    isFinal: p.isFinal,
    finalizedAt: p.finalizedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-3 sm:space-y-5">
      <PageHeroBand
        eyebrow="Premium Match Center"
        title="Match schedule"
        description="A tighter premium schedule view with a refined Match Center, last-five H2H context and a separate live rail."
        highlights={[
          {
            label: "Previous meetings",
            value: "Only the latest 5 meetings are shown for faster scanning.",
          },
          {
            label: "Power Pick",
            value: "Feeling confident? Arm your assigned Power Pick points on a match and a correct call is worth that exact point value. Choose your moments — your picks are limited.",
          },
        ]}
      />
      {matches.length === 0 ? (
        <p className="mt-6 text-nord-polarLight text-sm">
          No matches yet. Sync from API in the admin panel.
        </p>
      ) : (
        <section className="overflow-hidden rounded-[2rem] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(236,239,244,0.8))] shadow-[0_28px_75px_rgba(46,52,64,0.08)]">
          <div className="overflow-x-auto">
            <ScheduleTabs
              matches={serializedMatches}
              userPredictions={serializedUserPredictions}
              othersByMatchId={othersByMatchId}
              statsByMatchId={{}}
              liveByMatchId={{}}
              powerPickBalance={powerPickState.balance}
              powerPickByMatchId={powerPickState.byMatchId}
              isAdmin={user.role === "admin"}
            />
          </div>
        </section>
      )}
    </div>
  );
}
