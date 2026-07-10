import { PredictionValue } from "@prisma/client";
import { BTTS_CORRECT_POINTS, WINNER_CORRECT_POINTS } from "@/lib/config";

/** Display/API pick tokens (also used verbatim as button labels). */
export type PredictionDisplay = "1" | "X" | "2" | "BTTS Yes" | "BTTS No";

const TO_DISPLAY: Record<PredictionValue, PredictionDisplay> = {
  ONE: "1",
  X: "X",
  TWO: "2",
  BTTS_YES: "BTTS Yes",
  BTTS_NO: "BTTS No",
};

const FROM_DISPLAY: Record<PredictionDisplay, PredictionValue> = {
  "1": "ONE",
  X: "X",
  "2": "TWO",
  "BTTS Yes": "BTTS_YES",
  "BTTS No": "BTTS_NO",
};

const VALID_DISPLAYS = new Set<string>(Object.keys(FROM_DISPLAY));

export function toDisplay(value: PredictionValue): PredictionDisplay {
  return TO_DISPLAY[value];
}

export function fromDisplay(display: PredictionDisplay): PredictionValue {
  return FROM_DISPLAY[display];
}

export function isValidDisplay(s: string): s is PredictionDisplay {
  return VALID_DISPLAYS.has(s);
}

/** True for the Both-Teams-To-Score pick values (scored from the goal line, not 1/X/2). */
export function isBttsPredictionValue(value: PredictionValue): boolean {
  return value === "BTTS_YES" || value === "BTTS_NO";
}

/**
 * Base points a correct, non-boosted pick earns: BTTS Yes/No are worth more than
 * a plain 1/2 winner call. Power Pick overrides this with its own multiplier value.
 */
export function basePointsForPrediction(value: PredictionValue): number {
  return isBttsPredictionValue(value) ? BTTS_CORRECT_POINTS : WINNER_CORRECT_POINTS;
}

/** Both-teams-to-score outcome from the goal scoreline (penalty shootout excluded). */
export function bttsYesFromScore(
  homeScore: number | null | undefined,
  awayScore: number | null | undefined
): boolean | null {
  if (homeScore == null || awayScore == null) return null;
  return homeScore > 0 && awayScore > 0;
}

/**
 * Whether a finalized pick is correct for a finished match.
 *
 * - 1 / X / 2 → compares against the official winner result (incl. extra time & penalties).
 * - BTTS Yes / No → derived from the goal scoreline (both teams scored, penalties excluded).
 *   Returns false when the scoreline is unavailable so it can never be scored as correct.
 */
export function isPredictionCorrect(
  selected: PredictionValue,
  match: {
    officialResultType: PredictionValue | null;
    homeScore: number | null | undefined;
    awayScore: number | null | undefined;
  }
): boolean {
  if (isBttsPredictionValue(selected)) {
    const bttsYes = bttsYesFromScore(match.homeScore, match.awayScore);
    if (bttsYes === null) return false;
    return selected === "BTTS_YES" ? bttsYes : !bttsYes;
  }
  return match.officialResultType !== null && selected === match.officialResultType;
}
