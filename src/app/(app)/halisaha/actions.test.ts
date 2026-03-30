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
import { HALISAHA_ADMIN_PREVIEW_ONLY_MESSAGE } from "@/lib/halisaha/public-access";

type MockTx = {
  halisahaAnswer: {
    upsert: typeof mocks.upsert;
    updateMany: typeof mocks.updateMany;
  };
};

function buildQuestion(kickoffAt: Date) {
  return {
    id: "question-1",
    isActive: true,
    match: {
      id: "match-1",
      answersResolvedAt: null,
      kickoffAt,
      matchDurationMinutes: 60,
    },
    options: [
      {
        id: "option-1",
        kind: "standard" as const,
      },
    ],
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

  it("rejects non-admin submissions while Halisaha is admin-preview only", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      role: "user",
    });
    mocks.findMany.mockResolvedValue([buildQuestion(new Date(Date.now() + 4 * 60_000))]);

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
    mocks.findMany.mockResolvedValue([buildQuestion(new Date(Date.now() + 4 * 60_000))]);

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
});
