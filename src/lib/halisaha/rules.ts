import {
  parseScoreLabel,
  type HalisahaMatchPhase,
  type ParsedScore,
} from "./match-state";

export type HalisahaGateAnswerState = {
  selectedOptionId: string;
  customScoreHome: number | null;
  customScoreAway: number | null;
  isCorrect: boolean | null;
  awardedPoints: number;
  isFinal: boolean;
  finalizedAtIso: string | null;
};

export type HalisahaMvpGateMode =
  | "open"
  | "vote_required"
  | "waiting_for_vote_window";

export function buildHalisahaMvpGateState(input: {
  phase: HalisahaMatchPhase;
  hasSubmittedPostMatchVote: boolean;
  voteEligible?: boolean;
}) {
  const voteEligible = input.voteEligible ?? true;
  const waitingForVoteWindow =
    input.phase === "post_match_mvp_voting" && !voteEligible;
  const requiresPostMatchVote =
    input.phase === "post_match_mvp_voting" &&
    voteEligible &&
    !input.hasSubmittedPostMatchVote;
  const canRevealResults =
    input.phase === "pre_match" ||
    input.phase === "results_unlocked" ||
    (input.phase === "post_match_mvp_voting" &&
      voteEligible &&
      input.hasSubmittedPostMatchVote);
  const mode: HalisahaMvpGateMode = requiresPostMatchVote
    ? "vote_required"
    : waitingForVoteWindow
      ? "waiting_for_vote_window"
      : "open";

  const content =
    mode === "vote_required"
      ? {
          title: "Vote for the post-match MVP first",
          description:
            "The 24-hour MVP voting window is live for the admin and the players who took part in the match. Submit your MVP vote to unlock Halisaha results and leaderboard view immediately.",
          buttonLabel: "Go to MVP vote",
          ctaHref: "/halisaha?postMatchVote=1",
        }
      : mode === "waiting_for_vote_window"
        ? {
            title: "Results unlock after MVP voting",
            description:
              "The 24-hour MVP voting window is active for the admin and the players who took part in the match. Once that window ends, the final MVP, correct answers, and leaderboard will become visible for everyone.",
            buttonLabel: "Open Matchday",
            ctaHref: "/halisaha",
          }
        : {
            title: "Results available",
            description:
              input.phase === "pre_match"
                ? "Your saved answers stay visible here until the match ends."
                : "The final MVP is locked and Halisaha results are available.",
            buttonLabel: "Open Matchday",
            ctaHref: "/halisaha",
          };

  return {
    phase: input.phase,
    mode,
    requiresPostMatchVote,
    hasSubmittedPostMatchVote: input.hasSubmittedPostMatchVote,
    canRevealResults,
    title: content.title,
    description: content.description,
    buttonLabel: content.buttonLabel,
    ctaHref: content.ctaHref,
  };
}

export function shouldRevealWinnerPercentages(input: {
  phase: HalisahaMatchPhase;
  userAnswersLocked: boolean;
  canRevealResults: boolean;
  hasWinnerVoteSummary: boolean;
}) {
  if (!input.hasWinnerVoteSummary) {
    return false;
  }

  if (input.phase === "pre_match") {
    return input.userAnswersLocked;
  }

  return input.canRevealResults;
}

export function maskHalisahaAnswerForGate<T extends HalisahaGateAnswerState>(
  answer: T,
  hideResolvedResults: boolean,
) {
  return {
    ...answer,
    isCorrect: hideResolvedResults ? null : answer.isCorrect,
    awardedPoints: hideResolvedResults ? 0 : answer.awardedPoints,
  };
}

export function getMatchingFixedScoreOptionIds(input: {
  options: Array<{
    id: string;
    label: string;
    kind: "standard" | "custom_score" | "custom_number";
  }>;
  actualScore: ParsedScore;
}) {
  return input.options
    .filter((option) => option.kind === "standard")
    .filter((option) => {
      const parsed = parseScoreLabel(option.label);
      return (
        parsed !== null &&
        parsed.home === input.actualScore.home &&
        parsed.away === input.actualScore.away
      );
    })
    .map((option) => option.id);
}

export function isCustomScoreExactMatch(input: {
  actualScore: ParsedScore;
  customScoreHome: number | null;
  customScoreAway: number | null;
}) {
  return (
    input.customScoreHome === input.actualScore.home &&
    input.customScoreAway === input.actualScore.away
  );
}

export function isCustomNumberExactMatch(input: {
  actualValue: number;
  customScoreHome: number | null;
}) {
  return input.customScoreHome === input.actualValue;
}
