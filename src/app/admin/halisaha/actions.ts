"use server";

import {
  Prisma,
  type HalisahaFormation,
  type HalisahaPositionKey,
  type HalisahaQuestionKind,
  type HalisahaTeamSide,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-user";
import { prisma } from "@/lib/db";
import { createAdminLog } from "@/lib/admin-log";
import {
  createIstanbulDateFromInputs,
  getHalisahaFormationLabel,
  getHalisahaPositionDisplayOrder,
  isHalisahaPositionAllowed,
} from "@/lib/halisaha/config";
import {
  collapseStoredHalisahaQuestionOptionsToDrafts,
  deriveManagedHalisahaQuestionKindFromDrafts,
  normalizeManagedHalisahaQuestionKind,
  normalizeManagedHalisahaQuestionOptionLabel,
  type ManagedHalisahaQuestionKind,
  type ManagedHalisahaQuestionOptionInput,
} from "@/lib/halisaha/question-option-utils";
import {
  archiveHalisahaMatchForNextRound,
  ensureActiveHalisahaMatch,
  resolveHalisahaMvpFromVotes,
  scoreHalisahaAnswers,
  syncHalisahaPlayerPredictionQuestions,
  syncHalisahaMvpPredictionQuestion,
  syncHalisahaWinnerQuestion,
} from "@/lib/halisaha/server";
import { getHalisahaMatchPhase } from "@/lib/halisaha/match-state";

export type HalisahaAdminActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const QUESTION_SORT_STEP = 10;
const QUESTION_OPTION_SORT_STEP = 100;

function normalizeOptions(options: Array<string | ManagedHalisahaQuestionOptionInput>) {
  return options
    .map((option) =>
      typeof option === "string"
        ? {
            label: option,
            kind: "standard" as const,
          }
        : {
            label: option.label,
            kind: option.kind,
          },
    )
    .map((option) => ({
      label: normalizeManagedHalisahaQuestionOptionLabel(option),
      kind: option.kind,
    }))
    .filter((option) => (option.kind === "standard" ? Boolean(option.label) : true));
}

function normalizeGuestDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeGuestLookupKey(value: string) {
  return normalizeGuestDisplayName(value).toLocaleLowerCase("tr-TR");
}

function normalizeParticipantVisibleName(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized || null;
}

function getParticipantDefaultDisplayName(participant: {
  guestName?: string | null;
  guest?: { displayName: string } | null;
  user?: { name: string; surname: string } | null;
}) {
  if (participant.user) {
    return `${participant.user.name} ${participant.user.surname}`.trim();
  }

  return participant.guestName?.trim() || participant.guest?.displayName?.trim() || "Guest";
}

function getFormationForTeamSide(
  match: {
    homeFormation: HalisahaFormation;
    awayFormation: HalisahaFormation;
  },
  teamSide: HalisahaTeamSide,
) {
  return teamSide === "home" ? match.homeFormation : match.awayFormation;
}

async function clearInvalidParticipantAssignmentsForMatch(match: {
  id: string;
  homeFormation: HalisahaFormation;
  awayFormation: HalisahaFormation;
}) {
  const participants = await prisma.halisahaParticipant.findMany({
    where: {
      matchId: match.id,
      teamSide: {
        not: null,
      },
      positionKey: {
        not: null,
      },
    },
    select: {
      id: true,
      teamSide: true,
      positionKey: true,
    },
  });

  const invalidParticipantIds = participants
    .filter(
      (participant) =>
        participant.teamSide &&
        participant.positionKey &&
        !isHalisahaPositionAllowed(
          getFormationForTeamSide(match, participant.teamSide),
          participant.positionKey,
        ),
    )
    .map((participant) => participant.id);

  if (invalidParticipantIds.length > 0) {
    await prisma.halisahaParticipant.updateMany({
      where: {
        id: {
          in: invalidParticipantIds,
        },
      },
      data: {
        positionKey: null,
        displayOrder: 0,
      },
    });
  }

  return invalidParticipantIds.length;
}

function prepareQuestionOptions(input: {
  kind: ManagedHalisahaQuestionKind;
  options: Array<string | ManagedHalisahaQuestionOptionInput>;
}) {
  const normalizedOptions = normalizeOptions(input.options);
  if (normalizedOptions.length === 0) {
    return { ok: false as const, error: "Add at least 1 answer option." };
  }

  const playerPickerCount = normalizedOptions.filter(
    (option) => option.kind === "player_prediction",
  ).length;
  if (playerPickerCount > 1) {
    return {
      ok: false as const,
      error: "Use only one player picker row per question.",
    };
  }

  const standardOnly = normalizedOptions.every((option) => option.kind === "standard");
  if (standardOnly && normalizedOptions.length < 2) {
    return { ok: false as const, error: "Add at least 2 answer options." };
  }

  const derivedKind = deriveManagedHalisahaQuestionKindFromDrafts(normalizedOptions);
  const preparedOptions = normalizedOptions.map((option, index) => ({
    label: option.label,
    kind:
      option.kind === "player_prediction"
        ? ("player_picker" as const)
        : option.kind === "score_prediction"
          ? ("custom_score" as const)
          : option.kind === "number_prediction"
            ? ("custom_number" as const)
            : ("standard" as const),
    sortOrder: (index + 1) * QUESTION_OPTION_SORT_STEP,
  }));

  return {
    ok: true as const,
    kind: derivedKind,
    normalizedOptions,
    preparedOptions,
  };
}

async function resetResolutionState(matchId: string) {
  const match = await prisma.halisahaMatch.findUnique({
    where: { id: matchId },
    select: { roundNumber: true },
  });
  if (!match) {
    return;
  }

  const questions = await prisma.halisahaQuestion.findMany({
    where: {
      matchId,
    },
    select: {
      id: true,
      kind: true,
    },
  });
  const questionIds = questions.map((question) => question.id);
  const mvpQuestionIds = questions
    .filter((question) => question.kind === "mvp_prediction")
    .map((question) => question.id);

  const operations: Array<Prisma.PrismaPromise<unknown>> = [
    prisma.halisahaMatch.update({
      where: { id: matchId },
      data: {
        answersResolvedAt: null,
        mvpResolvedParticipantId: null,
        mvpResolvedAt: null,
      },
    }),
    prisma.halisahaLeaderboardRound.deleteMany({
      where: {
        roundNumber: match.roundNumber,
      },
    }),
    prisma.halisahaMvpRoundAward.deleteMany({
      where: {
        roundNumber: match.roundNumber,
      },
    }),
  ];

  if (questionIds.length > 0) {
    operations.push(
      prisma.halisahaAnswer.updateMany({
        where: {
          matchId,
          questionId: {
            in: questionIds,
          },
        },
        data: {
          isCorrect: null,
          awardedPoints: 0,
        },
      }),
    );
  }

  if (mvpQuestionIds.length > 0) {
    operations.push(
      prisma.halisahaQuestionOption.updateMany({
        where: {
          questionId: {
            in: mvpQuestionIds,
          },
        },
        data: {
          isCorrect: false,
        },
      }),
    );
  }

  await prisma.$transaction(operations);
}

function hasHalisahaMatchIdentityChanged(input: {
  match: {
    homeTeamName: string;
    awayTeamName: string;
    kickoffAt: Date;
  };
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: Date;
}) {
  return (
    input.match.homeTeamName !== input.homeTeamName ||
    input.match.awayTeamName !== input.awayTeamName ||
    input.match.kickoffAt.getTime() !== input.kickoffAt.getTime()
  );
}

async function hasExistingHalisahaRoundActivity(matchId: string) {
  const [answerCount, voteCount] = await Promise.all([
    prisma.halisahaAnswer.count({
      where: { matchId },
    }),
    prisma.halisahaMvpVote.count({
      where: { matchId },
    }),
  ]);

  return answerCount > 0 || voteCount > 0;
}

function revalidateHalisahaPaths(options: { includeLeaderboard?: boolean } = {}) {
  const { includeLeaderboard = true } = options;
  revalidatePath("/admin/halisaha");
  revalidatePath("/admin/halisaha/predictions");
  revalidatePath("/halisaha");
  if (includeLeaderboard) {
    revalidatePath("/leaderboard");
  }
}

export async function saveHalisahaMatchSettingsAction(data: {
  homeTeamName: string;
  awayTeamName: string;
  venueName: string;
  homeFormation: HalisahaFormation;
  awayFormation: HalisahaFormation;
  kickoffDate: string;
  kickoffTime: string;
  matchDurationMinutes: number;
}): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const match = await ensureActiveHalisahaMatch();
  const homeTeamName = data.homeTeamName.trim();
  const awayTeamName = data.awayTeamName.trim();
  const venueName = data.venueName.trim();
  const homeFormation = data.homeFormation;
  const awayFormation = data.awayFormation;
  const kickoffAt = createIstanbulDateFromInputs(data.kickoffDate, data.kickoffTime);
  const matchDurationMinutes = Number(data.matchDurationMinutes);

  if (!homeTeamName || !awayTeamName || !venueName) {
    return {
      ok: false,
      error: "Team names and venue are required.",
    };
  }

  if (!kickoffAt || Number.isNaN(kickoffAt.getTime())) {
    return {
      ok: false,
      error: "Enter a valid Istanbul date and time.",
    };
  }

  if (!Number.isFinite(matchDurationMinutes) || matchDurationMinutes < 1) {
    return {
      ok: false,
      error: "Match duration must be at least 1 minute.",
    };
  }

  if (!homeFormation || !awayFormation) {
    return {
      ok: false,
      error: "Pick a tactic for both teams.",
    };
  }

  const shouldArchiveForNewMatch =
    hasHalisahaMatchIdentityChanged({
      match,
      homeTeamName,
      awayTeamName,
      kickoffAt,
    }) &&
    (Boolean(match.answersResolvedAt) ||
      Boolean(match.mvpResolvedParticipantId) ||
      (await hasExistingHalisahaRoundActivity(match.id)));

  let targetMatchId = match.id;
  let targetRoundNumber = match.roundNumber;
  let archiveLogSummary: string | null = null;

  if (shouldArchiveForNewMatch) {
    const archiveResult = await archiveHalisahaMatchForNextRound({
      matchId: match.id,
      homeTeamName,
      awayTeamName,
      venueName,
      homeFormation,
      awayFormation,
      kickoffAt,
      matchDurationMinutes,
    });
    if (!archiveResult.ok) {
      return { ok: false, error: archiveResult.error };
    }

    targetMatchId = archiveResult.nextMatchId;
    targetRoundNumber = archiveResult.nextRoundNumber;
    archiveLogSummary = `${match.homeTeamName} vs ${match.awayTeamName} @ ${match.venueName} | archived:${archiveResult.archivedAt} | next_round:${archiveResult.nextRoundNumber}`;
  } else {
    await prisma.halisahaMatch.update({
      where: { id: match.id },
      data: {
        homeTeamName,
        awayTeamName,
        venueName,
        homeFormation,
        awayFormation,
        kickoffAt,
        matchDurationMinutes,
      },
    });
  }

  const clearedAssignmentsCount = await clearInvalidParticipantAssignmentsForMatch({
    id: targetMatchId,
    homeFormation,
    awayFormation,
  });

  await syncHalisahaWinnerQuestion({
    id: targetMatchId,
    homeTeamName,
    awayTeamName,
  });
  await syncHalisahaMvpPredictionQuestion(targetMatchId);
  await syncHalisahaPlayerPredictionQuestions(targetMatchId);

  if (archiveLogSummary) {
    await createAdminLog(
      admin.id,
      "halisaha_match_archived",
      "halisaha_match",
      match.id,
      `${match.homeTeamName} vs ${match.awayTeamName} | round:${match.roundNumber}`,
      archiveLogSummary,
    );
  }

  await createAdminLog(
    admin.id,
    "halisaha_match_updated",
    "halisaha_match",
    targetMatchId,
    null,
    `${homeTeamName} vs ${awayTeamName} @ ${venueName} (${matchDurationMinutes} min) | ${getHalisahaFormationLabel(
      homeFormation,
    )} vs ${getHalisahaFormationLabel(awayFormation)} | round:${targetRoundNumber}${
      shouldArchiveForNewMatch ? " | archived previous round" : ""
    }${clearedAssignmentsCount > 0 ? ` | cleared_assignments:${clearedAssignmentsCount}` : ""}`,
  );

  revalidateHalisahaPaths();

  const baseMessage = shouldArchiveForNewMatch
    ? "Halisaha match settings saved. Previous round archived and a new active match was created."
    : "Halisaha match settings saved.";

  return {
    ok: true,
    message:
      clearedAssignmentsCount > 0
        ? `${baseMessage} ${clearedAssignmentsCount} assignment(s) were cleared because they no longer fit the selected tactics.`
        : baseMessage,
  };
}

