export type HalisahaHistoryQuestionKind =
  | ""
  | "winner"
  | "mvp_prediction"
  | "score_prediction"
  | "standard";

export type AdminHalisahaPredictionHistoryFilters = {
  tab: "answers" | "mvp";
  matchFilter: string;
  userFilter: string;
  questionFilter: string;
  voteTargetFilter: string;
  kindFilter: HalisahaHistoryQuestionKind;
  statusFilter: "all" | "finalized" | "draft";
  timelineFilter: "all" | "previous" | "upcoming";
  resolutionFilter: "all" | "resolved" | "awaiting_resolution";
  outcomeFilter: "all" | "correct" | "incorrect" | "pending";
};

type AdminHalisahaPredictionHistorySearchParams = {
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
};

export type AdminHalisahaAnswerHistoryRow = {
  id: string;
  userId: string;
  matchId: string;
  questionId: string;
  isFinal: boolean;
  isCorrect: boolean | null;
  awardedPoints: number;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  match: {
    id: string;
    roundNumber: number;
    title: string;
    homeTeamName: string;
    awayTeamName: string;
    venueName: string;
    kickoffAt: string;
    answersResolvedAt: string | null;
    mvpResolvedAt: string | null;
    archivedAt: string | null;
  };
  user: {
    id: string;
    name: string;
    surname: string;
    username: string;
  };
  question: {
    id: string;
    prompt: string;
    kind: Exclude<HalisahaHistoryQuestionKind, "">;
    points: number;
  };
  selectedOption: {
    id: string;
    label: string;
    kind: string;
  };
  customScoreHome: number | null;
  customScoreAway: number | null;
};

export type AdminHalisahaMvpVoteHistoryRow = {
  id: string;
  matchId: string;
  userId: string;
  participantId: string;
  createdAt: string;
  updatedAt: string;
  voterLabel: string;
  votedForLabel: string;
  match: {
    id: string;
    roundNumber: number;
    title: string;
    homeTeamName: string;
    awayTeamName: string;
    venueName: string;
    kickoffAt: string;
    mvpResolvedAt: string | null;
    archivedAt: string | null;
  };
};

export type AdminHalisahaAnswerHistorySummary = {
  total: number;
  finalized: number;
  drafts: number;
  previousMatches: number;
  resolvedMatches: number;
  correctFinalized: number;
  uniqueUsers: number;
  uniqueMatches: number;
};

export type AdminHalisahaMvpHistorySummary = {
  total: number;
  previousMatches: number;
  resolvedMatches: number;
  uniqueVoters: number;
  uniqueMatches: number;
};

export const DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS: AdminHalisahaPredictionHistoryFilters =
  {
    tab: "answers",
    matchFilter: "",
    userFilter: "",
    questionFilter: "",
    voteTargetFilter: "",
    kindFilter: "",
    statusFilter: "all",
    timelineFilter: "all",
    resolutionFilter: "all",
    outcomeFilter: "all",
  };

const VALID_TABS = new Set<AdminHalisahaPredictionHistoryFilters["tab"]>([
  "answers",
  "mvp",
]);
const VALID_KINDS = new Set<HalisahaHistoryQuestionKind>([
  "",
  "winner",
  "mvp_prediction",
  "score_prediction",
  "standard",
]);
const VALID_STATUS_FILTERS = new Set<
  AdminHalisahaPredictionHistoryFilters["statusFilter"]
>(["all", "finalized", "draft"]);
const VALID_TIMELINE_FILTERS = new Set<
  AdminHalisahaPredictionHistoryFilters["timelineFilter"]
>(["all", "previous", "upcoming"]);
const VALID_RESOLUTION_FILTERS = new Set<
  AdminHalisahaPredictionHistoryFilters["resolutionFilter"]
>(["all", "resolved", "awaiting_resolution"]);
const VALID_OUTCOME_FILTERS = new Set<
  AdminHalisahaPredictionHistoryFilters["outcomeFilter"]
>(["all", "correct", "incorrect", "pending"]);

