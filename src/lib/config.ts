/**
 * App and API configuration.
 * UEFA Champions League: football-data.org v4 uses competition code "CL" (not 2001).
 */

export const FOOTBALL_DATA_API_KEY =
  process.env.FOOTBALL_DATA_ORG_API_KEY?.trim() || "";

export const UCL_COMPETITION_ID = "CL";
/** Competition id for "Diğer" (other leagues) tab; used in leaderboard and predictions. */
export const OTHER_COMPETITION_ID = "OTHER";
// UCL season: 2025 = 2025/26 (current season per UEFA)
export const UCL_SEASON = "2025";

export function hasFootballDataApiKey(): boolean {
  return FOOTBALL_DATA_API_KEY.length > 0;
}
