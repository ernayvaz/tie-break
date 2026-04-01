import {
  Prisma,
  type HalisahaParticipant,
  type HalisahaPositionKey,
  type HalisahaQuestionKind,
  type HalisahaQuestionOptionKind,
  type HalisahaTeamSide,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createIstanbulDateFromParts,
  formatHalisahaKickoffLabel,
  getHalisahaPositionDisplayOrder,
  getHalisahaPositionLabel,
  HALISAHA_DEFAULT_AWAY_TEAM,
  HALISAHA_DEFAULT_HOME_TEAM,
  HALISAHA_DEFAULT_VENUE,
  HALISAHA_MATCH_SINGLETON_KEY,
  HALISAHA_TIMEZONE,
  HALISAHA_TITLE,
  toIstanbulDateInput,
  toIstanbulTimeInput,
} from "./config";
import {
  formatScoreLabel,
  getHalisahaMatchEndAt,
  getHalisahaMatchPhase,
  getHalisahaMvpVoteEndsAt,
  HALISAHA_DEFAULT_MATCH_DURATION_MINUTES,
  type HalisahaMatchPhase,
} from "./match-state";
import {
  buildHalisahaMvpGateState,
  getMatchingFixedScoreOptionIds,
  isCustomScoreExactMatch,
  maskHalisahaAnswerForGate,
} from "./rules";
import {
  composeHalisahaCumulativeLeaderboard,
  mergeHalisahaResultRowSeeds,
  rankHalisahaResultRows,
  type HalisahaRecentAnswerRow,
  type HalisahaResultRow,
  type HalisahaResultRowSeed,
} from "./leaderboard";

const DEFAULT_KICKOFF_AT = createIstanbulDateFromParts(2026, 3, 27, 20, 0);
const DEFAULT_WINNER_QUESTION_PROMPT = "Who wins?";
const DEFAULT_WINNER_QUESTION_POINTS = 1;
const DEFAULT_MVP_PREDICTION_PROMPT = "Who will be the MVP?";
const DEFAULT_MVP_PREDICTION_POINTS = 1;
const DEFAULT_POST_MATCH_MVP_PROMPT = "Who was the MVP?";
const LEGACY_WINNER_QUESTION_PROMPTS = new Set([
  "kim kazanir?",
  "kim kazanır?",
  "who wins?",
]);

const FALLBACK_PARTICIPANTS: Array<{
  id: string;
  guestName: string;
  teamSide: HalisahaTeamSide;
  positionKey: HalisahaPositionKey;
}> = [
  {
    id: "fallback-home-goalkeeper",
    guestName: "Mert Kaya",
    teamSide: "home",
    positionKey: "goalkeeper",
  },
  {
    id: "fallback-home-left-defender",
    guestName: "Bora Demir",
    teamSide: "home",
    positionKey: "left_defender",
  },
  {
    id: "fallback-home-right-defender",
    guestName: "Ege Acar",
    teamSide: "home",
    positionKey: "right_defender",
  },
  {
    id: "fallback-home-left-wing",
    guestName: "Emre Tunc",
    teamSide: "home",
    positionKey: "left_wing",
  },
  {
    id: "fallback-home-center-midfield",
    guestName: "Kaan Yilmaz",
    teamSide: "home",
    positionKey: "center_midfield",
  },
  {
    id: "fallback-home-right-wing",
    guestName: "Deniz Arslan",
    teamSide: "home",
    positionKey: "right_wing",
  },
  {
    id: "fallback-home-striker",
    guestName: "Can Aksoy",
    teamSide: "home",
    positionKey: "striker",
  },
  {
    id: "fallback-away-goalkeeper",
    guestName: "Ali Riza",
    teamSide: "away",
    positionKey: "goalkeeper",
  },
  {
    id: "fallback-away-left-defender",
    guestName: "Kerem Aydin",
    teamSide: "away",
    positionKey: "left_defender",
  },
  {
    id: "fallback-away-right-defender",
    guestName: "Ozan Tekin",
    teamSide: "away",
    positionKey: "right_defender",
  },
  {
    id: "fallback-away-left-wing",
    guestName: "Burak Eren",
    teamSide: "away",
    positionKey: "left_wing",
  },
  {
    id: "fallback-away-center-midfield",
    guestName: "Tolga Sari",
    teamSide: "away",
    positionKey: "center_midfield",
  },
  {
    id: "fallback-away-right-wing",
    guestName: "Mete Korkmaz",
    teamSide: "away",
    positionKey: "right_wing",
  },
  {
    id: "fallback-away-striker",
    guestName: "Yigit Cinar",
    teamSide: "away",
    positionKey: "striker",
  },
];

type DbClient = typeof prisma | Prisma.TransactionClient;

type ParticipantWithUser = HalisahaParticipant & {
  user: {
    id: string;
    name: string;
    surname: string;
    username: string;
  } | null;
};

type PublicQuestionInput = {
  id: string;
  kind: HalisahaQuestionKind;
  prompt: string;
  points: number;
  sortOrder: number;
  scoreHomeResult: number | null;
  scoreAwayResult: number | null;
  isActive: boolean;
  options: Array<{
    id: string;
    label: string;
    kind: HalisahaQuestionOptionKind;
    participantId: string | null;
    sortOrder: number;
    isCorrect: boolean;
    participant: {
      teamSide: HalisahaTeamSide | null;
    } | null;
  }>;
};

export type HalisahaAdminQuestionRow = {
  id: string;
  kind: HalisahaQuestionKind;
  prompt: string;
  points: number;
  sortOrder: number;
  isActive: boolean;
  scoreHomeResult: number | null;
  scoreAwayResult: number | null;
  optionCount: number;
  answerCount: number;
  options: Array<{
    id: string;
    label: string;
    kind: HalisahaQuestionOptionKind;
    participantId: string | null;
    participantName: string | null;
    teamSide: HalisahaTeamSide | null;
    sortOrder: number;
    isCorrect: boolean;
  }>;
};

export type HalisahaPublicAnswerState = {
  selectedOptionId: string;
  customScoreHome: number | null;
  customScoreAway: number | null;
  isCorrect: boolean | null;
  awardedPoints: number;
  isFinal: boolean;
  finalizedAtIso: string | null;
};

export type HalisahaAdminParticipantRow = {
  id: string;
  userId: string | null;
  guestName: string | null;
  displayName: string;
  isGuest: boolean;
  teamSide: HalisahaTeamSide | null;
  positionKey: HalisahaPositionKey | null;
  positionLabel: string | null;
  displayOrder: number;
};

export type HalisahaPublicParticipant = {
  id: string;
  displayName: string;
  teamSide: HalisahaTeamSide;
  positionKey: HalisahaPositionKey;
  positionLabel: string;
  displayOrder: number;
};

export type HalisahaPublicQuestion = {
  id: string;
  kind: HalisahaQuestionKind;
  prompt: string;
  points: number;
  sortOrder: number;
  scoreHomeResult: number | null;
  scoreAwayResult: number | null;
  isActive: boolean;
  resolved: boolean;
  options: Array<{
    id: string;
    label: string;
    kind: HalisahaQuestionOptionKind;
    participantId: string | null;
    teamSide: HalisahaTeamSide | null;
    sortOrder: number;
    isCorrect: boolean;
  }>;
};

export type HalisahaWinnerVoteSummary = {
  questionId: string;
  totalVotes: number;
  homeOption: {
    id: string;
    label: string;
    voteCount: number;
    percentage: number;
  };
  awayOption: {
    id: string;
    label: string;
    voteCount: number;
    percentage: number;
  };
};

export type { HalisahaResultRow } from "./leaderboard";

