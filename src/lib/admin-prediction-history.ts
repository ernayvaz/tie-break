import { COMPETITION_IDS, UCL_COMPETITION_ID } from "@/lib/config";

export type AdminPredictionHistoryRow = {
  id: string;
  userId: string;
  matchId: string;
  selectedPrediction: string;
  isFinal: boolean;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  awardedPoints: number;
  match: {
    id: string;
    competitionId: string | null;
    stage: string;
    matchDatetime: string;
    lockAt: string;
    homeTeamName: string;
    awayTeamName: string;
    officialResultType: string | null;
    homeScore: number | null;
    awayScore: number | null;
  };
  user: {
    id: string;
    name: string;
    surname: string;
    username: string;
  };
};

export type AdminPredictionHistoryFilters = {
  leagueFilter: string;
  matchFilter: string;
  userFilter: string;
  statusFilter: "all" | "finalized" | "draft";
  timelineFilter: "all" | "previous" | "upcoming";
  resultFilter: "all" | "completed" | "awaiting_result";
  outcomeFilter: "all" | "correct" | "incorrect" | "pending";
};

type AdminPredictionHistorySearchParams = {
  league?: string;
  matchId?: string;
  userId?: string;
  status?: string;
  timeline?: string;
  result?: string;
  outcome?: string;
};

export type AdminPredictionOutcome = Exclude<
  AdminPredictionHistoryFilters["outcomeFilter"],
  "all"
>;

export type AdminPredictionHistorySummary = {
  total: number;
  finalized: number;
  drafts: number;
  previousMatches: number;
  completedMatches: number;
  correctFinalized: number;
  uniqueUsers: number;
  uniqueMatches: number;
};

export const DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS: AdminPredictionHistoryFilters = {
  leagueFilter: "",
  matchFilter: "",
  userFilter: "",
  statusFilter: "all",
  timelineFilter: "all",
  resultFilter: "all",
  outcomeFilter: "all",
};

const VALID_LEAGUE_FILTERS = new Set<AdminPredictionHistoryFilters["leagueFilter"]>([
  "",
  ...COMPETITION_IDS,
]);
const VALID_STATUS_FILTERS = new Set<AdminPredictionHistoryFilters["statusFilter"]>([
  "all",
  "finalized",
  "draft",
]);
const VALID_TIMELINE_FILTERS = new Set<AdminPredictionHistoryFilters["timelineFilter"]>([
  "all",
  "previous",
  "upcoming",
]);
const VALID_RESULT_FILTERS = new Set<AdminPredictionHistoryFilters["resultFilter"]>([
  "all",
  "completed",
  "awaiting_result",
]);
const VALID_OUTCOME_FILTERS = new Set<AdminPredictionHistoryFilters["outcomeFilter"]>([
  "all",
  "correct",
  "incorrect",
  "pending",
]);

