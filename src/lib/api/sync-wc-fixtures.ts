/**
 * Fill in World Cup 2026 knockout fixtures (teams + logos) from OpenLigaDB.
 *
 * Every fixture for the tournament already exists locally (all 104, group +
 * knockout) — the knockout rows are seeded as `TBD v TBD` placeholders and stay
 * that way until each round's participants are decided. This sync pulls the
 * resolved teams from OpenLigaDB and writes them onto the matching local
 * placeholder so the next round becomes predictable automatically after the
 * previous round finishes.
 *
 * Matching is by EXACT kickoff `matchDatetime` (UTC). Local knockout kickoff
 * times mirror OpenLigaDB exactly and every knockout match has a unique time, so
 * this is unambiguous. Group-stage rows are deliberately excluded (they already
 * carry the correct teams and can share kickoff slots, which would make a
 * datetime match ambiguous). Results are written separately by
 * `syncWorldCupResultsFromOpenLigaDb`.
 */
import { prisma } from "@/lib/db";
import { WORLD_CUP_2026_COMPETITION_ID } from "@/lib/config";
import {
  fetchOpenLigaDbWorldCupMatches,
  normalizeTeamName,
  resolveEnglishTeamName,
  type OpenLigaDbMatch,
} from "./openligadb";

export type SyncWcFixturesResult =
  | {
      ok: true;
      knockoutCandidates: number;
      filledCount: number;
      pendingDrawCount: number;
      unmatchedCount: number;
    }
  | { ok: false; error: string };

/** OpenLigaDB group-stage rounds are named "Gruppenphase …"; everything else is knockout. */
function isGroupStageRound(match: OpenLigaDbMatch): boolean {
  const name = match.group?.groupName ?? "";
  return name.startsWith("Gruppen");
}

export async function syncWorldCupFixturesFromOpenLigaDb(): Promise<SyncWcFixturesResult> {
  const fetched = await fetchOpenLigaDbWorldCupMatches();
  if (!fetched.ok) {
    await prisma.apiSyncLog.create({
      data: {
        provider: "openligadb.de",
        action: "sync_wc_fixtures",
        status: "error",
        errorMessage: fetched.error,
      },
    });
    return { ok: false, error: fetched.error };
  }

  const localMatches = await prisma.match.findMany({
    where: { competitionId: WORLD_CUP_2026_COMPETITION_ID },
    select: {
      id: true,
      stage: true,
      matchDatetime: true,
      homeTeamName: true,
      awayTeamName: true,
      homeTeamLogo: true,
      awayTeamLogo: true,
      officialResultType: true,
    },
  });

  // Reuse the canonical team crest we already store (sourced from football-data)
  // so knockout logos stay visually consistent with the group stage.
  const logoByTeam = new Map<string, string>();
  for (const m of localMatches) {
    if (m.homeTeamName !== "TBD" && m.homeTeamLogo) {
      logoByTeam.set(normalizeTeamName(m.homeTeamName), m.homeTeamLogo);
    }
    if (m.awayTeamName !== "TBD" && m.awayTeamLogo) {
      logoByTeam.set(normalizeTeamName(m.awayTeamName), m.awayTeamLogo);
    }
  }

  // Index local knockout fixtures by exact kickoff time. Skip group stage (its
  // teams are already correct and kickoff slots can repeat).
  const localKnockoutByTime = new Map<number, typeof localMatches>();
  for (const m of localMatches) {
    if (m.stage === "GROUP_STAGE") continue;
    const key = m.matchDatetime.getTime();
    const bucket = localKnockoutByTime.get(key);
    if (bucket) bucket.push(m);
    else localKnockoutByTime.set(key, [m]);
  }

  let knockoutCandidates = 0;
  let filledCount = 0;
  let pendingDrawCount = 0;
  let unmatchedCount = 0;

  for (const apiMatch of fetched.matches) {
    if (isGroupStageRound(apiMatch)) continue;
    knockoutCandidates++;

    const home = resolveEnglishTeamName(apiMatch.team1);
    const away = resolveEnglishTeamName(apiMatch.team2);
    // Placeholder rounds (e.g. "RSA/CAN") don't resolve to a country yet.
    if (!home || !away) {
      pendingDrawCount++;
      continue;
    }

    const key = new Date(apiMatch.matchDateTimeUTC).getTime();
    const bucket = localKnockoutByTime.get(key);
    if (!bucket || bucket.length !== 1) {
      unmatchedCount++;
      continue;
    }
    const local = bucket[0];

    // Never rewrite a fixture that already has a final result.
    if (local.officialResultType != null) continue;
    // Already filled with the same teams → nothing to do.
    if (local.homeTeamName === home && local.awayTeamName === away) continue;

    await prisma.match.update({
      where: { id: local.id },
      data: {
        homeTeamName: home,
        awayTeamName: away,
        homeTeamLogo: logoByTeam.get(normalizeTeamName(home)) ?? apiMatch.team1.teamIconUrl ?? null,
        awayTeamLogo: logoByTeam.get(normalizeTeamName(away)) ?? apiMatch.team2.teamIconUrl ?? null,
        sourceStatus: "mixed",
        syncedAt: new Date(),
      },
    });
    filledCount++;
  }

  await prisma.apiSyncLog.create({
    data: {
      provider: "openligadb.de",
      action: "sync_wc_fixtures",
      status: "success",
      errorMessage: null,
    },
  });

  return { ok: true, knockoutCandidates, filledCount, pendingDrawCount, unmatchedCount };
}