export type HalisahaMvpGateState = {
  phase: HalisahaMatchPhase;
  requiresPostMatchVote: boolean;
  hasSubmittedPostMatchVote: boolean;
  canRevealResults: boolean;
  title: string;
  description: string;
  buttonLabel: string;
  ctaHref: string;
};

export type HalisahaPostMatchMvpVoteState = {
  prompt: string;
  votingWindowOpen: boolean;
  requiresVote: boolean;
  hasUserVoted: boolean;
  voteEndsAtIso: string | null;
  resolvedParticipantId: string | null;
  resolvedParticipantName: string | null;
  userVoteParticipantId: string | null;
  userVoteSubmittedAtIso: string | null;
  userVoteIsCorrect: boolean | null;
  participants: HalisahaPublicParticipant[];
};

export type HalisahaAdminSnapshot = {
  match: {
    id: string | null;
    title: string;
    homeTeamName: string;
    awayTeamName: string;
    venueName: string;
    kickoffAtIso: string;
    kickoffDateInput: string;
    kickoffTimeInput: string;
    kickoffTimezone: string;
    matchDurationMinutes: number;
    matchEndAtIso: string;
    mvpVoteEndsAtIso: string;
    phase: HalisahaMatchPhase;
    answersResolvedAtIso: string | null;
    mvpResolvedParticipantId: string | null;
    mvpResolvedParticipantName: string | null;
    mvpVoteCount: number;
  };
  participants: HalisahaAdminParticipantRow[];
  questions: HalisahaAdminQuestionRow[];
  results: HalisahaResultRow[];
};

export type HalisahaPublicSnapshot = {
  match: {
    id: string | null;
    title: string;
    homeTeamName: string;
    awayTeamName: string;
    venueName: string;
    kickoffAtIso: string;
    kickoffLabel: string;
    matchDurationMinutes: number;
    matchEndAtIso: string;
    mvpVoteEndsAtIso: string;
    phase: HalisahaMatchPhase;
    answersResolved: boolean;
    canRevealResults: boolean;
  };
  participants: HalisahaPublicParticipant[];
  questions: HalisahaPublicQuestion[];
  standardQuestions: HalisahaPublicQuestion[];
  winnerQuestion: HalisahaPublicQuestion | null;
  winnerVoteSummary: HalisahaWinnerVoteSummary | null;
  userAnswers: Record<string, HalisahaPublicAnswerState>;
  userAnswersLocked: boolean;
  gate: HalisahaMvpGateState;
  postMatchMvpVote: HalisahaPostMatchMvpVoteState;
  results: HalisahaResultRow[];
};

function getDefaultMatchState() {
  return {
    id: null,
    title: HALISAHA_TITLE,
    homeTeamName: HALISAHA_DEFAULT_HOME_TEAM,
    awayTeamName: HALISAHA_DEFAULT_AWAY_TEAM,
    venueName: HALISAHA_DEFAULT_VENUE,
    kickoffAt: DEFAULT_KICKOFF_AT,
    kickoffTimezone: HALISAHA_TIMEZONE,
    matchDurationMinutes: HALISAHA_DEFAULT_MATCH_DURATION_MINUTES,
    answersResolvedAt: null as Date | null,
    mvpResolvedParticipantId: null as string | null,
    mvpResolvedAt: null as Date | null,
  };
}

function getParticipantDisplayName(participant: {
  guestName?: string | null;
  user?: { name: string; surname: string } | null;
}) {
  if (participant.user) {
    return `${participant.user.name} ${participant.user.surname}`.trim();
  }

  return participant.guestName?.trim() || "Guest";
}

function normalizeWinnerQuestionPrompt(prompt: string) {
  const trimmedPrompt = prompt.trim();
  const normalizedPrompt = trimmedPrompt.toLocaleLowerCase("tr-TR");
  if (LEGACY_WINNER_QUESTION_PROMPTS.has(normalizedPrompt)) {
    return DEFAULT_WINNER_QUESTION_PROMPT;
  }

  return trimmedPrompt || DEFAULT_WINNER_QUESTION_PROMPT;
}

function sortParticipantsForDisplay<T extends { displayOrder: number; displayName: string }>(
  participants: T[],
) {
  return [...participants].sort(
    (a, b) =>
      a.displayOrder - b.displayOrder || a.displayName.localeCompare(b.displayName),
  );
}

function toAdminParticipantRow(participant: ParticipantWithUser): HalisahaAdminParticipantRow {
  return {
    id: participant.id,
    userId: participant.userId,
    guestName: participant.guestName,
    displayName: getParticipantDisplayName(participant),
    isGuest: !participant.userId,
    teamSide: participant.teamSide,
    positionKey: participant.positionKey,
    positionLabel: participant.positionKey
      ? getHalisahaPositionLabel(participant.positionKey)
      : null,
    displayOrder: participant.displayOrder,
  };
}

function toPublicParticipantRow(participant: {
  id: string;
  guestName?: string | null;
  user?: { name: string; surname: string } | null;
  teamSide: HalisahaTeamSide;
  positionKey: HalisahaPositionKey;
  displayOrder: number;
}): HalisahaPublicParticipant {
  return {
    id: participant.id,
    displayName: getParticipantDisplayName(participant),
    teamSide: participant.teamSide,
    positionKey: participant.positionKey,
    positionLabel: getHalisahaPositionLabel(participant.positionKey),
    displayOrder: participant.displayOrder,
  };
}

function questionHasResolvedResult(question: PublicQuestionInput) {
  if (question.kind === "score_prediction") {
    return question.scoreHomeResult !== null && question.scoreAwayResult !== null;
  }
  if (question.kind === "number_prediction") {
    return question.scoreHomeResult !== null;
  }

  return question.options.some((option) => option.isCorrect);
}

function toPublicQuestionRow(
  question: PublicQuestionInput,
  { hideResolution = false }: { hideResolution?: boolean } = {},
): HalisahaPublicQuestion {
  return {
    id: question.id,
    kind: question.kind,
    prompt:
      question.kind === "winner"
        ? normalizeWinnerQuestionPrompt(question.prompt)
        : question.prompt,
    points: question.points,
    sortOrder: question.sortOrder,
    scoreHomeResult: hideResolution ? null : question.scoreHomeResult,
    scoreAwayResult: hideResolution ? null : question.scoreAwayResult,
    isActive: question.isActive,
    resolved: hideResolution ? false : questionHasResolvedResult(question),
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      kind: option.kind,
      participantId: option.participantId,
      teamSide: option.participant?.teamSide ?? null,
      sortOrder: option.sortOrder,
      isCorrect: hideResolution ? false : option.isCorrect,
    })),
  };
}

function formatAnswerSelectionLabel(answer: {
  customScoreHome: number | null;
  customScoreAway: number | null;
  selectedOption: {
    label: string;
    kind: HalisahaQuestionOptionKind;
  };
}) {
  if (
    answer.selectedOption.kind === "custom_score" &&
    answer.customScoreHome !== null &&
    answer.customScoreAway !== null
  ) {
    return formatScoreLabel({
      home: answer.customScoreHome,
      away: answer.customScoreAway,
    });
  }

  return answer.selectedOption.label;
}

type HalisahaResultAnswerRecord = {
  id: string;
  userId: string;
  customScoreHome: number | null;
  customScoreAway: number | null;
  isCorrect: boolean | null;
  awardedPoints: number;
  question: {
    prompt: string;
  };
  selectedOption: {
    label: string;
    kind: HalisahaQuestionOptionKind;
  };
  user: {
    id: string;
    name: string;
    surname: string;
  };
};

