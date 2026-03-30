export const HALISAHA_DEFAULT_MATCH_DURATION_MINUTES = 60;
export const HALISAHA_POST_MATCH_MVP_VOTE_WINDOW_HOURS = 24;
export const HALISAHA_PREDICTION_LOCK_BUFFER_MINUTES = 5;

export type HalisahaMatchPhase =
  | "pre_match"
  | "post_match_mvp_voting"
  | "results_unlocked";

export function getHalisahaMatchEndAt(input: {
  kickoffAt: Date;
  matchDurationMinutes: number;
}) {
  return new Date(
    input.kickoffAt.getTime() + Math.max(0, input.matchDurationMinutes) * 60_000,
  );
}

export function getHalisahaMvpVoteEndsAt(input: {
  kickoffAt: Date;
  matchDurationMinutes: number;
}) {
  return new Date(
    getHalisahaMatchEndAt(input).getTime() +
      HALISAHA_POST_MATCH_MVP_VOTE_WINDOW_HOURS * 60 * 60_000,
  );
}

export function getHalisahaPredictionLockAt(input: { kickoffAt: Date }) {
  return new Date(
    input.kickoffAt.getTime() - HALISAHA_PREDICTION_LOCK_BUFFER_MINUTES * 60_000,
  );
}

export function isHalisahaPredictionWindowOpen(
  input: { kickoffAt: Date },
  now: Date = new Date(),
) {
  return now < getHalisahaPredictionLockAt(input);
}

export function getHalisahaMatchPhase(
  input: {
    kickoffAt: Date;
    matchDurationMinutes: number;
  },
  now: Date = new Date(),
): HalisahaMatchPhase {
  const matchEndAt = getHalisahaMatchEndAt(input);
  if (now < matchEndAt) {
    return "pre_match";
  }

  if (now < getHalisahaMvpVoteEndsAt(input)) {
    return "post_match_mvp_voting";
  }

  return "results_unlocked";
}

export type ParsedScore = {
  home: number;
  away: number;
};

const SCORE_PATTERN = /^\s*(\d+)\s*-\s*(\d+)\s*$/;

export function parseScoreLabel(label: string): ParsedScore | null {
  const match = SCORE_PATTERN.exec(label);
  if (!match) {
    return null;
  }

  return {
    home: Number(match[1]),
    away: Number(match[2]),
  };
}

export function formatScoreLabel(score: ParsedScore) {
  return `${score.home}-${score.away}`;
}