export async function setHalisahaMatchPublishedAction(
  publishToUsers: boolean,
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const match = await ensureActiveHalisahaMatch();

  await prisma.halisahaMatch.update({
    where: {
      id: match.id,
    },
    data: {
      isPublishedToUsers: publishToUsers,
    },
  });

  await createAdminLog(
    admin.id,
    "halisaha_match_visibility_updated",
    "halisaha_match",
    match.id,
    match.isPublishedToUsers ? "published" : "hidden",
    publishToUsers ? "published" : "hidden",
  );

  revalidateHalisahaPaths();

  return {
    ok: true,
    message: publishToUsers
      ? "Halisaha match is now visible to users."
      : "Halisaha match is now hidden from users.",
  };
}

export async function addHalisahaRegisteredParticipantAction(
  userId: string,
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const match = await ensureActiveHalisahaMatch();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      surname: true,
      status: true,
    },
  });

  if (!user) {
    return { ok: false, error: "User not found." };
  }

  if (user.status !== "approved") {
    return { ok: false, error: "Only approved users can be added." };
  }

  try {
    await prisma.halisahaParticipant.create({
      data: {
        matchId: match.id,
        userId: user.id,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "This user is already in the match squad." };
    }
    throw error;
  }

  await createAdminLog(
    admin.id,
    "halisaha_participant_added",
    "halisaha_participant",
    `${match.id}:${user.id}`,
    null,
    `${user.name} ${user.surname}`,
  );
  await syncHalisahaMvpPredictionQuestion(match.id);
  await syncHalisahaPlayerPredictionQuestions(match.id);
  revalidateHalisahaPaths({ includeLeaderboard: false });

  return {
    ok: true,
    message: "Player added to the Halisaha squad.",
  };
}

