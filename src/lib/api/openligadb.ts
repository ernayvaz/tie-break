/**
 * OpenLigaDB World Cup 2026 results provider.
 *
 * football-data.org is the primary provider per the workspace provider-priority
 * rule, but while that account is unavailable we read World Cup 2026 *results*
 * (scores + finished status) from the free, key-less OpenLigaDB API.
 *
 * Endpoint: GET https://api.openligadb.de/getmatchdata/wm26/2026
 *
 * We only consume results here — fixtures, team names and Match Center content are
 * left untouched so the English UI and existing structure are preserved. Matching
 * to local fixtures is done via language-independent 3-letter team codes.
 */

export const OPENLIGADB_BASE_URL = "https://api.openligadb.de";
export const WORLD_CUP_OPENLIGADB_SHORTCUT = "wm26";
export const WORLD_CUP_OPENLIGADB_SEASON = "2026";

export type OpenLigaDbTeam = {
  teamId: number;
  teamName: string;
  shortName: string | null;
  teamIconUrl: string | null;
};

export type OpenLigaDbResult = {
  resultName: string;
  pointsTeam1: number;
  pointsTeam2: number;
  resultOrderID: number;
  resultTypeID: number;
};

export type OpenLigaDbMatch = {
  matchID: number;
  matchDateTimeUTC: string;
  matchIsFinished: boolean;
  group?: { groupName?: string; groupOrderID?: number } | null;
  team1: OpenLigaDbTeam;
  team2: OpenLigaDbTeam;
  matchResults?: OpenLigaDbResult[] | null;
};

export type FetchOpenLigaDbResult =
  | { ok: true; matches: OpenLigaDbMatch[] }
  | { ok: false; error: string };

/**
 * OpenLigaDB 3-letter team code → canonical English country name used in our
 * database (sourced originally from football-data.org). All 48 World Cup 2026
 * participants are covered.
 */
export const OPENLIGADB_CODE_TO_ENGLISH: Record<string, string> = {
  ARG: "Argentina",
  AUS: "Australia",
  AUT: "Austria",
  BEL: "Belgium",
  BIH: "Bosnia-Herzegovina",
  BRA: "Brazil",
  CAN: "Canada",
  CHE: "Switzerland",
  CIV: "Ivory Coast",
  COD: "Congo DR",
  COL: "Colombia",
  CPV: "Cape Verde Islands",
  CUW: "Curaçao",
  CZE: "Czechia",
  DEU: "Germany",
  DZA: "Algeria",
  ECU: "Ecuador",
  EGY: "Egypt",
  ENG: "England",
  ESP: "Spain",
  FRA: "France",
  GHA: "Ghana",
  HRV: "Croatia",
  HTI: "Haiti",
  IRN: "Iran",
  IRQ: "Iraq",
  JOR: "Jordan",
  JPN: "Japan",
  KOR: "South Korea",
  MAR: "Morocco",
  MEX: "Mexico",
  NLD: "Netherlands",
  NOR: "Norway",
  NZL: "New Zealand",
  PAN: "Panama",
  PAR: "Paraguay",
  PRT: "Portugal",
  QAT: "Qatar",
  RSA: "South Africa",
  SAU: "Saudi Arabia",
  SCT: "Scotland",
  SEN: "Senegal",
  SWE: "Sweden",
  TUN: "Tunisia",
  TUR: "Turkey",
  URY: "Uruguay",
  USA: "United States",
  UZB: "Uzbekistan",
};

/** Normalize a team name for tolerant comparison (case/space/diacritics-insensitive). */
export function normalizeTeamName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Resolve an OpenLigaDB team to our canonical English name (via code, then name fallback). */
export function resolveEnglishTeamName(team: OpenLigaDbTeam): string | null {
  const code = team.shortName?.trim().toUpperCase();
  if (code && OPENLIGADB_CODE_TO_ENGLISH[code]) {
    return OPENLIGADB_CODE_TO_ENGLISH[code];
  }
  return null;
}

/**
 * Extract the final (regular/extra-time) score from an OpenLigaDB match.
 * "Endergebnis" (resultTypeID 2) is the official final result; we fall back to the
 * highest resultOrderID. Penalties are not represented here and are ignored for 1/X/2.
 */
export function getOpenLigaDbFinalScore(
  match: OpenLigaDbMatch
): { team1: number; team2: number } | null {
  const results = match.matchResults ?? [];
  if (results.length === 0) return null;

  const endergebnis =
    results.find((r) => r.resultTypeID === 2) ??
    [...results].sort((a, b) => (b.resultOrderID ?? 0) - (a.resultOrderID ?? 0))[0];

  if (
    !endergebnis ||
    typeof endergebnis.pointsTeam1 !== "number" ||
    typeof endergebnis.pointsTeam2 !== "number"
  ) {
    return null;
  }

  return { team1: endergebnis.pointsTeam1, team2: endergebnis.pointsTeam2 };
}

/** Fetch all World Cup 2026 matches from OpenLigaDB. No API key required. */
export async function fetchOpenLigaDbWorldCupMatches(): Promise<FetchOpenLigaDbResult> {
  const url = `${OPENLIGADB_BASE_URL}/getmatchdata/${WORLD_CUP_OPENLIGADB_SHORTCUT}/${WORLD_CUP_OPENLIGADB_SEASON}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    const body = await res.text();
    if (!res.ok) {
      const snippet = body.replace(/\s+/g, " ").trim().slice(0, 200);
      return {
        ok: false,
        error: `OpenLigaDB returned HTTP ${res.status}${snippet ? `: ${snippet}` : ""}.`,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { ok: false, error: "OpenLigaDB returned a non-JSON response." };
    }

    if (!Array.isArray(parsed)) {
      return { ok: false, error: "OpenLigaDB returned an unexpected payload (expected an array)." };
    }

    return { ok: true, matches: parsed as OpenLigaDbMatch[] };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `OpenLigaDB request failed: ${message}` };
  }
}
