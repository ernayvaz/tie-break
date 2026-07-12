import { describe, expect, it } from "vitest";
import { pointsForPrediction } from "@/lib/power-pick";
import { normalizePowerPickMultiplier, POWER_PICK_MULTIPLIERS, POWER_PICK_POINTS } from "@/lib/config";

describe("Power Pick multiplier scoring (pointsForPrediction)", () => {
  it("awards 1 point for a normal correct prediction", () => {
    expect(pointsForPrediction(true, false)).toBe(1);
  });

  it("uses the supplied base points for a non-boosted correct prediction", () => {
    expect(pointsForPrediction(true, false, 2)).toBe(2);
  });

  it("awards 0 points for a normal incorrect prediction", () => {
    expect(pointsForPrediction(false, false)).toBe(0);
  });

  it("keeps the legacy boolean Power Pick path at the default 3 points", () => {
    expect(pointsForPrediction(true, true)).toBe(3);
    expect(pointsForPrediction(true, true)).toBe(POWER_PICK_POINTS);
    // Critical: must never be 4 points.
    expect(pointsForPrediction(true, true)).not.toBe(4);
  });

  it("awards exactly the configured multiplier for correct boosted predictions", () => {
    expect(pointsForPrediction(true, 1)).toBe(1);
    expect(pointsForPrediction(true, 2)).toBe(2);
    expect(pointsForPrediction(true, 4)).toBe(4);
    expect(pointsForPrediction(true, 5)).toBe(5);
    expect(pointsForPrediction(true, 6)).toBe(6);
    expect(pointsForPrediction(true, 7)).toBe(7);
    expect(pointsForPrediction(true, 8)).toBe(8);
    expect(pointsForPrediction(true, 9)).toBe(9);
    expect(pointsForPrediction(true, 10)).toBe(10);
  });

  it("supports every direct Power Pick point value from 1 through 10", () => {
    expect(POWER_PICK_MULTIPLIERS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (let value = 1; value <= 10; value++) {
      expect(normalizePowerPickMultiplier(value)).toBe(value);
    }
  });

  it("does not stack base points with the Power Pick multiplier", () => {
    expect(pointsForPrediction(true, 5, 2)).toBe(5);
  });

  it("awards 0 points for an incorrect Power Pick prediction", () => {
    expect(pointsForPrediction(false, true)).toBe(0);
    expect(pointsForPrediction(false, 10)).toBe(0);
  });
});
