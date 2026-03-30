import { describe, expect, it } from "vitest";
import {
  formatScoreLabel,
  getHalisahaMatchEndAt,
  getHalisahaMatchPhase,
  getHalisahaPredictionLockAt,
  getHalisahaMvpVoteEndsAt,
  isHalisahaPredictionWindowOpen,
  parseScoreLabel,
} from "@/lib/halisaha/match-state";

describe("halisaha/match-state", () => {
  const kickoffAt = new Date("2026-03-29T10:00:00.000Z");
  const matchDurationMinutes = 60;

  it("derives the match end from kickoff plus duration", () => {
    expect(
      getHalisahaMatchEndAt({
        kickoffAt,
        matchDurationMinutes,
      }).toISOString(),
    ).toBe("2026-03-29T11:00:00.000Z");
  });

  it("derives the MVP vote deadline as 24 hours after match end", () => {
    expect(
      getHalisahaMvpVoteEndsAt({
        kickoffAt,
        matchDurationMinutes,
      }).toISOString(),
    ).toBe("2026-03-30T11:00:00.000Z");
  });

  it("closes predictions exactly 5 minutes before kickoff", () => {
    expect(
      getHalisahaPredictionLockAt({
        kickoffAt,
      }).toISOString(),
    ).toBe("2026-03-29T09:55:00.000Z");

    expect(
      isHalisahaPredictionWindowOpen(
        {
          kickoffAt,
        },
        new Date("2026-03-29T09:54:59.000Z"),
      ),
    ).toBe(true);

    expect(
      isHalisahaPredictionWindowOpen(
        {
          kickoffAt,
        },
        new Date("2026-03-29T09:55:00.000Z"),
      ),
    ).toBe(false);
  });

  it("returns the expected phase before match end, during MVP voting, and after unlock", () => {
    expect(
      getHalisahaMatchPhase(
        {
          kickoffAt,
          matchDurationMinutes,
        },
        new Date("2026-03-29T10:30:00.000Z"),
      ),
    ).toBe("pre_match");

    expect(
      getHalisahaMatchPhase(
        {
          kickoffAt,
          matchDurationMinutes,
        },
        new Date("2026-03-29T14:00:00.000Z"),
      ),
    ).toBe("post_match_mvp_voting");

    expect(
      getHalisahaMatchPhase(
        {
          kickoffAt,
          matchDurationMinutes,
        },
        new Date("2026-03-30T11:00:01.000Z"),
      ),
    ).toBe("results_unlocked");
  });

  it("parses and formats exact score labels", () => {
    expect(parseScoreLabel(" 6 - 4 ")).toEqual({ home: 6, away: 4 });
    expect(parseScoreLabel("invalid")).toBeNull();
    expect(formatScoreLabel({ home: 15, away: 10 })).toBe("15-10");
  });
});
