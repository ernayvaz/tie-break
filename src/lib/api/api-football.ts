import {
  API_FOOTBALL_API_KEY,
  API_FOOTBALL_UCL_LEAGUE_ID,
  hasApiFootballApiKey,
  STATS_RECENT_MATCH_LIMIT,
  UCL_SEASON,
} from "@/lib/config";

const BASE_URL = "https://v3.football.api-sports.io";

type ApiFootballEnvelope<T> = {
  errors?: string[] | Record<string, string>;
  response?: T[];
  results?: number;
  paging?: { current: number; total: number };
};

type ApiFootballResult<T> =
  | { ok: true; data: T[] }
  | { ok: false; error: string };

export type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
      long?: string;
      elapsed?: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country?: string | null;
    logo?: string | null;
    season?: number;
    round?: string | null;
  };
  teams: {
    home: { id: number; name: string; logo?: string | null };
    away: { id: number; name: string; logo?: string | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
};

export type ApiFootballLeagueEntry = {
  league: {
    id: number;
    name: string;
    type: string;
    logo?: string | null;
  };
  country: {
    name: string;
    code?: string | null;
    flag?: string | null;
  };
  seasons: Array<{
    year: number;
    current: boolean;
    coverage?: {
      standings?: boolean;
    };
  }>;
};

export type ApiFootballStandingRecord = {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: {
    for: number;
    against: number;
  };
};

export type ApiFootballStandingEntry = {
  rank: number;
  points: number;
  goalsDiff: number;
  form?: string | null;
  description?: string | null;
  status?: string | null;
  team: {
    id: number;
    name: string;
    logo?: string | null;
  };
  all: ApiFootballStandingRecord;
  home: ApiFootballStandingRecord;
  away: ApiFootballStandingRecord;
};

export type ApiFootballStandingsResponse = {
  league: {
    id: number;
    name: string;
    logo?: string | null;
    country?: string | null;
    season: number;
    standings: ApiFootballStandingEntry[][];
  };
};

export type ApiFootballTeamSearchEntry = {
  team: {
    id: number;
    name: string;
    country?: string | null;
    logo?: string | null;
  };
};

function getErrors(errors: ApiFootballEnvelope<unknown>["errors"]): string | null {
  if (!errors) return null;
  if (Array.isArray(errors)) {
    const nonEmpty = errors.filter(Boolean);
    return nonEmpty.length > 0 ? nonEmpty.join(", ") : null;
  }
  const values = Object.values(errors).filter(Boolean);
  return values.length > 0 ? values.join(", ") : null;
}

async function apiFootballGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>
): Promise<ApiFootballResult<T>> {
  if (!hasApiFootballApiKey()) {
    return {
      ok: false,
      error: "No API_FOOTBALL_API_KEY configured.",
    };
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    searchParams.set(key, String(value));
  }

  const url = `${BASE_URL}${path}?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "x-apisports-key": API_FOOTBALL_API_KEY,
      },
      next: { revalidate: 0 },
    });

    const data = (await response.json()) as ApiFootballEnvelope<T>;
    const errorMessage = getErrors(data.errors);
    if (!response.ok || errorMessage) {
      return {
        ok: false,
        error: errorMessage || `HTTP ${response.status}`,
      };
    }

    return { ok: true, data: data.response ?? [] };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchApiFootballUclFixtures(): Promise<
  ApiFootballResult<ApiFootballFixture>
> {
  return apiFootballGet<ApiFootballFixture>("/fixtures", {
    league: API_FOOTBALL_UCL_LEAGUE_ID,
    season: Number(UCL_SEASON),
  });
}

export async function searchApiFootballTeams(
  query: string
): Promise<ApiFootballResult<ApiFootballTeamSearchEntry>> {
  return apiFootballGet<ApiFootballTeamSearchEntry>("/teams", {
    search: query,
  });
}

export async function fetchApiFootballTeamLeagues(
  teamId: number
): Promise<ApiFootballResult<ApiFootballLeagueEntry>> {
  return apiFootballGet<ApiFootballLeagueEntry>("/leagues", {
    team: teamId,
    current: true,
  });
}

export async function fetchApiFootballStandings(
  leagueId: number,
  season: number
): Promise<ApiFootballResult<ApiFootballStandingsResponse>> {
  return apiFootballGet<ApiFootballStandingsResponse>("/standings", {
    league: leagueId,
    season,
  });
}

export async function fetchApiFootballHeadToHead(
  teamAId: number,
  teamBId: number,
  last: number = STATS_RECENT_MATCH_LIMIT
): Promise<ApiFootballResult<ApiFootballFixture>> {
  return apiFootballGet<ApiFootballFixture>("/fixtures/headtohead", {
    h2h: `${teamAId}-${teamBId}`,
    last,
    status: "FT-AET-PEN",
  });
}

export async function fetchApiFootballLeagueFixtures(
  leagueId: number,
  season: number
): Promise<ApiFootballResult<ApiFootballFixture>> {
  return apiFootballGet<ApiFootballFixture>("/fixtures", {
    league: leagueId,
    season,
    status: "FT-AET-PEN",
  });
}

export async function fetchApiFootballRecentFixtures(input: {
  teamId?: number;
  leagueId: number;
  season?: number;
  last?: number;
}): Promise<ApiFootballResult<ApiFootballFixture>> {
  return apiFootballGet<ApiFootballFixture>("/fixtures", {
    team: input.teamId,
    league: input.leagueId,
    season: input.season,
    last: input.last ?? STATS_RECENT_MATCH_LIMIT,
    status: "FT-AET-PEN",
  });
}
