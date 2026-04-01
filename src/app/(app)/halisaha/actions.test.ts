import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getCurrentUser: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
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
  finalizeHalisahaAnswersAction,
  submitHalisahaAnswersAction,
} from "./actions";
import { HALISAHA_ADMIN_PREVIEW_ONLY_MESSAGE } from "@/lib/halisaha/public-access";

type MockTx = {
  halisahaAnswer: {
    deleteMany: typeof mocks.deleteMany;
    createMany: typeof mocks.createMany;
    updateMany: typeof mocks.updateMany;
  };
};

function buildQuestion(id: string, optionId: string, kickoffAt: Date) {
  return {
    id,
    isActive: true,
    match: {
      id: "match-1",
      answersResolvedAt: null,
      kickoffAt,
      matchDurationMinutes: 60,
    },
    options: [
      {
        id: optionId,
        kind: "standard" as const,
      },
    ],
  };
}

describe("halisaha actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.createMany.mockResolvedValue({ count: 1 });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (tx: MockTx) => Promise<unknown>) =>
      callback({
        halisahaAnswer: {
          deleteMany: mocks.deleteMany,
          createMany: mocks.createMany,
          updateMany: mocks.updateMany,
        },
      }),
    );
  });

  it("rejects non-admin submissions while Halisaha is admin-preview only", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      role: "user",
    });
    mocks.findMany.mockResolvedValue([
      buildQuestion("question-1", "option-1", new Date(Date.now() + 4 * 60_000)),
    ]);

    const result = await submitHalisahaAnswersAction([
      {
        questionId: "question-1",
        optionId: "option-1",
      },
    ]);

    expect(result).toEqual({
      ok: false,
      error: HALISAHA_ADMIN_PREVIEW_ONLY_MESSAGE,
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("keeps admins exempt from the kickoff-minus-5-minute lock for testing", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "admin",
    });
    mocks.findMany.mockResolvedValue([
      buildQuestion("question-1", "option-1", new Date(Date.now() + 4 * 60_000)),
    ]);

    const result = await submitHalisahaAnswersAction([
      {
        questionId: "question-1",
        optionId: "option-1",
      },
    ]);

    expect(result).toEqual({
      ok: true,
      message: "Answer saved.",
    });
    expect(mocks.findFirst).toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/halisaha");
  });

  it("locks answers with batched delete/create writes before the final lock update", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "admin",
    });
    mocks.findMany.mockResolvedValue([
      buildQuestion("question-1", "option-1", new Date(Date.now() + 4 * 60_000)),
      buildQuestion("question-2", "option-2", new Date(Date.now() + 4 * 60_000)),
    ]);

    const result = await finalizeHalisahaAnswersAction([
      {
        questionId: "question-1",
        optionId: "option-1",
      },
      {
        questionId: "question-2",
        optionId: "option-2",
      },
    ]);

    expect(result).toEqual({
      ok: true,
      message: "Answers locked.",
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        matchId: "match-1",
        userId: "admin-1",
        questionId: {
          in: ["question-1", "question-2"],
        },
      },
    });
    expect(mocks.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        matchId: "match-1",
        userId: "admin-1",
      },
      data: expect.objectContaining({
        isFinal: true,
      }),
    });
  });
});
