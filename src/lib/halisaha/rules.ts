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

export function buildHalisahaMvpGateState(input: {
  phase: HalisahaMatchPhase;
  hasSubmittedPostMatchVote: boolean;
  shouldRequireVote?: boolean;
}) {
  const requiresPostMatchVote =
    input.phase !== "pre_match" && (input.shouldRequireVote ?? true);
  const canRevealResults = !requiresPostMatchVote || input.hasSubmittedPostMatchVote;

  return {
    phase: input.phase,
    requiresPostMatchVote,
    hasSubmittedPostMatchVote: input.hasSubmittedPostMatchVote,
    canRevealResults,
    title: "Vote for the post-match MVP first",
    description:
      input.phase === "pre_match"
        ? "Results are available after the match begins."
        : input.phase === "post_match_mvp_voting"
          ? "The 24-hour MVP vote is live. Submit your MVP vote to unlock your Halisaha results and leaderboard view."
          : "The MVP window has closed and the final MVP is locked. Submit your MVP vote to unlock your Halisaha results and leaderboard view.",
    buttonLabel: "Go to MVP vote",
    ctaHref: "/halisaha?postMatchVote=1",
  };
}

export function shouldRevealWinnerPercentages(input: {
  phase: HalisahaMatchPhase;
  userAnswersLocked: boolean;
  canRevealResults: boolean;
  hasWinnerVoteSummary: boolean;
}) {
  if (input.phase === "pre_match") {
    return input.userAnswersLocked;
  }

  return input.canRevealResults && input.hasWinnerVoteSummary;
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
    kind: "standard" | "custom_score";
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
