import type {
  MatchStatisticsPayload,
  StatsFixtureSection,
  StatsH2HSection,
  StatsLeagueSnapshot,
  StatsSectionState,
  StatsSectionSource,
  StatsTeamSection,
  StatsTeamSources,
} from "@/lib/match-stats/types";
import { resolveScoreAxisCompetitionSnapshot, resolveScoreAxisDomesticLeagueSnapshot } from "./scoreaxis-provider";
import { resolveScoreBatStructuredAttempt } from "./scorebat-provider";
import {
  createProviderAttempt,
  describeProviderChainFailure,
  resolveSectionSource,
} from "./types";

function combineStatuses(statuses: StatsSectionState[]): StatsSectionState {
  if (statuses.every((status) => status === "available")) return "available";
  if (statuses.every((status) => status === "unavailable")) return "unavailable";
  return "partial";
}

function buildFootballDataAttempt(
  sectionLabel: string,
  status: StatsSectionState,
  message?: string | null
) {
  if (status === "available" || status === "partial") {
    return createProviderAttempt(
      "football-data.org",
      "used",
      status === "available"
        ? `${sectionLabel} resolved from football-data.org.`
        : message ?? `${sectionLabel} is only partially available from football-data.org.`
    );
  }

  return createProviderAttempt(
    "football-data.org",
    "unavailable",
    message ?? `${sectionLabel} is unavailable from football-data.org.`
  );
}

function finalizeUnavailableSection<T extends { message: string | null }>(
  section: T,
  sectionLabel: string,
  source: StatsSectionSource
): T {
  return {
    ...section,
    message: describeProviderChainFailure(sectionLabel, source, section.message),
  };
}

function resolveFixtureSection(
  section: StatsFixtureSection,
  sectionLabel: string
): {
  section: StatsFixtureSection;
  source: StatsSectionSource;
} {
  const hasMatches = section.matches.length > 0;
  const footballDataAttempt = buildFootballDataAttempt(
    sectionLabel,
    section.status === "partial" && !hasMatches ? "unavailable" : section.status,
    section.message
  );

  if (section.status === "available" || (section.status === "partial" && hasMatches)) {
    return {
      section,
      source: resolveSectionSource([footballDataAttempt]),
    };
  }

  const source = resolveSectionSource([
    footballDataAttempt,
    createProviderAttempt(
      "scoreaxis.com",
      "unsupported",
      `ScoreAxis does not provide a supported structured ${sectionLabel.toLowerCase()} fallback for Match Center.`
    ),
    resolveScoreBatStructuredAttempt(sectionLabel.toLowerCase()),
  ]);

  return {
    section: {
      ...finalizeUnavailableSection(section, sectionLabel, source),
      status: "unavailable",
    },
    source,
  };
}

function resolveH2HSection(section: StatsH2HSection): {
  section: StatsH2HSection;
  source: StatsSectionSource;
} {
  const hasMeetings = section.matches.length > 0 || Boolean(section.summary);
  const footballDataAttempt = buildFootballDataAttempt(
    "Previous meetings",
    section.status === "partial" && !hasMeetings ? "unavailable" : section.status,
    section.message
  );

  if (section.status === "available" || (section.status === "partial" && hasMeetings)) {
    return {
      section,
      source: resolveSectionSource([footballDataAttempt]),
    };
  }

  const source = resolveSectionSource([
    footballDataAttempt,
    createProviderAttempt(
      "scoreaxis.com",
      "unsupported",
      "ScoreAxis does not provide a supported structured previous-meetings fallback for Match Center."
    ),
    resolveScoreBatStructuredAttempt("previous meetings"),
  ]);

  return {
    section: {
      ...finalizeUnavailableSection(section, "Previous meetings", source),
      status: "unavailable",
      knownTotalMeetings: section.knownTotalMeetings ?? 0,
    },
    source,
  };
}

