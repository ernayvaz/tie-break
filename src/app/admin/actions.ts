"use server";

import { syncMatchesFromApi } from "@/lib/api/sync-matches";
import { recalculateAll } from "@/lib/scoring";

export type SyncState = { message?: string; error?: string } | null;

export async function syncMatchesAction(): Promise<SyncState> {
  const result = await syncMatchesFromApi();
  if (!result.ok) return { error: result.error };

  const recalc = await recalculateAll();
  if (recalc.ok) {
    return {
      message: `Matches synced. ${result.count} match(es) processed. Scores and leaderboard updated (${recalc.leaderboardCount} users).`,
    };
  }
  return {
    message: `Matches synced (${result.count} match(es)). Score update failed: ${recalc.error}. Run Recalculate manually if needed.`,
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
