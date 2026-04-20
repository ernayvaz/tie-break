import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireAdmin: vi.fn(),
  createAdminLog: vi.fn(),
  ensureActiveMatch: vi.fn(),
  getBaseline: vi.fn(),
  rebuildLeaderboard: vi.fn(),
  purgeArchived: vi.fn(),
  matchFindUnique: vi.fn(),
  matchUpdate: vi.fn(),
  questionFindMany: vi.fn(),
  questionOptionUpdateMany: vi.fn(),
  answerCount: vi.fn(),
  answerDeleteMany: vi.fn(),
  mvpVoteCount: vi.fn(),
  mvpVoteDeleteMany: vi.fn(),
  leaderboardDeleteMany: vi.fn(),
  mvpAwardDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/get-user", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/admin-log", () => ({
  createAdminLog: mocks.createAdminLog,
}));

vi.mock("@/lib/halisaha/server", () => ({
  buildHalisahaLeaderboardResetLogValue: (baselineRoundNumber: number) =>
    `baseline_round:${baselineRoundNumber}`,
  ensureActiveHalisahaMatch: mocks.ensureActiveMatch,
  getHalisahaLeaderboardBaselineRoundNumber: mocks.getBaseline,
  purgeArchivedHalisahaMatchesBefore: mocks.purgeArchived,
  rebuildHalisahaLeaderboardForMatch: mocks.rebuildLeaderboard,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    halisahaMatch: {
      findUnique: mocks.matchFindUnique,
      update: mocks.matchUpdate,
    },
    halisahaQuestion: {
      findMany: mocks.questionFindMany,
    },
    halisahaQuestionOption: {
      updateMany: mocks.questionOptionUpdateMany,
    },
    halisahaAnswer: {
      count: mocks.answerCount,
      deleteMany: mocks.answerDeleteMany,
    },
    halisahaMvpVote: {
      count: mocks.mvpVoteCount,
      deleteMany: mocks.mvpVoteDeleteMany,
    },
    halisahaLeaderboardRound: {
      deleteMany: mocks.leaderboardDeleteMany,
    },
    halisahaMvpRoundAward: {
      deleteMany: mocks.mvpAwardDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  adminResetMatchHalisahaAnswersAction,
  resetHalisahaLeaderboardAction,
} from "./actions";

describe("admin halisaha prediction reset actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.getBaseline.mockResolvedValue(1);
    mocks.rebuildLeaderboard.mockResolvedValue({ ok: true });
    mocks.purgeArchived.mockResolvedValue({ ok: true, deletedMatches: 0, deletedRounds: 0 });
    mocks.matchFindUnique.mockResolvedValue({
      id: "match-1",
      roundNumber: 7,
      homeTeamName: "Raynet",
      awayTeamName: "Flexera",
    });
    mocks.questionFindMany.mockResolvedValue([
      { id: "question-mvp", kind: "mvp_prediction" },
      { id: "question-standard", kind: "standard" },
    ]);
    mocks.questionOptionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.answerCount.mockResolvedValue(14);
    mocks.answerDeleteMany.mockResolvedValue({ count: 14 });
    mocks.mvpVoteCount.mockResolvedValue(6);
    mocks.mvpVoteDeleteMany.mockResolvedValue({ count: 6 });
    mocks.matchUpdate.mockResolvedValue(undefined);
    mocks.leaderboardDeleteMany.mockResolvedValue({ count: 7 });
    mocks.mvpAwardDeleteMany.mockResolvedValue({ count: 1 });
    mocks.ensureActiveMatch.mockResolvedValue({
      id: "active-1",
      roundNumber: 11,
      answersResolvedAt: null,
    });
    mocks.transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return arg({
          halisahaAnswer: {
            deleteMany: mocks.answerDeleteMany,
          },
          halisahaMvpVote: {
            deleteMany: mocks.mvpVoteDeleteMany,
          },
          halisahaMatch: {
            update: mocks.matchUpdate,
          },
          halisahaQuestionOption: {
            updateMany: mocks.questionOptionUpdateMany,
          },
          halisahaLeaderboardRound: {
            deleteMany: mocks.leaderboardDeleteMany,
          },
          halisahaMvpRoundAward: {
            deleteMany: mocks.mvpAwardDeleteMany,
          },
        });
      }
      return arg;
    });
  });

  it("resets every user input for the selected match and reopens scoring", async () => {
    const result = await adminResetMatchHalisahaAnswersAction("match-1");

    expect(result).toEqual({
      ok: true,
      message:
        "Reset 14 answer(s) and 6 MVP vote(s) for this match. Saved answer keys stay in place, but scoring is open again.",
    });
    expect(mocks.answerDeleteMany).toHaveBeenCalledWith({
      where: { matchId: "match-1" },
    });
    expect(mocks.mvpVoteDeleteMany).toHaveBeenCalledWith({
      where: { matchId: "match-1" },
    });
    expect(mocks.matchUpdate).toHaveBeenCalledWith({
      where: { id: "match-1" },
      data: {
        answersResolvedAt: null,
        mvpResolvedParticipantId: null,
        mvpResolvedAt: null,
      },
    });
    expect(mocks.questionOptionUpdateMany).toHaveBeenCalledWith({
      where: {
        questionId: {
          in: ["question-mvp"],
        },
      },
      data: {
        isCorrect: false,
      },
    });
    expect(mocks.createAdminLog).toHaveBeenCalledWith(
      "admin-1",
      "halisaha_match_answers_reset_all",
      "halisaha_match",
      "match-1",
      "Raynet vs Flexera",
      "deleted_answers:14/deleted_mvp_votes:6/round:7",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/leaderboard");
  });

  it("moves the leaderboard baseline to the next round when the active round is already resolved", async () => {
    mocks.ensureActiveMatch.mockResolvedValue({
      id: "active-1",
      roundNumber: 10,
      answersResolvedAt: new Date("2026-04-20T18:00:00.000Z"),
    });
    mocks.getBaseline.mockResolvedValue(4);

    const result = await resetHalisahaLeaderboardAction();

    expect(result).toEqual({
      ok: true,
      message:
        "Leaderboard reset. Previous totals are no longer counted, and the next Halisaha round will start from zero.",
    });
    expect(mocks.createAdminLog).toHaveBeenCalledWith(
      "admin-1",
      "halisaha_leaderboard_reset",
      "halisaha_leaderboard",
      "global",
      "baseline_round:4",
      "baseline_round:11",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/leaderboard");
  });
});
