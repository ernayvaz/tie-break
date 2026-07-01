import { describe, expect, it } from "vitest";
import { pointsForPrediction } from "@/lib/power-pick";
import { POWER_PICK_POINTS } from "@/lib/config";

describe("Power Pick multiplier scoring (pointsForPrediction)", () => {
  it("awards 1 point for a normal correct prediction", () => {
    expect(pointsForPrediction(true, false)).toBe(1);
  });

  it("awards 0 points for a normal incorrect prediction", () => {
    expect(pointsForPrediction(false, false)).toBe(0);
  });

  it("keeps the legacy boolean Power Pick path as x3", () => {
    expect(pointsForPrediction(true, true)).toBe(3);
    expect(pointsForPrediction(true, true)).toBe(POWER_PICK_POINTS);
    // Critical: must never be 4 points.
    expect(pointsForPrediction(true, true)).not.toBe(4);
  });

  it("awards exactly the configured multiplier for correct boosted predictions", () => {
    expect(pointsForPrediction(true, 4)).toBe(4);
    expect(pointsForPrediction(true, 5)).toBe(5);
    expect(pointsForPrediction(true, 6)).toBe(6);
    expect(pointsForPrediction(true, 10)).toBe(10);
  });

  it("awards 0 points for an incorrect Power Pick prediction", () => {
    expect(pointsForPrediction(false, true)).toBe(0);
    expect(pointsForPrediction(false, 10)).toBe(0);
  });
});
