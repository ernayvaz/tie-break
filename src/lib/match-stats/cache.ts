import { prisma } from "@/lib/db";
import {
  createUnavailableMatchStatisticsPayload,
  createUnavailableLeagueSnapshot,
  type MatchStatisticsPayload,
  type StatsFreshness,
  type StatsFreshnessState,
  type StatsLeagueSnapshot,
  type StatsProviderLinkMode,
} from "./types";

const STALE_AFTER_MINUTES = 12 * 60;

function getAgeMinutes(syncedAt: string | null): number | null {
  if (!syncedAt) return null;

  const syncedMs = new Date(syncedAt).getTime();
  if (!Number.isFinite(syncedMs)) return null;

  return Math.max(0, Math.round((Date.now() - syncedMs) / 60000));
}

function getFreshnessStatus(
  payload: MatchStatisticsPayload,
  syncedAt: string | null
): StatsFreshnessState {
  if (!syncedAt || payload.status === "unavailable") return "unavailable";

  const ageMinutes = getAgeMinutes(syncedAt);
  if (payload.status === "partial") {
    if (ageMinutes == null) return "partial";
    return ageMinutes > STALE_AFTER_MINUTES ? "stale" : "partial";
  }

  if (ageMinutes == null) return "unavailable";
  return ageMinutes > STALE_AFTER_MINUTES ? "stale" : "fresh";
}

function buildFreshness(
  payload: MatchStatisticsPayload,
  syncedAt: string | null
): StatsFreshness {
  return {
    status: getFreshnessStatus(payload, syncedAt),
    syncedAt,
    ageMinutes: getAgeMinutes(syncedAt),
  };
}

function hydrateLeagueSnapshot(
  snapshot: StatsLeagueSnapshot | null | undefined
): StatsLeagueSnapshot {
  if (!snapshot) return createUnavailableLeagueSnapshot("League data is unavailable.");

  return {
    ...snapshot,
    competitionCode: snapshot.competitionCode ?? null,
  };
}

function normalizeMatchCenterMessage(message: string | null | undefined): string | null {
  if (!message) return null;

  const normalized = message.toLowerCase();

  if (
    normalized.includes("recent domestic") ||
    normalized.includes("domestic matches")
  ) {
    return "Recent domestic match data is coming soon.";
  }

  if (
    normalized.includes("recent champions league") ||
    normalized.includes("champions league matches")
  ) {
    return "Recent Champions League match data is coming soon.";
  }

  if (normalized.includes("previous meetings")) {
    return "Previous meetings for this fixture are coming soon.";
  }

  if (normalized.includes("domestic league table")) {
    return "The domestic league table for this club is coming soon.";
  }

  if (
    normalized.includes("team profile") ||
    normalized.includes("team info") ||
    normalized.includes("detailed team profile")
  ) {
    return "Detailed team information is coming soon.";
  }

  if (
    normalized.includes("top-player") ||
    normalized.includes("top players") ||
    normalized.includes("scorer")
  ) {
    return "Top-player insights for this club are coming soon.";
  }

  if (
    normalized.includes("competition leaders") ||
    normalized.includes("leaders are not available")
  ) {
    return "Competition leaders are coming soon.";
  }

  if (
    normalized.includes("league identity") ||
    normalized.includes("current competition snapshot") ||
    normalized.includes("domestic league data")
  ) {
    return "Competition snapshot details are coming soon.";
  }

  return "This part of Match Center is coming soon.";
}

