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
  // Alternate 3-letter codes OpenLigaDB uses in the knockout rounds (they differ
  // from the codes above used in the group stage, e.g. Germany = GER not DEU).
  GER: "Germany",
  NED: "Netherlands",
  POR: "Portugal",
  CRO: "Croatia",
  SUI: "Switzerland",
  ALG: "Algeria",
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
 * OpenLigaDB encodes a match outcome across several `matchResults` rows, keyed by
 * `resultTypeID`:
 *   - 1  "Halbzeitergebnis"      → half-time
 *   - 2  "Endergebnis"           → score after 90 minutes
 *   - 4  "nach Verlängerung"     → score after extra time
 *   - 5  "nach Elfmeterschießen" → penalty-shootout tally
 *
 * Important quirks confirmed against real tournament data:
 *   - "Endergebnis" (id 2) is the 90-minute score, NOT the post-extra-time score.
 *     For a knockout that went to extra time the real result is id 4.
 *   - id 4 / id 5 rows are sometimes present even when the match never went to
 *     extra time / penalties — they simply duplicate the final score (noise). A
 *     shootout is only genuine when the score was level after 90/extra time, so we
 *     only trust id 5 when the base scoreline is a draw.
 *   - The post-extra-time score is CUMULATIVE (it includes the 90-minute goals),
 *     so a genuine id-4 row is never lower than the 90-minute score on either
 *     side. OpenLigaDB sometimes carries a bogus 0-0 (or otherwise smaller) id-4
 *     row for a match that was actually decided in 90 minutes (e.g. Switzerland
 *     2-0 Algeria showing a "nach Verlängerung 0-0"). Such rows are ignored and
 *     the 90-minute score is used instead.
 */
type OpenLigaDbOutcome = {
  /** Displayed goal scoreline (after extra time if played, else 90 min). */
  team1: number;
  team2: number;
  /** Overall winner including a penalty shootout; "draw" only if truly undecided. */
  winner: "team1" | "team2" | "draw";
};

function readResult(
  r: OpenLigaDbResult | undefined
): { team1: number; team2: number } | null {
  if (!r || typeof r.pointsTeam1 !== "number" || typeof r.pointsTeam2 !== "number") {
    return null;
  }
  return { team1: r.pointsTeam1, team2: r.pointsTeam2 };
}

/**
 * Resolve a match's full outcome (scoreline + winner) honoring 90 min → extra time
 * → penalties. Returns null if no usable result row exists yet.
 */
export function getOpenLigaDbOutcome(match: OpenLigaDbMatch): OpenLigaDbOutcome | null {
  const results = match.matchResults ?? [];
  if (results.length === 0) return null;

  const byType = (id: number) => results.find((r) => r.resultTypeID === id);
  const afterEtRaw = readResult(byType(4));
  const after90 = readResult(byType(2));
  const shootout = readResult(byType(5));
  const fallback = readResult(
    [...results].sort((a, b) => (b.resultOrderID ?? 0) - (a.resultOrderID ?? 0))[0]
  );

  // Guard against bogus extra-time rows: a real post-ET score is cumulative and can
  // never be lower than the 90-minute score on either side. If it is (e.g. a 0-0
  // "nach Verlängerung" after a 2-0 in 90 minutes), treat the id-4 row as noise and
  // ignore it so the 90-minute score wins.
  const afterEt =
    afterEtRaw && after90
      ? afterEtRaw.team1 >= after90.team1 && afterEtRaw.team2 >= after90.team2
        ? afterEtRaw
        : null
      : afterEtRaw;

  // Base scoreline: after extra time if it was played, else 90 min, else newest row.
  const base = afterEt ?? after90 ?? fallback;
  if (!base) return null;

  let winner: OpenLigaDbOutcome["winner"];
  if (base.team1 > base.team2) winner = "team1";
  else if (base.team2 > base.team1) winner = "team2";
  else if (shootout && shootout.team1 !== shootout.team2) {
    // Level after 90/extra time and a real shootout broke the tie.
    winner = shootout.team1 > shootout.team2 ? "team1" : "team2";
  } else {
    winner = "draw";
  }

  return { team1: base.team1, team2: base.team2, winner };
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