export async function addHalisahaGuestParticipantAction(
  guestName: string,
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const match = await ensureActiveHalisahaMatch();
  const displayName = normalizeGuestDisplayName(guestName);
  const normalizedGuestName = normalizeGuestLookupKey(guestName);

  if (!displayName) {
    return { ok: false, error: "Guest name is required." };
  }

  let createdParticipantId: string | null = null;
  let guestRegistryId: string | null = null;
  let createdRegistryEntry = false;
  let reactivatedRegistryEntry = false;

  try {
    await prisma.$transaction(async (tx) => {
      const existingGuest = await tx.halisahaGuest.findUnique({
        where: {
          normalizedName: normalizedGuestName,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      const registryGuest = existingGuest
        ? await tx.halisahaGuest.update({
            where: {
              normalizedName: normalizedGuestName,
            },
            data: {
              displayName,
              isActive: true,
            },
          })
        : await tx.halisahaGuest.create({
            data: {
              displayName,
              normalizedName: normalizedGuestName,
            },
          });

      guestRegistryId = registryGuest.id;
      createdRegistryEntry = !existingGuest;
      reactivatedRegistryEntry = Boolean(existingGuest && !existingGuest.isActive);

      const participant = await tx.halisahaParticipant.create({
        data: {
          matchId: match.id,
          guestId: registryGuest.id,
          guestName: registryGuest.displayName,
        },
      });
      createdParticipantId = participant.id;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "This guest is already in the match squad.",
      };
    }
    throw error;
  }

  if (!createdParticipantId || !guestRegistryId) {
    return { ok: false, error: "Guest could not be added." };
  }

  if (createdRegistryEntry || reactivatedRegistryEntry) {
    await createAdminLog(
      admin.id,
      createdRegistryEntry
        ? "halisaha_guest_registry_created"
        : "halisaha_guest_registry_reactivated",
      "halisaha_guest",
      guestRegistryId,
      null,
      displayName,
    );
  }

  await createAdminLog(
    admin.id,
    "halisaha_guest_added",
    "halisaha_participant",
    createdParticipantId,
    null,
    displayName,
  );
  await syncHalisahaMvpPredictionQuestion(match.id);
  await syncHalisahaPlayerPredictionQuestions(match.id);
  revalidateHalisahaPaths({ includeLeaderboard: false });

  return {
    ok: true,
    message: "Guest added to the Halisaha squad.",
  };
}

export async function addHalisahaGuestFromRegistryAction(
  guestId: string,
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const match = await ensureActiveHalisahaMatch();
  const normalizedGuestId = guestId.trim();

  if (!normalizedGuestId) {
    return { ok: false, error: "Pick a guest first." };
  }

  const guest = await prisma.halisahaGuest.findUnique({
    where: {
      id: normalizedGuestId,
    },
    select: {
      id: true,
      displayName: true,
      isActive: true,
    },
  });

  if (!guest || !guest.isActive) {
    return { ok: false, error: "Guest not found." };
  }

  let participantId: string;
  try {
    const participant = await prisma.halisahaParticipant.create({
      data: {
        matchId: match.id,
        guestId: guest.id,
        guestName: guest.displayName,
      },
      select: {
        id: true,
      },
    });
    participantId = participant.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "This guest is already in the match squad.",
      };
    }
    throw error;
  }

  await createAdminLog(
    admin.id,
    "halisaha_guest_added_from_registry",
    "halisaha_participant",
    participantId,
    null,
    guest.displayName,
  );
  await syncHalisahaMvpPredictionQuestion(match.id);
  await syncHalisahaPlayerPredictionQuestions(match.id);
  revalidateHalisahaPaths({ includeLeaderboard: false });

  return {
    ok: true,
    message: "Guest added from the saved guest list.",
  };
}

export async function deactivateHalisahaGuestRegistryAction(
  guestId: string,
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const normalizedGuestId = guestId.trim();

  if (!normalizedGuestId) {
    return { ok: false, error: "Guest not found." };
  }

  const guest = await prisma.halisahaGuest.findUnique({
    where: {
      id: normalizedGuestId,
    },
    select: {
      id: true,
      displayName: true,
      isActive: true,
    },
  });

  if (!guest?.isActive) {
    return { ok: false, error: "Guest not found." };
  }

  await prisma.halisahaGuest.update({
    where: {
      id: guest.id,
    },
    data: {
      isActive: false,
    },
  });

  await createAdminLog(
    admin.id,
    "halisaha_guest_registry_deactivated",
    "halisaha_guest",
    guest.id,
    guest.displayName,
    "inactive",
  );
  revalidateHalisahaPaths({ includeLeaderboard: false });

  return {
    ok: true,
    message: "Guest removed from the saved guest list.",
  };
}

export async function updateHalisahaParticipantAssignmentAction(
  participantId: string,
  data: {
    teamSide: HalisahaTeamSide | null;
    positionKey: HalisahaPositionKey | null;
    displayName?: string | null;
  },
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const participant = await prisma.halisahaParticipant.findUnique({
    where: { id: participantId },
    select: {
      id: true,
      matchId: true,
      guestName: true,
      guestId: true,
      displayNameOverride: true,
      teamSide: true,
      positionKey: true,
      guest: {
        select: {
          displayName: true,
        },
      },
      match: {
        select: {
          homeFormation: true,
          awayFormation: true,
        },
      },
      user: {
        select: {
          name: true,
          surname: true,
        },
      },
    },
  });

  if (!participant) {
    return { ok: false, error: "Participant not found." };
  }

  if (data.positionKey && !data.teamSide) {
    return {
      ok: false,
      error: "Pick a team before choosing a position.",
    };
  }

  if (data.teamSide && data.positionKey) {
    const selectedFormation = getFormationForTeamSide(participant.match, data.teamSide);
    if (!isHalisahaPositionAllowed(selectedFormation, data.positionKey)) {
      return {
        ok: false,
        error: "That position does not belong to the selected team tactic.",
      };
    }
  }

  const displayOrder =
    data.teamSide && data.positionKey
      ? getHalisahaPositionDisplayOrder(
          data.positionKey,
          getFormationForTeamSide(participant.match, data.teamSide),
        )
      : 0;

  const shouldUpdateDisplayName = Object.prototype.hasOwnProperty.call(data, "displayName");
  const defaultDisplayName = getParticipantDefaultDisplayName(participant);
  const normalizedDefaultDisplayName =
    normalizeParticipantVisibleName(defaultDisplayName) ?? defaultDisplayName;
  const nextVisibleDisplayName = normalizeParticipantVisibleName(data.displayName);
  const nextDisplayNameOverride =
    nextVisibleDisplayName && nextVisibleDisplayName !== normalizedDefaultDisplayName
      ? nextVisibleDisplayName
      : null;
  const previousVisibleDisplayName =
    normalizeParticipantVisibleName(participant.displayNameOverride) ?? normalizedDefaultDisplayName;

  const updateData: Prisma.HalisahaParticipantUpdateInput = {
    teamSide: data.teamSide,
    positionKey: data.positionKey,
    displayOrder,
  };

  if (shouldUpdateDisplayName) {
    updateData.displayNameOverride = nextDisplayNameOverride;
  }

  try {
    await prisma.halisahaParticipant.update({
      where: { id: participantId },
      data: updateData,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "That team slot is already occupied by another player.",
      };
    }
    throw error;
  }

  await createAdminLog(
    admin.id,
    "halisaha_participant_updated",
    "halisaha_participant",
    participantId,
    `${participant.teamSide ?? "unassigned"} / ${participant.positionKey ?? "unassigned"} / ${previousVisibleDisplayName}`,
    `${data.teamSide ?? "unassigned"} / ${data.positionKey ?? "unassigned"} / ${
      shouldUpdateDisplayName
        ? nextDisplayNameOverride ?? normalizedDefaultDisplayName
        : previousVisibleDisplayName
    }`,
  );

  await syncHalisahaMvpPredictionQuestion(participant.matchId);
  await syncHalisahaPlayerPredictionQuestions(participant.matchId);
  revalidateHalisahaPaths({ includeLeaderboard: false });

  return {
    ok: true,
    message: "Player assignment updated.",
  };
}

export async function removeHalisahaParticipantAction(
  participantId: string,
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const participant = await prisma.halisahaParticipant.findUnique({
    where: { id: participantId },
    include: {
      user: {
        select: {
          name: true,
          surname: true,
        },
      },
    },
  });

  if (!participant) {
    return { ok: false, error: "Participant not found." };
  }

  await prisma.halisahaParticipant.delete({
    where: { id: participantId },
  });

  const label = participant.user
    ? `${participant.user.name} ${participant.user.surname}`
    : participant.guestName ?? "Guest";

  await createAdminLog(
    admin.id,
    "halisaha_participant_removed",
    "halisaha_participant",
    participantId,
    label,
    null,
  );
  await syncHalisahaMvpPredictionQuestion(participant.matchId);
  await syncHalisahaPlayerPredictionQuestions(participant.matchId);
  revalidateHalisahaPaths({ includeLeaderboard: false });

  return {
    ok: true,
    message: "Participant removed from the Halisaha squad.",
  };
}

export async function clearHalisahaParticipantsAction(): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const match = await ensureActiveHalisahaMatch();
  const result = await prisma.halisahaParticipant.deleteMany({
    where: {
      matchId: match.id,
    },
  });

  if (result.count === 0) {
    return {
      ok: true,
      message: "There were no participants to remove.",
    };
  }

  await createAdminLog(
    admin.id,
    "halisaha_participants_cleared",
    "halisaha_match",
    match.id,
    String(result.count),
    "cleared",
  );
  await syncHalisahaMvpPredictionQuestion(match.id);
  await syncHalisahaPlayerPredictionQuestions(match.id);
  revalidateHalisahaPaths({ includeLeaderboard: false });

  return {
    ok: true,
    message: `Removed ${result.count} participant(s) from the Halisaha squad.`,
  };
}