function hydratePayload(
  payload: MatchStatisticsPayload,
  syncedAt: string | null
): MatchStatisticsPayload {
  const fallbackPayload = createUnavailableMatchStatisticsPayload({
    homeTeamName: payload.homeTeam?.teamName ?? "Home team",
    homeTeamLogo: payload.homeTeam?.teamLogo ?? null,
    awayTeamName: payload.awayTeam?.teamName ?? "Away team",
    awayTeamLogo: payload.awayTeam?.teamLogo ?? null,
    note: payload.note ?? undefined,
  });
  const providerMatchLinkMode = (
    payload.providerMatchLinkMode ?? "none"
  ) as StatsProviderLinkMode;

  const hydrated: MatchStatisticsPayload = {
    ...payload,
    syncedAt,
    freshness: buildFreshness(payload, syncedAt),
    providerMatchLinkMode,
    h2h: {
      ...fallbackPayload.h2h,
      ...payload.h2h,
      message: normalizeMatchCenterMessage(payload.h2h?.message),
      knownTotalMeetings:
        payload.h2h?.knownTotalMeetings ??
        payload.h2h?.summary?.totalMeetings ??
        payload.h2h?.matches.length ??
        fallbackPayload.h2h.matches.length,
      isTruncated: payload.h2h?.isTruncated ?? false,
      summary: payload.h2h?.summary
        ? {
            ...payload.h2h.summary,
            analyzedMeetings:
              payload.h2h.summary.analyzedMeetings ??
              payload.h2h.matches.length,
          }
        : null,
    },
    homeTeam: {
      ...fallbackPayload.homeTeam,
      ...payload.homeTeam,
      domesticLeague: {
        ...hydrateLeagueSnapshot(payload.homeTeam?.domesticLeague),
        message: normalizeMatchCenterMessage(payload.homeTeam?.domesticLeague?.message),
      },
      domesticLeagueTable: {
        ...(payload.homeTeam?.domesticLeagueTable ?? fallbackPayload.homeTeam.domesticLeagueTable),
        message: normalizeMatchCenterMessage(
          payload.homeTeam?.domesticLeagueTable?.message
        ),
      },
      currentCompetition: {
        ...hydrateLeagueSnapshot(payload.homeTeam?.currentCompetition),
        message: normalizeMatchCenterMessage(
          payload.homeTeam?.currentCompetition?.message
        ),
      },
      topPlayers: {
        ...(payload.homeTeam?.topPlayers ?? fallbackPayload.homeTeam.topPlayers),
        message: normalizeMatchCenterMessage(payload.homeTeam?.topPlayers?.message),
      },
      teamInfo: {
        ...(payload.homeTeam?.teamInfo ?? fallbackPayload.homeTeam.teamInfo),
        message: normalizeMatchCenterMessage(payload.homeTeam?.teamInfo?.message),
      },
      recentDomesticMatches: {
        ...(payload.homeTeam?.recentDomesticMatches ??
          fallbackPayload.homeTeam.recentDomesticMatches),
        message: normalizeMatchCenterMessage(
          payload.homeTeam?.recentDomesticMatches?.message
        ),
      },
      recentUclMatches: {
        ...(payload.homeTeam?.recentUclMatches ??
          fallbackPayload.homeTeam.recentUclMatches),
        message: normalizeMatchCenterMessage(
          payload.homeTeam?.recentUclMatches?.message
        ),
      },
    },
    awayTeam: {
      ...fallbackPayload.awayTeam,
      ...payload.awayTeam,
      domesticLeague: {
        ...hydrateLeagueSnapshot(payload.awayTeam?.domesticLeague),
        message: normalizeMatchCenterMessage(payload.awayTeam?.domesticLeague?.message),
      },
      domesticLeagueTable: {
        ...(payload.awayTeam?.domesticLeagueTable ?? fallbackPayload.awayTeam.domesticLeagueTable),
        message: normalizeMatchCenterMessage(
          payload.awayTeam?.domesticLeagueTable?.message
        ),
      },
      currentCompetition: {
        ...hydrateLeagueSnapshot(payload.awayTeam?.currentCompetition),
        message: normalizeMatchCenterMessage(
          payload.awayTeam?.currentCompetition?.message
        ),
      },
      topPlayers: {
        ...(payload.awayTeam?.topPlayers ?? fallbackPayload.awayTeam.topPlayers),
        message: normalizeMatchCenterMessage(payload.awayTeam?.topPlayers?.message),
      },
      teamInfo: {
        ...(payload.awayTeam?.teamInfo ?? fallbackPayload.awayTeam.teamInfo),
        message: normalizeMatchCenterMessage(payload.awayTeam?.teamInfo?.message),
      },
      recentDomesticMatches: {
        ...(payload.awayTeam?.recentDomesticMatches ??
          fallbackPayload.awayTeam.recentDomesticMatches),
        message: normalizeMatchCenterMessage(
          payload.awayTeam?.recentDomesticMatches?.message
        ),
      },
      recentUclMatches: {
        ...(payload.awayTeam?.recentUclMatches ??
          fallbackPayload.awayTeam.recentUclMatches),
        message: normalizeMatchCenterMessage(
          payload.awayTeam?.recentUclMatches?.message
        ),
      },
    },
    competitionLeaders: {
      ...(payload.competitionLeaders ?? fallbackPayload.competitionLeaders),
      message: normalizeMatchCenterMessage(payload.competitionLeaders?.message),
    },
  };

  return hydrated;
}

export async function getMatchStatisticsByMatchIds(
  matchIds: string[]
): Promise<Record<string, MatchStatisticsPayload>> {
  if (matchIds.length === 0) return {};

  const rows = await prisma.matchStatsCache.findMany({
    where: { matchId: { in: matchIds } },
    select: {
      matchId: true,
      payload: true,
      syncedAt: true,
    },
  });

  const result: Record<string, MatchStatisticsPayload> = {};
  for (const row of rows) {
    if (!row.payload || typeof row.payload !== "object") continue;
    result[row.matchId] = hydratePayload(
      row.payload as MatchStatisticsPayload,
      row.syncedAt?.toISOString() ?? null
    );
  }

  return result;
}
