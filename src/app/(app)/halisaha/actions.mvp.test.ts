import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getCurrentUser: vi.fn(),
  matchFindUnique: vi.fn(),
  mvpVoteCreate: vi.fn(),
  answerFindFirst: vi.fn(),
  answerUpdateMany: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/get-user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    halisahaMatch: {
      findUnique: mocks.matchFindUnique,
    },
    halisahaMvpVote: {
      create: mocks.mvpVoteCreate,
    },
    halisahaAnswer: {
      findFirst: mocks.answerFindFirst,
      updateMany: mocks.answerUpdateMany,
    },
  },
}));

import {
  submitPostMatchMvpVoteAction,
  unlockHalisahaAnswersAction,
} from "./actions";

describe("halisaha MVP and unlock actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mvpVoteCreate.mockResolvedValue(undefined);
    mocks.answerFindFirst.mockResolvedValue({ id: "answer-1" });
    mocks.answerUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("allows admins and match participants to submit MVP votes during the 24-hour window", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      role: "user",
    });
    mocks.matchFindUnique.mockResolvedValue({
      id: "match-1",
      isPublishedToUsers: true,
      kickoffAt: new Date(Date.now() - 70 * 60_000),
      matchDurationMinutes: 60,
      participants: [
        { id: "participant-user", userId: "user-1" },
        { id: "participant-other", userId: "user-2" },
      ],
      mvpVotes: [],
    });

    const result = await submitPostMatchMvpVoteAction("match-1", "participant-other");

    expect(result).toEqual({
      ok: true,
      message: "Your MVP vote has been submitted.",
    });
    expect(mocks.mvpVoteCreate).toHaveBeenCalledWith({
      data: {
        matchId: "match-1",
        userId: "user-1",
        participantId: "participant-other",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/halisaha");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/leaderboard");
  });

  it("rejects MVP votes from users who did not play in the match", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-9",
      role: "user",
    });
    mocks.matchFindUnique.mockResolvedValue({
      id: "match-1",
      isPublishedToUsers: true,
      kickoffAt: new Date(Date.now() - 70 * 60_000),
      matchDurationMinutes: 60,
      participants: [
        { id: "participant-home", userId: "user-1" },
        { id: "participant-away", userId: "user-2" },
      ],
      mvpVotes: [],
    });

    const result = await submitPostMatchMvpVoteAction("match-1", "participant-home");

    expect(result).toEqual({
      ok: false,
      error: "Only the admin and players who took part in the match can vote for MVP.",
    });
    expect(mocks.mvpVoteCreate).not.toHaveBeenCalled();
  });

  it("rejects MVP votes after the 24-hour window closes", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "admin",
    });
    mocks.matchFindUnique.mockResolvedValue({
      id: "match-1",
      isPublishedToUsers: true,
      kickoffAt: new Date(Date.now() - 26 * 60 * 60_000),
      matchDurationMinutes: 60,
      participants: [{ id: "participant-home", userId: "user-1" }],
      mvpVotes: [],
    });

    const result = await submitPostMatchMvpVoteAction("match-1", "participant-home");

    expect(result).toEqual({
      ok: false,
      error: "The 24-hour MVP voting window has closed.",
    });
    expect(mocks.mvpVoteCreate).not.toHaveBeenCalled();
  });

  it("blocks answer unlocks once the 5-minute prediction lock has started", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "admin",
    });
    mocks.matchFindUnique.mockResolvedValue({
      id: "match-1",
      isPublishedToUsers: true,
      answersResolvedAt: null,
      kickoffAt: new Date(Date.now() + 2 * 60_000),
    });

    const result = await unlockHalisahaAnswersAction("match-1");

    expect(result).toEqual({
      ok: false,
      error: "Answers can only be unlocked before predictions close.",
    });
    expect(mocks.answerUpdateMany).not.toHaveBeenCalled();
  });
});