export async function createHalisahaQuestionAction(data: {
  kind: HalisahaQuestionKind;
  prompt: string;
  points: number;
  options: Array<string | ManagedHalisahaQuestionOptionInput>;
}): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const match = await ensureActiveHalisahaMatch();
  const kind = normalizeManagedHalisahaQuestionKind(data.kind);
  const prompt = data.prompt.trim();
  const points = Number(data.points);
  const preparedOptionsResult = prepareQuestionOptions({
    kind,
    options: data.options,
  });

  if (!prompt) {
    return { ok: false, error: "Question text is required." };
  }
  if (!Number.isFinite(points) || points < 1) {
    return { ok: false, error: "Question points must be at least 1." };
  }
  if (!preparedOptionsResult.ok) {
    return { ok: false, error: preparedOptionsResult.error };
  }

  const maxSortOrder =
    (await prisma.halisahaQuestion.aggregate({
      where: {
        matchId: match.id,
        kind: {
          not: "winner",
        },
      },
      _max: { sortOrder: true },
    }))._max.sortOrder ?? 0;

  const question = await prisma.halisahaQuestion.create({
    data: {
      matchId: match.id,
      kind: preparedOptionsResult.kind,
      prompt,
      points,
      sortOrder: maxSortOrder + QUESTION_SORT_STEP,
      options: {
        create: preparedOptionsResult.preparedOptions.map((option) => ({
          label: option.label,
          kind: option.kind,
          sortOrder: option.sortOrder,
        })),
      },
    },
  });

  if (
    preparedOptionsResult.preparedOptions.some((option) => option.kind === "player_picker") ||
    preparedOptionsResult.kind === "player_prediction"
  ) {
    await syncHalisahaPlayerPredictionQuestions(match.id);
  }
  await resetResolutionState(match.id);
  await createAdminLog(
    admin.id,
    "halisaha_question_created",
    "halisaha_question",
    question.id,
    null,
    prompt,
  );

  revalidateHalisahaPaths();
  return { ok: true, message: "Question created." };
}

