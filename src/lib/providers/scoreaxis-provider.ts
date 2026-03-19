import type {
  StatsLeagueSnapshot,
  StatsTeamSection,
} from "@/lib/match-stats/types";
import {
  buildScoreAxisWidgetSrc,
  getScoreAxisDomesticLeagueInfo,
  getScoreAxisLeagueId,
  getScoreAxisLeagueInfo,
  getScoreAxisLiveMatchId,
  getScoreAxisTeamId,
  getScoreAxisUclLeagueId,
} from "@/lib/scoreaxis";
import { createProviderAttempt } from "./types";

type ScoreAxisWidgetKind =
  | "league-table"
  | "team-top-players"
  | "team-info"
  | "league-top-players"
  | "live-match";

export type ProviderWidgetResolution = {
  provider: "scoreaxis.com";
  available: boolean;
  src: string | null;
  reason: string;
};

function createMissingWidgetReason(widgetLabel: string): string {
  return `ScoreAxis does not have a confirmed ${widgetLabel} mapping for this panel.`;
}

export function resolveScoreAxisDomesticLeagueSnapshot(
  teamName: string,
  snapshot: StatsLeagueSnapshot
): {
  snapshot: StatsLeagueSnapshot;
  attempt: ReturnType<typeof createProviderAttempt>;
} {
  const domesticLeagueInfo = getScoreAxisDomesticLeagueInfo(teamName);
  if (!domesticLeagueInfo) {
    return {
      snapshot,
      attempt: createProviderAttempt(
        "scoreaxis.com",
        "missing",
        "No ScoreAxis domestic-league mapping exists for this club."
      ),
    };
  }

  const nextSnapshot: StatsLeagueSnapshot = {
    ...snapshot,
    status: snapshot.standing ? snapshot.status : "partial",
    leagueName: snapshot.leagueName ?? domesticLeagueInfo.leagueName,
    message: snapshot.standing
      ? snapshot.message
      : "League identity is shown from ScoreAxis while structured domestic standings remain unavailable from football-data.org.",
  };

  return {
    snapshot: nextSnapshot,
    attempt: createProviderAttempt(
      "scoreaxis.com",
      "used",
      "ScoreAxis supplied the domestic league identity for this club."
    ),
  };
}

export function resolveScoreAxisCompetitionSnapshot(
  snapshot: StatsLeagueSnapshot,
  input: {
    competitionCode?: string | null;
    leagueName?: string | null;
  }
): {
  snapshot: StatsLeagueSnapshot;
  attempt: ReturnType<typeof createProviderAttempt>;
} {
  const competitionInfo = getScoreAxisLeagueInfo(input);
  if (!competitionInfo) {
    return {
      snapshot,
      attempt: createProviderAttempt(
        "scoreaxis.com",
        "missing",
        "No ScoreAxis competition mapping exists for this section."
      ),
    };
  }

  const nextSnapshot: StatsLeagueSnapshot = {
    ...snapshot,
    status: snapshot.standing ? snapshot.status : "partial",
    leagueName: snapshot.leagueName ?? competitionInfo.leagueName,
    message: snapshot.standing
      ? snapshot.message
      : "Competition identity is shown from ScoreAxis while structured standings remain unavailable from football-data.org.",
  };

  return {
    snapshot: nextSnapshot,
    attempt: createProviderAttempt(
      "scoreaxis.com",
      "used",
      "ScoreAxis supplied the competition identity for this section."
    ),
  };
}

function buildWidgetResolution(
  kind: ScoreAxisWidgetKind,
  entityId: string | null,
  widgetLabel: string
): ProviderWidgetResolution {
  if (!entityId) {
    return {
      provider: "scoreaxis.com",
      available: false,
      src: null,
      reason: createMissingWidgetReason(widgetLabel),
    };
  }

  return {
    provider: "scoreaxis.com",
    available: true,
    src: buildScoreAxisWidgetSrc(kind, entityId),
    reason: `ScoreAxis widget resolved for ${widgetLabel}.`,
  };
}

export function resolveScoreAxisLeagueTableWidget(
  team: StatsTeamSection
): ProviderWidgetResolution {
  const fallbackDomesticLeague = getScoreAxisDomesticLeagueInfo(team.teamName);
  const leagueId =
    getScoreAxisLeagueId({
      competitionCode: team.domesticLeague.competitionCode,
      leagueName: team.domesticLeague.leagueName,
    }) ?? fallbackDomesticLeague?.leagueId ?? null;

  return buildWidgetResolution("league-table", leagueId, "domestic league table");
}

export function resolveScoreAxisTeamWidget(
  teamName: string,
  kind: "team-top-players" | "team-info"
): ProviderWidgetResolution {
  return buildWidgetResolution(
    kind,
    getScoreAxisTeamId(teamName),
    kind === "team-top-players" ? "team top players" : "team info"
  );
}

export function resolveScoreAxisUclLeadersWidget(
  competitionId?: string | null
): ProviderWidgetResolution {
  if (competitionId !== "CL") {
    return {
      provider: "scoreaxis.com",
      available: false,
      src: null,
      reason: "ScoreAxis UCL leaders are only available on Champions League fixtures.",
    };
  }

  return buildWidgetResolution(
    "league-top-players",
    getScoreAxisUclLeagueId(),
    "Champions League leaders"
  );
}

export function resolveScoreAxisLiveMatchWidget(
  externalApiId?: string | null
): ProviderWidgetResolution {
  return buildWidgetResolution(
    "live-match",
    getScoreAxisLiveMatchId(externalApiId),
    "live match"
  );
}
