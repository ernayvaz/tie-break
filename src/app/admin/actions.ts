"use server";

import { syncMatchesFromApi } from "@/lib/api/sync-matches";
import { syncWorldCupFixturesFromOpenLigaDb } from "@/lib/api/sync-wc-fixtures";
import { syncWorldCupResultsFromOpenLigaDb } from "@/lib/api/sync-wc-results";
import { syncHighlightsFromApi } from "@/lib/api/sync-highlights";
import { syncMatchStatisticsCache } from "@/lib/api/sync-match-stats";
import { recalculateAll } from "@/lib/scoring";
import { requireAdmin } from "@/lib/auth/get-user";
import { revalidatePath } from "next/cache";

export type SyncState = { message?: string; error?: string } | null;

export async function syncMatchesAction(): Promise<SyncState> {
  await requireAdmin();

  // football-data.org is primary but best-effort while unavailable; its failure
  // must not block the World Cup results pipeline (OpenLigaDB) or recalculation.
  const footballData = await syncMatchesFromApi();
  // Fill the next knockout round's teams as soon as they're known.
  const worldCupFixtures = await syncWorldCupFixturesFromOpenLigaDb();
  const worldCup = await syncWorldCupResultsFromOpenLigaDb();
  const stats = await syncMatchStatisticsCache();
  const recalc = await recalculateAll();

  revalidatePath("/schedule");
  revalidatePath("/admin/matches");
  revalidatePath("/admin/api");
  revalidatePath("/admin/predictions");
  revalidatePath("/leaderboard");
  revalidatePath("/predictions");

  const fdSummary = footballData.ok
    ? `football-data.org: ${footballData.count} fixture(s) synced.`
    : `football-data.org unavailable (${footballData.error}).`;
  const wcFixturesSummary = worldCupFixtures.ok
    ? `World Cup knockout fixtures: ${worldCupFixtures.filledCount} round(s) filled${worldCupFixtures.pendingDrawCount > 0 ? `, ${worldCupFixtures.pendingDrawCount} awaiting draw` : ""}.`
    : `World Cup fixtures failed: ${worldCupFixtures.error}.`;
  const wcSummary = worldCup.ok
    ? `World Cup results (OpenLigaDB): ${worldCup.updatedCount} updated of ${worldCup.finishedCount} finished${worldCup.unmatchedCount > 0 ? `, ${worldCup.unmatchedCount} unmatched` : ""}.`
    : `World Cup results failed: ${worldCup.error}.`;
  const statsSummary = stats.ok
    ? `Match Center cache refreshed for ${stats.targetCount} fixture(s).`
    : `Match Center cache refresh failed: ${stats.error}.`;

  if (recalc.ok) {
    return {
      message: `${fdSummary} ${wcFixturesSummary} ${wcSummary} Scores and leaderboard updated (${recalc.leaderboardCount} users). ${statsSummary}`,
    };
  }
  return {
    message: `${fdSummary} ${wcFixturesSummary} ${wcSummary} ${statsSummary} Score update failed: ${recalc.error}. Run Recalculate manually if needed.`,
  };
}

export async function syncHighlightsAction(): Promise<SyncState> {
  await requireAdmin();

  const result = await syncHighlightsFromApi();

  if (!result.ok) return { error: result.error };

  revalidatePath("/highlights");
  revalidatePath("/highlights/[matchId]", "page");
  revalidatePath("/schedule");
  revalidatePath("/admin/api");

  const sbNote =
    result.fetchedCount === 0
      ? " Highlights provider returned no items — check the SCOREBAT_API_TOKEN configuration."
      : "";

  return {
    message: `Highlights synced. ScoreBat: ${result.fetchedCount} item(s), ${result.matchedCount} match(es) resolved, ${result.storedCount} stored. World Cup highlights stream live from the official ScoreBat widget.${sbNote}`,
  };
}

export type ScoringState = { message?: string; error?: string } | null;

export async function recalculateScoresAction(): Promise<ScoringState> {
  await requireAdmin();

  const result = await recalculateAll();
  revalidatePath("/schedule");
  revalidatePath("/leaderboard");
  revalidatePath("/predictions");
  revalidatePath("/admin/predictions");
  revalidatePath("/admin/scoring");

  if (result.ok) {
    return {
      message: `Scores recalculated. ${result.matchesScored} match(es) scored, leaderboard updated (${result.leaderboardCount} users).`,
    };
  }
  return { error: result.error };
}