export async function updateHalisahaQuestionAction(
  questionId: string,
  data: {
    kind: HalisahaQuestionKind;
    prompt: string;
    points: number;
    options: Array<string | ManagedHalisahaQuestionOptionInput>;
    isActive: boolean;
  },
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const question = await prisma.halisahaQuestion.findUnique({
    where: { id: questionId },
    include: {
      match: {
        select: {
          id: true,
          homeTeamName: true,
          awayTeamName: true,
        },
      },
      options: {
        orderBy: { sortOrder: "asc" },
      },
      answers: {
        select: { id: true },
      },
    },
  });

  if (!question) {
    return { ok: false, error: "Question not found." };
  }

  const prompt = data.prompt.trim();
  const points = Number(data.points);
  const requestedEditableKind = normalizeManagedHalisahaQuestionKind(data.kind);
  const preparedOptionsResult =
    question.kind === "winner" || question.kind === "mvp_prediction"
      ? {
          ok: true as const,
          kind: question.kind,
          normalizedOptions: collapseStoredHalisahaQuestionOptionsToDrafts(question.options),
          preparedOptions: question.options.map((option) => ({
            label: option.label.trim(),
            kind: option.kind,
            sortOrder: option.sortOrder,
          })),
        }
      : prepareQuestionOptions({
          kind: requestedEditableKind,
          options: data.options,
        });
  const nextEditableKind = preparedOptionsResult.ok
    ? preparedOptionsResult.kind
    : requestedEditableKind;
  const resolvedNextKind =
    question.kind === "winner" || question.kind === "mvp_prediction"
      ? question.kind
      : nextEditableKind;

  if (!prompt) {
    return { ok: false, error: "Question text is required." };
  }
  if (!Number.isFinite(points) || points < 1) {
    return { ok: false, error: "Question points must be at least 1." };
  }
  if (!preparedOptionsResult.ok) {
    return { ok: false, error: preparedOptionsResult.error };
  }

  const existingDrafts =
    question.kind === "winner" || question.kind === "mvp_prediction"
      ? []
      : collapseStoredHalisahaQuestionOptionsToDrafts(question.options);
  const nextDrafts =
    question.kind === "winner" || question.kind === "mvp_prediction"
      ? []
      : preparedOptionsResult.normalizedOptions;
  const nextOptions = preparedOptionsResult.preparedOptions;
  const questionKindChanged = resolvedNextKind !== question.kind;
  const optionSetChanged =
    question.kind === "winner" || question.kind === "mvp_prediction"
      ? false
      : questionKindChanged ||
        nextDrafts.length !== existingDrafts.length ||
        nextDrafts.some(
          (option, index) =>
            option.label !== existingDrafts[index]?.label ||
            option.kind !== existingDrafts[index]?.kind,
        );
  const shouldClearExistingAnswers =
    question.kind !== "winner" &&
    question.kind !== "mvp_prediction" &&
    question.answers.length > 0 &&
    optionSetChanged;

  await prisma.$transaction(async (tx) => {
    await tx.halisahaQuestion.update({
      where: { id: questionId },
      data: {
        kind: resolvedNextKind,
        prompt,
        points,
        isActive:
          question.kind === "winner" || question.kind === "mvp_prediction" ? true : data.isActive,
        sortOrder: question.kind === "winner" ? 0 : question.sortOrder,
        ...(optionSetChanged
          ? {
              scoreHomeResult: null,
              scoreAwayResult: null,
            }
          : {}),
      },
    });

    if (
      question.kind !== "winner" &&
      question.kind !== "mvp_prediction" &&
      optionSetChanged
    ) {
      if (shouldClearExistingAnswers) {
        await tx.halisahaAnswer.deleteMany({
          where: {
            questionId,
          },
        });
      }
      await tx.halisahaQuestionOption.deleteMany({
        where: { questionId },
      });
      await tx.halisahaQuestionOption.createMany({
        data: nextOptions.map((option) => ({
          questionId,
          label: option.label,
          kind: option.kind,
          sortOrder: option.sortOrder,
          participantId: null,
          resolvedScoreHome: null,
          resolvedScoreAway: null,
        })),
      });
    }
  });

  if (question.kind === "winner") {
    await syncHalisahaWinnerQuestion({
      id: question.match.id,
      homeTeamName: question.match.homeTeamName,
      awayTeamName: question.match.awayTeamName,
    });
  }
  if (
    nextOptions.some((option) => option.kind === "player_picker") ||
    resolvedNextKind === "player_prediction"
  ) {
    await syncHalisahaPlayerPredictionQuestions(question.matchId);
  }
  if (question.kind === "mvp_prediction") {
    await syncHalisahaMvpPredictionQuestion(question.matchId);
  }

  await resetResolutionState(question.matchId);
  await createAdminLog(
    admin.id,
    "halisaha_question_updated",
    "halisaha_question",
    questionId,
    question.prompt,
    prompt,
  );
  revalidateHalisahaPaths();

  return {
    ok: true,
    message: shouldClearExistingAnswers
      ? "Question updated. Existing answers for this question were cleared because the option set changed."
      : "Question updated.",
  };
}