function buildHalisahaResultSeedsFromAnswers(answers: HalisahaResultAnswerRecord[]) {
  const byUser = new Map<string, HalisahaResultRowSeed>();

  for (const answer of answers) {
    const existing = byUser.get(answer.userId) ?? {
      userId: answer.user.id,
      name: answer.user.name,
      surname: answer.user.surname,
      totalPoints: 0,
      correctAnswers: 0,
      answeredQuestions: 0,
      mvpWins: 0,
      recentAnswers: [] as HalisahaRecentAnswerRow[],
    };

    existing.answeredQuestions += 1;
    existing.totalPoints += answer.awardedPoints;
    if (answer.isCorrect) {
      existing.correctAnswers += 1;
    }
    existing.recentAnswers.push({
      id: answer.id,
      status:
        answer.isCorrect === true
          ? "correct"
          : answer.isCorrect === false
            ? "incorrect"
            : "pending",
      label: `${answer.question.prompt} - ${formatAnswerSelectionLabel(answer)}`,
    });

    byUser.set(answer.userId, existing);
  }

  return [...byUser.values()];
}

function parseHalisahaRecentAnswers(
  value: Prisma.JsonValue,
): HalisahaResultRowSeed["recentAnswers"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return [];
    }

    const record = candidate as Record<string, unknown>;
    const status = record.status;
    if (
      typeof record.id !== "string" ||
      typeof record.label !== "string" ||
      (status !== "correct" && status !== "incorrect" && status !== "pending")
    ) {
      return [];
    }

    return [
      {
        id: record.id,
        label: record.label,
        status,
      } satisfies HalisahaRecentAnswerRow,
    ];
  });
}

function buildGateState(input: {
  phase: HalisahaMatchPhase;
  hasSubmittedPostMatchVote: boolean;
  shouldRequireVote?: boolean;
}): HalisahaMvpGateState {
  return buildHalisahaMvpGateState(input);
}

async function syncHalisahaMvpPredictionResolution(
  matchId: string,
  resolvedParticipantId: string | null,
  db: DbClient = prisma,
) {
  const questions = await db.halisahaQuestion.findMany({
    where: {
      matchId,
      kind: "mvp_prediction",
    },
    include: {
      options: {
        select: {
          id: true,
          participantId: true,
        },
      },
    },
  });

  const questionIds = questions.map((question) => question.id);
  if (questionIds.length === 0) {
    return;
  }

  await db.halisahaQuestionOption.updateMany({
    where: {
      questionId: {
        in: questionIds,
      },
    },
    data: {
      isCorrect: false,
    },
  });

  if (!resolvedParticipantId) {
    return;
  }

  for (const question of questions) {
    const correctOption = question.options.find(
      (option) => option.participantId === resolvedParticipantId,
    );
    if (!correctOption) {
      continue;
    }

    await db.halisahaQuestionOption.update({
      where: { id: correctOption.id },
      data: { isCorrect: true },
    });
  }
}

async function getSyncedParticipantOptionRows(matchId: string) {
  const participants = await prisma.halisahaParticipant.findMany({
    where: {
      matchId,
      teamSide: {
        not: null,
      },
      positionKey: {
        not: null,
      },
    },
    include: {
      user: {
        select: {
          name: true,
          surname: true,
        },
      },
    },
    orderBy: {
      displayOrder: "asc",
    },
  });

  return sortParticipantsForDisplay(
    participants.map((participant) => ({
      id: participant.id,
      displayName: getParticipantDisplayName(participant),
      displayOrder:
        participant.displayOrder ||
        (participant.positionKey
          ? getHalisahaPositionDisplayOrder(participant.positionKey)
          : Number.MAX_SAFE_INTEGER),
    })),
  );
}

export async function syncHalisahaPlayerPredictionQuestions(matchId: string) {
  const [questions, optionRows] = await Promise.all([
    prisma.halisahaQuestion.findMany({
      where: {
        matchId,
        kind: "player_prediction",
      },
      include: {
        options: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        answers: {
          select: {
            selectedOptionId: true,
          },
        },
      },
      orderBy: {
        sortOrder: "asc",
      },
    }),
    getSyncedParticipantOptionRows(matchId),
  ]);

  if (questions.length === 0) {
    return;
  }

  const activeParticipantIds = new Set(optionRows.map((participant) => participant.id));

  await prisma.$transaction(async (tx) => {
    for (const question of questions) {
      const selectedOptionIds = new Set(
        question.answers.map((answer) => answer.selectedOptionId),
      );
      const optionByParticipantId = new Map(
        question.options
          .filter((option) => option.participantId)
          .map((option) => [option.participantId as string, option]),
      );

      for (const [index, participant] of optionRows.entries()) {
        const existingOption = optionByParticipantId.get(participant.id);
        if (existingOption) {
          await tx.halisahaQuestionOption.update({
            where: { id: existingOption.id },
            data: {
              label: participant.displayName,
              kind: "standard",
              sortOrder: (index + 1) * 10,
            },
          });
        } else {
          await tx.halisahaQuestionOption.create({
            data: {
              questionId: question.id,
              label: participant.displayName,
              kind: "standard",
              participantId: participant.id,
              sortOrder: (index + 1) * 10,
            },
          });
        }
      }

      const removableOptionIds = question.options
        .filter(
          (option) =>
            !option.participantId || !activeParticipantIds.has(option.participantId),
        )
        .filter((option) => !selectedOptionIds.has(option.id))
        .map((option) => option.id);

      if (removableOptionIds.length > 0) {
        await tx.halisahaQuestionOption.deleteMany({
          where: {
            id: {
              in: removableOptionIds,
            },
          },
        });
      }
    }
  });
}

async function scoreResolvedMvpPredictionAnswers(
  matchId: string,
  resolvedParticipantId: string,
  db: DbClient = prisma,
) {
  const questions = await db.halisahaQuestion.findMany({
    where: {
      matchId,
      kind: "mvp_prediction",
    },
    include: {
      options: {
        select: {
          id: true,
          participantId: true,
        },
      },
    },
  });

  const questionIds = questions.map((question) => question.id);
  if (questionIds.length === 0) {
    return;
  }

  await db.halisahaAnswer.updateMany({
    where: {
      matchId,
      questionId: {
        in: questionIds,
      },
      isFinal: true,
    },
    data: {
      isCorrect: false,
      awardedPoints: 0,
    },
  });

  for (const question of questions) {
    const correctOption = question.options.find(
      (option) => option.participantId === resolvedParticipantId,
    );
    if (!correctOption) {
      continue;
    }

    await db.halisahaAnswer.updateMany({
      where: {
        questionId: question.id,
        selectedOptionId: correctOption.id,
        isFinal: true,
      },
      data: {
        isCorrect: true,
        awardedPoints: question.points,
      },
    });
  }
}

