import { describe, expect, it } from "vitest";
import { pointsForPrediction } from "@/lib/power-pick";
import { POWER_PICK_POINTS } from "@/lib/config";

describe("Power Pick x3 scoring (pointsForPrediction)", () => {
  it("awards 1 point for a normal correct prediction", () => {
    expect(pointsForPrediction(true, false)).toBe(1);
  });

  it("awards 0 points for a normal incorrect prediction", () => {
    expect(pointsForPrediction(false, false)).toBe(0);
  });

  it("awards exactly 3 points for a correct Power Pick x3 prediction (never 1 + 3)", () => {
    expect(pointsForPrediction(true, true)).toBe(3);
    expect(pointsForPrediction(true, true)).toBe(POWER_PICK_POINTS);
    // Critical: must never be 4 points.
    expect(pointsForPrediction(true, true)).not.toBe(4);
  });

  it("awards 0 points for an incorrect Power Pick x3 prediction", () => {
    expect(pointsForPrediction(false, true)).toBe(0);
  });
});
