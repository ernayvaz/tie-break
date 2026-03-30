import { PageHeroBand } from "@/components/page-hero-band";
import { requireAdmin } from "@/lib/auth/get-user";
import { prisma } from "@/lib/db";
import {
  sanitizeAdminHalisahaPredictionHistoryFilters,
} from "@/lib/admin-halisaha-prediction-history";
import { type HalisahaRecentAnswerRow } from "@/lib/halisaha/leaderboard";
import { ensureActiveHalisahaMatch } from "@/lib/halisaha/server";
import { HalisahaPredictionManagementClient } from "./halisaha-prediction-history-client";
import type {
  HalisahaHistoryPageContext,
  HalisahaAnswerRow,
  HalisahaHistoryMatchOption,
  HalisahaLegacyRoundSnapshot,
  HalisahaMvpVoteRow,
  QuestionForAdminSelect,
  UserOption,
} from "./halisaha-prediction-history-client";

type SearchParams = Promise<{
  tab?: string;
  matchId?: string;
  userId?: string;
  questionId?: string;
  voteTargetId?: string;
  kind?: string;
  status?: string;
  timeline?: string;
  resolution?: string;
  outcome?: string;
}>;

function formatMatchLabel(match: {
  roundNumber: number;
  kickoffAt: Date;
  homeTeamName: string;
  awayTeamName: string;
  archivedAt: Date | null;
}) {
  const kickoffLabel = match.kickoffAt.toLocaleDateString("en-GB", {
    dateStyle: "short",
  });
  const suffix = match.archivedAt ? "Archived" : "Active";
  return `R${match.roundNumber} · ${kickoffLabel} · ${match.homeTeamName} vs ${match.awayTeamName} · ${suffix}`;
}

function compareLegacyRows(
  left: {
    totalPoints: number;
    correctAnswers: number;
    answeredQuestions: number;
    name: string;
    surname: string;
  },
  right: {
    totalPoints: number;
    correctAnswers: number;
    answeredQuestions: number;
    name: string;
    surname: string;
  },
) {
  return (
    right.totalPoints - left.totalPoints ||
    right.correctAnswers - left.correctAnswers ||
    right.answeredQuestions - left.answeredQuestions ||
    left.surname.localeCompare(right.surname) ||
    left.name.localeCompare(right.name)
  );
}

function buildLegacyRoundSnapshots(
  rounds: Array<{
    roundNumber: number;
    totalPoints: number;
    correctAnswers: number;
    answeredQuestions: number;
    recentAnswers: unknown;
    user: { id: string; name: string; surname: string; username: string };
  }>,
  awards: Array<{
    roundNumber: number;
    user: { id: string; name: string; surname: string };
  }>,
  knownRoundNumbers: Set<number>,
): HalisahaLegacyRoundSnapshot[] {
  const rowsByRound = new Map<number, HalisahaLegacyRoundSnapshot["rows"]>();
  const awardLabelsByRound = new Map<number, string[]>();

  for (const award of awards) {
    if (knownRoundNumbers.has(award.roundNumber)) continue;
    const existing = awardLabelsByRound.get(award.roundNumber) ?? [];
    existing.push(`${award.user.name} ${award.user.surname}`);
    awardLabelsByRound.set(award.roundNumber, existing);
  }

  for (const round of rounds) {
    if (knownRoundNumbers.has(round.roundNumber)) continue;
    const existing = rowsByRound.get(round.roundNumber) ?? [];
    existing.push({
      userId: round.user.id,
      name: round.user.name,
      surname: round.user.surname,
      username: round.user.username,
      totalPoints: round.totalPoints,
      correctAnswers: round.correctAnswers,
      answeredQuestions: round.answeredQuestions,
      recentAnswers: round.recentAnswers as HalisahaRecentAnswerRow[],
    });
    rowsByRound.set(round.roundNumber, existing);
  }

  return Array.from(rowsByRound.entries())
    .sort((left, right) => right[0] - left[0])
    .map(([roundNumber, rows]) => ({
      roundNumber,
      rows: [...rows].sort(compareLegacyRows),
      mvpWinnerLabels: [...(awardLabelsByRound.get(roundNumber) ?? [])].sort(),
    }));
}

