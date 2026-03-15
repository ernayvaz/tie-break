import { hasFootballDataApiKey } from "@/lib/config";

const BASE_URL = "https://api.football-data.org/v4";

export type ApiMatch = {
  id: number;
  utcDate: string;
  status: string;
  stage?: string;
  homeTeam: { id: number; name: string; shortName?: string; crest?: string };
  awayTeam: { id: number; name: string; shortName?: string; crest?: string };
  score?: {
    fullTime?: { homeTeam: number | null; awayTeam: number | null };
    halfTime?: { homeTeam: number | null; awayTeam: number | null };
    regularTime?: { homeTeam: number | null; awayTeam: number | null };
    extraTime?: { homeTeam: number | null; awayTeam: number | null };
    penalties?: { homeTeam: number | null; awayTeam: number | null };
    duration?: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
    winner?: "HOME_TEAM" | "AWAY_TEAM" | null;
  };
};

export type ApiMatchesResponse = {
  matches?: ApiMatch[];
  message?: string;
};

export type FetchMatchesResult =
  | { ok: true; matches: ApiMatch[] }
  | { ok: false; error: string };

/**
 * Fetch UEFA Champions League matches from football-data.org.
 * Result is based on 90 min + extra time only; penalties are ignored for 1/X/2.
 */
export async function fetchUclMatches(
  competitionId: string,
  season: string
): Promise<FetchMatchesResult> {
  if (!hasFootballDataApiKey()) {
    return { ok: false, error: "No API key configured. Set FOOTBALL_DATA_ORG_API_KEY in .env" };
  }

  const headers: HeadersInit = {
    "X-Auth-Token": process.env.FOOTBALL_DATA_ORG_API_KEY!.trim(),
  };

  // Try with season first; if 404, try without season (some plans return current season by default)
  const urlWithSeason = `${BASE_URL}/competitions/${competitionId}/matches?season=${season}`;
  try {
    let res = await fetch(urlWithSeason, { headers, next: { revalidate: 0 } });
    let data = (await res.json()) as ApiMatchesResponse & { error?: number; message?: string };

    if (res.status === 404 && data.message?.toLowerCase().includes("does not exist")) {
      const urlNoSeason = `${BASE_URL}/competitions/${competitionId}/matches`;
      res = await fetch(urlNoSeason, { headers, next: { revalidate: 0 } });
      data = (await res.json()) as ApiMatchesResponse & { error?: number; message?: string };
    }

    if (!res.ok) {
      const msg = data.message || data.error?.toString() || `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    const matches = data.matches ?? [];
    return { ok: true, matches };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/** Read home/away from API score node (supports homeTeam/awayTeam and legacy home/away) */
function readHomeAway(obj: { homeTeam?: number | null; awayTeam?: number | null; home?: number | null; away?: number | null } | undefined): { home: number; away: number } | null {
  if (!obj) return null;
  const home = obj.homeTeam ?? (obj as { home?: number | null }).home ?? 0;
  const away = obj.awayTeam ?? (obj as { away?: number | null }).away ?? 0;
  return { home, away };
}

/**
 * Derive 1/X/2 from API score. Uses 90 min + extra time only; penalties ignored.
 * API v4 uses homeTeam/awayTeam in score objects.
 */
export function getResultTypeFromScore(score: ApiMatch["score"]): "ONE" | "X" | "TWO" | null {
  if (!score) return null;

  const duration = score.duration;
  let home = 0;
  let away = 0;

  if (duration === "EXTRA_TIME" && score.regularTime && score.extraTime) {
    const rt = readHomeAway(score.regularTime);
    const et = readHomeAway(score.extraTime);
    if (rt && et) {
      home = rt.home + et.home;
      away = rt.away + et.away;
    } else return null;
  } else if (duration === "PENALTY_SHOOTOUT" && score.regularTime && score.extraTime) {
    const rt = readHomeAway(score.regularTime);
    const et = readHomeAway(score.extraTime);
    if (rt && et) {
      home = rt.home + et.home;
      away = rt.away + et.away;
    } else return null;
  } else {
    const ft = readHomeAway(score.fullTime);
    if (ft) {
      home = ft.home;
      away = ft.away;
    } else return null;
  }

  if (home > away) return "ONE";
  if (away > home) return "TWO";
  return "X";
}

/**
 * Get home/away score from API (90 min + extra time only). Returns null if not available.
 * API v4 uses homeTeam/awayTeam in score objects.
 */
export function getScoreFromApi(score: ApiMatch["score"]): { home: number; away: number } | null {
  if (!score) return null;
  const duration = score.duration;
  let home = 0;
  let away = 0;
  if (duration === "EXTRA_TIME" && score.regularTime && score.extraTime) {
    const rt = readHomeAway(score.regularTime);
    const et = readHomeAway(score.extraTime);
    if (rt && et) {
      home = rt.home + et.home;
      away = rt.away + et.away;
      return { home, away };
    }
    return null;
  }
  if (duration === "PENALTY_SHOOTOUT" && score.regularTime && score.extraTime) {
    const rt = readHomeAway(score.regularTime);
    const et = readHomeAway(score.extraTime);
    if (rt && et) {
      home = rt.home + et.home;
      away = rt.away + et.away;
      return { home, away };
    }
    return null;
  }
  const ft = readHomeAway(score.fullTime);
  if (ft) return ft;
  const ht = readHomeAway(score.halfTime);
  if (ht) return ht;
  return null;
}
