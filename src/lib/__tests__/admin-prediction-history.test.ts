import { describe, expect, it } from "vitest";
import {
  applyAdminPredictionHistoryFilters,
  buildAdminPredictionHistorySummary,
  getAdminPredictionOutcome,
  sanitizeAdminPredictionHistoryFilters,
  type AdminPredictionHistoryRow,
} from "@/lib/admin-prediction-history";

const NOW = new Date("2026-03-30T12:00:00.000Z");

type PredictionRowOverrides = Omit<Partial<AdminPredictionHistoryRow>, "match" | "user"> & {
  match?: Partial<AdminPredictionHistoryRow["match"]>;
  user?: Partial<AdminPredictionHistoryRow["user"]>;
};

function makeRow(
  id: string,
  overrides: PredictionRowOverrides = {}
): AdminPredictionHistoryRow {
  const { match: matchOverrides, user: userOverrides, ...rowOverrides } = overrides;

  return {
    id,
    userId: `user-${id}`,
    matchId: `match-${id}`,
    selectedPrediction: "ONE",
    isFinal: true,
    createdAt: "2026-03-28T09:00:00.000Z",
    updatedAt: "2026-03-28T09:30:00.000Z",
    finalizedAt: "2026-03-28T09:10:00.000Z",
    awardedPoints: 1,
    match: {
      id: `match-${id}`,
      competitionId: "CL",
      stage: "QUARTER_FINAL",
      matchDatetime: "2026-03-29T18:00:00.000Z",
      lockAt: "2026-03-29T17:55:00.000Z",
      homeTeamName: "Home",
      awayTeamName: "Away",
      officialResultType: "ONE",
      homeScore: 2,
      awayScore: 1,
      ...matchOverrides,
    },
    user: {
      id: `user-${id}`,
      name: "Ada",
      surname: "Lovelace",
      username: `ada-${id}`,
      ...userOverrides,
    },
    ...rowOverrides,
  };
}

describe("sanitizeAdminPredictionHistoryFilters", () => {
  it("falls back to defaults for invalid enums and trims IDs", () => {
    expect(
      sanitizeAdminPredictionHistoryFilters({
        league: "bad",
        status: "oops",
        timeline: "  previous ",
        result: "nah",
        outcome: " incorrect ",
        matchId: " match-1 ",
        userId: " user-9 ",
      })
    ).toEqual({
      leagueFilter: "",
      statusFilter: "all",
      timelineFilter: "previous",
      resultFilter: "all",
      outcomeFilter: "incorrect",
      matchFilter: "match-1",
      userFilter: "user-9",
    });
  });

  it("accepts configured World Cup filters", () => {
    expect(
      sanitizeAdminPredictionHistoryFilters({
        league: "WC",
      }).leagueFilter
    ).toBe("WC");
  });
});

describe("getAdminPredictionOutcome", () => {
  it("returns pending for drafts or matches without a result", () => {
    expect(getAdminPredictionOutcome(makeRow("draft", { isFinal: false }))).toBe(
      "pending"
    );
    expect(
      getAdminPredictionOutcome(
        makeRow("no-result", {
          match: { officialResultType: null },
        })
      )
    ).toBe("pending");
  });

  it("returns correct or incorrect for finalized completed matches", () => {
    expect(getAdminPredictionOutcome(makeRow("correct"))).toBe("correct");
    expect(
      getAdminPredictionOutcome(
        makeRow("incorrect", {
          selectedPrediction: "TWO",
        })
      )
    ).toBe("incorrect");
  });
});

describe("applyAdminPredictionHistoryFilters", () => {
  const rows = [
    makeRow("correct"),
    makeRow("incorrect", {
      userId: "user-b",
      user: { id: "user-b", username: "b", name: "Grace", surname: "Hopper" },
      selectedPrediction: "TWO",
    }),
    makeRow("pending", {
      matchId: "match-pending",
      match: {
        id: "match-pending",
        matchDatetime: "2026-04-02T18:00:00.000Z",
        officialResultType: null,
        homeScore: null,
        awayScore: null,
      },
      finalizedAt: null,
      isFinal: false,
      awardedPoints: 0,
    }),
    makeRow("world-cup", {
      matchId: "match-wc",
      match: {
        id: "match-wc",
        competitionId: "WC",
      },
    }),
  ];

  it("filters previous completed history for one user", () => {
    const filtered = applyAdminPredictionHistoryFilters(
      rows,
      {
        leagueFilter: "",
        matchFilter: "",
        userFilter: "user-b",
        statusFilter: "all",
        timelineFilter: "previous",
        resultFilter: "completed",
        outcomeFilter: "all",
      },
      NOW
    );

    expect(filtered.map((row) => row.id)).toEqual(["incorrect"]);
  });

  it("supports outcome and league filters together", () => {
    const filtered = applyAdminPredictionHistoryFilters(
      rows,
      {
        leagueFilter: "CL",
        matchFilter: "",
        userFilter: "",
        statusFilter: "all",
        timelineFilter: "all",
        resultFilter: "all",
        outcomeFilter: "pending",
      },
      NOW
    );

    expect(filtered.map((row) => row.id)).toEqual(["pending"]);
  });

  it("filters World Cup rows by dedicated competition id", () => {
    const filtered = applyAdminPredictionHistoryFilters(
      rows,
      {
        leagueFilter: "WC",
        matchFilter: "",
        userFilter: "",
        statusFilter: "all",
        timelineFilter: "all",
        resultFilter: "all",
        outcomeFilter: "all",
      },
      NOW
    );

    expect(filtered.map((row) => row.id)).toEqual(["world-cup"]);
  });
});

describe("buildAdminPredictionHistorySummary", () => {
  it("counts finalized, previous, completed, and correct rows", () => {
    const summary = buildAdminPredictionHistorySummary(
      [
        makeRow("a"),
        makeRow("b", {
          userId: "user-a",
          user: { id: "user-a", name: "Ada", surname: "Lovelace", username: "ada" },
          selectedPrediction: "TWO",
        }),
        makeRow("c", {
          isFinal: false,
          finalizedAt: null,
          awardedPoints: 0,
          match: {
            id: "match-c",
            matchDatetime: "2026-04-01T18:00:00.000Z",
            officialResultType: null,
            homeScore: null,
            awayScore: null,
          },
        }),
      ],
      NOW
    );

    expect(summary).toEqual({
      total: 3,
      finalized: 2,
      drafts: 1,
      previousMatches: 2,
      completedMatches: 2,
      correctFinalized: 1,
      uniqueUsers: 2,
      uniqueMatches: 3,
    });
  });
});
