"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, type AuthUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/db";
import {
  canAccessHalisahaMode,
  HALISAHA_ADMIN_PREVIEW_ONLY_MESSAGE,
} from "@/lib/halisaha/public-access";
import {
  getHalisahaMatchPhase,
  isHalisahaPredictionWindowOpen,
} from "@/lib/halisaha/match-state";

export type HalisahaAnswerActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

type HalisahaAnswerSelection = {
  questionId: string;
  optionId: string;
  customScoreHome?: number | null;
  customScoreAway?: number | null;
};

type SubmitHalisahaAnswersOptions = {
  finalize?: boolean;
};

function resolveHalisahaActor(
  user: AuthUser | null,
):
  | { ok: false; state: HalisahaAnswerActionState }
  | { ok: true; user: AuthUser } {
  if (!user) {
    return { ok: false, state: { ok: false, error: "You must be logged in." } };
  }
  if (!canAccessHalisahaMode(user.role)) {
    return {
      ok: false,
      state: { ok: false, error: HALISAHA_ADMIN_PREVIEW_ONLY_MESSAGE },
    };
  }
  return { ok: true, user };
}

function normalizeAnswerSelections(selections: HalisahaAnswerSelection[]) {
  const uniqueSelections = new Map<string, HalisahaAnswerSelection>();

  for (const selection of selections) {
    const questionId = selection.questionId.trim();
    const optionId = selection.optionId.trim();
    if (!questionId || !optionId) {
      continue;
    }

    uniqueSelections.set(questionId, {
      questionId,
      optionId,
      customScoreHome:
        typeof selection.customScoreHome === "number" &&
        Number.isInteger(selection.customScoreHome) &&
        selection.customScoreHome >= 0
          ? selection.customScoreHome
          : null,
      customScoreAway:
        typeof selection.customScoreAway === "number" &&
        Number.isInteger(selection.customScoreAway) &&
        selection.customScoreAway >= 0
          ? selection.customScoreAway
          : null,
    });
  }

  return [...uniqueSelections.values()];
}

export async function submitHalisahaAnswersAction(
  selections: HalisahaAnswerSelection[],
  options: SubmitHalisahaAnswersOptions = {},
): Promise<HalisahaAnswerActionState> {
  const actor = resolveHalisahaActor(await getCurrentUser());
  if (!actor.ok) {
    return actor.state;
  }
  const { user } = actor;

  const normalizedSelections = normalizeAnswerSelections(selections);
  if (normalizedSelections.length === 0) {
    return { ok: false, error: "Select at least one answer first." };
  }

  const questionIds = normalizedSelections.map((selection) => selection.questionId);
  const questions = await prisma.halisahaQuestion.findMany({
    where: {
      id: {
        in: questionIds,
      },
    },
    include: {
      match: {
        select: {
          id: true,
          answersResolvedAt: true,
          kickoffAt: true,
          matchDurationMinutes: true,
        },
      },
      options: {
        select: {
          id: true,
          kind: true,
        },
      },
    },
  });

  if (questions.length !== normalizedSelections.length) {
    return { ok: false, error: "Question not found." };
  }

  if (questions.some((question) => !question.isActive)) {
    return { ok: false, error: "One or more questions are not active." };
  }

  if (questions.some((question) => question.match.answersResolvedAt)) {
    return {
      ok: false,
      error: "Answers have already been resolved for this match.",
    };
  }

  const questionById = new Map(questions.map((question) => [question.id, question]));
  const matchIds = new Set(questions.map((question) => question.match.id));
  if (matchIds.size !== 1) {
    return {
      ok: false,
      error: "Answers must belong to the same Halisaha match.",
    };
  }

  const matchId = questions[0]?.match.id;
  if (!matchId) {
    return { ok: false, error: "Match not found." };
  }

  const match = questions[0]?.match;
  if (!match) {
    return { ok: false, error: "Match not found." };
  }

  if (
    user.role !== "admin" &&
    !isHalisahaPredictionWindowOpen({
      kickoffAt: match.kickoffAt,
    })
  ) {
    return {
      ok: false,
      error: "Predictions close 5 minutes before kickoff.",
    };
  }

  const existingFinalAnswer = await prisma.halisahaAnswer.findFirst({
    where: {
      matchId,
      userId: user.id,
      isFinal: true,
    },
    select: {
      id: true,
    },
  });

  if (existingFinalAnswer) {
    return {
      ok: false,
      error: "Your answers are already locked for this match.",
    };
  }

  for (const selection of normalizedSelections) {
    const question = questionById.get(selection.questionId);
    if (!question) {
      return { ok: false, error: "Question not found." };
    }

    const selectedOption = question.options.find((option) => option.id === selection.optionId);
    if (!selectedOption) {
      return { ok: false, error: "Invalid answer option." };
    }

    if (selectedOption.kind === "custom_score") {
      if (
        selection.customScoreHome === null ||
        selection.customScoreAway === null
      ) {
        return {
          ok: false,
          error: "Enter both home and away values for the custom score option.",
        };
      }
    }
  }

  const finalizedAt = options.finalize ? new Date() : null;

  await prisma.$transaction(async (tx) => {
    for (const selection of normalizedSelections) {
      const question = questionById.get(selection.questionId)!;

      await tx.halisahaAnswer.upsert({
        where: {
          questionId_userId: {
            questionId: selection.questionId,
            userId: user.id,
          },
        },
        update: {
          selectedOptionId: selection.optionId,
          customScoreHome: selection.customScoreHome ?? null,
          customScoreAway: selection.customScoreAway ?? null,
          isCorrect: null,
          awardedPoints: 0,
          matchId: question.match.id,
          isFinal: Boolean(options.finalize),
          finalizedAt,
        },
        create: {
          matchId: question.match.id,
          questionId: selection.questionId,
          userId: user.id,
          selectedOptionId: selection.optionId,
          customScoreHome: selection.customScoreHome ?? null,
          customScoreAway: selection.customScoreAway ?? null,
          isFinal: Boolean(options.finalize),
          finalizedAt,
        },
      });
    }

    if (options.finalize) {
      await tx.halisahaAnswer.updateMany({
        where: {
          matchId,
          userId: user.id,
        },
        data: {
          isFinal: true,
          finalizedAt,
        },
      });
    }
  });

  revalidatePath("/halisaha");
  return {
    ok: true,
    message: options.finalize
      ? "Answers locked."
      : normalizedSelections.length === 1
        ? "Answer saved."
        : "Answers saved.",
  };
}

