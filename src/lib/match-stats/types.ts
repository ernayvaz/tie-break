export type StatsSectionState = "available" | "partial" | "unavailable";

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
  leagueName: string | null;
  leagueLogo: string | null;
  countryName: string | null;
  season: number | null;
  standing: StatsStandingSnapshot | null;
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
  currentCompetition: StatsLeagueSnapshot;
  recentDomesticMatches: StatsFixtureSection;
  recentUclMatches: StatsFixtureSection;
};

export type StatsH2HSummary = {
  totalMeetings: number;
  homeTeamWins: number;
  draws: number;
  awayTeamWins: number;
};

export type StatsH2HSection = {
  status: StatsSectionState;
  summary: StatsH2HSummary | null;
  matches: StatsMatchSummary[];
  message: string | null;
};

export type MatchStatisticsPayload = {
  status: StatsSectionState;
  syncedAt: string | null;
  note: string | null;
  h2h: StatsH2HSection;
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
    currentCompetition: createUnavailableLeagueSnapshot(
      "Current competition snapshot is not available for this team."
    ),
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
    h2h: {
      status: "unavailable",
      summary: null,
      matches: [],
      message: "No previous meetings data available.",
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
