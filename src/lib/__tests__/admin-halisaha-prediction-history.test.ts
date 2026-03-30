import { describe, expect, it } from "vitest";
import {
  applyAdminHalisahaAnswerHistoryFilters,
  applyAdminHalisahaMvpHistoryFilters,
  buildAdminHalisahaAnswerHistorySummary,
  buildAdminHalisahaMvpHistorySummary,
  getAdminHalisahaAnswerOutcome,
  sanitizeAdminHalisahaPredictionHistoryFilters,
  type AdminHalisahaAnswerHistoryRow,
  type AdminHalisahaMvpVoteHistoryRow,
} from "@/lib/admin-halisaha-prediction-history";

const NOW = new Date("2026-03-30T12:00:00.000Z");

type AnswerRowOverrides = Omit<
  Partial<AdminHalisahaAnswerHistoryRow>,
  "match" | "user" | "question" | "selectedOption"
> & {
  match?: Partial<AdminHalisahaAnswerHistoryRow["match"]>;
  user?: Partial<AdminHalisahaAnswerHistoryRow["user"]>;
  question?: Partial<AdminHalisahaAnswerHistoryRow["question"]>;
  selectedOption?: Partial<AdminHalisahaAnswerHistoryRow["selectedOption"]>;
};

function makeAnswerRow(
  id: string,
  overrides: AnswerRowOverrides = {},
): AdminHalisahaAnswerHistoryRow {
  const {
    match: matchOverrides = {},
    user: userOverrides = {},
    question: questionOverrides = {},
    selectedOption: selectedOptionOverrides = {},
    ...rowOverrides
  } = overrides;

  return {
    id,
    userId: `user-${id}`,
    matchId: `match-${id}`,
    questionId: `question-${id}`,
    isFinal: true,
    isCorrect: true,
    awardedPoints: 2,
    createdAt: "2026-03-28T09:00:00.000Z",
    updatedAt: "2026-03-28T09:05:00.000Z",
    finalizedAt: "2026-03-28T09:01:00.000Z",
    customScoreHome: null,
    customScoreAway: null,
    match: {
      id: `match-${id}`,
      roundNumber: 3,
      title: "RayNET Matchday Show",
      homeTeamName: "Home",
      awayTeamName: "Away",
      venueName: "Venue",
      kickoffAt: "2026-03-29T18:00:00.000Z",
      answersResolvedAt: "2026-03-29T20:00:00.000Z",
      mvpResolvedAt: "2026-03-29T20:30:00.000Z",
      archivedAt: "2026-03-30T00:00:00.000Z",
      ...matchOverrides,
    },
    user: {
      id: `user-${id}`,
      name: "Ada",
      surname: "Lovelace",
      username: `ada-${id}`,
      ...userOverrides,
    },
    question: {
      id: `question-${id}`,
      prompt: "Who wins?",
      kind: "winner",
      points: 2,
      ...questionOverrides,
    },
    selectedOption: {
      id: `option-${id}`,
      label: "Home",
      kind: "standard",
      ...selectedOptionOverrides,
    },
    ...rowOverrides,
  };
}

type MvpRowOverrides = Omit<Partial<AdminHalisahaMvpVoteHistoryRow>, "match"> & {
  match?: Partial<AdminHalisahaMvpVoteHistoryRow["match"]>;
};

function makeMvpRow(
  id: string,
  overrides: MvpRowOverrides = {},
): AdminHalisahaMvpVoteHistoryRow {
  const { match: matchOverrides = {}, ...rowOverrides } = overrides;

  return {
    id,
    matchId: `match-${id}`,
    userId: `user-${id}`,
    participantId: `participant-${id}`,
    createdAt: "2026-03-29T21:00:00.000Z",
    updatedAt: "2026-03-29T21:05:00.000Z",
    voterLabel: "Ada Lovelace",
    votedForLabel: "Guest Star",
    match: {
      id: `match-${id}`,
      roundNumber: 3,
      title: "RayNET Matchday Show",
      homeTeamName: "Home",
      awayTeamName: "Away",
      venueName: "Venue",
      kickoffAt: "2026-03-29T18:00:00.000Z",
      mvpResolvedAt: "2026-03-29T22:00:00.000Z",
      archivedAt: "2026-03-30T00:00:00.000Z",
      ...matchOverrides,
    },
    ...rowOverrides,
  };
}