async function ensureResolvedHalisahaMvp(matchId: string) {
  const match = await prisma.halisahaMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      roundNumber: true,
      kickoffAt: true,
      matchDurationMinutes: true,
      answersResolvedAt: true,
      mvpResolvedParticipantId: true,
    },
  });

  if (!match) {
    return null;
  }

  if (match.mvpResolvedParticipantId) {
    return match.mvpResolvedParticipantId;
  }

  const voteEndsAt = getHalisahaMvpVoteEndsAt(match);
  if (new Date() < voteEndsAt) {
    return null;
  }

  const voteGroups = await prisma.halisahaMvpVote.groupBy({
    by: ["participantId"],
    where: {
      matchId,
      createdAt: {
        lte: voteEndsAt,
      },
    },
    _count: {
      _all: true,
    },
  });

  if (voteGroups.length === 0) {
    return null;
  }

  const participants = await prisma.halisahaParticipant.findMany({
    where: {
      id: {
        in: voteGroups.map((group) => group.participantId),
      },
    },
    include: {
      user: {
        select: {
          name: true,
          surname: true,
        },
      },
    },
  });

  const participantById = new Map(
    participants.map((participant) => [participant.id, participant]),
  );

  const winner = [...voteGroups]
    .map((group) => {
      const participant = participantById.get(group.participantId);
      return {
        participantId: group.participantId,
        voteCount: group._count._all,
        displayName: participant ? getParticipantDisplayName(participant) : "Player",
        displayOrder: participant?.displayOrder ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => {
      if (b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.displayName.localeCompare(b.displayName);
    })[0];

  if (!winner) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.halisahaMatch.update({
      where: { id: match.id },
      data: {
        mvpResolvedParticipantId: winner.participantId,
        mvpResolvedAt: new Date(),
      },
    });

    await syncHalisahaMvpPredictionResolution(match.id, winner.participantId, tx);
    await scoreResolvedMvpPredictionAnswers(match.id, winner.participantId, tx);
    if (match.answersResolvedAt) {
      await syncHalisahaLeaderboardRound(tx, {
        matchId: match.id,
        roundNumber: match.roundNumber,
      });
    } else {
      await syncHalisahaMvpRoundAward(tx, {
        matchId: match.id,
        roundNumber: match.roundNumber,
      });
    }
  });

  return winner.participantId;
}

export async function resolveHalisahaMvpFromVotes(matchId: string) {
  return ensureResolvedHalisahaMvp(matchId);
}

export async function syncHalisahaMvpPredictionQuestion(matchId: string) {
  const [match, participants, existingQuestion] = await Promise.all([
    prisma.halisahaMatch.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        mvpResolvedParticipantId: true,
      },
    }),
    prisma.halisahaParticipant.findMany({
      where: {
        matchId,
        teamSide: {
          not: null,
        },
        positionKey: {
          not: null,
        },
      },
      include: {
        user: {
          select: {
            name: true,
            surname: true,
          },
        },
      },
      orderBy: {
        displayOrder: "asc",
      },
    }),
    prisma.halisahaQuestion.findFirst({
      where: {
        matchId,
        kind: "mvp_prediction",
      },
      include: {
        options: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        answers: {
          select: {
            selectedOptionId: true,
          },
        },
      },
      orderBy: {
        sortOrder: "asc",
      },
    }),
  ]);

  if (!match) {
    return;
  }

  const optionRows = sortParticipantsForDisplay(
    participants.map((participant) => ({
      id: participant.id,
      displayName: getParticipantDisplayName(participant),
      displayOrder:
        participant.displayOrder ||
        (participant.positionKey
          ? getHalisahaPositionDisplayOrder(participant.positionKey)
          : Number.MAX_SAFE_INTEGER),
    })),
  );

  if (!existingQuestion) {
    await prisma.halisahaQuestion.create({
      data: {
        matchId,
        kind: "mvp_prediction",
        prompt: DEFAULT_MVP_PREDICTION_PROMPT,
        points: DEFAULT_MVP_PREDICTION_POINTS,
        sortOrder: 5,
        isActive: true,
        options: {
          create: optionRows.map((participant, index) => ({
            label: participant.displayName,
            kind: "standard",
            participantId: participant.id,
            sortOrder: (index + 1) * 10,
          })),
        },
      },
    });

    if (match.mvpResolvedParticipantId) {
      await syncHalisahaMvpPredictionResolution(matchId, match.mvpResolvedParticipantId);
    }
    return;
  }

  const selectedOptionIds = new Set(
    existingQuestion.answers.map((answer) => answer.selectedOptionId),
  );
  const optionByParticipantId = new Map(
    existingQuestion.options
      .filter((option) => option.participantId)
      .map((option) => [option.participantId as string, option]),
  );
  const activeParticipantIds = new Set(optionRows.map((participant) => participant.id));

  await prisma.$transaction(async (tx) => {
    await tx.halisahaQuestion.update({
      where: { id: existingQuestion.id },
      data: {
        kind: "mvp_prediction",
        prompt: existingQuestion.prompt,
        points: existingQuestion.points,
        sortOrder: existingQuestion.sortOrder,
        isActive: true,
      },
    });

    for (const [index, participant] of optionRows.entries()) {
      const existingOption = optionByParticipantId.get(participant.id);
      if (existingOption) {
        await tx.halisahaQuestionOption.update({
          where: { id: existingOption.id },
          data: {
            label: participant.displayName,
            kind: "standard",
            sortOrder: (index + 1) * 10,
          },
        });
      } else {
        await tx.halisahaQuestionOption.create({
          data: {
            questionId: existingQuestion.id,
            label: participant.displayName,
            kind: "standard",
            participantId: participant.id,
            sortOrder: (index + 1) * 10,
          },
        });
      }
    }

    const removableOptionIds = existingQuestion.options
      .filter(
        (option) =>
          !option.participantId || !activeParticipantIds.has(option.participantId),
      )
      .filter((option) => !selectedOptionIds.has(option.id))
      .map((option) => option.id);

    if (removableOptionIds.length > 0) {
      await tx.halisahaQuestionOption.deleteMany({
        where: {
          id: {
            in: removableOptionIds,
          },
        },
      });
    }
  });

  if (match.mvpResolvedParticipantId) {
    await syncHalisahaMvpPredictionResolution(matchId, match.mvpResolvedParticipantId);
  }
}