function resolveDomesticLeagueSection(
  teamName: string,
  snapshot: StatsLeagueSnapshot
): {
  snapshot: StatsLeagueSnapshot;
  source: StatsSectionSource;
} {
  const footballDataAttempt = buildFootballDataAttempt(
    "Domestic league snapshot",
    snapshot.status,
    snapshot.message
  );

  if (snapshot.status === "available") {
    return {
      snapshot,
      source: resolveSectionSource([footballDataAttempt]),
    };
  }

  const scoreAxisResult = resolveScoreAxisDomesticLeagueSnapshot(teamName, snapshot);
  const source = resolveSectionSource([
    footballDataAttempt,
    scoreAxisResult.attempt,
    resolveScoreBatStructuredAttempt("domestic league snapshot"),
  ]);

  const nextSnapshot =
    source.selectedProvider === "scoreaxis.com" && scoreAxisResult.snapshot.status !== "unavailable"
      ? scoreAxisResult.snapshot
      : source.selectedProvider === null
        ? finalizeUnavailableSection(
            scoreAxisResult.snapshot,
            "Domestic league snapshot",
            source
          )
        : scoreAxisResult.snapshot;

  return {
    snapshot: nextSnapshot,
    source,
  };
}

function resolveCurrentCompetitionSection(
  snapshot: StatsLeagueSnapshot
): {
  snapshot: StatsLeagueSnapshot;
  source: StatsSectionSource;
} {
  const footballDataAttempt = buildFootballDataAttempt(
    "Current competition snapshot",
    snapshot.status,
    snapshot.message
  );

  if (snapshot.status === "available") {
    return {
      snapshot,
      source: resolveSectionSource([footballDataAttempt]),
    };
  }

  const scoreAxisResult = resolveScoreAxisCompetitionSnapshot(snapshot, {
    competitionCode: snapshot.competitionCode,
    leagueName: snapshot.leagueName,
  });
  const source = resolveSectionSource([
    footballDataAttempt,
    scoreAxisResult.attempt,
    resolveScoreBatStructuredAttempt("current competition snapshot"),
  ]);

  const nextSnapshot =
    source.selectedProvider === "scoreaxis.com" && scoreAxisResult.snapshot.status !== "unavailable"
      ? scoreAxisResult.snapshot
      : source.selectedProvider === null
        ? finalizeUnavailableSection(
            scoreAxisResult.snapshot,
            "Current competition snapshot",
            source
          )
        : scoreAxisResult.snapshot;

  return {
    snapshot: nextSnapshot,
    source,
  };
}

function resolveTeamSection(team: StatsTeamSection): {
  team: StatsTeamSection;
  sources: StatsTeamSources;
} {
  const domesticLeague = resolveDomesticLeagueSection(
    team.teamName,
    team.domesticLeague
  );
  const currentCompetition = resolveCurrentCompetitionSection(
    team.currentCompetition
  );
  const recentDomesticMatches = resolveFixtureSection(
    team.recentDomesticMatches,
    "Recent domestic matches"
  );
  const recentUclMatches = resolveFixtureSection(
    team.recentUclMatches,
    "Recent Champions League matches"
  );

  return {
    team: {
      ...team,
      status: combineStatuses([
        domesticLeague.snapshot.status,
        currentCompetition.snapshot.status,
        recentDomesticMatches.section.status,
        recentUclMatches.section.status,
      ]),
      domesticLeague: domesticLeague.snapshot,
      currentCompetition: currentCompetition.snapshot,
      recentDomesticMatches: recentDomesticMatches.section,
      recentUclMatches: recentUclMatches.section,
    },
    sources: {
      domesticLeague: domesticLeague.source,
      currentCompetition: currentCompetition.source,
      recentDomesticMatches: recentDomesticMatches.source,
      recentUclMatches: recentUclMatches.source,
    },
  };
}

export function applyMatchCenterProviderFallbacks(
  payload: MatchStatisticsPayload
): MatchStatisticsPayload {
  const h2h = resolveH2HSection(payload.h2h);
  const homeTeam = resolveTeamSection(payload.homeTeam);
  const awayTeam = resolveTeamSection(payload.awayTeam);

  return {
    ...payload,
    status: combineStatuses([
      h2h.section.status,
      homeTeam.team.status,
      awayTeam.team.status,
    ]),
    h2h: h2h.section,
    homeTeam: homeTeam.team,
    awayTeam: awayTeam.team,
    sources: {
      h2h: h2h.source,
      homeTeam: homeTeam.sources,
      awayTeam: awayTeam.sources,
    },
  };
}
