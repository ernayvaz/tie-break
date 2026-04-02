import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireAdmin: vi.fn(),
  createAdminLog: vi.fn(),
  transaction: vi.fn(),
  ensureActiveMatch: vi.fn(),
  archiveMatch: vi.fn(),
  syncWinnerQuestion: vi.fn(),
  syncMvpQuestion: vi.fn(),
  syncPlayerQuestions: vi.fn(),
  guestFindUnique: vi.fn(),
  guestCreate: vi.fn(),
  guestUpdate: vi.fn(),
  participantCreate: vi.fn(),
  participantFindUnique: vi.fn(),
  participantFindMany: vi.fn(),
  participantUpdate: vi.fn(),
  participantUpdateMany: vi.fn(),
  userFindUnique: vi.fn(),
  matchUpdate: vi.fn(),
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
  archiveHalisahaMatchForNextRound: mocks.archiveMatch,
  ensureActiveHalisahaMatch: mocks.ensureActiveMatch,
  resolveHalisahaMvpFromVotes: vi.fn(),
  scoreHalisahaAnswers: vi.fn(),
  syncHalisahaPlayerPredictionQuestions: mocks.syncPlayerQuestions,
  syncHalisahaMvpPredictionQuestion: mocks.syncMvpQuestion,
  syncHalisahaWinnerQuestion: mocks.syncWinnerQuestion,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    halisahaGuest: {
      findUnique: mocks.guestFindUnique,
      create: mocks.guestCreate,
      update: mocks.guestUpdate,
    },
    halisahaParticipant: {
      create: mocks.participantCreate,
      findUnique: mocks.participantFindUnique,
      findMany: mocks.participantFindMany,
      update: mocks.participantUpdate,
      updateMany: mocks.participantUpdateMany,
    },
    halisahaMatch: {
      update: mocks.matchUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  addHalisahaGuestFromRegistryAction,
  addHalisahaGuestParticipantAction,
  deactivateHalisahaGuestRegistryAction,
  saveHalisahaMatchSettingsAction,
  updateHalisahaParticipantAssignmentAction,
} from "./actions";

