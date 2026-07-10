import { describe, it, expect } from "vitest";
import type { PredictionValue } from "@prisma/client";
import {
  toDisplay,
  fromDisplay,
  isValidDisplay,
  isBttsPredictionValue,
  basePointsForPrediction,
  bttsYesFromScore,
  isPredictionCorrect,
  type PredictionDisplay,
} from "@/lib/prediction-values";

describe("prediction-values", () => {
  describe("toDisplay", () => {
    it("maps enum values to labels", () => {
      expect(toDisplay("ONE" as PredictionValue)).toBe("1");
      expect(toDisplay("X" as PredictionValue)).toBe("X");
      expect(toDisplay("TWO" as PredictionValue)).toBe("2");
      expect(toDisplay("BTTS_YES" as PredictionValue)).toBe("BTTS Yes");
      expect(toDisplay("BTTS_NO" as PredictionValue)).toBe("BTTS No");
    });
  });

  describe("fromDisplay", () => {
    it("maps labels to enum values", () => {
      expect(fromDisplay("1")).toBe("ONE");
      expect(fromDisplay("X")).toBe("X");
      expect(fromDisplay("2")).toBe("TWO");
      expect(fromDisplay("BTTS Yes")).toBe("BTTS_YES");
      expect(fromDisplay("BTTS No")).toBe("BTTS_NO");
    });
  });

  describe("round-trip", () => {
    it("fromDisplay(toDisplay(v)) === v for all PredictionValue", () => {
      const values: PredictionValue[] = [
        "ONE",
        "X",
        "TWO",
        "BTTS_YES",
        "BTTS_NO",
      ] as PredictionValue[];
      for (const v of values) {
        expect(fromDisplay(toDisplay(v))).toBe(v);
      }
    });
    it("toDisplay(fromDisplay(d)) === d for all PredictionDisplay", () => {
      const displays: PredictionDisplay[] = ["1", "X", "2", "BTTS Yes", "BTTS No"];
      for (const d of displays) {
        expect(toDisplay(fromDisplay(d) as PredictionValue)).toBe(d);
      }
    });
  });

  describe("isValidDisplay", () => {
    it("returns true for every valid pick token", () => {
      expect(isValidDisplay("1")).toBe(true);
      expect(isValidDisplay("X")).toBe(true);
      expect(isValidDisplay("2")).toBe(true);
      expect(isValidDisplay("BTTS Yes")).toBe(true);
      expect(isValidDisplay("BTTS No")).toBe(true);
    });
    it("returns false for other strings", () => {
      expect(isValidDisplay("")).toBe(false);
      expect(isValidDisplay("ONE")).toBe(false);
      expect(isValidDisplay("x")).toBe(false);
      expect(isValidDisplay("3")).toBe(false);
      expect(isValidDisplay(" 1")).toBe(false);
      expect(isValidDisplay("BTTS_YES")).toBe(false);
      expect(isValidDisplay("btts yes")).toBe(false);
    });
  });

  describe("isBttsPredictionValue", () => {
    it("detects BTTS values only", () => {
      expect(isBttsPredictionValue("BTTS_YES" as PredictionValue)).toBe(true);
      expect(isBttsPredictionValue("BTTS_NO" as PredictionValue)).toBe(true);
      expect(isBttsPredictionValue("ONE" as PredictionValue)).toBe(false);
      expect(isBttsPredictionValue("X" as PredictionValue)).toBe(false);
    });
  });

  describe("basePointsForPrediction", () => {
    it("awards 1 base point for winner picks and 2 for BTTS picks", () => {
      expect(basePointsForPrediction("ONE" as PredictionValue)).toBe(1);
      expect(basePointsForPrediction("TWO" as PredictionValue)).toBe(1);
      expect(basePointsForPrediction("X" as PredictionValue)).toBe(1);
      expect(basePointsForPrediction("BTTS_YES" as PredictionValue)).toBe(2);
      expect(basePointsForPrediction("BTTS_NO" as PredictionValue)).toBe(2);
    });
  });

  describe("bttsYesFromScore", () => {
    it("is yes only when both teams scored", () => {
      expect(bttsYesFromScore(2, 1)).toBe(true);
      expect(bttsYesFromScore(1, 1)).toBe(true);
      expect(bttsYesFromScore(2, 0)).toBe(false);
      expect(bttsYesFromScore(0, 0)).toBe(false);
    });
    it("returns null when a score is missing", () => {
      expect(bttsYesFromScore(null, 1)).toBeNull();
      expect(bttsYesFromScore(2, null)).toBeNull();
      expect(bttsYesFromScore(undefined, undefined)).toBeNull();
    });
  });

  describe("isPredictionCorrect", () => {
    const v = (s: string) => s as PredictionValue;

    it("scores 1/2 against the official winner result", () => {
      const match = { officialResultType: v("ONE"), homeScore: 2, awayScore: 1 };
      expect(isPredictionCorrect(v("ONE"), match)).toBe(true);
      expect(isPredictionCorrect(v("TWO"), match)).toBe(false);
    });

    it("a penalty-shootout winner counts as 1/2, not a draw", () => {
      // Goals level 1-1 (both scored) but the official result is a decisive winner.
      const match = { officialResultType: v("TWO"), homeScore: 1, awayScore: 1 };
      expect(isPredictionCorrect(v("TWO"), match)).toBe(true);
      expect(isPredictionCorrect(v("ONE"), match)).toBe(false);
    });

    it("scores BTTS from goals, ignoring the winner and shootout", () => {
      const bothScored = { officialResultType: v("TWO"), homeScore: 1, awayScore: 1 };
      expect(isPredictionCorrect(v("BTTS_YES"), bothScored)).toBe(true);
      expect(isPredictionCorrect(v("BTTS_NO"), bothScored)).toBe(false);

      const oneScored = { officialResultType: v("ONE"), homeScore: 2, awayScore: 0 };
      expect(isPredictionCorrect(v("BTTS_YES"), oneScored)).toBe(false);
      expect(isPredictionCorrect(v("BTTS_NO"), oneScored)).toBe(true);

      const goalless = { officialResultType: v("X"), homeScore: 0, awayScore: 0 };
      expect(isPredictionCorrect(v("BTTS_NO"), goalless)).toBe(true);
      expect(isPredictionCorrect(v("BTTS_YES"), goalless)).toBe(false);
    });

    it("BTTS is never correct when the scoreline is unavailable", () => {
      const noScore = { officialResultType: v("ONE"), homeScore: null, awayScore: null };
      expect(isPredictionCorrect(v("BTTS_YES"), noScore)).toBe(false);
      expect(isPredictionCorrect(v("BTTS_NO"), noScore)).toBe(false);
    });
  });
});
