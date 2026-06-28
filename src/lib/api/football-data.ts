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

type FootballDataErrorResponse = ApiMatchesResponse & {
  error?: number | string;
  message?: string;
};

function compactProviderMessage(value: string) {
  const compacted = value.replace(/\s+/g, " ").trim();
  return compacted.length > 220 ? `${compacted.slice(0, 217)}...` : compacted;
}

function formatFootballDataNonJsonError(response: Response, body: string) {
  const providerMessage = compactProviderMessage(body);
  const statusLabel = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;

  return providerMessage
    ? `football-data.org returned a non-JSON response (${statusLabel}): "${providerMessage}". Check FOOTBALL_DATA_ORG_API_KEY account access, subscription limits, or competition/season permissions.`
    : `football-data.org returned an empty non-JSON response (${statusLabel}). Check FOOTBALL_DATA_ORG_API_KEY account access, subscription limits, or competition/season permissions.`;
}

async function readFootballDataResponse(response: Response): Promise<
  | { ok: true; data: FootballDataErrorResponse }
  | { ok: false; error: string }
> {
  const body = await response.text();
  if (!body.trim()) {
    return { ok: true, data: {} };
  }

  try {
    return { ok: true, data: JSON.parse(body) as FootballDataErrorResponse };
  } catch {
    return { ok: false, error: formatFootballDataNonJsonError(response, body) };
  }
}

function getFootballDataErrorMessage(response: Response, data: FootballDataErrorResponse) {
  return data.message || data.error?.toString() || `HTTP ${response.status}`;
}

function shouldRetryMatchesWithoutSeason(response: Response, errorMessage: string | undefined) {
  const normalizedMessage = errorMessage?.toLowerCase() ?? "";

  return (
    (response.status === 404 && normalizedMessage.includes("does not exist")) ||
    (response.status === 403 &&
      (normalizedMessage.includes("season") ||
        normalizedMessage.includes("restricted") ||
        normalizedMessage.includes("permission") ||
        normalizedMessage.includes("subscription")))
  );
}

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
  const urlNoSeason = `${BASE_URL}/competitions/${competitionId}/matches`;
  try {
    let res = await fetch(urlWithSeason, { headers, next: { revalidate: 0 } });
    let parsed = await readFootballDataResponse(res);
    if (!parsed.ok) {
      if (shouldRetryMatchesWithoutSeason(res, parsed.error)) {
        res = await fetch(urlNoSeason, { headers, next: { revalidate: 0 } });
        parsed = await readFootballDataResponse(res);
        if (!parsed.ok) {
          return { ok: false, error: parsed.error };
        }
        const fallbackData = parsed.data;
        if (!res.ok) {
          return { ok: false, error: getFootballDataErrorMessage(res, fallbackData) };
        }

        return { ok: true, matches: fallbackData.matches ?? [] };
      }

      return { ok: false, error: parsed.error };
    }
    let data = parsed.data;

    if (shouldRetryMatchesWithoutSeason(res, getFootballDataErrorMessage(res, data))) {
      res = await fetch(urlNoSeason, { headers, next: { revalidate: 0 } });
      parsed = await readFootballDataResponse(res);
      if (!parsed.ok) {
        return { ok: false, error: parsed.error };
      }
      data = parsed.data;
    }

    if (!res.ok) {
      return { ok: false, error: getFootballDataErrorMessage(res, data) };
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
  const home = obj.homeTeam ?? obj.home;
  const away = obj.awayTeam ?? obj.away;
  if (typeof home !== "number" || typeof away !== "number") return null;
  return { home, away };
}

/**
 * Derive 1/X/2 from API score, honoring the FULL match outcome:
 * 90 min, then extra time, then penalties decide the winner.
 *
 * - REGULAR: full-time score decides.
 * - EXTRA_TIME: 90 min + extra time aggregate decides.
 * - PENALTY_SHOOTOUT: the side that won the shootout is the winner (never X),
 *   resolved from `score.winner` first, then the `score.penalties` tally.
 *
 * API v4 uses homeTeam/awayTeam in score objects.
 */
export function getResultTypeFromScore(score: ApiMatch["score"]): "ONE" | "X" | "TWO" | null {
  if (!score) return null;

  const duration = score.duration;

  if (duration === "PENALTY_SHOOTOUT") {
    // A shootout always produces a decisive winner — it is never a draw (X).
    if (score.winner === "HOME_TEAM") return "ONE";
    if (score.winner === "AWAY_TEAM") return "TWO";
    const pens = readHomeAway(score.penalties);
    if (pens) {
      if (pens.home > pens.away) return "ONE";
      if (pens.away > pens.home) return "TWO";
    }
    return null;
  }

  let home = 0;
  let away = 0;

  if (duration === "EXTRA_TIME" && score.regularTime && score.extraTime) {
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
 * Get the home/away goal scoreline from API (90 min + extra time aggregate).
 * The penalty-shootout tally is intentionally NOT added to this scoreline — it is
 * stored as the displayed score; the 1/X/2 winner (incl. penalties) is derived by
 * getResultTypeFromScore. Returns null if not available.
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