export async function moveHalisahaQuestionAction(
  questionId: string,
  direction: "up" | "down",
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const question = await prisma.halisahaQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      matchId: true,
      kind: true,
      prompt: true,
    },
  });

  if (!question) {
    return { ok: false, error: "Question not found." };
  }

  if (question.kind === "winner") {
    return {
      ok: false,
      error: "The winner strip stays fixed as question 1 on the public Halisaha screen.",
    };
  }

  const questions = await prisma.halisahaQuestion.findMany({
    where: {
      matchId: question.matchId,
      kind: {
        not: "winner",
      },
    },
    select: {
      id: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const currentIndex = questions.findIndex((entry) => entry.id === questionId);
  if (currentIndex === -1) {
    return { ok: false, error: "Question not found." };
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= questions.length) {
    return {
      ok: false,
      error:
        direction === "up"
          ? "This question is already at the top of the reorderable list."
          : "This question is already at the bottom of the reorderable list.",
    };
  }

  const reordered = [...questions];
  const [movedQuestion] = reordered.splice(currentIndex, 1);
  if (!movedQuestion) {
    return { ok: false, error: "Question not found." };
  }
  reordered.splice(targetIndex, 0, movedQuestion);

  await prisma.$transaction(
    reordered.map((entry, index) =>
      prisma.halisahaQuestion.update({
        where: { id: entry.id },
        data: {
          sortOrder: (index + 1) * QUESTION_SORT_STEP,
        },
      }),
    ),
  );

  await createAdminLog(
    admin.id,
    "halisaha_question_reordered",
    "halisaha_question",
    question.id,
    `${question.prompt} (${direction})`,
    `position:${targetIndex + 1}`,
  );
  revalidateHalisahaPaths();

  return {
    ok: true,
    message:
      direction === "up"
        ? "Question moved up."
        : "Question moved down.",
  };
}

export async function deleteHalisahaQuestionAction(
  questionId: string,
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const question = await prisma.halisahaQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      kind: true,
      matchId: true,
      prompt: true,
    },
  });

  if (!question) {
    return { ok: false, error: "Question not found." };
  }

  if (question.kind === "winner" || question.kind === "mvp_prediction") {
    return {
      ok: false,
      error:
        question.kind === "winner"
          ? "The pinned match winner question cannot be deleted."
          : "The pinned MVP prediction question cannot be deleted.",
    };
  }

  await prisma.halisahaQuestion.delete({
    where: { id: questionId },
  });
  await resetResolutionState(question.matchId);
  await createAdminLog(
    admin.id,
    "halisaha_question_deleted",
    "halisaha_question",
    questionId,
    question.prompt,
    null,
  );
  revalidateHalisahaPaths();

  return { ok: true, message: "Question deleted." };
}

