import { describe, expect, it } from "vitest";
import { WORLD_CUP_2026_COMPETITION_ID, UCL_COMPETITION_ID } from "@/lib/config";
import { isPredictionValueAllowedForMatch } from "@/lib/predictions";

describe("prediction availability rules", () => {
  it("removes X (draw) as a pick everywhere", () => {
    expect(
      isPredictionValueAllowedForMatch(
        { competitionId: WORLD_CUP_2026_COMPETITION_ID, stage: "GROUP_STAGE" },
        "X"
      )
    ).toBe(false);
    expect(
      isPredictionValueAllowedForMatch(
        { competitionId: WORLD_CUP_2026_COMPETITION_ID, stage: "FINAL" },
        "X"
      )
    ).toBe(false);
    expect(
      isPredictionValueAllowedForMatch(
        { competitionId: UCL_COMPETITION_ID, stage: "GROUP_STAGE" },
        "X"
      )
    ).toBe(false);
  });

  it("keeps 1 and 2 available for all matches", () => {
    const wc = { competitionId: WORLD_CUP_2026_COMPETITION_ID, stage: "ROUND_16" };
    const ucl = { competitionId: UCL_COMPETITION_ID, stage: "GROUP_STAGE" };
    expect(isPredictionValueAllowedForMatch(wc, "1")).toBe(true);
    expect(isPredictionValueAllowedForMatch(wc, "2")).toBe(true);
    expect(isPredictionValueAllowedForMatch(ucl, "1")).toBe(true);
    expect(isPredictionValueAllowedForMatch(ucl, "2")).toBe(true);
  });

  it("allows BTTS Yes / BTTS No for all matches", () => {
    const wcGroup = { competitionId: WORLD_CUP_2026_COMPETITION_ID, stage: "GROUP_STAGE" };
    const wcKnockout = { competitionId: WORLD_CUP_2026_COMPETITION_ID, stage: "FINAL" };
    const ucl = { competitionId: UCL_COMPETITION_ID, stage: "GROUP_STAGE" };
    for (const match of [wcGroup, wcKnockout, ucl]) {
      expect(isPredictionValueAllowedForMatch(match, "BTTS Yes")).toBe(true);
      expect(isPredictionValueAllowedForMatch(match, "BTTS No")).toBe(true);
    }
  });
});
