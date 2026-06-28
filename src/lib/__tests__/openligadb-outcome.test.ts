import { describe, it, expect } from "vitest";
import { getOpenLigaDbOutcome, type OpenLigaDbMatch } from "@/lib/api/openligadb";

function match(results: Array<[number, string, number, number, number]>): OpenLigaDbMatch {
  return {
    matchID: 1,
    matchDateTimeUTC: "2026-06-29T19:00:00Z",
    matchIsFinished: true,
    team1: { teamId: 1, teamName: "Team 1", shortName: "T1", teamIconUrl: null },
    team2: { teamId: 2, teamName: "Team 2", shortName: "T2", teamIconUrl: null },
    matchResults: results.map(([resultTypeID, resultName, pointsTeam1, pointsTeam2, resultOrderID]) => ({
      resultTypeID,
      resultName,
      pointsTeam1,
      pointsTeam2,
      resultOrderID,
    })),
  };
}

describe("getOpenLigaDbOutcome", () => {
  it("returns null when there are no results", () => {
    expect(getOpenLigaDbOutcome(match([]))).toBeNull();
  });

  it("uses the 90-minute Endergebnis for a group-stage match", () => {
    // Only half-time + final-90 rows (group stage).
    const out = getOpenLigaDbOutcome(
      match([
        [1, "Halbzeitergebnis", 1, 0, 1],
        [2, "Endergebnis", 3, 0, 2],
      ])
    );
    expect(out).toEqual({ team1: 3, team2: 0, winner: "team1" });
  });

  it("treats a 90-minute draw with no shootout as a draw", () => {
    const out = getOpenLigaDbOutcome(
      match([
        [1, "Halbzeitergebnis", 0, 0, 1],
        [2, "Endergebnis", 1, 1, 2],
      ])
    );
    expect(out).toEqual({ team1: 1, team2: 1, winner: "draw" });
  });

  it("prefers the post-extra-time score over the 90-minute score", () => {
    // 1-1 after 90, 2-1 after extra time → home (team1) wins, scoreline is 2-1.
    const out = getOpenLigaDbOutcome(
      match([
        [1, "Halbzeitergebnis", 0, 1, 1],
        [2, "Endergebnis", 1, 1, 2],
        [4, "nach Verlängerung", 2, 1, 3],
      ])
    );
    expect(out).toEqual({ team1: 2, team2: 1, winner: "team1" });
  });

  it("resolves the penalty-shootout winner when level after extra time", () => {
    // 0-0 after 90 and after ET, team1 wins shootout 3-0 → winner team1, scoreline 0-0.
    const out = getOpenLigaDbOutcome(
      match([
        [1, "Halbzeitergebnis", 0, 0, 1],
        [2, "Endergebnis", 0, 0, 2],
        [4, "nach Verlängerung", 0, 0, 3],
        [5, "nach Elfmeterschießen", 3, 0, 4],
      ])
    );
    expect(out).toEqual({ team1: 0, team2: 0, winner: "team1" });

    // Away team wins the shootout.
    const out2 = getOpenLigaDbOutcome(
      match([
        [2, "Endergebnis", 0, 0, 2],
        [4, "nach Verlängerung", 0, 0, 3],
        [5, "nach Elfmeterschießen", 3, 5, 4],
      ])
    );
    expect(out2).toEqual({ team1: 0, team2: 0, winner: "team2" });
  });

  it("ignores a spurious shootout row when the match was already decided in normal time", () => {
    // Real win 2-1 with a noisy duplicate id-5 row (no actual shootout) → still team1.
    const out = getOpenLigaDbOutcome(
      match([
        [1, "Halbzeitergebnis", 0, 1, 1],
        [2, "Endergebnis", 2, 1, 2],
        [5, "nach Elfmeterschießen", 2, 1, 4],
      ])
    );
    expect(out).toEqual({ team1: 2, team2: 1, winner: "team1" });
  });
});
