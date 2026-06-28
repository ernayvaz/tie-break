import { describe, expect, it } from "vitest";
import { WORLD_CUP_2026_COMPETITION_ID, UCL_COMPETITION_ID } from "@/lib/config";
import { isPredictionValueAllowedForMatch } from "@/lib/predictions";

describe("prediction availability rules", () => {
  it("allows X in World Cup group-stage matches", () => {
    expect(
      isPredictionValueAllowedForMatch(
        { competitionId: WORLD_CUP_2026_COMPETITION_ID, stage: "GROUP_STAGE" },
        "X"
      )
    ).toBe(true);
  });

  it("removes X from World Cup knockout matches", () => {
    expect(
      isPredictionValueAllowedForMatch(
        { competitionId: WORLD_CUP_2026_COMPETITION_ID, stage: "LAST_32" },
        "X"
      )
    ).toBe(false);
    expect(
      isPredictionValueAllowedForMatch(
        { competitionId: WORLD_CUP_2026_COMPETITION_ID, stage: "FINAL" },
        "X"
      )
    ).toBe(false);
  });

  it("keeps 1 and 2 available for World Cup knockout matches", () => {
    const match = { competitionId: WORLD_CUP_2026_COMPETITION_ID, stage: "ROUND_16" };
    expect(isPredictionValueAllowedForMatch(match, "1")).toBe(true);
    expect(isPredictionValueAllowedForMatch(match, "2")).toBe(true);
  });

  it("does not affect non-World-Cup competitions", () => {
    expect(
      isPredictionValueAllowedForMatch(
        { competitionId: UCL_COMPETITION_ID, stage: "FINAL" },
        "X"
      )
    ).toBe(true);
  });
});
