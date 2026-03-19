export type StatsSectionState = "available" | "partial" | "unavailable";
export type StatsFreshnessState = "fresh" | "stale" | "partial" | "unavailable";
export type StatsProviderLinkMode = "exact" | "fuzzy" | "none";
export type StatsProviderName =
  | "football-data.org"
  | "scoreaxis.com"
  | "scorebat.com";

export type StatsProviderAttemptStatus =
  | "used"
  | "missing"
  | "unavailable"
  | "unsupported";

export type StatsProviderAttempt = {
  provider: StatsProviderName;
  status: StatsProviderAttemptStatus;
  detail: string | null;
};

export type StatsSectionSource = {
  selectedProvider: StatsProviderName | null;
  attempts: StatsProviderAttempt[];
};

export type StatsTeamSources = {
  domesticLeague: StatsSectionSource;
  currentCompetition: StatsSectionSource;
  recentDomesticMatches: StatsSectionSource;
  recentUclMatches: StatsSectionSource;
};

export type MatchStatisticsSources = {
  h2h: StatsSectionSource;
  homeTeam: StatsTeamSources;
  awayTeam: StatsTeamSources;
};

export type StatsRecordKey = "overall" | "home" | "away";

export type StatsMatchSummary = {
  id: string;
  kickoff: string;
  competitionName: string | null;
  competitionLogo: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  outcomeLabel: string | null;
};

export type StatsTeamRecord = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type StatsStandingSnapshot = {
  rank: number | null;
  points: number | null;
  form: string | null;
  description: string | null;
  records: {
    overall: StatsTeamRecord | null;
    home: StatsTeamRecord | null;
    away: StatsTeamRecord | null;
  };
};

export type StatsLeagueSnapshot = {
  status: StatsSectionState;
  competitionCode: string | null;
  leagueName: string | null;
  leagueLogo: string | null;
  countryName: string | null;
  season: number | null;
  standing: StatsStandingSnapshot | null;
  message: string | null;
};

export type StatsLeagueTableRow = {
  rank: number;
  teamId: number | null;
  teamName: string;
  teamLogo: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string | null;
  isHighlighted: boolean;
};

export type StatsLeagueTableSection = {
  status: StatsSectionState;
  leagueName: string | null;
  rows: StatsLeagueTableRow[];
  message: string | null;
};

export type StatsPlayerLeader = {
  playerId: number | null;
  playerName: string;
  teamName: string | null;
  position: string | null;
  playedMatches: number | null;
  goals: number | null;
  assists: number | null;
  penalties: number | null;
};

export type StatsPlayerLeadersSection = {
  status: StatsSectionState;
  title: string | null;
  competitionName: string | null;
  players: StatsPlayerLeader[];
  message: string | null;
};

export type StatsTeamInfoSection = {
  status: StatsSectionState;
  officialName: string | null;
  shortName: string | null;
  tla: string | null;
  founded: number | null;
  venue: string | null;
  website: string | null;
  clubColors: string | null;
  coachName: string | null;
  squadSize: number | null;
  areaName: string | null;
  message: string | null;
};

export type StatsFixtureSection = {
  status: StatsSectionState;
  matches: StatsMatchSummary[];
  message: string | null;
};

export type StatsTeamSection = {
  status: StatsSectionState;
  teamName: string;
  teamLogo: string | null;
  providerTeamId: number | null;
  domesticLeague: StatsLeagueSnapshot;
  domesticLeagueTable: StatsLeagueTableSection;
  currentCompetition: StatsLeagueSnapshot;
  topPlayers: StatsPlayerLeadersSection;
  teamInfo: StatsTeamInfoSection;
  recentDomesticMatches: StatsFixtureSection;
  recentUclMatches: StatsFixtureSection;
};

export type StatsH2HSummary = {
  totalMeetings: number;
  analyzedMeetings: number;
  homeTeamWins: number;
  draws: number;
  awayTeamWins: number;
};

export type StatsH2HSection = {
  status: StatsSectionState;
  summary: StatsH2HSummary | null;
  matches: StatsMatchSummary[];
  knownTotalMeetings: number | null;
  isTruncated: boolean;
  message: string | null;
};

export type StatsFreshness = {
  status: StatsFreshnessState;
  syncedAt: string | null;
  ageMinutes: number | null;
};

export type MatchStatisticsPayload = {
  status: StatsSectionState;
  syncedAt: string | null;
  note: string | null;
  freshness: StatsFreshness;
  providerMatchLinkMode: StatsProviderLinkMode;
  sources?: MatchStatisticsSources;
  h2h: StatsH2HSection;
  competitionLeaders: StatsPlayerLeadersSection;
  homeTeam: StatsTeamSection;
  awayTeam: StatsTeamSection;
};

export const DEFAULT_STATS_NOTE =
  "Statistics will refresh after the next scheduled sync.";

export function createUnavailableFixtureSection(
  message: string
): StatsFixtureSection {
  return {
    status: "unavailable",
    matches: [],
    message,
  };
}

export function createUnavailableLeagueSnapshot(
  message: string
): StatsLeagueSnapshot {
  return {
    status: "unavailable",
    competitionCode: null,
    leagueName: null,
    leagueLogo: null,
    countryName: null,
    season: null,
    standing: null,
    message,
  };
}

export function createUnavailableTeamSection(
  teamName: string,
  teamLogo: string | null
): StatsTeamSection {
  return {
    status: "unavailable",
    teamName,
    teamLogo,
    providerTeamId: null,
    domesticLeague: createUnavailableLeagueSnapshot(
      "Domestic league data is not available for this team."
    ),
    domesticLeagueTable: {
      status: "unavailable",
      leagueName: null,
      rows: [],
      message: "Domestic league table is not available for this team.",
    },
    currentCompetition: createUnavailableLeagueSnapshot(
      "Current competition snapshot is not available for this team."
    ),
    topPlayers: {
      status: "unavailable",
      title: "Top players",
      competitionName: null,
      players: [],
      message: "Top-player data is not available for this team.",
    },
    teamInfo: {
      status: "unavailable",
      officialName: null,
      shortName: null,
      tla: null,
      founded: null,
      venue: null,
      website: null,
      clubColors: null,
      coachName: null,
      squadSize: null,
      areaName: null,
      message: "Team profile data is not available for this club.",
    },
    recentDomesticMatches: createUnavailableFixtureSection(
      "No recent domestic matches available."
    ),
    recentUclMatches: createUnavailableFixtureSection(
      "No recent Champions League matches available."
    ),
  };
}

export function createUnavailableMatchStatisticsPayload(input: {
  homeTeamName: string;
  homeTeamLogo: string | null;
  awayTeamName: string;
  awayTeamLogo: string | null;
  note?: string;
}): MatchStatisticsPayload {
  return {
    status: "unavailable",
    syncedAt: null,
    note: input.note ?? DEFAULT_STATS_NOTE,
    freshness: {
      status: "unavailable",
      syncedAt: null,
      ageMinutes: null,
    },
    providerMatchLinkMode: "none",
    h2h: {
      status: "unavailable",
      summary: null,
      matches: [],
      knownTotalMeetings: null,
      isTruncated: false,
      message: "No previous meetings data available.",
    },
    competitionLeaders: {
      status: "unavailable",
      title: "Competition leaders",
      competitionName: null,
      players: [],
      message: "Competition leaders are not available.",
    },
    homeTeam: createUnavailableTeamSection(
      input.homeTeamName,
      input.homeTeamLogo
    ),
    awayTeam: createUnavailableTeamSection(
      input.awayTeamName,
      input.awayTeamLogo
    ),
  };
}
