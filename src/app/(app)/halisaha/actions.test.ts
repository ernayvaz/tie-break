import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getCurrentUser: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/get-user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    halisahaQuestion: {
      findMany: mocks.findMany,
    },
    halisahaAnswer: {
      findFirst: mocks.findFirst,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  submitHalisahaAnswersAction,
} from "./actions";
import { HALISAHA_MATCH_NOT_PUBLISHED_MESSAGE } from "@/lib/halisaha/public-access";

type MockTx = {
  halisahaAnswer: {
    upsert: typeof mocks.upsert;
    updateMany: typeof mocks.updateMany;
  };
};

function buildQuestion(
  id: string,
  kickoffAt: Date,
  options: Array<{
    id: string;
    kind: "standard" | "player_picker" | "custom_score" | "custom_number";
  }> = [
    {
      id: "option-1",
      kind: "standard" as const,
    },
  ],
) {
  return {
    id,
    isActive: true,
    match: {
      id: "match-1",
      isPublishedToUsers: true,
      answersResolvedAt: null,
      kickoffAt,
      matchDurationMinutes: 60,
    },
    options,
  };
}

describe("halisaha actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue(undefined);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (tx: MockTx) => Promise<unknown>) =>
      callback({
        halisahaAnswer: {
          upsert: mocks.upsert,
          updateMany: mocks.updateMany,
        },
      }),
    );
  });

  it("rejects non-admin submissions before the match is published", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      role: "user",
    });
    const unpublishedQuestion = buildQuestion("question-1", new Date(Date.now() + 4 * 60_000));
    unpublishedQuestion.match.isPublishedToUsers = false;
    mocks.findMany.mockResolvedValue([unpublishedQuestion]);

    const result = await submitHalisahaAnswersAction([
      {
        questionId: "question-1",
        optionId: "option-1",
      },
    ]);

    expect(result).toEqual({
      ok: false,
      error: HALISAHA_MATCH_NOT_PUBLISHED_MESSAGE,
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("applies the kickoff-minus-5-minute lock to admins too", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "admin",
    });
    mocks.findMany.mockResolvedValue([buildQuestion("question-1", new Date(Date.now() + 4 * 60_000))]);

    const result = await submitHalisahaAnswersAction([
      {
        questionId: "question-1",
        optionId: "option-1",
      },
    ]);

    expect(result).toEqual({
      ok: false,
      error: "Predictions close 5 minutes before kickoff.",
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("finalizes only the submitted question ids", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "admin",
    });
    mocks.findMany.mockResolvedValue([
      buildQuestion("question-1", new Date(Date.now() + 10 * 60_000)),
    ]);

    const result = await submitHalisahaAnswersAction(
      [
        {
          questionId: "question-1",
          optionId: "option-1",
        },
      ],
      { finalize: true },
    );

    expect(result).toEqual({
      ok: true,
      message: "Answers locked.",
    });
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        matchId: "match-1",
        userId: "admin-1",
        questionId: {
          in: ["question-1"],
        },
      },
      data: {
        isFinal: true,
        finalizedAt: expect.any(Date),
      },
    });
  });

  it("requires a value for single-number prediction questions", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "admin",
    });
    mocks.findMany.mockResolvedValue([
      buildQuestion("question-1", new Date(Date.now() + 10 * 60_000), [
        {
          id: "option-1",
          kind: "custom_number",
        },
      ]),
    ]);

    const result = await submitHalisahaAnswersAction([
      {
        questionId: "question-1",
        optionId: "option-1",
      },
    ]);

    expect(result).toEqual({
      ok: false,
      error: "Enter a whole number for this prediction.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects player-picker placeholder rows without a chosen player option", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "admin",
    });
    mocks.findMany.mockResolvedValue([
      buildQuestion("question-1", new Date(Date.now() + 10 * 60_000), [
        {
          id: "option-picker",
          kind: "player_picker",
        },
      ]),
    ]);

    const result = await submitHalisahaAnswersAction([
      {
        questionId: "question-1",
        optionId: "option-picker",
      },
    ]);

    expect(result).toEqual({
      ok: false,
      error: "Choose one player before saving this answer.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
