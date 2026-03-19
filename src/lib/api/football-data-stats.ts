import {
  FOOTBALL_DATA_API_KEY,
  STATS_H2H_MATCH_LIMIT,
  STATS_RECENT_MATCH_LIMIT,
  UCL_COMPETITION_ID,
  UCL_SEASON,
  hasFootballDataApiKey,
} from "@/lib/config";

const BASE_URL = "https://api.football-data.org/v4";

type FootballDataResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type FootballDataErrorResponse = {
  error?: number;
  message?: string;
};

export type FootballDataArea = {
  id: number;
  name: string;
  code?: string | null;
  flag?: string | null;
};

export type FootballDataCompetition = {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem?: string | null;
};

export type FootballDataTeamRef = {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
};

export type FootballDataCoach = {
  id?: number;
  name?: string | null;
  nationality?: string | null;
};

type FootballDataScoreLine = {
  homeTeam?: number | null;
  awayTeam?: number | null;
  home?: number | null;
  away?: number | null;
};

export type FootballDataMatch = {
  area?: FootballDataArea;
  competition: FootballDataCompetition;
  season?: {
    id: number;
    startDate?: string;
    endDate?: string;
    currentMatchday?: number | null;
    winner?: unknown;
  };
  id: number;
  utcDate: string;
  status: string;
  matchday?: number | null;
  stage?: string;
  group?: string | null;
  lastUpdated?: string;
  homeTeam: FootballDataTeamRef;
  awayTeam: FootballDataTeamRef;
  score?: {
    winner?: "HOME_TEAM" | "AWAY_TEAM" | null;
    duration?: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
    fullTime?: FootballDataScoreLine;
    halfTime?: FootballDataScoreLine;
    regularTime?: FootballDataScoreLine;
    extraTime?: FootballDataScoreLine;
    penalties?: FootballDataScoreLine;
  };
};

export type FootballDataStandingRow = {
  position: number;
  team: FootballDataTeamRef;
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type FootballDataStanding = {
  stage?: string;
  type: string;
  group?: string | null;
  table: FootballDataStandingRow[];
};

export type FootballDataStandingsResponse = FootballDataErrorResponse & {
  filters?: Record<string, unknown>;
  area?: FootballDataArea;
  competition: FootballDataCompetition;
  season: {
    id: number;
    startDate?: string;
    endDate?: string;
    currentMatchday?: number | null;
    winner?: unknown;
  };
  standings: FootballDataStanding[];
};

export type FootballDataHeadToHeadResponse = FootballDataErrorResponse & {
  filters?: Record<string, unknown>;
  resultSet?: {
    count?: number;
    competitions?: string;
    first?: string;
    last?: string;
  };
  aggregates?: {
    numberOfMatches: number;
    totalGoals: number;
    homeTeam: {
      id: number;
      name: string;
      wins: number;
      draws: number;
      losses: number;
    };
    awayTeam: {
      id: number;
      name: string;
      wins: number;
      draws: number;
      losses: number;
    };
  };
  matches?: FootballDataMatch[];
};

export type FootballDataScorer = {
  player?: {
    id?: number;
    name?: string | null;
    position?: string | null;
    dateOfBirth?: string | null;
    nationality?: string | null;
  };
  team?: FootballDataTeamRef;
  playedMatches?: number | null;
  goals?: number | null;
  assists?: number | null;
  penalties?: number | null;
};

export type FootballDataScorersResponse = FootballDataErrorResponse & {
  competition: FootballDataCompetition;
  scorers?: FootballDataScorer[];
};

export type FootballDataTeamResponse = FootballDataErrorResponse & {
  area?: FootballDataArea;
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
  founded?: number | null;
  venue?: string | null;
  website?: string | null;
  clubColors?: string | null;
  runningCompetitions?: FootballDataCompetition[];
  coach?: FootballDataCoach | null;
  squad?: Array<{
    id?: number;
    name?: string | null;
    position?: string | null;
    dateOfBirth?: string | null;
    nationality?: string | null;
  }>;
};

type FootballDataMatchesEnvelope = FootballDataErrorResponse & {
  matches?: FootballDataMatch[];
};

type FootballDataTeamMatchesEnvelope = FootballDataErrorResponse & {
  filters?: Record<string, unknown>;
  resultSet?: Record<string, unknown>;
  matches?: FootballDataMatch[];
};

type FootballDataRequestOptions = {
  fallbackWithoutSeason?: boolean;
};

function parseRateLimitDelayMs(message: string | undefined): number | null {
  if (!message) return null;
  const match = message.match(/wait\s+(\d+)\s+seconds?/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds)) return null;
  return seconds * 1000 + 1000;
}

function buildUrl(
  path: string,
  params: Record<string, string | number | undefined>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `${BASE_URL}${path}?${query}` : `${BASE_URL}${path}`;
}

