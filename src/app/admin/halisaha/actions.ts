"use server";

import {
  Prisma,
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
  getHalisahaPositionDisplayOrder,
} from "@/lib/halisaha/config";
import { formatScoreLabel, parseScoreLabel } from "@/lib/halisaha/match-state";
import {
  archiveHalisahaMatchForNextRound,
  ensureActiveHalisahaMatch,
  resolveHalisahaMvpFromVotes,
  scoreHalisahaAnswers,
  syncHalisahaMvpPredictionQuestion,
  syncHalisahaWinnerQuestion,
} from "@/lib/halisaha/server";
import { getHalisahaMatchPhase } from "@/lib/halisaha/match-state";

export type HalisahaAdminActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const CUSTOM_SCORE_OPTION_LABEL = "Your exact score";

function normalizeOptions(options: string[]) {
  return options.map((option) => option.trim()).filter(Boolean);
}

function prepareQuestionOptions(input: {
  kind: HalisahaQuestionKind;
  options: string[];
  includeCustomScoreOption?: boolean;
}) {
  if (input.kind === "score_prediction") {
    const fixedScoreOptions = normalizeOptions(input.options).map((option) => {
      const parsed = parseScoreLabel(option);
      return parsed ? formatScoreLabel(parsed) : option;
    });

    if (fixedScoreOptions.some((option) => parseScoreLabel(option) === null)) {
      return {
        ok: false as const,
        error:
          'Every fixed score option must use the "home-away" format, for example 6-4.',
      };
    }

    const preparedOptions = [
      ...fixedScoreOptions.map((label) => ({
        label,
        kind: "standard" as const,
      })),
      ...(input.includeCustomScoreOption
        ? [
            {
              label: CUSTOM_SCORE_OPTION_LABEL,
              kind: "custom_score" as const,
            },
          ]
        : []),
    ];

    if (fixedScoreOptions.length < 1) {
      return {
        ok: false as const,
        error: "Add at least one fixed score option for a score prediction question.",
      };
    }

    if (preparedOptions.length < 2) {
      return {
        ok: false as const,
        error:
          "A score prediction question needs at least two answer choices in total.",
      };
    }

    return {
      ok: true as const,
      preparedOptions,
    };
  }

  const preparedOptions = normalizeOptions(input.options).map((label) => ({
    label,
    kind: "standard" as const,
  }));

  if (preparedOptions.length < 2) {
    return { ok: false as const, error: "Add at least 2 answer options." };
  }

  return {
    ok: true as const,
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

  const questionIds = (
    await prisma.halisahaQuestion.findMany({
      where: {
        matchId,
        kind: {
          not: "mvp_prediction",
        },
      },
      select: {
        id: true,
      },
    })
  ).map((question) => question.id);

  const operations: Array<Prisma.PrismaPromise<unknown>> = [
    prisma.halisahaMatch.update({
      where: { id: matchId },
      data: { answersResolvedAt: null },
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

function revalidateHalisahaPaths() {
  revalidatePath("/admin/halisaha");
  revalidatePath("/admin/halisaha/predictions");
  revalidatePath("/halisaha");
  revalidatePath("/leaderboard");
}

export async function saveHalisahaMatchSettingsAction(data: {
  homeTeamName: string;
  awayTeamName: string;
  venueName: string;
  kickoffDate: string;
  kickoffTime: string;
  matchDurationMinutes: number;
}): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const match = await ensureActiveHalisahaMatch();
  const homeTeamName = data.homeTeamName.trim();
  const awayTeamName = data.awayTeamName.trim();
  const venueName = data.venueName.trim();
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
        kickoffAt,
        matchDurationMinutes,
      },
    });
  }

  await syncHalisahaWinnerQuestion({
    id: targetMatchId,
    homeTeamName,
    awayTeamName,
  });
  await syncHalisahaMvpPredictionQuestion(targetMatchId);

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
    `${homeTeamName} vs ${awayTeamName} @ ${venueName} (${matchDurationMinutes} min) | round:${targetRoundNumber}${
      shouldArchiveForNewMatch ? " | archived previous round" : ""
    }`,
  );

  revalidateHalisahaPaths();

  return {
    ok: true,
    message: shouldArchiveForNewMatch
      ? "Halisaha match settings saved. Previous round archived and a new active match was created."
      : "Halisaha match settings saved.",
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
  revalidateHalisahaPaths();

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
  const normalizedGuestName = guestName.trim();

  if (!normalizedGuestName) {
    return { ok: false, error: "Guest name is required." };
  }

  const participant = await prisma.halisahaParticipant.create({
    data: {
      matchId: match.id,
      guestName: normalizedGuestName,
    },
  });

  await createAdminLog(
    admin.id,
    "halisaha_guest_added",
    "halisaha_participant",
    participant.id,
    null,
    normalizedGuestName,
  );
  revalidateHalisahaPaths();

  return {
    ok: true,
    message: "Guest added to the Halisaha squad.",
  };
}