function readTrimmed(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function sanitizeAdminHalisahaPredictionHistoryFilters(
  params: AdminHalisahaPredictionHistorySearchParams,
): AdminHalisahaPredictionHistoryFilters {
  const tab = readTrimmed(params.tab);
  const kind = readTrimmed(params.kind);
  const status = readTrimmed(params.status);
  const timeline = readTrimmed(params.timeline);
  const resolution = readTrimmed(params.resolution);
  const outcome = readTrimmed(params.outcome);

  return {
    tab: VALID_TABS.has(tab as AdminHalisahaPredictionHistoryFilters["tab"])
      ? (tab as AdminHalisahaPredictionHistoryFilters["tab"])
      : DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.tab,
    matchFilter: readTrimmed(params.matchId),
    userFilter: readTrimmed(params.userId),
    questionFilter: readTrimmed(params.questionId),
    voteTargetFilter: readTrimmed(params.voteTargetId),
    kindFilter: VALID_KINDS.has(kind as HalisahaHistoryQuestionKind)
      ? (kind as HalisahaHistoryQuestionKind)
      : DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.kindFilter,
    statusFilter: VALID_STATUS_FILTERS.has(
      status as AdminHalisahaPredictionHistoryFilters["statusFilter"],
    )
      ? (status as AdminHalisahaPredictionHistoryFilters["statusFilter"])
      : DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.statusFilter,
    timelineFilter: VALID_TIMELINE_FILTERS.has(
      timeline as AdminHalisahaPredictionHistoryFilters["timelineFilter"],
    )
      ? (timeline as AdminHalisahaPredictionHistoryFilters["timelineFilter"])
      : DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.timelineFilter,
    resolutionFilter: VALID_RESOLUTION_FILTERS.has(
      resolution as AdminHalisahaPredictionHistoryFilters["resolutionFilter"],
    )
      ? (resolution as AdminHalisahaPredictionHistoryFilters["resolutionFilter"])
      : DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.resolutionFilter,
    outcomeFilter: VALID_OUTCOME_FILTERS.has(
      outcome as AdminHalisahaPredictionHistoryFilters["outcomeFilter"],
    )
      ? (outcome as AdminHalisahaPredictionHistoryFilters["outcomeFilter"])
      : DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.outcomeFilter,
  };
}

export function isPastHalisahaHistoryMatch(
  kickoffAtIso: string,
  now: Date = new Date(),
) {
  return new Date(kickoffAtIso).getTime() < now.getTime();
}

export function isResolvedHalisahaAnswerRow(row: AdminHalisahaAnswerHistoryRow) {
  return row.match.answersResolvedAt !== null;
}

export function isResolvedHalisahaMvpVoteRow(row: AdminHalisahaMvpVoteHistoryRow) {
  return row.match.mvpResolvedAt !== null;
}

export function getAdminHalisahaAnswerOutcome(
  row: AdminHalisahaAnswerHistoryRow,
): Exclude<AdminHalisahaPredictionHistoryFilters["outcomeFilter"], "all"> {
  if (!row.isFinal || row.isCorrect === null) return "pending";
  return row.isCorrect ? "correct" : "incorrect";
}

export function applyAdminHalisahaAnswerHistoryFilters(
  rows: AdminHalisahaAnswerHistoryRow[],
  filters: AdminHalisahaPredictionHistoryFilters,
  now: Date = new Date(),
): AdminHalisahaAnswerHistoryRow[] {
  return rows.filter((row) => {
    if (filters.matchFilter && row.matchId !== filters.matchFilter) return false;
    if (filters.userFilter && row.userId !== filters.userFilter) return false;
    if (filters.questionFilter && row.questionId !== filters.questionFilter) return false;
    if (filters.kindFilter && row.question.kind !== filters.kindFilter) return false;
    if (filters.statusFilter === "finalized" && !row.isFinal) return false;
    if (filters.statusFilter === "draft" && row.isFinal) return false;

    const isPast = isPastHalisahaHistoryMatch(row.match.kickoffAt, now);
    if (filters.timelineFilter === "previous" && !isPast) return false;
    if (filters.timelineFilter === "upcoming" && isPast) return false;

    const resolved = isResolvedHalisahaAnswerRow(row);
    if (filters.resolutionFilter === "resolved" && !resolved) return false;
    if (filters.resolutionFilter === "awaiting_resolution" && resolved) return false;

    const outcome = getAdminHalisahaAnswerOutcome(row);
    if (filters.outcomeFilter !== "all" && filters.outcomeFilter !== outcome) {
      return false;
    }

    return true;
  });
}

export function applyAdminHalisahaMvpHistoryFilters(
  rows: AdminHalisahaMvpVoteHistoryRow[],
  filters: AdminHalisahaPredictionHistoryFilters,
  now: Date = new Date(),
): AdminHalisahaMvpVoteHistoryRow[] {
  return rows.filter((row) => {
    if (filters.matchFilter && row.matchId !== filters.matchFilter) return false;
    if (filters.userFilter && row.userId !== filters.userFilter) return false;
    if (filters.voteTargetFilter && row.participantId !== filters.voteTargetFilter) {
      return false;
    }

    const isPast = isPastHalisahaHistoryMatch(row.match.kickoffAt, now);
    if (filters.timelineFilter === "previous" && !isPast) return false;
    if (filters.timelineFilter === "upcoming" && isPast) return false;

    const resolved = isResolvedHalisahaMvpVoteRow(row);
    if (filters.resolutionFilter === "resolved" && !resolved) return false;
    if (filters.resolutionFilter === "awaiting_resolution" && resolved) return false;

    return true;
  });
}

export function buildAdminHalisahaAnswerHistorySummary(
  rows: AdminHalisahaAnswerHistoryRow[],
  now: Date = new Date(),
): AdminHalisahaAnswerHistorySummary {
  let finalized = 0;
  let previousMatches = 0;
  let resolvedMatches = 0;
  let correctFinalized = 0;
  const userIds = new Set<string>();
  const matchIds = new Set<string>();

  for (const row of rows) {
    userIds.add(row.userId);
    matchIds.add(row.matchId);

    if (row.isFinal) finalized += 1;
    if (isPastHalisahaHistoryMatch(row.match.kickoffAt, now)) previousMatches += 1;
    if (isResolvedHalisahaAnswerRow(row)) resolvedMatches += 1;
    if (getAdminHalisahaAnswerOutcome(row) === "correct") correctFinalized += 1;
  }

  return {
    total: rows.length,
    finalized,
    drafts: rows.length - finalized,
    previousMatches,
    resolvedMatches,
    correctFinalized,
    uniqueUsers: userIds.size,
    uniqueMatches: matchIds.size,
  };
}

export function buildAdminHalisahaMvpHistorySummary(
  rows: AdminHalisahaMvpVoteHistoryRow[],
  now: Date = new Date(),
): AdminHalisahaMvpHistorySummary {
  let previousMatches = 0;
  let resolvedMatches = 0;
  const userIds = new Set<string>();
  const matchIds = new Set<string>();

  for (const row of rows) {
    userIds.add(row.userId);
    matchIds.add(row.matchId);
    if (isPastHalisahaHistoryMatch(row.match.kickoffAt, now)) previousMatches += 1;
    if (isResolvedHalisahaMvpVoteRow(row)) resolvedMatches += 1;
  }

  return {
    total: rows.length,
    previousMatches,
    resolvedMatches,
    uniqueVoters: userIds.size,
    uniqueMatches: matchIds.size,
  };
}
