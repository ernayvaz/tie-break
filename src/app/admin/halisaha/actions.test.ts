import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireAdmin: vi.fn(),
  createAdminLog: vi.fn(),
  questionFindUnique: vi.fn(),
  questionFindMany: vi.fn(),
  questionAggregate: vi.fn(),
  questionCreate: vi.fn(),
  questionUpdate: vi.fn(),
  questionOptionDeleteMany: vi.fn(),
  questionOptionCreateMany: vi.fn(),
  questionOptionUpdateMany: vi.fn(),
  answerDeleteMany: vi.fn(),
  answerUpdateMany: vi.fn(),
  participantDeleteMany: vi.fn(),
  matchFindUnique: vi.fn(),
  matchUpdate: vi.fn(),
  leaderboardDeleteMany: vi.fn(),
  mvpAwardDeleteMany: vi.fn(),
  transaction: vi.fn(),
  ensureActiveMatch: vi.fn(),
  syncWinnerQuestion: vi.fn(),
  syncMvpQuestion: vi.fn(),
  syncPlayerQuestions: vi.fn(),
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
  archiveHalisahaMatchForNextRound: vi.fn(),
  ensureActiveHalisahaMatch: mocks.ensureActiveMatch,
  resolveHalisahaMvpFromVotes: vi.fn(),
  scoreHalisahaAnswers: vi.fn(),
  syncHalisahaPlayerPredictionQuestions: mocks.syncPlayerQuestions,
  syncHalisahaMvpPredictionQuestion: mocks.syncMvpQuestion,
  syncHalisahaWinnerQuestion: mocks.syncWinnerQuestion,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    halisahaQuestion: {
      findUnique: mocks.questionFindUnique,
      findMany: mocks.questionFindMany,
      aggregate: mocks.questionAggregate,
      create: mocks.questionCreate,
      update: mocks.questionUpdate,
    },
    halisahaQuestionOption: {
      deleteMany: mocks.questionOptionDeleteMany,
      createMany: mocks.questionOptionCreateMany,
      updateMany: mocks.questionOptionUpdateMany,
    },
    halisahaAnswer: {
      deleteMany: mocks.answerDeleteMany,
      updateMany: mocks.answerUpdateMany,
    },
    halisahaParticipant: {
      deleteMany: mocks.participantDeleteMany,
    },
    halisahaMatch: {
      findUnique: mocks.matchFindUnique,
      update: mocks.matchUpdate,
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
  clearHalisahaParticipantsAction,
  createHalisahaQuestionAction,
  setHalisahaMatchPublishedAction,
  updateHalisahaQuestionAction,
} from "./actions";