export async function submitHalisahaAnswerAction(
  questionId: string,
  optionId: string,
  customScore?: {
    home: number | null;
    away: number | null;
  },
): Promise<HalisahaAnswerActionState> {
  return submitHalisahaAnswersAction([
    {
      questionId,
      optionId,
      customScoreHome: customScore?.home ?? null,
      customScoreAway: customScore?.away ?? null,
    },
  ]);
}

export async function finalizeHalisahaAnswersAction(
  selections: HalisahaAnswerSelection[],
): Promise<HalisahaAnswerActionState> {
  return submitHalisahaAnswersAction(selections, {
    finalize: true,
  });
}

export async function unlockHalisahaAnswersAction(
  matchId: string,
): Promise<HalisahaAnswerActionState> {
  const actor = resolveHalisahaActor(await getCurrentUser());
  if (!actor.ok) {
    return actor.state;
  }
  const { user } = actor;

  const normalizedMatchId = matchId.trim();
  if (!normalizedMatchId) {
    return { ok: false, error: "Match not found." };
  }

  const match = await prisma.halisahaMatch.findUnique({
    where: { id: normalizedMatchId },
    select: {
      id: true,
      answersResolvedAt: true,
    },
  });

  if (!match) {
    return { ok: false, error: "Match not found." };
  }

  if (match.answersResolvedAt) {
    return {
      ok: false,
      error: "Resolved answers cannot be unlocked.",
    };
  }

  const lockedAnswer = await prisma.halisahaAnswer.findFirst({
    where: {
      matchId: match.id,
      userId: user.id,
      isFinal: true,
    },
    select: {
      id: true,
    },
  });

  if (!lockedAnswer) {
    return {
      ok: false,
      error: "Your answers are not locked for this match.",
    };
  }

  await prisma.halisahaAnswer.updateMany({
    where: {
      matchId: match.id,
      userId: user.id,
      isFinal: true,
    },
    data: {
      isFinal: false,
      finalizedAt: null,
      isCorrect: null,
      awardedPoints: 0,
    },
  });

  revalidatePath("/halisaha");
  return {
    ok: true,
    message: "Answers unlocked.",
  };
}

export async function submitPostMatchMvpVoteAction(
  matchId: string,
  participantId: string,
): Promise<HalisahaAnswerActionState> {
  const actor = resolveHalisahaActor(await getCurrentUser());
  if (!actor.ok) {
    return actor.state;
  }
  const { user } = actor;

  const normalizedMatchId = matchId.trim();
  const normalizedParticipantId = participantId.trim();
  if (!normalizedMatchId || !normalizedParticipantId) {
    return { ok: false, error: "Pick an MVP first." };
  }

  const match = await prisma.halisahaMatch.findUnique({
    where: { id: normalizedMatchId },
    select: {
      id: true,
      kickoffAt: true,
      matchDurationMinutes: true,
      participants: {
        where: {
          teamSide: {
            not: null,
          },
          positionKey: {
            not: null,
          },
        },
        select: {
          id: true,
        },
      },
      mvpVotes: {
        where: {
          userId: user.id,
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!match) {
    return { ok: false, error: "Match not found." };
  }

  if (getHalisahaMatchPhase(match) === "pre_match") {
    return {
      ok: false,
      error: "MVP voting opens after the match finishes.",
    };
  }

  if (match.mvpVotes.length > 0) {
    return {
      ok: false,
      error: "You already submitted your MVP vote for this match.",
    };
  }

  if (!match.participants.some((participant) => participant.id === normalizedParticipantId)) {
    return {
      ok: false,
      error: "That player is not available for MVP voting.",
    };
  }

  await prisma.halisahaMvpVote.create({
    data: {
      matchId: match.id,
      userId: user.id,
      participantId: normalizedParticipantId,
    },
  });

  revalidatePath("/halisaha");
  revalidatePath("/leaderboard");
  return {
    ok: true,
    message: "Your MVP vote has been submitted.",
  };
}
