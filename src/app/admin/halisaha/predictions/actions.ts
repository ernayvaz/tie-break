"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createAdminLog } from "@/lib/admin-log";
import { requireAdmin } from "@/lib/auth/get-user";
import {
  purgeArchivedHalisahaMatchesBefore,
  rebuildHalisahaLeaderboardForMatch,
} from "@/lib/halisaha/server";

export type HalisahaPredictionAdminState = { ok: true; message?: string } | { ok: false; error: string };

function revalidateHalisahaPredictionPaths() {
  revalidatePath("/admin/halisaha");
  revalidatePath("/admin/halisaha/predictions");
  revalidatePath("/halisaha");
  revalidatePath("/leaderboard");
}

async function refreshLeaderboard(matchId: string): Promise<string | null> {
  const result = await rebuildHalisahaLeaderboardForMatch(matchId);
  return result.ok ? null : result.error;
}

export async function setHalisahaAnswerPointsAction(
  answerId: string,
  mode: "zero" | "full",
): Promise<HalisahaPredictionAdminState> {
  const admin = await requireAdmin();
  const answer = await prisma.halisahaAnswer.findUnique({
    where: { id: answerId },
    include: {
      question: { select: { id: true, points: true } },
    },
  });
  if (!answer) return { ok: false, error: "Answer not found." };
  if (!answer.isFinal) return { ok: false, error: "Only finalized answers can be adjusted." };

  const maxPts = answer.question.points;
  const awardedPoints = mode === "zero" ? 0 : maxPts;
  const isCorrect = mode === "full";

  const previous = `pts:${answer.awardedPoints}/correct:${answer.isCorrect}`;
  await prisma.halisahaAnswer.update({
    where: { id: answerId },
    data: {
      awardedPoints,
      isCorrect,
    },
  });

  const lbErr = await refreshLeaderboard(answer.matchId);
  if (lbErr) {
    return { ok: false, error: `Points updated but leaderboard sync failed: ${lbErr}` };
  }

  await createAdminLog(
    admin.id,
    "halisaha_answer_points_override",
    "halisaha_answer",
    answerId,
    previous,
    `pts:${awardedPoints}/correct:${isCorrect}`,
  );
  revalidateHalisahaPredictionPaths();
  return { ok: true, message: "Points updated. Leaderboard refreshed." };
}

export async function deleteHalisahaAnswerAction(answerId: string): Promise<HalisahaPredictionAdminState> {
  const admin = await requireAdmin();
  const answer = await prisma.halisahaAnswer.findUnique({
    where: { id: answerId },
    select: { id: true, matchId: true, userId: true, questionId: true },
  });
  if (!answer) return { ok: false, error: "Answer not found." };

  await prisma.halisahaAnswer.delete({ where: { id: answerId } });

  const lbErr = await refreshLeaderboard(answer.matchId);
  if (lbErr) {
    return { ok: false, error: `Answer removed but leaderboard sync failed: ${lbErr}` };
  }

  await createAdminLog(
    admin.id,
    "halisaha_answer_deleted",
    "halisaha_answer",
    answerId,
    `${answer.userId}/${answer.questionId}`,
    null,
  );
  revalidateHalisahaPredictionPaths();
  return { ok: true, message: "Answer removed. Leaderboard refreshed." };
}

export async function adminResetUserHalisahaMatchAnswersAction(
  targetUserId: string,
  matchId: string,
  options?: { deleteMvpVotes?: boolean },
): Promise<HalisahaPredictionAdminState> {
  const admin = await requireAdmin();

  const match = await prisma.halisahaMatch.findUnique({
    where: { id: matchId },
    select: { id: true },
  });
  if (!match) return { ok: false, error: "Match not found." };

  const count = await prisma.halisahaAnswer.count({
    where: { matchId, userId: targetUserId },
  });

  await prisma.$transaction(async (tx) => {
    await tx.halisahaAnswer.deleteMany({
      where: { matchId, userId: targetUserId },
    });
    if (options?.deleteMvpVotes) {
      await tx.halisahaMvpVote.deleteMany({
        where: { matchId, userId: targetUserId },
      });
    }
  });

  const lbErr = await refreshLeaderboard(matchId);
  if (lbErr) {
    return { ok: false, error: `Reset but leaderboard sync failed: ${lbErr}` };
  }

  await createAdminLog(
    admin.id,
    "halisaha_user_match_answers_reset",
    "halisaha_match",
    matchId,
    `user:${targetUserId}`,
    `deleted_answers:${count}${options?.deleteMvpVotes ? "+mvp" : ""}`,
  );
  revalidateHalisahaPredictionPaths();
  return {
    ok: true,
    message: `Removed ${count} answer(s) for this user.${options?.deleteMvpVotes ? " MVP votes removed." : ""}`,
  };
}

export async function deleteHalisahaMvpVoteAction(voteId: string): Promise<HalisahaPredictionAdminState> {
  const admin = await requireAdmin();
  const vote = await prisma.halisahaMvpVote.findUnique({
    where: { id: voteId },
    select: { id: true, matchId: true, userId: true, participantId: true },
  });
  if (!vote) return { ok: false, error: "Vote not found." };

  await prisma.halisahaMvpVote.delete({ where: { id: voteId } });

  const lbErr = await refreshLeaderboard(vote.matchId);
  if (lbErr) {
    return { ok: false, error: `Vote removed but leaderboard sync failed: ${lbErr}` };
  }

  await createAdminLog(
    admin.id,
    "halisaha_mvp_vote_deleted",
    "halisaha_mvp_vote",
    voteId,
    `user:${vote.userId}/participant:${vote.participantId}`,
    null,
  );
  revalidateHalisahaPredictionPaths();
  return { ok: true, message: "MVP vote removed. Leaderboard refreshed." };
}