export async function syncHalisahaWinnerQuestion(match: {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
}) {
  const winnerQuestion = await prisma.halisahaQuestion.findFirst({
    where: {
      matchId: match.id,
      kind: "winner",
    },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
      },
      answers: {
        select: {
          selectedOptionId: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  if (!winnerQuestion) {
    await prisma.halisahaQuestion.create({
      data: {
        matchId: match.id,
        kind: "winner",
        prompt: DEFAULT_WINNER_QUESTION_PROMPT,
        points: DEFAULT_WINNER_QUESTION_POINTS,
        sortOrder: 0,
        isActive: true,
        options: {
          create: [
            {
              label: match.homeTeamName,
              sortOrder: 10,
            },
            {
              label: match.awayTeamName,
              sortOrder: 20,
            },
          ],
        },
      },
    });
    return;
  }

  const [homeOption, awayOption, ...extraOptions] = winnerQuestion.options;
  const selectedOptionIds = new Set(
    winnerQuestion.answers.map((answer) => answer.selectedOptionId),
  );

  await prisma.$transaction(async (tx) => {
    await tx.halisahaQuestion.update({
      where: { id: winnerQuestion.id },
      data: {
        kind: "winner",
        prompt: normalizeWinnerQuestionPrompt(winnerQuestion.prompt),
        sortOrder: 0,
        isActive: true,
      },
    });

    if (!homeOption || !awayOption) {
      if (winnerQuestion.answers.length === 0) {
        await tx.halisahaQuestionOption.deleteMany({
          where: { questionId: winnerQuestion.id },
        });
        await tx.halisahaQuestionOption.createMany({
          data: [
            {
              questionId: winnerQuestion.id,
              label: match.homeTeamName,
              sortOrder: 10,
            },
            {
              questionId: winnerQuestion.id,
              label: match.awayTeamName,
              sortOrder: 20,
            },
          ],
        });
      }
      return;
    }

    await tx.halisahaQuestionOption.update({
      where: { id: homeOption.id },
      data: {
        label: match.homeTeamName,
        sortOrder: 10,
      },
    });
    await tx.halisahaQuestionOption.update({
      where: { id: awayOption.id },
      data: {
        label: match.awayTeamName,
        sortOrder: 20,
      },
    });

    const removableExtraOptionIds = extraOptions
      .filter((option) => !selectedOptionIds.has(option.id))
      .map((option) => option.id);

    if (removableExtraOptionIds.length > 0) {
      await tx.halisahaQuestionOption.deleteMany({
        where: {
          id: {
            in: removableExtraOptionIds,
          },
        },
      });
    }
  });
}

type ArchiveHalisahaMatchInput = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  venueName: string;
  kickoffAt: Date;
  matchDurationMinutes: number;
};

export type ArchiveHalisahaMatchResult =
  | {
      ok: true;
      archivedAt: string;
      archivedMatchId: string;
      archivedRoundNumber: number;
      nextMatchId: string;
      nextRoundNumber: number;
    }
  | { ok: false; error: string };

async function archiveHalisahaMatchForNextRoundTx(
  tx: Prisma.TransactionClient,
  input: ArchiveHalisahaMatchInput,
) {
  const sourceMatch = await tx.halisahaMatch.findUnique({
    where: { id: input.matchId },
    include: {
      participants: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
      questions: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          options: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!sourceMatch) {
    throw new Error("Active Halisaha match not found.");
  }

  const archivedAt = new Date();
  await tx.halisahaMatch.update({
    where: { id: sourceMatch.id },
    data: {
      singletonKey: null,
      archivedAt,
    },
  });

  const nextMatch = await tx.halisahaMatch.create({
    data: {
      singletonKey: HALISAHA_MATCH_SINGLETON_KEY,
      roundNumber: sourceMatch.roundNumber + 1,
      title: sourceMatch.title,
      homeTeamName: input.homeTeamName,
      awayTeamName: input.awayTeamName,
      venueName: input.venueName,
      kickoffAt: input.kickoffAt,
      kickoffTimezone: sourceMatch.kickoffTimezone,
      matchDurationMinutes: input.matchDurationMinutes,
    },
  });

  const participantIdMap = new Map<string, string>();
  for (const participant of sourceMatch.participants) {
    const clonedParticipant = await tx.halisahaParticipant.create({
      data: {
        matchId: nextMatch.id,
        userId: participant.userId,
        guestName: participant.guestName,
        teamSide: participant.teamSide,
        positionKey: participant.positionKey,
        displayOrder: participant.displayOrder,
      },
    });
    participantIdMap.set(participant.id, clonedParticipant.id);
  }

  for (const question of sourceMatch.questions) {
    const clonedQuestion = await tx.halisahaQuestion.create({
      data: {
        matchId: nextMatch.id,
        kind: question.kind,
        prompt: question.prompt,
        points: question.points,
        sortOrder: question.sortOrder,
        scoreHomeResult: null,
        scoreAwayResult: null,
        isActive: question.isActive,
      },
    });

    for (const option of question.options) {
      await tx.halisahaQuestionOption.create({
        data: {
          questionId: clonedQuestion.id,
          label: option.label,
          kind: option.kind,
          participantId: option.participantId
            ? participantIdMap.get(option.participantId) ?? null
            : null,
          sortOrder: option.sortOrder,
          isCorrect: false,
        },
      });
    }
  }

  return {
    archivedAt,
    archivedMatchId: sourceMatch.id,
    archivedRoundNumber: sourceMatch.roundNumber,
    nextMatchId: nextMatch.id,
    nextRoundNumber: nextMatch.roundNumber,
  };
}

export async function archiveHalisahaMatchForNextRound(
  input: ArchiveHalisahaMatchInput,
  db: PrismaClient = prisma,
): Promise<ArchiveHalisahaMatchResult> {
  try {
    const result = await db.$transaction((tx) =>
      archiveHalisahaMatchForNextRoundTx(tx, input),
    );

    return {
      ok: true,
      archivedAt: result.archivedAt.toISOString(),
      archivedMatchId: result.archivedMatchId,
      archivedRoundNumber: result.archivedRoundNumber,
      nextMatchId: result.nextMatchId,
      nextRoundNumber: result.nextRoundNumber,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not archive the current Halisaha round.",
    };
  }
}

export type PurgeArchivedHalisahaMatchesResult =
  | {
      ok: true;
      deletedMatches: number;
      deletedRounds: number;
    }
  | { ok: false; error: string };

export async function purgeArchivedHalisahaMatchesBefore(
  cutoff: Date,
  db: PrismaClient = prisma,
): Promise<PurgeArchivedHalisahaMatchesResult> {
  try {
    const result = await db.$transaction(async (tx) => {
      const matches = await tx.halisahaMatch.findMany({
        where: {
          singletonKey: null,
          archivedAt: {
            lt: cutoff,
          },
        },
        select: {
          id: true,
          roundNumber: true,
        },
      });

      if (matches.length === 0) {
        return {
          deletedMatches: 0,
          deletedRounds: 0,
        };
      }

      const matchIds = matches.map((match) => match.id);
      const roundNumbers = matches.map((match) => match.roundNumber);

      await tx.halisahaLeaderboardRound.deleteMany({
        where: {
          roundNumber: {
            in: roundNumbers,
          },
        },
      });
      await tx.halisahaMvpRoundAward.deleteMany({
        where: {
          roundNumber: {
            in: roundNumbers,
          },
        },
      });
      await tx.halisahaMatch.deleteMany({
        where: {
          id: {
            in: matchIds,
          },
        },
      });

      return {
        deletedMatches: matches.length,
        deletedRounds: roundNumbers.length,
      };
    });

    return {
      ok: true,
      deletedMatches: result.deletedMatches,
      deletedRounds: result.deletedRounds,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not purge archived Halisaha matches.",
    };
  }
}

export async function ensureActiveHalisahaMatch() {
  const existingMatch = await prisma.halisahaMatch.findUnique({
    where: { singletonKey: HALISAHA_MATCH_SINGLETON_KEY },
  });
  if (existingMatch) {
    return existingMatch;
  }

  const match = await prisma.halisahaMatch.upsert({
    where: { singletonKey: HALISAHA_MATCH_SINGLETON_KEY },
    update: {},
    create: {
      singletonKey: HALISAHA_MATCH_SINGLETON_KEY,
      title: HALISAHA_TITLE,
      homeTeamName: HALISAHA_DEFAULT_HOME_TEAM,
      awayTeamName: HALISAHA_DEFAULT_AWAY_TEAM,
      venueName: HALISAHA_DEFAULT_VENUE,
      kickoffAt: DEFAULT_KICKOFF_AT,
      kickoffTimezone: HALISAHA_TIMEZONE,
      matchDurationMinutes: HALISAHA_DEFAULT_MATCH_DURATION_MINUTES,
    },
  });

  await syncHalisahaWinnerQuestion(match);
  await syncHalisahaMvpPredictionQuestion(match.id);
  return match;
}

export async function getActiveHalisahaMatch() {
  const match = await ensureActiveHalisahaMatch();
  return prisma.halisahaMatch.findUnique({
    where: { id: match.id },
  });
}

export async function getHalisahaMvpGateState(
  userId: string,
  userRole: string,
): Promise<HalisahaMvpGateState> {
  const activeMatch = await ensureActiveHalisahaMatch();
  await ensureResolvedHalisahaMvp(activeMatch.id);

  const match = await prisma.halisahaMatch.findUnique({
    where: { id: activeMatch.id },
    select: {
      kickoffAt: true,
      matchDurationMinutes: true,
      mvpVotes: {
        where: {
          userId,
        },
        select: {
          id: true,
        },
        take: 1,
      },
      participants: {
        where: {
          userId,
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
        take: 1,
      },
    },
  });

  if (!match) {
    return buildGateState({
      phase: "pre_match",
      hasSubmittedPostMatchVote: false,
    });
  }

  return buildGateState({
    phase: getHalisahaMatchPhase(match),
    hasSubmittedPostMatchVote: match.mvpVotes.length > 0,
    shouldRequireVote: userRole === "admin" || match.participants.length > 0,
  });
}

export async function getHalisahaAdminSnapshot(): Promise<HalisahaAdminSnapshot> {
  const activeMatch = await ensureActiveHalisahaMatch();
  await ensureResolvedHalisahaMvp(activeMatch.id);
  await syncHalisahaWinnerQuestion({
    id: activeMatch.id,
    homeTeamName: activeMatch.homeTeamName,
    awayTeamName: activeMatch.awayTeamName,
  });
  await syncHalisahaMvpPredictionQuestion(activeMatch.id);
  await syncHalisahaPlayerPredictionQuestions(activeMatch.id);

  const match = await prisma.halisahaMatch.findUnique({
    where: { id: activeMatch.id },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              surname: true,
              username: true,
            },
          },
        },
      },
      questions: {
        include: {
          options: {
            include: {
              participant: {
                include: {
                  user: {
                    select: {
                      name: true,
                      surname: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          answers: {
            select: { id: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      mvpVotes: {
        select: { id: true },
      },
      resolvedMvpParticipant: {
        include: {
          user: {
            select: {
              name: true,
              surname: true,
            },
          },
        },
      },
    },
  });

  const results = match ? await getHalisahaResults(match.id) : [];
  const fallback = getDefaultMatchState();
  const baseMatch = match ?? fallback;

  return {
    match: {
      id: match?.id ?? null,
      title: baseMatch.title,
      homeTeamName: baseMatch.homeTeamName,
      awayTeamName: baseMatch.awayTeamName,
      venueName: baseMatch.venueName,
      kickoffAtIso: baseMatch.kickoffAt.toISOString(),
      kickoffDateInput: toIstanbulDateInput(baseMatch.kickoffAt),
      kickoffTimeInput: toIstanbulTimeInput(baseMatch.kickoffAt),
      kickoffTimezone: baseMatch.kickoffTimezone,
      matchDurationMinutes: baseMatch.matchDurationMinutes,
      matchEndAtIso: getHalisahaMatchEndAt(baseMatch).toISOString(),
      mvpVoteEndsAtIso: getHalisahaMvpVoteEndsAt(baseMatch).toISOString(),
      phase: getHalisahaMatchPhase(baseMatch),
      answersResolvedAtIso: baseMatch.answersResolvedAt?.toISOString() ?? null,
      mvpResolvedParticipantId: match?.mvpResolvedParticipantId ?? null,
      mvpResolvedParticipantName: match?.resolvedMvpParticipant
        ? getParticipantDisplayName(match.resolvedMvpParticipant)
        : null,
      mvpVoteCount: match?.mvpVotes.length ?? 0,
    },
    participants: sortParticipantsForDisplay(
      (match?.participants ?? []).map(toAdminParticipantRow),
    ),
    questions: (match?.questions ?? []).map((question) => ({
      id: question.id,
      kind: question.kind,
      prompt: question.prompt,
      points: question.points,
      sortOrder: question.sortOrder,
      isActive: question.isActive,
      scoreHomeResult: question.scoreHomeResult,
      scoreAwayResult: question.scoreAwayResult,
      optionCount: question.options.length,
      answerCount: question.answers.length,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        kind: option.kind,
        participantId: option.participantId,
        participantName: option.participant
          ? getParticipantDisplayName(option.participant)
          : null,
        teamSide: option.participant?.teamSide ?? null,
        sortOrder: option.sortOrder,
        isCorrect: option.isCorrect,
      })),
    })),
    results,
  };
}

async function getHalisahaWinnerVoteSummary(
  question: HalisahaPublicQuestion,
): Promise<HalisahaWinnerVoteSummary | null> {
  const [homeOption, awayOption] = question.options;
  if (!homeOption || !awayOption) {
    return null;
  }

  const voteGroups = await prisma.halisahaAnswer.groupBy({
    by: ["selectedOptionId"],
    where: {
      questionId: question.id,
      isFinal: true,
    },
    _count: {
      _all: true,
    },
  });

  const voteCountByOptionId = new Map(
    voteGroups.map((group) => [group.selectedOptionId, group._count._all]),
  );
  const homeVoteCount = voteCountByOptionId.get(homeOption.id) ?? 0;
  const awayVoteCount = voteCountByOptionId.get(awayOption.id) ?? 0;
  const totalVotes = homeVoteCount + awayVoteCount;
  const homePercentage =
    totalVotes > 0 ? Math.round((homeVoteCount / totalVotes) * 100) : 0;
  const awayPercentage = totalVotes > 0 ? 100 - homePercentage : 0;

  return {
    questionId: question.id,
    totalVotes,
    homeOption: {
      id: homeOption.id,
      label: homeOption.label,
      voteCount: homeVoteCount,
      percentage: homePercentage,
    },
    awayOption: {
      id: awayOption.id,
      label: awayOption.label,
      voteCount: awayVoteCount,
      percentage: awayPercentage,
    },
  };
}

export async function getHalisahaPublicSnapshot(
  userId: string,
  userRole: string,
): Promise<HalisahaPublicSnapshot> {
  const activeMatch = await ensureActiveHalisahaMatch();
  await ensureResolvedHalisahaMvp(activeMatch.id);
  await syncHalisahaPlayerPredictionQuestions(activeMatch.id);

  const readPublicMatch = () =>
    prisma.halisahaMatch.findUnique({
      where: { id: activeMatch.id },
      include: {
        participants: {
          include: {
            user: {
              select: {
                name: true,
                surname: true,
              },
            },
          },
        },
        questions: {
          where: { isActive: true },
          include: {
            options: {
              include: {
                participant: {
                  select: {
                    teamSide: true,
                  },
                },
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        answers: {
          where: { userId },
          select: {
            questionId: true,
            selectedOptionId: true,
            customScoreHome: true,
            customScoreAway: true,
            isCorrect: true,
            awardedPoints: true,
            isFinal: true,
            finalizedAt: true,
          },
        },
        mvpVotes: {
          where: { userId },
          select: {
            participantId: true,
            createdAt: true,
          },
          take: 1,
        },
        resolvedMvpParticipant: {
          include: {
            user: {
              select: {
                name: true,
                surname: true,
              },
            },
          },
        },
      },
    });

  let match = await readPublicMatch();
  const hasWinnerQuestion = match?.questions.some((question) => question.kind === "winner") ?? false;
  const hasMvpPredictionQuestion =
    match?.questions.some((question) => question.kind === "mvp_prediction") ?? false;
  if (match && (!hasWinnerQuestion || !hasMvpPredictionQuestion)) {
    await syncHalisahaWinnerQuestion({
      id: activeMatch.id,
      homeTeamName: activeMatch.homeTeamName,
      awayTeamName: activeMatch.awayTeamName,
    });
    await syncHalisahaMvpPredictionQuestion(activeMatch.id);
    match = await readPublicMatch();
  }

  const fallback = getDefaultMatchState();
  const baseMatch = match ?? fallback;

  const persistedParticipants = (match?.participants ?? []).filter(
    (participant) => participant.teamSide && participant.positionKey,
  ) as Array<
    ParticipantWithUser & {
      teamSide: HalisahaTeamSide;
      positionKey: HalisahaPositionKey;
    }
  >;

  const publicParticipants =
    persistedParticipants.length > 0
      ? sortParticipantsForDisplay(
          persistedParticipants.map((participant) =>
            toPublicParticipantRow({
              id: participant.id,
              guestName: participant.guestName,
              user: participant.user,
              teamSide: participant.teamSide,
              positionKey: participant.positionKey,
              displayOrder:
                participant.displayOrder ||
                getHalisahaPositionDisplayOrder(participant.positionKey),
            }),
          ),
        )
      : sortParticipantsForDisplay(
          FALLBACK_PARTICIPANTS.map((participant) =>
            toPublicParticipantRow({
              ...participant,
              displayOrder: getHalisahaPositionDisplayOrder(participant.positionKey),
            }),
          ),
        );

  const userVote = match?.mvpVotes[0] ?? null;
  const shouldRequirePostMatchVote =
    userRole === "admin" ||
    persistedParticipants.some((participant) => participant.userId === userId);
  const gate = buildGateState({
    phase: getHalisahaMatchPhase(baseMatch),
    hasSubmittedPostMatchVote: Boolean(userVote),
    shouldRequireVote: shouldRequirePostMatchVote,
  });

  const hideResolvedResults = !gate.canRevealResults;
  const userAnswers: Record<string, HalisahaPublicAnswerState> = Object.fromEntries(
    (match?.answers ?? []).map((answer) => [
      answer.questionId,
      maskHalisahaAnswerForGate(
        {
        selectedOptionId: answer.selectedOptionId,
        customScoreHome: answer.customScoreHome,
        customScoreAway: answer.customScoreAway,
          isCorrect: answer.isCorrect,
          awardedPoints: answer.awardedPoints,
        isFinal: answer.isFinal,
        finalizedAtIso: answer.finalizedAt?.toISOString() ?? null,
        },
        hideResolvedResults,
      ),
    ]),
  );

  const userAnswersLocked = (match?.answers ?? []).some((answer) => answer.isFinal);
  const questions = (match?.questions ?? []).map((question) =>
    toPublicQuestionRow(question, {
      hideResolution: hideResolvedResults,
    }),
  );
  const winnerQuestion = questions.find((question) => question.kind === "winner") ?? null;
  const standardQuestions = questions.filter((question) => question.kind !== "winner");
  const canRevealWinnerVoteSummary =
    gate.canRevealResults && getHalisahaMatchPhase(baseMatch) !== "pre_match";
  const winnerVoteSummary =
    winnerQuestion &&
    (userAnswersLocked || Boolean(match?.answersResolvedAt) || canRevealWinnerVoteSummary)
      ? await getHalisahaWinnerVoteSummary(winnerQuestion)
      : null;

  const persistedVoteParticipants =
    persistedParticipants.length > 0
      ? sortParticipantsForDisplay(
          persistedParticipants.map((participant) =>
            toPublicParticipantRow({
              id: participant.id,
              guestName: participant.guestName,
              user: participant.user,
              teamSide: participant.teamSide,
              positionKey: participant.positionKey,
              displayOrder:
                participant.displayOrder ||
                getHalisahaPositionDisplayOrder(participant.positionKey),
            }),
          ),
        )
      : [];

  return {
    match: {
      id: match?.id ?? null,
      title: baseMatch.title,
      homeTeamName: baseMatch.homeTeamName,
      awayTeamName: baseMatch.awayTeamName,
      venueName: baseMatch.venueName,
      kickoffAtIso: baseMatch.kickoffAt.toISOString(),
      kickoffLabel: formatHalisahaKickoffLabel(baseMatch.kickoffAt),
      matchDurationMinutes: baseMatch.matchDurationMinutes,
      matchEndAtIso: getHalisahaMatchEndAt(baseMatch).toISOString(),
      mvpVoteEndsAtIso: getHalisahaMvpVoteEndsAt(baseMatch).toISOString(),
      phase: getHalisahaMatchPhase(baseMatch),
      answersResolved: Boolean(baseMatch.answersResolvedAt),
      canRevealResults: gate.canRevealResults,
    },
    participants: publicParticipants,
    questions,
    standardQuestions,
    winnerQuestion,
    winnerVoteSummary,
    userAnswers,
    userAnswersLocked,
    gate,
    postMatchMvpVote: {
      prompt: DEFAULT_POST_MATCH_MVP_PROMPT,
      votingWindowOpen: gate.phase === "post_match_mvp_voting",
      requiresVote: gate.requiresPostMatchVote,
      hasUserVoted: Boolean(userVote),
      voteEndsAtIso: getHalisahaMvpVoteEndsAt(baseMatch).toISOString(),
      resolvedParticipantId: match?.mvpResolvedParticipantId ?? null,
      resolvedParticipantName: match?.resolvedMvpParticipant
        ? getParticipantDisplayName(match.resolvedMvpParticipant)
        : null,
      userVoteParticipantId: userVote?.participantId ?? null,
      userVoteSubmittedAtIso: userVote?.createdAt.toISOString() ?? null,
      userVoteIsCorrect:
        userVote && match?.mvpResolvedParticipantId
          ? userVote.participantId === match.mvpResolvedParticipantId
          : null,
      participants: persistedVoteParticipants,
    },
    results: gate.canRevealResults ? await getHalisahaLeaderboardResults() : [],
  };
}

async function syncHalisahaMvpRoundAward(
  tx: Prisma.TransactionClient,
  input: { matchId: string; roundNumber: number },
) {
  await tx.halisahaMvpRoundAward.deleteMany({
    where: { roundNumber: input.roundNumber },
  });

  const match = await tx.halisahaMatch.findUnique({
    where: { id: input.matchId },
    select: { mvpResolvedParticipantId: true },
  });

  if (!match?.mvpResolvedParticipantId) {
    return;
  }

  const participant = await tx.halisahaParticipant.findUnique({
    where: { id: match.mvpResolvedParticipantId },
    select: { userId: true },
  });

  const userId = participant?.userId;
  if (!userId) {
    return;
  }

  await tx.halisahaMvpRoundAward.create({
    data: {
      roundNumber: input.roundNumber,
      userId,
    },
  });
}

async function syncHalisahaLeaderboardRound(
  tx: Prisma.TransactionClient,
  input: { matchId: string; roundNumber: number },
) {
  const answers = await tx.halisahaAnswer.findMany({
    where: {
      matchId: input.matchId,
      isFinal: true,
    },
    orderBy: { createdAt: "asc" },
    include: {
      question: {
        select: {
          prompt: true,
        },
      },
      selectedOption: {
        select: {
          label: true,
          kind: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          surname: true,
        },
      },
    },
  });

  const seeds = buildHalisahaResultSeedsFromAnswers(answers);

  await tx.halisahaLeaderboardRound.deleteMany({
    where: {
      roundNumber: input.roundNumber,
    },
  });

  if (seeds.length > 0) {
    await tx.halisahaLeaderboardRound.createMany({
      data: seeds.map((seed) => ({
        roundNumber: input.roundNumber,
        userId: seed.userId,
        totalPoints: seed.totalPoints,
        correctAnswers: seed.correctAnswers,
        answeredQuestions: seed.answeredQuestions,
        recentAnswers: seed.recentAnswers as Prisma.InputJsonValue,
      })),
    });
  }

  await syncHalisahaMvpRoundAward(tx, input);
}

/**
 * Rebuild cumulative Halisaha leaderboard rows for a match's round from finalized answers
 * (e.g. after admin prediction / points overrides).
 *
 * @param db Optional Prisma client (e.g. SQLite test `PrismaClient`); defaults to app `prisma`.
 */
export async function rebuildHalisahaLeaderboardForMatch(
  matchId: string,
  db: PrismaClient = prisma,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const match = await db.halisahaMatch.findUnique({
    where: { id: matchId },
    select: { id: true, roundNumber: true },
  });
  if (!match) {
    return { ok: false, error: "Match not found." };
  }
  await db.$transaction(async (tx) => {
    await syncHalisahaLeaderboardRound(tx, {
      matchId: match.id,
      roundNumber: match.roundNumber,
    });
  });
  return { ok: true };
}

async function ensureCurrentHalisahaLeaderboardRoundBackfill() {
  const currentMatch = await prisma.halisahaMatch.findUnique({
    where: {
      singletonKey: HALISAHA_MATCH_SINGLETON_KEY,
    },
    select: {
      id: true,
      roundNumber: true,
      answersResolvedAt: true,
    },
  });

  if (!currentMatch?.answersResolvedAt) {
    return;
  }

  const existingRoundCount = await prisma.halisahaLeaderboardRound.count({
    where: {
      roundNumber: currentMatch.roundNumber,
    },
  });
  if (existingRoundCount > 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const stillMissing = await tx.halisahaLeaderboardRound.count({
      where: {
        roundNumber: currentMatch.roundNumber,
      },
    });
    if (stillMissing > 0) {
      return;
    }

    await syncHalisahaLeaderboardRound(tx, {
      matchId: currentMatch.id,
      roundNumber: currentMatch.roundNumber,
    });
  });
}

async function getHalisahaLeaderboardResults(): Promise<HalisahaResultRow[]> {
  await ensureCurrentHalisahaLeaderboardRoundBackfill();

  const mvpGroups = await prisma.halisahaMvpRoundAward.groupBy({
    by: ["userId"],
    _count: { _all: true },
  });
  const mvpCountByUser = new Map(
    mvpGroups.map((group) => [group.userId, group._count._all]),
  );

  const rounds = await prisma.halisahaLeaderboardRound.findMany({
    orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          surname: true,
        },
      },
    },
  });

  const roundSnapshots = rounds.map((round) => ({
    userId: round.user.id,
    name: round.user.name,
    surname: round.user.surname,
    totalPoints: round.totalPoints,
    correctAnswers: round.correctAnswers,
    answeredQuestions: round.answeredQuestions,
    recentAnswers: parseHalisahaRecentAnswers(round.recentAnswers),
  }));

  const seenFromSnapshots = new Set(
    mergeHalisahaResultRowSeeds(
      roundSnapshots.map((row) => ({ ...row, mvpWins: 0 })),
    ).map((row) => row.userId),
  );
  const orphanMvpUserIds = [...mvpCountByUser.keys()].filter(
    (userId) => !seenFromSnapshots.has(userId),
  );

  const mvpOnlyProfiles =
    orphanMvpUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: orphanMvpUserIds } },
          select: { id: true, name: true, surname: true },
        })
      : [];

  return composeHalisahaCumulativeLeaderboard(
    roundSnapshots,
    mvpCountByUser,
    mvpOnlyProfiles.map((u) => ({
      userId: u.id,
      name: u.name,
      surname: u.surname,
    })),
  );
}

export async function getHalisahaResults(matchId: string): Promise<HalisahaResultRow[]> {
  const answers = await prisma.halisahaAnswer.findMany({
    where: {
      matchId,
      isFinal: true,
    },
    orderBy: { createdAt: "asc" },
    include: {
      question: {
        select: {
          prompt: true,
        },
      },
      selectedOption: {
        select: {
          label: true,
          kind: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          surname: true,
        },
      },
    },
  });

  return rankHalisahaResultRows(buildHalisahaResultSeedsFromAnswers(answers));
}

export async function scoreHalisahaAnswers(matchId: string) {
  const match = await prisma.halisahaMatch.findUnique({
    where: { id: matchId },
    select: { roundNumber: true },
  });
  if (!match) {
    return {
      ok: false as const,
      error: "Match not found.",
    };
  }

  const questions = await prisma.halisahaQuestion.findMany({
    where: { matchId, isActive: true },
    include: {
      options: true,
    },
  });

  const scorableQuestions = questions.filter(
    (question) => question.kind !== "mvp_prediction",
  );

  const unresolvedQuestions = scorableQuestions.filter((question) => {
    if (question.kind === "score_prediction") {
      return question.scoreHomeResult === null || question.scoreAwayResult === null;
    }
    if (question.kind === "number_prediction") {
      return question.scoreHomeResult === null;
    }

    return question.options.filter((option) => option.isCorrect).length !== 1;
  });

  if (unresolvedQuestions.length > 0) {
    return {
      ok: false as const,
      error:
        `Resolve ${unresolvedQuestions.length} active question(s) before scoring. ` +
        "Standard questions need one correct option, and score questions need the actual score.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.halisahaAnswer.updateMany({
      where: {
        matchId,
        questionId: {
          in: scorableQuestions.map((question) => question.id),
        },
        isFinal: true,
      },
      data: {
        isCorrect: false,
        awardedPoints: 0,
      },
    });

    for (const question of scorableQuestions) {
      if (question.kind === "score_prediction") {
        const actualScore = {
          home: question.scoreHomeResult!,
          away: question.scoreAwayResult!,
        };
        const matchingFixedOptionIds = getMatchingFixedScoreOptionIds({
          options: question.options,
          actualScore,
        });

        if (matchingFixedOptionIds.length > 0) {
          await tx.halisahaAnswer.updateMany({
            where: {
              questionId: question.id,
              selectedOptionId: {
                in: matchingFixedOptionIds,
              },
              isFinal: true,
            },
            data: {
              isCorrect: true,
              awardedPoints: question.points,
            },
          });
        }

        const customOptionIds = question.options
          .filter((option) => option.kind === "custom_score")
          .map((option) => option.id);

        if (customOptionIds.length > 0) {
          const matchingCustomAnswerIds = (
            await tx.halisahaAnswer.findMany({
              where: {
                questionId: question.id,
                selectedOptionId: {
                  in: customOptionIds,
                },
                isFinal: true,
              },
              select: {
                id: true,
                customScoreHome: true,
                customScoreAway: true,
              },
            })
          )
            .filter((answer) =>
              isCustomScoreExactMatch({
                actualScore,
                customScoreHome: answer.customScoreHome,
                customScoreAway: answer.customScoreAway,
              }),
            )
            .map((answer) => answer.id);

          if (matchingCustomAnswerIds.length > 0) {
            await tx.halisahaAnswer.updateMany({
              where: {
                id: {
                  in: matchingCustomAnswerIds,
                },
              },
              data: {
                isCorrect: true,
                awardedPoints: question.points,
              },
            });
          }
        }

        continue;
      }

      if (question.kind === "number_prediction") {
        const customOptionIds = question.options
          .filter((option) => option.kind === "custom_number")
          .map((option) => option.id);

        if (customOptionIds.length > 0) {
          const matchingAnswerIds = (
            await tx.halisahaAnswer.findMany({
              where: {
                questionId: question.id,
                selectedOptionId: {
                  in: customOptionIds,
                },
                isFinal: true,
              },
              select: {
                id: true,
                customScoreHome: true,
              },
            })
          )
            .filter((answer) => answer.customScoreHome === question.scoreHomeResult)
            .map((answer) => answer.id);

          if (matchingAnswerIds.length > 0) {
            await tx.halisahaAnswer.updateMany({
              where: {
                id: {
                  in: matchingAnswerIds,
                },
              },
              data: {
                isCorrect: true,
                awardedPoints: question.points,
              },
            });
          }
        }

        continue;
      }

      const correctOption = question.options.find((option) => option.isCorrect);
      if (!correctOption) {
        continue;
      }

      await tx.halisahaAnswer.updateMany({
        where: {
          questionId: question.id,
          selectedOptionId: correctOption.id,
          isFinal: true,
        },
        data: {
          isCorrect: true,
          awardedPoints: question.points,
        },
      });
    }

    await tx.halisahaMatch.update({
      where: { id: matchId },
      data: {
        answersResolvedAt: new Date(),
      },
    });

    await syncHalisahaLeaderboardRound(tx, {
      matchId,
      roundNumber: match.roundNumber,
    });
  });

  return { ok: true as const };
}