describe("sanitizeAdminHalisahaPredictionHistoryFilters", () => {
  it("normalizes supported filters and trims ids", () => {
    expect(
      sanitizeAdminHalisahaPredictionHistoryFilters({
        tab: " mvp ",
        matchId: " match-1 ",
        userId: " user-1 ",
        questionId: " question-1 ",
        voteTargetId: " participant-1 ",
        kind: " score_prediction ",
        status: " finalized ",
        timeline: " previous ",
        resolution: " resolved ",
        outcome: " correct ",
      }),
    ).toEqual({
      tab: "mvp",
      matchFilter: "match-1",
      userFilter: "user-1",
      questionFilter: "question-1",
      voteTargetFilter: "participant-1",
      kindFilter: "score_prediction",
      statusFilter: "finalized",
      timelineFilter: "previous",
      resolutionFilter: "resolved",
      outcomeFilter: "correct",
    });
  });
});

describe("getAdminHalisahaAnswerOutcome", () => {
  it("marks unresolved or draft answers as pending", () => {
    expect(getAdminHalisahaAnswerOutcome(makeAnswerRow("draft", { isFinal: false }))).toBe(
      "pending",
    );
    expect(
      getAdminHalisahaAnswerOutcome(makeAnswerRow("unresolved", { isCorrect: null })),
    ).toBe("pending");
  });
});

describe("applyAdminHalisahaAnswerHistoryFilters", () => {
  it("filters by previous timeline, resolved state, and incorrect outcome", () => {
    const rows = [
      makeAnswerRow("correct"),
      makeAnswerRow("incorrect", {
        isCorrect: false,
        userId: "user-b",
        user: { id: "user-b", name: "Grace", surname: "Hopper", username: "grace" },
      }),
      makeAnswerRow("upcoming", {
        matchId: "match-upcoming",
        match: {
          id: "match-upcoming",
          kickoffAt: "2026-04-02T18:00:00.000Z",
          answersResolvedAt: null,
          mvpResolvedAt: null,
          archivedAt: null,
        },
        isFinal: false,
        isCorrect: null,
        finalizedAt: null,
        awardedPoints: 0,
      }),
    ];

    const filtered = applyAdminHalisahaAnswerHistoryFilters(
      rows,
      {
        tab: "answers",
        matchFilter: "",
        userFilter: "user-b",
        questionFilter: "",
        voteTargetFilter: "",
        kindFilter: "",
        statusFilter: "all",
        timelineFilter: "previous",
        resolutionFilter: "resolved",
        outcomeFilter: "incorrect",
      },
      NOW,
    );

    expect(filtered.map((row) => row.id)).toEqual(["incorrect"]);
  });
});

describe("applyAdminHalisahaMvpHistoryFilters", () => {
  it("filters by target participant and awaiting resolution", () => {
    const rows = [
      makeMvpRow("resolved"),
      makeMvpRow("pending", {
        participantId: "participant-special",
        match: {
          id: "match-pending",
          kickoffAt: "2026-03-29T18:00:00.000Z",
          mvpResolvedAt: null,
          archivedAt: null,
        },
      }),
    ];

    const filtered = applyAdminHalisahaMvpHistoryFilters(
      rows,
      {
        tab: "mvp",
        matchFilter: "",
        userFilter: "",
        questionFilter: "",
        voteTargetFilter: "participant-special",
        kindFilter: "",
        statusFilter: "all",
        timelineFilter: "previous",
        resolutionFilter: "awaiting_resolution",
        outcomeFilter: "all",
      },
      NOW,
    );

    expect(filtered.map((row) => row.id)).toEqual(["pending"]);
  });
});

describe("history summaries", () => {
  it("builds answer and MVP summaries", () => {
    const answerSummary = buildAdminHalisahaAnswerHistorySummary(
      [
        makeAnswerRow("a"),
        makeAnswerRow("b", {
          isFinal: false,
          isCorrect: null,
          finalizedAt: null,
          awardedPoints: 0,
          match: {
            id: "match-b",
            kickoffAt: "2026-04-01T18:00:00.000Z",
            answersResolvedAt: null,
            mvpResolvedAt: null,
            archivedAt: null,
          },
        }),
      ],
      NOW,
    );
    const mvpSummary = buildAdminHalisahaMvpHistorySummary(
      [
        makeMvpRow("a"),
        makeMvpRow("b", {
          userId: "user-a",
          matchId: "match-b",
          match: {
            id: "match-b",
            kickoffAt: "2026-04-01T18:00:00.000Z",
            mvpResolvedAt: null,
            archivedAt: null,
          },
        }),
      ],
      NOW,
    );

    expect(answerSummary).toEqual({
      total: 2,
      finalized: 1,
      drafts: 1,
      previousMatches: 1,
      resolvedMatches: 1,
      correctFinalized: 1,
      uniqueUsers: 2,
      uniqueMatches: 2,
    });
    expect(mvpSummary).toEqual({
      total: 2,
      previousMatches: 1,
      resolvedMatches: 1,
      uniqueVoters: 1,
      uniqueMatches: 2,
    });
  });
});
