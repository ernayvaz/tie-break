import { describe, it, expect } from "vitest";
import type { PredictionValue } from "@prisma/client";
import {
  toDisplay,
  fromDisplay,
  isValidDisplay,
  type PredictionDisplay,
} from "@/lib/prediction-values";

describe("prediction-values", () => {
  describe("toDisplay", () => {
    it("maps ONE -> 1, X -> X, TWO -> 2", () => {
      expect(toDisplay("ONE" as PredictionValue)).toBe("1");
      expect(toDisplay("X" as PredictionValue)).toBe("X");
      expect(toDisplay("TWO" as PredictionValue)).toBe("2");
    });
  });

  describe("fromDisplay", () => {
    it("maps 1 -> ONE, X -> X, 2 -> TWO", () => {
      expect(fromDisplay("1")).toBe("ONE");
      expect(fromDisplay("X")).toBe("X");
      expect(fromDisplay("2")).toBe("TWO");
    });
  });

  describe("round-trip", () => {
    it("fromDisplay(toDisplay(v)) === v for all PredictionValue", () => {
      const values: PredictionValue[] = ["ONE", "X", "TWO"];
      for (const v of values) {
        expect(fromDisplay(toDisplay(v))).toBe(v);
      }
    });
    it("toDisplay(fromDisplay(d)) === d for all PredictionDisplay", () => {
      const displays: PredictionDisplay[] = ["1", "X", "2"];
      for (const d of displays) {
        expect(toDisplay(fromDisplay(d) as PredictionValue)).toBe(d);
      }
    });
  });

  describe("isValidDisplay", () => {
    it("returns true for 1, X, 2", () => {
      expect(isValidDisplay("1")).toBe(true);
      expect(isValidDisplay("X")).toBe(true);
      expect(isValidDisplay("2")).toBe(true);
    });
    it("returns false for other strings", () => {
      expect(isValidDisplay("")).toBe(false);
      expect(isValidDisplay("ONE")).toBe(false);
      expect(isValidDisplay("x")).toBe(false);
      expect(isValidDisplay("3")).toBe(false);
      expect(isValidDisplay(" 1")).toBe(false);
    });
  });
});