describe("admin halisaha question actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.questionAggregate.mockResolvedValue({ _max: { sortOrder: 20 } });
    mocks.questionCreate.mockResolvedValue({ id: "question-2" });
    mocks.questionUpdate.mockResolvedValue(undefined);
    mocks.questionOptionDeleteMany.mockResolvedValue({ count: 2 });
    mocks.questionOptionCreateMany.mockResolvedValue({ count: 3 });
    mocks.questionOptionUpdateMany.mockResolvedValue({ count: 0 });
    mocks.answerDeleteMany.mockResolvedValue({ count: 2 });
    mocks.answerUpdateMany.mockResolvedValue({ count: 2 });
    mocks.participantDeleteMany.mockResolvedValue({ count: 2 });
    mocks.ensureActiveMatch.mockResolvedValue({
      id: "match-1",
      isPublishedToUsers: false,
    });
    mocks.matchFindUnique.mockResolvedValue({ roundNumber: 1 });
    mocks.matchUpdate.mockResolvedValue(undefined);
    mocks.questionFindMany.mockResolvedValue([{ id: "question-1", kind: "standard" }]);
    mocks.leaderboardDeleteMany.mockResolvedValue({ count: 1 });
    mocks.mvpAwardDeleteMany.mockResolvedValue({ count: 0 });
    mocks.transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return arg({
          halisahaQuestion: {
            update: mocks.questionUpdate,
          },
          halisahaQuestionOption: {
            deleteMany: mocks.questionOptionDeleteMany,
            createMany: mocks.questionOptionCreateMany,
          },
          halisahaAnswer: {
            deleteMany: mocks.answerDeleteMany,
          },
        });
      }
      return arg;
    });
  });

  it("replaces option sets by clearing existing answers for that question", async () => {
    mocks.questionFindUnique.mockResolvedValue({
      id: "question-1",
      kind: "standard",
      prompt: "Old question?",
      points: 1,
      sortOrder: 20,
      matchId: "match-1",
      match: {
        id: "match-1",
        homeTeamName: "Home",
        awayTeamName: "Away",
      },
      options: [
        { id: "opt-1", label: "Old A", kind: "standard" },
        { id: "opt-2", label: "Old B", kind: "standard" },
      ],
      answers: [{ id: "answer-1" }],
    });

    const result = await updateHalisahaQuestionAction("question-1", {
      kind: "standard",
      prompt: "Updated question?",
      points: 3,
      options: ["New A", "New B", "New C"],
      isActive: true,
    });

    expect(result).toEqual({
      ok: true,
      message:
        "Question updated. Existing answers for this question were cleared because the option set changed.",
    });
    expect(mocks.answerDeleteMany).toHaveBeenCalledWith({
      where: {
        questionId: "question-1",
      },
    });
    expect(mocks.questionOptionDeleteMany).toHaveBeenCalledWith({
      where: { questionId: "question-1" },
    });
    expect(mocks.questionOptionCreateMany).toHaveBeenCalledWith({
      data: [
        {
          questionId: "question-1",
          label: "New A",
          kind: "standard",
          sortOrder: 10,
        },
        {
          questionId: "question-1",
          label: "New B",
          kind: "standard",
          sortOrder: 20,
        },
        {
          questionId: "question-1",
          label: "New C",
          kind: "standard",
          sortOrder: 30,
        },
      ],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/halisaha");
  });

  it("creates a player picker question from the selected option type", async () => {
    const result = await createHalisahaQuestionAction({
      kind: "standard",
      prompt: "Who will score first?",
      points: 2,
      options: [{ label: "Pick a player", kind: "player_prediction" }],
    });

    expect(result).toEqual({
      ok: true,
      message: "Question created.",
    });
    expect(mocks.questionCreate).toHaveBeenCalledWith({
      data: {
        matchId: "match-1",
        kind: "player_prediction",
        prompt: "Who will score first?",
        points: 2,
        sortOrder: 30,
        options: {
          create: [],
        },
      },
    });
    expect(mocks.syncPlayerQuestions).toHaveBeenCalledWith("match-1");
  });

  it("derives a single-number prediction from the edited option type row", async () => {
    mocks.questionFindUnique.mockResolvedValue({
      id: "question-1",
      kind: "standard",
      prompt: "Old question?",
      points: 1,
      sortOrder: 20,
      matchId: "match-1",
      match: {
        id: "match-1",
        homeTeamName: "Home",
        awayTeamName: "Away",
      },
      options: [
        { id: "opt-1", label: "Old A", kind: "standard" },
        { id: "opt-2", label: "Old B", kind: "standard" },
      ],
      answers: [{ id: "answer-1" }],
    });

    const result = await updateHalisahaQuestionAction("question-1", {
      kind: "standard",
      prompt: "How many saves?",
      points: 4,
      options: [{ label: "Any number", kind: "number_prediction" }],
      isActive: true,
    });

    expect(result).toEqual({
      ok: true,
      message:
        "Question updated. Existing answers for this question were cleared because the option set changed.",
    });
    expect(mocks.questionUpdate).toHaveBeenCalledWith({
      where: { id: "question-1" },
      data: expect.objectContaining({
        kind: "number_prediction",
        prompt: "How many saves?",
        points: 4,
        isActive: true,
        sortOrder: 20,
        scoreHomeResult: null,
        scoreAwayResult: null,
      }),
    });
    expect(mocks.questionOptionCreateMany).toHaveBeenCalledWith({
      data: [
        {
          questionId: "question-1",
          label: "Your number guess",
          kind: "custom_number",
          sortOrder: 10,
        },
      ],
    });
  });

  it("publishes the active match for users", async () => {
    const result = await setHalisahaMatchPublishedAction(true);

    expect(result).toEqual({
      ok: true,
      message: "Halisaha match is now visible to users.",
    });
    expect(mocks.matchUpdate).toHaveBeenCalledWith({
      where: {
        id: "match-1",
      },
      data: {
        isPublishedToUsers: true,
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/halisaha");
  });

  it("clears every participant from the active match", async () => {
    const result = await clearHalisahaParticipantsAction();

    expect(result).toEqual({
      ok: true,
      message: "Removed 2 participant(s) from the Halisaha squad.",
    });
    expect(mocks.participantDeleteMany).toHaveBeenCalledWith({
      where: {
        matchId: "match-1",
      },
    });
    expect(mocks.syncMvpQuestion).toHaveBeenCalledWith("match-1");
    expect(mocks.syncPlayerQuestions).toHaveBeenCalledWith("match-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/halisaha");
  });
});