describe("admin halisaha participant flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.ensureActiveMatch.mockResolvedValue({
      id: "match-1",
      roundNumber: 1,
      homeTeamName: "Home",
      awayTeamName: "Away",
      venueName: "Pitch",
      homeFormation: "f1_2_3_1",
      awayFormation: "f1_2_3_1",
      kickoffAt: new Date("2026-04-01T17:00:00.000Z"),
      answersResolvedAt: null,
      mvpResolvedParticipantId: null,
      isPublishedToUsers: false,
    });
    mocks.matchUpdate.mockResolvedValue(undefined);
    mocks.participantUpdateMany.mockResolvedValue({ count: 1 });
    mocks.participantFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === "function") {
        return callback({
          halisahaGuest: {
            findUnique: mocks.guestFindUnique,
            create: mocks.guestCreate,
            update: mocks.guestUpdate,
          },
          halisahaParticipant: {
            create: mocks.participantCreate,
          },
        });
      }

      return callback;
    });
  });

  it("creates a guest registry entry and adds the guest to the active squad", async () => {
    mocks.guestFindUnique.mockResolvedValue(null);
    mocks.guestCreate.mockResolvedValue({
      id: "guest-1",
      displayName: "Guest Star",
      isActive: true,
    });
    mocks.participantCreate.mockResolvedValue({
      id: "participant-1",
    });

    const result = await addHalisahaGuestParticipantAction("  Guest   Star ");

    expect(result).toEqual({
      ok: true,
      message: "Guest added to the Halisaha squad.",
    });
    expect(mocks.guestCreate).toHaveBeenCalledWith({
      data: {
        displayName: "Guest Star",
        normalizedName: "guest star",
      },
    });
    expect(mocks.participantCreate).toHaveBeenCalledWith({
      data: {
        matchId: "match-1",
        guestId: "guest-1",
        guestName: "Guest Star",
      },
    });
    expect(mocks.syncMvpQuestion).toHaveBeenCalledWith("match-1");
    expect(mocks.syncPlayerQuestions).toHaveBeenCalledWith("match-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/halisaha");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/leaderboard");
  });

  it("adds an already saved guest from the registry", async () => {
    mocks.guestFindUnique.mockResolvedValue({
      id: "guest-1",
      displayName: "Saved Guest",
      isActive: true,
    });
    mocks.participantCreate.mockResolvedValue({
      id: "participant-2",
    });

    const result = await addHalisahaGuestFromRegistryAction("guest-1");

    expect(result).toEqual({
      ok: true,
      message: "Guest added from the saved guest list.",
    });
    expect(mocks.participantCreate).toHaveBeenCalledWith({
      data: {
        matchId: "match-1",
        guestId: "guest-1",
        guestName: "Saved Guest",
      },
      select: {
        id: true,
      },
    });
  });

  it("deactivates a saved guest without touching past participants", async () => {
    mocks.guestFindUnique.mockResolvedValue({
      id: "guest-1",
      displayName: "Saved Guest",
      isActive: true,
    });
    mocks.guestUpdate.mockResolvedValue(undefined);

    const result = await deactivateHalisahaGuestRegistryAction("guest-1");

    expect(result).toEqual({
      ok: true,
      message: "Guest removed from the saved guest list.",
    });
    expect(mocks.guestUpdate).toHaveBeenCalledWith({
      where: {
        id: "guest-1",
      },
      data: {
        isActive: false,
      },
    });
  });

  it("rejects positions that do not belong to the selected team tactic", async () => {
    mocks.participantFindUnique.mockResolvedValue({
      id: "participant-1",
      matchId: "match-1",
      guestName: null,
      guestId: null,
      teamSide: "home",
      positionKey: "striker",
      match: {
        homeFormation: "f1_3_2_1",
        awayFormation: "f1_2_3_1",
      },
      user: {
        name: "Mert",
        surname: "Yildiz",
      },
    });

    const result = await updateHalisahaParticipantAssignmentAction("participant-1", {
      teamSide: "home",
      positionKey: "left_wing",
    });

    expect(result).toEqual({
      ok: false,
      error: "That position does not belong to the selected team tactic.",
    });
    expect(mocks.participantUpdate).not.toHaveBeenCalled();
  });

  it("stores a custom visible name for Halisaha", async () => {
    mocks.participantFindUnique.mockResolvedValue({
      id: "participant-1",
      matchId: "match-1",
      guestName: null,
      guestId: null,
      displayNameOverride: null,
      teamSide: "home",
      positionKey: "striker",
      guest: null,
      match: {
        homeFormation: "f1_2_3_1",
        awayFormation: "f1_2_3_1",
      },
      user: {
        name: "Mert",
        surname: "Yildiz",
      },
    });

    const result = await updateHalisahaParticipantAssignmentAction("participant-1", {
      teamSide: null,
      positionKey: null,
      displayName: "  Captain   Mert  ",
    });

    expect(result).toEqual({
      ok: true,
      message: "Player assignment updated.",
    });
    expect(mocks.participantUpdate).toHaveBeenCalledWith({
      where: { id: "participant-1" },
      data: {
        teamSide: null,
        positionKey: null,
        displayOrder: 0,
        displayNameOverride: "Captain Mert",
      },
    });
    expect(mocks.syncMvpQuestion).toHaveBeenCalledWith("match-1");
    expect(mocks.syncPlayerQuestions).toHaveBeenCalledWith("match-1");
  });

  it("clears the custom visible name when the default player name is selected again", async () => {
    mocks.participantFindUnique.mockResolvedValue({
      id: "participant-1",
      matchId: "match-1",
      guestName: null,
      guestId: null,
      displayNameOverride: "Captain Mert",
      teamSide: "home",
      positionKey: "striker",
      guest: null,
      match: {
        homeFormation: "f1_2_3_1",
        awayFormation: "f1_2_3_1",
      },
      user: {
        name: "Mert",
        surname: "Yildiz",
      },
    });

    const result = await updateHalisahaParticipantAssignmentAction("participant-1", {
      teamSide: null,
      positionKey: null,
      displayName: "Mert Yildiz",
    });

    expect(result).toEqual({
      ok: true,
      message: "Player assignment updated.",
    });
    expect(mocks.participantUpdate).toHaveBeenCalledWith({
      where: { id: "participant-1" },
      data: {
        teamSide: null,
        positionKey: null,
        displayOrder: 0,
        displayNameOverride: null,
      },
    });
  });

  it("clears incompatible assignments when tactics change", async () => {
    mocks.participantFindMany.mockResolvedValue([
      {
        id: "participant-home-invalid",
        teamSide: "home",
        positionKey: "left_wing",
      },
      {
        id: "participant-away-valid",
        teamSide: "away",
        positionKey: "striker",
      },
    ]);

    const result = await saveHalisahaMatchSettingsAction({
      homeTeamName: "Home",
      awayTeamName: "Away",
      venueName: "Pitch",
      homeFormation: "f1_3_2_1",
      awayFormation: "f1_2_3_1",
      kickoffDate: "2026-04-01",
      kickoffTime: "20:00",
      matchDurationMinutes: 60,
    });

    expect(result).toEqual({
      ok: true,
      message:
        "Halisaha match settings saved. 1 assignment(s) were cleared because they no longer fit the selected tactics.",
    });
    expect(mocks.matchUpdate).toHaveBeenCalledWith({
      where: { id: "match-1" },
      data: {
        homeTeamName: "Home",
        awayTeamName: "Away",
        venueName: "Pitch",
        homeFormation: "f1_3_2_1",
        awayFormation: "f1_2_3_1",
        kickoffAt: new Date("2026-04-01T17:00:00.000Z"),
        matchDurationMinutes: 60,
      },
    });
    expect(mocks.participantUpdateMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["participant-home-invalid"],
        },
      },
      data: {
        positionKey: null,
        displayOrder: 0,
      },
    });
    expect(mocks.syncWinnerQuestion).toHaveBeenCalledWith({
      id: "match-1",
      homeTeamName: "Home",
      awayTeamName: "Away",
    });
    expect(mocks.syncMvpQuestion).toHaveBeenCalledWith("match-1");
    expect(mocks.syncPlayerQuestions).toHaveBeenCalledWith("match-1");
  });
});