async function footballDataRequest<T extends FootballDataErrorResponse>(
  path: string,
  params: Record<string, string | number | undefined>,
  options: FootballDataRequestOptions = {}
): Promise<FootballDataResult<T>> {
  if (!hasFootballDataApiKey()) {
    return {
      ok: false,
      error: "No API key configured. Set FOOTBALL_DATA_ORG_API_KEY in .env",
    };
  }

  const headers: HeadersInit = {
    "X-Auth-Token": FOOTBALL_DATA_API_KEY,
  };

  const run = async (
    requestParams: Record<string, string | number | undefined>,
    allowRetry = true
  ): Promise<FootballDataResult<T>> => {
    const response = await fetch(buildUrl(path, requestParams), {
      headers,
      next: { revalidate: 0 },
    });

    const data = (await response.json()) as T;
    if (!response.ok) {
      const errorMessage =
        data.message || data.error?.toString() || `HTTP ${response.status}`;
      const retryDelayMs = allowRetry
        ? parseRateLimitDelayMs(errorMessage)
        : null;
      if (retryDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        return run(requestParams, false);
      }

      return {
        ok: false,
        error: errorMessage,
      };
    }

    return { ok: true, data };
  };

  try {
    const firstAttempt = await run(params);
    if (
      !firstAttempt.ok &&
      options.fallbackWithoutSeason &&
      params.season !== undefined &&
      firstAttempt.error.toLowerCase().includes("does not exist")
    ) {
      const fallbackParams = { ...params };
      delete fallbackParams.season;
      return run(fallbackParams);
    }

    return firstAttempt;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchFootballDataCompetitionMatches(
  competitionCode: string,
  options: {
    season?: string | number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    matchday?: number;
  } = {}
): Promise<FootballDataResult<FootballDataMatch[]>> {
  const response = await footballDataRequest<FootballDataMatchesEnvelope>(
    `/competitions/${competitionCode}/matches`,
    {
      season: options.season,
      status: options.status,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      matchday: options.matchday,
    },
    { fallbackWithoutSeason: true }
  );

  if (!response.ok) return response;
  return { ok: true, data: response.data.matches ?? [] };
}

export async function fetchFootballDataUclFixtures(): Promise<
  FootballDataResult<FootballDataMatch[]>
> {
  return fetchFootballDataCompetitionMatches(UCL_COMPETITION_ID, {
    season: Number(UCL_SEASON),
  });
}

export async function fetchFootballDataCompetitionStandings(
  competitionCode: string,
  season: string | number = UCL_SEASON
): Promise<FootballDataResult<FootballDataStandingsResponse>> {
  return footballDataRequest<FootballDataStandingsResponse>(
    `/competitions/${competitionCode}/standings`,
    { season },
    { fallbackWithoutSeason: true }
  );
}

export async function fetchFootballDataMatchHeadToHead(
  matchId: number,
  limit: number = STATS_H2H_MATCH_LIMIT
): Promise<FootballDataResult<FootballDataHeadToHeadResponse>> {
  return footballDataRequest<FootballDataHeadToHeadResponse>(
    `/matches/${matchId}/head2head`,
    { limit }
  );
}

export async function fetchFootballDataTeamMatches(
  teamId: number,
  options: {
    competitions?: string | string[];
    season?: string | number;
    status?: string;
    venue?: "HOME" | "AWAY";
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
  } = {}
): Promise<FootballDataResult<FootballDataMatch[]>> {
  const competitions = Array.isArray(options.competitions)
    ? options.competitions.join(",")
    : options.competitions;

  const response = await footballDataRequest<FootballDataTeamMatchesEnvelope>(
    `/teams/${teamId}/matches`,
    {
      competitions,
      season: options.season,
      status: options.status,
      venue: options.venue,
      limit: options.limit,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
    }
  );

  if (!response.ok) return response;
  return { ok: true, data: response.data.matches ?? [] };
}

export async function fetchFootballDataCompetitionScorers(
  competitionCode: string,
  options: {
    limit?: number;
  } = {}
): Promise<FootballDataResult<FootballDataScorersResponse>> {
  return footballDataRequest<FootballDataScorersResponse>(
    `/competitions/${competitionCode}/scorers`,
    {
      limit: options.limit,
    }
  );
}

export async function fetchFootballDataTeam(
  teamId: number
): Promise<FootballDataResult<FootballDataTeamResponse>> {
  return footballDataRequest<FootballDataTeamResponse>(`/teams/${teamId}`, {});
}

function readScoreLine(
  line: FootballDataScoreLine | undefined
): { home: number; away: number } | null {
  if (!line) return null;
  const home = line.homeTeam ?? line.home ?? null;
  const away = line.awayTeam ?? line.away ?? null;
  if (home == null || away == null) return null;
  return {
    home,
    away,
  };
}

export function getFootballDataScore(
  score: FootballDataMatch["score"]
): { home: number; away: number } | null {
  if (!score) return null;

  if (score.duration === "EXTRA_TIME" && score.regularTime && score.extraTime) {
    const regularTime = readScoreLine(score.regularTime);
    const extraTime = readScoreLine(score.extraTime);
    if (!regularTime || !extraTime) return null;
    return {
      home: regularTime.home + extraTime.home,
      away: regularTime.away + extraTime.away,
    };
  }

  if (
    score.duration === "PENALTY_SHOOTOUT" &&
    score.regularTime &&
    score.extraTime
  ) {
    const regularTime = readScoreLine(score.regularTime);
    const extraTime = readScoreLine(score.extraTime);
    if (!regularTime || !extraTime) return null;
    return {
      home: regularTime.home + extraTime.home,
      away: regularTime.away + extraTime.away,
    };
  }

  return readScoreLine(score.fullTime) ?? readScoreLine(score.regularTime);
}

export function getFootballDataOutcomeLabel(
  match: Pick<FootballDataMatch, "status" | "score">
): string | null {
  if (match.status !== "FINISHED") return null;
  switch (match.score?.duration) {
    case "EXTRA_TIME":
      return "After extra time";
    case "PENALTY_SHOOTOUT":
      return "Penalties";
    default:
      return "Full-time";
  }
}

export function pickRecentTeamMatches(
  matches: FootballDataMatch[],
  teamId: number,
  limit: number = STATS_RECENT_MATCH_LIMIT
): FootballDataMatch[] {
  return matches
    .filter(
      (match) =>
        match.status === "FINISHED" &&
        (match.homeTeam.id === teamId || match.awayTeam.id === teamId)
    )
    .sort(
      (a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
    )
    .slice(0, limit);
}
