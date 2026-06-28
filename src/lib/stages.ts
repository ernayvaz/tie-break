/**
 * Canonical, user-facing labels for match stages. Centralised so the schedule,
 * leaderboard and admin views all render the exact same wording (e.g. LAST_32 →
 * "Round of 32", THIRD_PLACE → "Third-place play-off").
 */

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: "Group stage",
  LEAGUE_STAGE: "Group stage",
  PLAYOFFS: "Play-offs",
  LAST_32: "Round of 32",
  ROUND_32: "Round of 32",
  ROUND_16: "Round of 16",
  LAST_16: "Round of 16",
  QUARTER_FINAL: "Quarter-final",
  SEMI_FINAL: "Semi-final",
  THIRD_PLACE: "Third-place play-off",
  FINAL: "Final",
};

/** Chronological ordering for stage filters/sorting. */
export const STAGE_ORDER = [
  "GROUP_STAGE",
  "LEAGUE_STAGE",
  "PLAYOFFS",
  "LAST_32",
  "ROUND_32",
  "ROUND_16",
  "LAST_16",
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "THIRD_PLACE",
  "FINAL",
] as const;

/** Format a raw stage key into its premium, user-facing label. */
export function formatStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}