function readTrimmed(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function sanitizeAdminPredictionHistoryFilters(
  params: AdminPredictionHistorySearchParams
): AdminPredictionHistoryFilters {
  const league = readTrimmed(params.league);
  const status = readTrimmed(params.status);
  const timeline = readTrimmed(params.timeline);
  const result = readTrimmed(params.result);
  const outcome = readTrimmed(params.outcome);

  return {
    leagueFilter: VALID_LEAGUE_FILTERS.has(
      league as AdminPredictionHistoryFilters["leagueFilter"]
    )
      ? (league as AdminPredictionHistoryFilters["leagueFilter"])
      : DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.leagueFilter,
    matchFilter: readTrimmed(params.matchId),
    userFilter: readTrimmed(params.userId),
    statusFilter: VALID_STATUS_FILTERS.has(
      status as AdminPredictionHistoryFilters["statusFilter"]
    )
      ? (status as AdminPredictionHistoryFilters["statusFilter"])
      : DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.statusFilter,
    timelineFilter: VALID_TIMELINE_FILTERS.has(
      timeline as AdminPredictionHistoryFilters["timelineFilter"]
    )
      ? (timeline as AdminPredictionHistoryFilters["timelineFilter"])
      : DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.timelineFilter,
    resultFilter: VALID_RESULT_FILTERS.has(
      result as AdminPredictionHistoryFilters["resultFilter"]
    )
      ? (result as AdminPredictionHistoryFilters["resultFilter"])
      : DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.resultFilter,
    outcomeFilter: VALID_OUTCOME_FILTERS.has(
      outcome as AdminPredictionHistoryFilters["outcomeFilter"]
    )
      ? (outcome as AdminPredictionHistoryFilters["outcomeFilter"])
      : DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.outcomeFilter,
  };
}

export function isCompletedPredictionMatch(row: AdminPredictionHistoryRow): boolean {
  return row.match.officialResultType !== null;
}

export function isPastPredictionMatch(
  row: AdminPredictionHistoryRow,
  now: Date = new Date()
): boolean {
  return new Date(row.match.matchDatetime).getTime() < now.getTime();
}

export function getAdminPredictionOutcome(
  row: AdminPredictionHistoryRow
): AdminPredictionOutcome {
  if (!row.isFinal || row.match.officialResultType === null) return "pending";
  return row.selectedPrediction === row.match.officialResultType
    ? "correct"
    : "incorrect";
}

export function applyAdminPredictionHistoryFilters(
  rows: AdminPredictionHistoryRow[],
  filters: AdminPredictionHistoryFilters,
  now: Date = new Date()
): AdminPredictionHistoryRow[] {
  return rows.filter((row) => {
    if (
      filters.leagueFilter === UCL_COMPETITION_ID &&
      row.match.competitionId !== UCL_COMPETITION_ID &&
      row.match.competitionId != null
    ) {
      return false;
    }

    if (
      filters.leagueFilter &&
      filters.leagueFilter !== UCL_COMPETITION_ID &&
      row.match.competitionId !== filters.leagueFilter
    ) {
      return false;
    }

    if (filters.matchFilter && row.matchId !== filters.matchFilter) return false;
    if (filters.userFilter && row.userId !== filters.userFilter) return false;

    if (filters.statusFilter === "finalized" && !row.isFinal) return false;
    if (filters.statusFilter === "draft" && row.isFinal) return false;

    const isPast = isPastPredictionMatch(row, now);
    if (filters.timelineFilter === "previous" && !isPast) return false;
    if (filters.timelineFilter === "upcoming" && isPast) return false;

    const isCompleted = isCompletedPredictionMatch(row);
    if (filters.resultFilter === "completed" && !isCompleted) return false;
    if (filters.resultFilter === "awaiting_result" && isCompleted) return false;

    const outcome = getAdminPredictionOutcome(row);
    if (filters.outcomeFilter !== "all" && outcome !== filters.outcomeFilter) {
      return false;
    }

    return true;
  });
}

export function buildAdminPredictionHistorySummary(
  rows: AdminPredictionHistoryRow[],
  now: Date = new Date()
): AdminPredictionHistorySummary {
  let finalized = 0;
  let previousMatches = 0;
  let completedMatches = 0;
  let correctFinalized = 0;
  const userIds = new Set<string>();
  const matchIds = new Set<string>();

  for (const row of rows) {
    userIds.add(row.userId);
    matchIds.add(row.matchId);

    if (row.isFinal) finalized += 1;
    if (isPastPredictionMatch(row, now)) previousMatches += 1;
    if (isCompletedPredictionMatch(row)) completedMatches += 1;
    if (getAdminPredictionOutcome(row) === "correct") correctFinalized += 1;
  }

  return {
    total: rows.length,
    finalized,
    drafts: rows.length - finalized,
    previousMatches,
    completedMatches,
    correctFinalized,
    uniqueUsers: userIds.size,
    uniqueMatches: matchIds.size,
  };
}