export async function setHalisahaQuestionCorrectOptionAction(
  questionId: string,
  optionId: string | null,
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const question = await prisma.halisahaQuestion.findUnique({
    where: { id: questionId },
    include: {
      options: true,
    },
  });

  if (!question) {
    return { ok: false, error: "Question not found." };
  }

  if (question.kind === "mvp_prediction") {
    return {
      ok: false,
      error: "The MVP prediction question is resolved automatically from MVP voting.",
    };
  }

  const fixedChoiceOptions = question.options.filter((option) => option.kind === "standard");
  if (fixedChoiceOptions.length === 0) {
    return {
      ok: false,
      error: "This question does not have any fixed-choice rows to resolve.",
    };
  }

  if (
    optionId &&
    !fixedChoiceOptions.some((option) => option.id === optionId)
  ) {
    return { ok: false, error: "Correct option is invalid." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.halisahaQuestionOption.updateMany({
      where: { questionId },
      data: { isCorrect: false },
    });

    if (optionId) {
      await tx.halisahaQuestionOption.update({
        where: { id: optionId },
        data: { isCorrect: true },
      });
    }
  });

  await resetResolutionState(question.matchId);
  await createAdminLog(
    admin.id,
    "halisaha_question_resolved_option",
    "halisaha_question",
    questionId,
    null,
    optionId ?? "cleared",
  );
  revalidateHalisahaPaths();

  return {
    ok: true,
    message: optionId
      ? "Correct option updated."
      : "Correct option cleared.",
  };
}