export async function updateHalisahaParticipantAssignmentAction(
  participantId: string,
  data: {
    teamSide: HalisahaTeamSide | null;
    positionKey: HalisahaPositionKey | null;
  },
): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const participant = await prisma.halisahaParticipant.findUnique({
    where: { id: participantId },
    select: {
      id: true,
      matchId: true,
      guestName: true,
      teamSide: true,
      positionKey: true,
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

  const displayOrder = data.positionKey
    ? getHalisahaPositionDisplayOrder(data.positionKey)
    : 0;

  try {
    await prisma.halisahaParticipant.update({
      where: { id: participantId },
      data: {
        teamSide: data.teamSide,
        positionKey: data.positionKey,
        displayOrder,
      },
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
    `${participant.teamSide ?? "unassigned"} / ${participant.positionKey ?? "unassigned"}`,
    `${data.teamSide ?? "unassigned"} / ${data.positionKey ?? "unassigned"}`,
  );

  revalidateHalisahaPaths();

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
  revalidateHalisahaPaths();

  return {
    ok: true,
    message: "Participant removed from the Halisaha squad.",
  };
}

export async function createHalisahaQuestionAction(data: {
  kind: HalisahaQuestionKind;
  prompt: string;
  points: number;
  options: string[];
  includeCustomScoreOption?: boolean;
}): Promise<HalisahaAdminActionState> {
  const admin = await requireAdmin();
  const match = await ensureActiveHalisahaMatch();
  const kind =
    data.kind === "score_prediction" ? "score_prediction" : "standard";
  const prompt = data.prompt.trim();
  const points = Number(data.points);
  const preparedOptionsResult = prepareQuestionOptions({
    kind,
    options: data.options,
    includeCustomScoreOption: data.includeCustomScoreOption,
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
          in: ["standard", "score_prediction"],
        },
      },
      _max: { sortOrder: true },
    }))._max.sortOrder ?? 0;

  const question = await prisma.halisahaQuestion.create({
    data: {
      matchId: match.id,
      kind,
      prompt,
      points,
      sortOrder: maxSortOrder + 10,
      options: {
        create: preparedOptionsResult.preparedOptions.map((option, index) => ({
          label: option.label,
          kind: option.kind,
          sortOrder: (index + 1) * 10,
        })),
      },
    },
  });

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
    prompt: string;
    points: number;
    options: string[];
    isActive: boolean;
    includeCustomScoreOption?: boolean;
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
  const preparedOptionsResult =
    question.kind === "winner" || question.kind === "mvp_prediction"
      ? {
          ok: true as const,
          preparedOptions: question.options.map((option) => ({
            label: option.label.trim(),
            kind: option.kind,
          })),
        }
      : prepareQuestionOptions({
          kind: question.kind,
          options: data.options,
          includeCustomScoreOption: data.includeCustomScoreOption,
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

  const existingOptions = question.options.map((option) => ({
    label: option.label.trim(),
    kind: option.kind,
  }));
  const nextOptions = preparedOptionsResult.preparedOptions;
  const optionSetChanged =
    nextOptions.length !== existingOptions.length ||
    nextOptions.some(
      (option, index) =>
        option.label !== existingOptions[index]?.label ||
        option.kind !== existingOptions[index]?.kind,
    );

  if (
    question.kind !== "winner" &&
    question.kind !== "mvp_prediction" &&
    question.answers.length > 0 &&
    optionSetChanged
  ) {
    return {
      ok: false,
      error:
        "Options cannot be changed after users have answered. Create a new question or clear answers first.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.halisahaQuestion.update({
      where: { id: questionId },
      data: {
        prompt,
        points,
        isActive:
          question.kind === "winner" || question.kind === "mvp_prediction"
            ? true
            : data.isActive,
        sortOrder:
          question.kind === "winner"
            ? 0
            : question.kind === "mvp_prediction"
              ? 5
              : question.sortOrder,
        ...(question.kind === "score_prediction" && optionSetChanged
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
      await tx.halisahaQuestionOption.deleteMany({
        where: { questionId },
      });
      await tx.halisahaQuestionOption.createMany({
        data: nextOptions.map((option, index) => ({
          questionId,
          label: option.label,
          kind: option.kind,
          sortOrder: (index + 1) * 10,
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

  return { ok: true, message: "Question updated." };
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

  if (question.kind === "score_prediction") {
    return {
      ok: false,
      error: "Use the actual score inputs for score prediction questions.",
    };
  }

  if (question.kind === "mvp_prediction") {
    return {
      ok: false,
      error: "The MVP prediction question is resolved automatically from MVP voting.",
    };
  }

  if (
    optionId &&
    !question.options.some((option) => option.id === optionId)
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

  if (question.kind !== "score_prediction") {
    return {
      ok: false,
      error: "Only score prediction questions can store an actual score.",
    };
  }

  const home = score?.home;
  const away = score?.away;
  const shouldClear = home === null || away === null;
  const resolvedHome = shouldClear ? null : home;
  const resolvedAway = shouldClear ? null : away;

  if (!shouldClear) {
    if (
      resolvedHome == null ||
      resolvedAway == null ||
      !Number.isInteger(resolvedHome) ||
      !Number.isInteger(resolvedAway) ||
      resolvedHome < 0 ||
      resolvedAway < 0
    ) {
      return {
        ok: false,
        error: "Enter valid whole numbers for the actual home and away scores.",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.halisahaQuestion.update({
      where: { id: questionId },
      data: {
        scoreHomeResult: resolvedHome,
        scoreAwayResult: resolvedAway,
      },
    });

    await tx.halisahaQuestionOption.updateMany({
      where: { questionId },
      data: { isCorrect: false },
    });

    if (!shouldClear) {
      const correctOptionIds = question.options
        .filter((option) => option.kind === "standard")
        .filter((option) => {
          const parsed = parseScoreLabel(option.label);
          return (
            parsed !== null &&
            parsed.home === resolvedHome &&
            parsed.away === resolvedAway
          );
        })
        .map((option) => option.id);

      if (correctOptionIds.length > 0) {
        await tx.halisahaQuestionOption.updateMany({
          where: {
            id: {
              in: correctOptionIds,
            },
          },
          data: {
            isCorrect: true,
          },
        });
      }
    }
  });

  await resetResolutionState(question.matchId);
  await createAdminLog(
    admin.id,
    "halisaha_question_score_result",
    "halisaha_question",
    questionId,
    null,
    shouldClear ? "cleared" : `${resolvedHome}-${resolvedAway}`,
  );
  revalidateHalisahaPaths();

  return {
    ok: true,
    message: shouldClear ? "Actual score cleared." : "Actual score saved.",
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
