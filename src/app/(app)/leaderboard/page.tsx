import { requireAuth } from "@/lib/auth/get-user";
import { getLeaderboardStatsForUser } from "@/lib/scoring";
import { CompetitionTabs } from "@/components/competition-tabs";
import { HalisahaResultsGateCard } from "@/components/halisaha/halisaha-results-gate-card";
import { PageHeroBand } from "@/components/page-hero-band";
import { LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { getLeaderboardBoardData, normalizeLeaderboardCompetitionId } from "@/lib/leaderboard";
import {
  canUserAccessPublishedHalisahaMatch,
  getHalisahaMvpGateState,
} from "@/lib/halisaha/server";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  const currentUser = await requireAuth();
  const params = await searchParams;
  const competitionId = normalizeLeaderboardCompetitionId(params.competition);
  const halisahaGate = (await canUserAccessPublishedHalisahaMatch(currentUser.role))
    ? await getHalisahaMvpGateState(currentUser.id, currentUser.role)
    : null;
  const data =
    halisahaGate === null || halisahaGate.canRevealResults
      ? await getLeaderboardBoardData(currentUser, competitionId)
      : null;
  const liveStats =
    currentUser.role === "admin" && data
      ? await getLeaderboardStatsForUser(currentUser.id, competitionId)
      : null;

  return (
    <div className="space-y-3 sm:space-y-6">
      <PageHeroBand
        eyebrow="Premium Ranking"
        title="Leaderboard"
        description="Track the board with a cleaner premium overview ranked by points first and accuracy second."
        highlights={[
          {
            label: "Ranking logic",
            value: "Total points decide the order, with accuracy used as the tie-break.",
          },
          {
            label: "Recent form",
            value: "The latest 5 prediction reads stay visible for every row.",
          },
        ]}
        footerNote={
          <>
            Username is never shown. Last 5 reads left to right from oldest to newest.
            {data?.isAdmin && data.hasAdminRows && (
              <span className="mt-1 block text-nord-polarLight/95">
                Admin entries are shown at the bottom for testing only; other users do not see them.
              </span>
            )}
            {data?.adminHasLiveRow && liveStats && (
              <span className="mt-1 block text-nord-polarLight/95">
                Your row is computed from your predictions. Run{" "}
                <strong>Recalculate scores & leaderboard</strong> in Admin → Scoring to update the stored board.
              </span>
            )}
          </>
        }
      />

      <div>
        <CompetitionTabs currentCompetitionId={competitionId} basePath="/leaderboard" />
      </div>

      {data ? (
        <LeaderboardBoard data={data} showPrizes />
      ) : halisahaGate ? (
        <HalisahaResultsGateCard
          eyebrow={
            halisahaGate.mode === "waiting_for_vote_window"
              ? "MVP voting in progress"
              : "MVP vote required"
          }
          title={halisahaGate.title}
          description={halisahaGate.description}
          href={halisahaGate.ctaHref}
          buttonLabel={halisahaGate.buttonLabel}
        />
      ) : null
      }
    </div>
  );
}
