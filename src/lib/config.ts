/**
 * App and API configuration.
 * UEFA Champions League: football-data.org v4 uses competition code "CL" (not 2001).
 */

export const FOOTBALL_DATA_API_KEY =
  process.env.FOOTBALL_DATA_ORG_API_KEY?.trim() || "";
export const SCOREBAT_HIGHLIGHTS_API_URL =
  process.env.SCOREBAT_HIGHLIGHTS_API_URL?.trim() ||
  "https://www.scorebat.com/video-api/v3/";
/** ScoreBat Video API access token (free-feed + paid competition endpoints). */
export const SCOREBAT_API_TOKEN = process.env.SCOREBAT_API_TOKEN?.trim() || "";
/** ScoreBat competition slug for UEFA Champions League highlights feed. */
export const SCOREBAT_UCL_COMPETITION_SLUG =
  process.env.SCOREBAT_UCL_COMPETITION_SLUG?.trim() || "uefa-champions-league";
/** ScoreBat competition slug for World Cup highlights feed (paid plan). */
export const SCOREBAT_WC_COMPETITION_SLUG =
  process.env.SCOREBAT_WC_COMPETITION_SLUG?.trim() || "international-world-cup";

export function hasScoreBatApiToken(): boolean {
  return SCOREBAT_API_TOKEN.length > 0;
}

export const UCL_COMPETITION_ID = "CL";
export const WORLD_CUP_2026_COMPETITION_ID = "WC";
/** Legacy bucket kept for older non-UCL data; new World Cup rows use `WC`. */
export const OTHER_COMPETITION_ID = "OTHER";
// UCL season: 2025 = 2025/26 (current season per UEFA)
export const UCL_SEASON = "2025";
export const WORLD_CUP_2026_SEASON = "2026";
export const DEFAULT_COMPETITION_ID = WORLD_CUP_2026_COMPETITION_ID;
export const COMPETITIONS = [
  {
    id: WORLD_CUP_2026_COMPETITION_ID,
    label: "World Cup 2026",
    shortLabel: "WC 2026",
    season: WORLD_CUP_2026_SEASON,
  },
  {
    id: UCL_COMPETITION_ID,
    label: "UEFA Champions League 2026",
    shortLabel: "UCL",
    season: UCL_SEASON,
  },
] as const;
export const COMPETITION_IDS = COMPETITIONS.map((competition) => competition.id);
/** Power Pick x3: number of rights granted per admin "package". */
export const POWER_PICK_PACKAGE_SIZE = 3;
/** Power Pick x3: hard ceiling on how many rights a single user can hold. */
export const POWER_PICK_MAX_PER_USER = 10;
/** Power Pick x3: total points awarded for a correct boosted prediction (replaces the normal 1). */
export const POWER_PICK_POINTS = 3;
/** Power Pick x3 is only offered on the World Cup competition. */
export const POWER_PICK_COMPETITION_ID = WORLD_CUP_2026_COMPETITION_ID;

// Match Center bulk-sync window. Kept tight (15 days back + 15 days ahead) so each
// background/admin stats sync only writes JSON for fixtures that are actually
// relevant, which keeps database write/read transfer (egress) well under quota.
export const STATS_SYNC_LOOKBACK_DAYS = 15;
export const STATS_SYNC_LOOKAHEAD_DAYS = 15;
export const STATS_RECENT_MATCH_LIMIT = 5;
export const STATS_H2H_MATCH_LIMIT = 100;

export function hasFootballDataApiKey(): boolean {
  return FOOTBALL_DATA_API_KEY.length > 0;
}

export function isConfiguredCompetitionId(
  competitionId: string | null | undefined,
): competitionId is (typeof COMPETITIONS)[number]["id"] {
  return COMPETITIONS.some((competition) => competition.id === competitionId);
}

export function normalizeCompetitionId(
  competitionId: string | null | undefined,
) {
  return isConfiguredCompetitionId(competitionId)
    ? competitionId
    : DEFAULT_COMPETITION_ID;
}

export function getCompetitionLabel(competitionId: string | null | undefined) {
  return (
    COMPETITIONS.find((competition) => competition.id === competitionId)?.label ??
    competitionId ??
    "Unknown competition"
  );
}
