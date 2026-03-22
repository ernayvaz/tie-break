"use server";

import { syncMatchesFromApi } from "@/lib/api/sync-matches";
import { syncHighlightsFromApi } from "@/lib/api/sync-highlights";
import { syncMatchStatisticsCache } from "@/lib/api/sync-match-stats";
import { recalculateAll } from "@/lib/scoring";
import { requireAdmin } from "@/lib/auth/get-user";
import { revalidatePath } from "next/cache";

export type SyncState = { message?: string; error?: string } | null;

export async function syncMatchesAction(): Promise<SyncState> {
  const result = await syncMatchesFromApi();
  if (!result.ok) return { error: result.error };

  const stats = await syncMatchStatisticsCache();
  const recalc = await recalculateAll();
  const statsSummary = stats.ok
    ? `Match Center cache refreshed for ${stats.targetCount} fixture(s).`
    : `Match Center cache refresh failed: ${stats.error}.`;
  revalidatePath("/schedule");
  revalidatePath("/admin/matches");
  if (recalc.ok) {
    return {
      message: `Matches synced. ${result.count} match(es) processed. Scores and leaderboard updated (${recalc.leaderboardCount} users). ${statsSummary}`,
    };
  }
  return {
    message: `Matches synced (${result.count} match(es)). ${statsSummary} Score update failed: ${recalc.error}. Run Recalculate manually if needed.`,
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

  return {
    message: `Highlights synced. ${result.fetchedCount} provider item(s), ${result.matchedCount} match(es) resolved, ${result.storedCount} record(s) stored, ${result.staleCount} recent record(s) marked stale.`,
  };
}

export type ScoringState = { message?: string; error?: string } | null;

export async function recalculateScoresAction(): Promise<ScoringState> {
  const result = await recalculateAll();
  if (result.ok) {
    return {
      message: `Scores recalculated. ${result.matchesScored} match(es) scored, leaderboard updated (${result.leaderboardCount} users).`,
    };
  }
  return { error: result.error };
}
