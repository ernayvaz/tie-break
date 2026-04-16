import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { archiveHalisahaMatchForNextRound } from "@/lib/halisaha/server";

describe("archiveHalisahaMatchForNextRound", () => {
  it("clones question options with nested creates inside the extended transaction window", async () => {
    const matchUpdate = vi.fn().mockResolvedValue(undefined);
    const matchCreate = vi.fn().mockResolvedValue({
      id: "match-2",
      roundNumber: 8,
    });
    const participantCreate = vi
      .fn()
      .mockResolvedValueOnce({ id: "participant-home-next" })
      .mockResolvedValueOnce({ id: "participant-away-next" });
    const questionCreate = vi.fn().mockResolvedValue({ id: "question-next-1" });
    const directOptionCreate = vi.fn(() => {
      throw new Error("question options should be cloned through nested creates");
    });

    const tx = {
      halisahaMatch: {
        findUnique: vi.fn().mockResolvedValue({
          id: "match-1",
          roundNumber: 7,
          title: "Matchday Show",
          kickoffTimezone: "Europe/Istanbul",
          participants: [
            {
              id: "participant-home",
              userId: "user-1",
              guestId: null,
              guestName: null,
              displayNameOverride: "Captain Mert",
              teamSide: "home",
              positionKey: "striker",
              displayOrder: 10,
            },
            {
              id: "participant-away",
              userId: null,
              guestId: "guest-1",
              guestName: "Guest Star",
              displayNameOverride: null,
              teamSide: "away",
              positionKey: "goalkeeper",
              displayOrder: 20,
            },
          ],
          questions: [
            {
              id: "question-1",
              kind: "mvp_prediction",
              prompt: "Who will be the MVP?",
              points: 1,
              sortOrder: 20,
              isActive: true,
              options: [
                {
                  id: "option-1",
                  label: "Captain Mert",
                  kind: "standard",
                  participantId: "participant-home",
                  sortOrder: 10,
                },
                {
                  id: "option-2",
                  label: "Guest Star",
                  kind: "standard",
                  participantId: "participant-away",
                  sortOrder: 20,
                },
                {
                  id: "option-3",
                  label: "No vote",
                  kind: "standard",
                  participantId: null,
                  sortOrder: 30,
                },
              ],
            },
          ],
        }),
        update: matchUpdate,
        create: matchCreate,
      },
      halisahaParticipant: {
        create: participantCreate,
      },
      halisahaQuestion: {
        create: questionCreate,
      },
      halisahaQuestionOption: {
        create: directOptionCreate,
      },
    };

    const transaction = vi.fn(
      async (
        callback: (client: typeof tx) => Promise<unknown>,
        options?: { maxWait?: number; timeout?: number },
      ) => {
        expect(options).toEqual({
          maxWait: 10_000,
          timeout: 30_000,
        });
        return callback(tx);
      },
    );

    const db = {
      $transaction: transaction,
    } as unknown as PrismaClient;

    const result = await archiveHalisahaMatchForNextRound(
      {
        matchId: "match-1",
        homeTeamName: "Flexera Club",
        awayTeamName: "RayNET Glory",
        venueName: "HITABSPOR Arena",
        homeFormation: "f1_2_3_1",
        awayFormation: "f1_2_3_1",
        kickoffAt: new Date("2026-04-03T17:00:00.000Z"),
        matchDurationMinutes: 60,
      },
      db,
    );

    expect(result).toMatchObject({
      ok: true,
      archivedMatchId: "match-1",
      archivedRoundNumber: 7,
      nextMatchId: "match-2",
      nextRoundNumber: 8,
    });
    expect(matchUpdate).toHaveBeenCalledWith({
      where: { id: "match-1" },
      data: {
        singletonKey: null,
        archivedAt: expect.any(Date),
      },
    });
    expect(matchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        singletonKey: "active",
        roundNumber: 8,
        homeTeamName: "Flexera Club",
        awayTeamName: "RayNET Glory",
        venueName: "HITABSPOR Arena",
        isPublishedToUsers: false,
      }),
    });
    expect(questionCreate).toHaveBeenCalledWith({
      data: {
        matchId: "match-2",
        kind: "mvp_prediction",
        prompt: "Who will be the MVP?",
        points: 1,
        sortOrder: 20,
        scoreHomeResult: null,
        scoreAwayResult: null,
        isActive: true,
        options: {
          create: [
            {
              label: "Captain Mert",
              kind: "standard",
              participantId: "participant-home-next",
              sortOrder: 10,
              isCorrect: false,
            },
            {
              label: "Guest Star",
              kind: "standard",
              participantId: "participant-away-next",
              sortOrder: 20,
              isCorrect: false,
            },
            {
              label: "No vote",
              kind: "standard",
              participantId: null,
              sortOrder: 30,
              isCorrect: false,
            },
          ],
        },
      },
    });
    expect(directOptionCreate).not.toHaveBeenCalled();
  });
});
