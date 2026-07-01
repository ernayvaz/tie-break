"use server";

import { requireAuth } from "@/lib/auth/get-user";
import { getHeadToHeadData, type HeadToHeadData } from "@/lib/head-to-head";
import { normalizeLeaderboardCompetitionId } from "@/lib/leaderboard";

export type HeadToHeadActionState =
  | { ok: true; data: HeadToHeadData }
  | { ok: false; error: string };

export async function getHeadToHeadAction(
  userIdA: string,
  userIdB: string,
  competitionId: string,
): Promise<HeadToHeadActionState> {
  await requireAuth();

  if (!userIdA || !userIdB || userIdA === userIdB) {
    return { ok: false, error: "Select two different players to compare." };
  }

  const normalizedCompetitionId = normalizeLeaderboardCompetitionId(competitionId);
  const data = await getHeadToHeadData(userIdA, userIdB, normalizedCompetitionId);

  if (!data) {
    return { ok: false, error: "Comparison data is not available for these players." };
  }

  return { ok: true, data };
}