export default async function AdminHalisahaPredictionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const initialFilters = sanitizeAdminHalisahaPredictionHistoryFilters(await searchParams);

  const activeMatch = await ensureActiveHalisahaMatch();

  const [matches, answers, questions, users, mvpVotes, leaderboardRounds, mvpAwards] =
    await Promise.all([
      prisma.halisahaMatch.findMany({
        orderBy: [{ roundNumber: "desc" }, { kickoffAt: "desc" }],
        select: {
          id: true,
          singletonKey: true,
          roundNumber: true,
          title: true,
          homeTeamName: true,
          awayTeamName: true,
          venueName: true,
          kickoffAt: true,
          answersResolvedAt: true,
          mvpResolvedAt: true,
          archivedAt: true,
        },
      }),
      prisma.halisahaAnswer.findMany({
        orderBy: [{ match: { roundNumber: "desc" } }, { updatedAt: "desc" }],
        include: {
          match: {
            select: {
              id: true,
              roundNumber: true,
              title: true,
              homeTeamName: true,
              awayTeamName: true,
              venueName: true,
              kickoffAt: true,
              answersResolvedAt: true,
              mvpResolvedAt: true,
              archivedAt: true,
            },
          },
          user: { select: { id: true, name: true, surname: true, username: true } },
          question: { select: { id: true, prompt: true, kind: true, points: true } },
          selectedOption: { select: { id: true, label: true, kind: true } },
        },
      }),
      prisma.halisahaQuestion.findMany({
        orderBy: [{ match: { roundNumber: "desc" } }, { sortOrder: "asc" }],
        select: {
          id: true,
          matchId: true,
          prompt: true,
          kind: true,
          points: true,
          match: {
            select: {
              roundNumber: true,
              homeTeamName: true,
              awayTeamName: true,
              kickoffAt: true,
              archivedAt: true,
            },
          },
          options: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, label: true, kind: true },
          },
        },
      }),
      prisma.user.findMany({
        orderBy: [{ surname: "asc" }, { name: "asc" }],
        select: { id: true, name: true, surname: true, username: true },
      }),
      prisma.halisahaMvpVote.findMany({
        orderBy: [{ match: { roundNumber: "desc" } }, { updatedAt: "desc" }],
        include: {
          match: {
            select: {
              id: true,
              roundNumber: true,
              title: true,
              homeTeamName: true,
              awayTeamName: true,
              venueName: true,
              kickoffAt: true,
              mvpResolvedAt: true,
              archivedAt: true,
            },
          },
          user: { select: { id: true, name: true, surname: true } },
          participant: {
            select: {
              id: true,
              guestName: true,
              user: { select: { name: true, surname: true } },
            },
          },
        },
      }),
      prisma.halisahaLeaderboardRound.findMany({
        orderBy: [{ roundNumber: "desc" }, { createdAt: "asc" }],
        include: {
          user: {
            select: { id: true, name: true, surname: true, username: true },
          },
        },
      }),
      prisma.halisahaMvpRoundAward.findMany({
        include: {
          user: {
            select: { id: true, name: true, surname: true },
          },
        },
      }),
    ]);

  const historyContext: HalisahaHistoryPageContext = {
    activeMatchId: activeMatch.id,
    activeRoundNumber: activeMatch.roundNumber,
    activeHomeTeamName: activeMatch.homeTeamName,
    activeAwayTeamName: activeMatch.awayTeamName,
    activeKickoffAt: activeMatch.kickoffAt.toISOString(),
    activeAnswersResolvedAt: activeMatch.answersResolvedAt?.toISOString() ?? null,
    archivedMatchCount: matches.filter((match) => match.archivedAt != null).length,
  };

  const answerRows: HalisahaAnswerRow[] = answers.map((answer) => ({
    id: answer.id,
    userId: answer.userId,
    matchId: answer.matchId,
    questionId: answer.questionId,
    isFinal: answer.isFinal,
    isCorrect: answer.isCorrect,
    awardedPoints: answer.awardedPoints,
    createdAt: answer.createdAt.toISOString(),
    updatedAt: answer.updatedAt.toISOString(),
    finalizedAt: answer.finalizedAt?.toISOString() ?? null,
    match: {
      id: answer.match.id,
      roundNumber: answer.match.roundNumber,
      title: answer.match.title,
      homeTeamName: answer.match.homeTeamName,
      awayTeamName: answer.match.awayTeamName,
      venueName: answer.match.venueName,
      kickoffAt: answer.match.kickoffAt.toISOString(),
      answersResolvedAt: answer.match.answersResolvedAt?.toISOString() ?? null,
      mvpResolvedAt: answer.match.mvpResolvedAt?.toISOString() ?? null,
      archivedAt: answer.match.archivedAt?.toISOString() ?? null,
    },
    user: {
      id: answer.user.id,
      name: answer.user.name,
      surname: answer.user.surname,
      username: answer.user.username,
    },
    question: {
      id: answer.question.id,
      prompt: answer.question.prompt,
      kind: answer.question.kind,
      points: answer.question.points,
    },
    selectedOption: {
      id: answer.selectedOption.id,
      label: answer.selectedOption.label,
      kind: answer.selectedOption.kind,
    },
    customScoreHome: answer.customScoreHome,
    customScoreAway: answer.customScoreAway,
  }));

  const questionSelects: QuestionForAdminSelect[] = questions.map((q) => ({
    id: q.id,
    matchId: q.matchId,
    matchLabel: formatMatchLabel({
      roundNumber: q.match.roundNumber,
      kickoffAt: q.match.kickoffAt,
      homeTeamName: q.match.homeTeamName,
      awayTeamName: q.match.awayTeamName,
      archivedAt: q.match.archivedAt,
    }),
    kickoffAt: q.match.kickoffAt.toISOString(),
    prompt: q.prompt,
    kind: q.kind,
    points: q.points,
    options: q.options.map((o) => ({
      id: o.id,
      label: o.label,
      kind: o.kind,
    })),
  }));

  const userOptions: UserOption[] = users.map((u) => ({
    id: u.id,
    label: `${u.name} ${u.surname}`,
    username: u.username,
  }));

  const matchOptions: HalisahaHistoryMatchOption[] = matches.map((match) => ({
    id: match.id,
    roundNumber: match.roundNumber,
    label: formatMatchLabel(match),
    title: match.title,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    venueName: match.venueName,
    kickoffAt: match.kickoffAt.toISOString(),
    answersResolvedAt: match.answersResolvedAt?.toISOString() ?? null,
    mvpResolvedAt: match.mvpResolvedAt?.toISOString() ?? null,
    archivedAt: match.archivedAt?.toISOString() ?? null,
    isActive: match.singletonKey === "active",
  }));

  const mvpRows: HalisahaMvpVoteRow[] = mvpVotes.map((v) => {
    const p = v.participant;
    const votedFor =
      p.guestName?.trim() ||
      (p.user ? `${p.user.name} ${p.user.surname}`.trim() : "Player");
    return {
      id: v.id,
      matchId: v.matchId,
      userId: v.userId,
      participantId: v.participantId,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      voterLabel: `${v.user.name} ${v.user.surname}`,
      votedForLabel: votedFor,
      match: {
        id: v.match.id,
        roundNumber: v.match.roundNumber,
        title: v.match.title,
        homeTeamName: v.match.homeTeamName,
        awayTeamName: v.match.awayTeamName,
        venueName: v.match.venueName,
        kickoffAt: v.match.kickoffAt.toISOString(),
        mvpResolvedAt: v.match.mvpResolvedAt?.toISOString() ?? null,
        archivedAt: v.match.archivedAt?.toISOString() ?? null,
      },
    };
  });

  const legacyRoundSnapshots = buildLegacyRoundSnapshots(
    leaderboardRounds.map((round) => ({
      roundNumber: round.roundNumber,
      totalPoints: round.totalPoints,
      correctAnswers: round.correctAnswers,
      answeredQuestions: round.answeredQuestions,
      recentAnswers: round.recentAnswers,
      user: round.user,
    })),
    mvpAwards.map((award) => ({
      roundNumber: award.roundNumber,
      user: award.user,
    })),
    new Set(matches.map((match) => match.roundNumber)),
  );

  return (
    <div className="space-y-6">
      <PageHeroBand
        eyebrow="HALISAHA MODE"
        title="Prediction Management & History"
        description="Review active and archived Halisaha answers with match, user, resolution, outcome, and timestamp filters in one premium admin history surface."
        highlights={[
          {
            label: "Active round",
            value: `R${historyContext.activeRoundNumber} · ${historyContext.activeHomeTeamName} vs ${historyContext.activeAwayTeamName}`,
          },
          {
            label: "Archived matches",
            value: `${historyContext.archivedMatchCount} retained for history`,
          },
          {
            label: "Coverage",
            value: `${answerRows.length} answers · ${mvpRows.length} MVP votes`,
          },
        ]}
        footerNote={
          <>
            This screen now combines the <strong>active match</strong>, archived
            Halisaha rounds, and any <strong>legacy snapshot-only</strong> rounds
            that existed before archival history was enabled.
          </>
        }
      />
      <HalisahaPredictionManagementClient
        historyContext={historyContext}
        answers={answerRows}
        matchOptions={matchOptions}
        questions={questionSelects}
        userOptions={userOptions}
        mvpVotes={mvpRows}
        legacyRoundSnapshots={legacyRoundSnapshots}
        initialFilters={initialFilters}
      />
    </div>
  );
}