export async function setHalisahaScoreQuestionResultAction(
  questionId: string,
  optionId: string,
  score: {
    home: number | null;
    away: number | null;
  } | null,
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const question = await prisma.halisahaQuestion.findUnique({
    where: { id: questionId },
    include: {
      options: true,
    },
  });

  if (!question) {
    return { ok: false, error: "Question not found." };
  }

  const option = question.options.find((entry) => entry.id === optionId);
  if (!option) {
    return { ok: false, error: "Question option not found." };
  }

  if (option.kind !== "custom_score" && option.kind !== "custom_number") {
    return {
      ok: false,
      error: "Only numeric option rows can store an actual result.",
    };
  }

  const home = score?.home;
  const away = score?.away;
  const isSingleNumberQuestion = option.kind === "custom_number";
  const shouldClear = home === null || (!isSingleNumberQuestion && away === null);
  const resolvedHome = shouldClear ? null : home;
  const resolvedAway = shouldClear ? null : isSingleNumberQuestion ? null : away;

  if (!shouldClear) {
    if (
      resolvedHome == null ||
      !Number.isInteger(resolvedHome) ||
      resolvedHome < 0 ||
      (!isSingleNumberQuestion &&
        (resolvedAway == null || !Number.isInteger(resolvedAway) || resolvedAway < 0))
    ) {
      return {
        ok: false,
        error: isSingleNumberQuestion
          ? "Enter a valid whole number for the actual result."
          : "Enter valid whole numbers for the actual home and away scores.",
      };
    }
  }

  const numericOptions = question.options
    .filter(
      (entry) => entry.kind === "custom_score" || entry.kind === "custom_number",
    )
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const primaryNumericOptionId = numericOptions[0]?.id ?? null;
  const primaryNumericOption =
    primaryNumericOptionId === option.id
      ? {
          ...option,
          resolvedScoreHome: resolvedHome,
          resolvedScoreAway: resolvedAway,
        }
      : numericOptions[0] ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.halisahaQuestionOption.update({
      where: { id: optionId },
      data: {
        resolvedScoreHome: resolvedHome,
        resolvedScoreAway: resolvedAway,
      },
    });

    await tx.halisahaQuestion.update({
      where: { id: questionId },
      data: {
        scoreHomeResult: primaryNumericOption?.resolvedScoreHome ?? null,
        scoreAwayResult:
          primaryNumericOption?.kind === "custom_score"
            ? primaryNumericOption.resolvedScoreAway
            : null,
      },
    });
  });

  await resetResolutionState(question.matchId);
  await createAdminLog(
    admin.id,
    "halisaha_question_score_result",
    "halisaha_question",
    optionId,
    null,
    shouldClear
      ? "cleared"
      : isSingleNumberQuestion
        ? `${option.label}: ${resolvedHome}`
        : `${option.label}: ${resolvedHome}-${resolvedAway}`,
  );
  revalidateHalisahaPaths();

  return {
    ok: true,
    message: shouldClear
      ? "Actual result cleared."
      : option.kind === "custom_number"
        ? "Actual value saved."
        : "Actual score saved.",
  };
}

export async function scoreHalisahaAnswersAction(): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const match = await ensureActiveHalisahaMatch();

  const result = await scoreHalisahaAnswers(match.id);
  if (!result.ok) {
    return result;
  }

  await createAdminLog(
    admin.id,
    "halisaha_answers_scored",
    "halisaha_match",
    match.id,
    null,
    "answers_scored",
  );
  revalidateHalisahaPaths();

  return {
    ok: true,
    message: "Answers scored and winners updated.",
  };
}

export async function resolveHalisahaMvpFromVotesAction(): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const match = await ensureActiveHalisahaMatch();

  if (getHalisahaMatchPhase(match) === "pre_match") {
    return {
      ok: false,
      error: "The match has not finished yet, so MVP voting cannot be resolved.",
    };
  }

  const resolvedParticipantId = await resolveHalisahaMvpFromVotes(match.id);
  if (!resolvedParticipantId) {
    return {
      ok: false,
      error:
        "No MVP winner could be resolved yet. Wait for the vote window to close and make sure at least one vote exists.",
    };
  }

  await createAdminLog(
    admin.id,
    "halisaha_mvp_resolved",
    "halisaha_match",
    match.id,
    null,
    resolvedParticipantId,
  );
  revalidateHalisahaPaths();

  return {
    ok: true,
    message: "Community MVP resolved from vote totals.",
  };
}