export async function adminSetHalisahaAnswerAction(
  targetUserId: string,
  questionId: string,
  optionId: string,
  finalize: boolean,
  enteredAtIso: string | null | undefined,
  customScore?: { home: number | null; away: number | null },
): Promise<HalisahaPredictionAdminState> {
  const admin = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, status: true },
  });
  if (!user) return { ok: false, error: "User not found." };
  if (user.status === "blocked") {
    return { ok: false, error: "Cannot set answers for a blocked user." };
  }

  const question = await prisma.halisahaQuestion.findUnique({
    where: { id: questionId },
    include: {
      match: { select: { id: true } },
      options: { select: { id: true, kind: true } },
    },
  });
  if (!question) return { ok: false, error: "Question not found." };

  const selectedOption = question.options.find((o) => o.id === optionId);
  if (!selectedOption) return { ok: false, error: "Invalid option for this question." };

  let customScoreHome: number | null = customScore?.home ?? null;
  let customScoreAway: number | null = customScore?.away ?? null;

  if (selectedOption.kind === "custom_score") {
    if (
      customScoreHome === null ||
      customScoreAway === null ||
      !Number.isInteger(customScoreHome) ||
      !Number.isInteger(customScoreAway) ||
      customScoreHome < 0 ||
      customScoreAway < 0
    ) {
      return { ok: false, error: "Enter valid non-negative integer home and away scores for this option." };
    }
  } else {
    customScoreHome = null;
    customScoreAway = null;
  }

  let effectiveEnteredAt = new Date();
  if (enteredAtIso != null && String(enteredAtIso).trim() !== "") {
    const parsed = new Date(enteredAtIso);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Invalid date/time." };
    }
    effectiveEnteredAt = parsed;
  }

  const matchId = question.match.id;
  const finalizedAt = finalize ? effectiveEnteredAt : null;

  const before = await prisma.halisahaAnswer.findUnique({
    where: { questionId_userId: { questionId, userId: targetUserId } },
    select: {
      id: true,
      selectedOptionId: true,
      isFinal: true,
      awardedPoints: true,
    },
  });
  const oldSummary = before
    ? `${before.selectedOptionId}/${before.isFinal ? "final" : "draft"}/pts:${before.awardedPoints}`
    : "(none)";

  await prisma.$transaction(async (tx) => {
    await tx.halisahaAnswer.upsert({
      where: {
        questionId_userId: {
          questionId,
          userId: targetUserId,
        },
      },
      update: {
        matchId,
        selectedOptionId: optionId,
        customScoreHome,
        customScoreAway,
        isCorrect: null,
        awardedPoints: 0,
        isFinal: Boolean(finalize),
        finalizedAt,
        createdAt: effectiveEnteredAt,
      },
      create: {
        matchId,
        questionId,
        userId: targetUserId,
        selectedOptionId: optionId,
        customScoreHome,
        customScoreAway,
        isFinal: Boolean(finalize),
        finalizedAt,
        createdAt: effectiveEnteredAt,
      },
    });

    if (finalize) {
      await tx.halisahaAnswer.updateMany({
        where: { matchId, userId: targetUserId },
        data: {
          isFinal: true,
          finalizedAt,
        },
      });
    }
  });

  const lbErr = await refreshLeaderboard(matchId);
  if (lbErr) {
    return { ok: false, error: `Saved but leaderboard sync failed: ${lbErr}` };
  }

  const afterRow = await prisma.halisahaAnswer.findUnique({
    where: { questionId_userId: { questionId, userId: targetUserId } },
    select: { id: true },
  });

  await createAdminLog(
    admin.id,
    "admin_set_halisaha_answer",
    "halisaha_answer",
    afterRow?.id ?? `${targetUserId}:${questionId}`,
    oldSummary,
    `${optionId}/${finalize ? "final" : "draft"}/at:${effectiveEnteredAt.toISOString()}`,
  );
  revalidateHalisahaPredictionPaths();
  return {
    ok: true,
    message: finalize ? "Answer saved and locked for this user (all questions)." : "Answer saved as draft.",
  };
}

export async function purgeArchivedHalisahaMatchesAction(
  cutoffIso: string,
): Promise<HalisahaPredictionAdminState> {
  const admin = await requireAdmin();
  const parsedCutoff = new Date(cutoffIso);

  if (Number.isNaN(parsedCutoff.getTime())) {
    return { ok: false, error: "Invalid archive cutoff date." };
  }

  const result = await purgeArchivedHalisahaMatchesBefore(parsedCutoff);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await createAdminLog(
    admin.id,
    "halisaha_match_archive_purged",
    "halisaha_match",
    parsedCutoff.toISOString(),
    null,
    `deleted_matches:${result.deletedMatches}/deleted_rounds:${result.deletedRounds}`,
  );
  revalidateHalisahaPredictionPaths();

  return {
    ok: true,
    message:
      result.deletedMatches > 0
        ? `Archived history purged. ${result.deletedMatches} match(es) and ${result.deletedRounds} round snapshot(s) removed.`
        : "No archived Halisaha matches matched that cutoff.",
  };
}
