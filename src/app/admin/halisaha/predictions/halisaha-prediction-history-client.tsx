"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Modal } from "@/components/ui";
import {
  applyAdminHalisahaAnswerHistoryFilters,
  applyAdminHalisahaMvpHistoryFilters,
  buildAdminHalisahaAnswerHistorySummary,
  buildAdminHalisahaMvpHistorySummary,
  DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS,
  getAdminHalisahaAnswerOutcome,
  isResolvedHalisahaAnswerRow,
  isResolvedHalisahaMvpVoteRow,
  type AdminHalisahaAnswerHistoryRow,
  type AdminHalisahaMvpVoteHistoryRow,
  type AdminHalisahaPredictionHistoryFilters,
} from "@/lib/admin-halisaha-prediction-history";
import { type HalisahaRecentAnswerRow } from "@/lib/halisaha/leaderboard";
import {
  adminResetUserHalisahaMatchAnswersAction,
  adminSetHalisahaAnswerAction,
  deleteHalisahaAnswerAction,
  deleteHalisahaMvpVoteAction,
  purgeArchivedHalisahaMatchesAction,
  setHalisahaAnswerPointsAction,
} from "./actions";

export type HalisahaHistoryPageContext = {
  activeMatchId: string;
  activeRoundNumber: number;
  activeHomeTeamName: string;
  activeAwayTeamName: string;
  activeKickoffAt: string;
  activeAnswersResolvedAt: string | null;
  archivedMatchCount: number;
};

export type HalisahaAnswerRow = AdminHalisahaAnswerHistoryRow;
export type HalisahaMvpVoteRow = AdminHalisahaMvpVoteHistoryRow;

export type HalisahaHistoryMatchOption = {
  id: string;
  roundNumber: number;
  label: string;
  title: string;
  homeTeamName: string;
  awayTeamName: string;
  venueName: string;
  kickoffAt: string;
  answersResolvedAt: string | null;
  mvpResolvedAt: string | null;
  archivedAt: string | null;
  isActive: boolean;
};

export type QuestionForAdminSelect = {
  id: string;
  matchId: string;
  matchLabel: string;
  kickoffAt: string;
  prompt: string;
  kind: string;
  points: number;
  options: { id: string; label: string; kind: string }[];
};

export type UserOption = { id: string; label: string; username: string };

export type HalisahaLegacyRoundSnapshot = {
  roundNumber: number;
  rows: Array<{
    userId: string;
    name: string;
    surname: string;
    username: string;
    totalPoints: number;
    correctAnswers: number;
    answeredQuestions: number;
    recentAnswers: HalisahaRecentAnswerRow[];
  }>;
  mvpWinnerLabels: string[];
};

type MvpTargetOption = {
  id: string;
  label: string;
  matchId: string;
};

const QUESTION_KINDS = [
  { value: "", label: "All kinds" },
  { value: "winner", label: "Who wins" },
  { value: "mvp_prediction", label: "MVP" },
  { value: "score_prediction", label: "Score" },
  { value: "standard", label: "Standard" },
] as const;

const TIMELINE_FILTERS = [
  { value: "all", label: "All matches" },
  { value: "previous", label: "Previous matches" },
  { value: "upcoming", label: "Upcoming matches" },
] as const;

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "finalized", label: "Finalized" },
  { value: "draft", label: "Draft" },
] as const;

const RESOLUTION_FILTERS = [
  { value: "all", label: "All resolution states" },
  { value: "resolved", label: "Resolved" },
  { value: "awaiting_resolution", label: "Awaiting resolution" },
] as const;

const OUTCOME_FILTERS = [
  { value: "all", label: "All outcomes" },
  { value: "correct", label: "Correct" },
  { value: "incorrect", label: "Incorrect" },
  { value: "pending", label: "Pending / draft" },
] as const;

function formatDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function formatDateTime(iso: string | null) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatLegacyLabel(answer: HalisahaRecentAnswerRow) {
  return answer.label;
}

function kindLabel(kind: string) {
  const map: Record<string, string> = {
    winner: "WHO WINS",
    mvp_prediction: "MVP",
    score_prediction: "Score",
    standard: "Standard",
  };
  return map[kind] ?? kind;
}

function displaySelection(row: HalisahaAnswerRow): string {
  if (
    row.selectedOption.kind === "custom_score" &&
    row.customScoreHome !== null &&
    row.customScoreAway !== null
  ) {
    return `${row.customScoreHome}–${row.customScoreAway} (${row.selectedOption.label})`;
  }
  return row.selectedOption.label;
}

function buildHalisahaHistoryHref(
  filters: Partial<AdminHalisahaPredictionHistoryFilters>,
): string {
  const params = new URLSearchParams();
  if (filters.tab && filters.tab !== "answers") params.set("tab", filters.tab);
  if (filters.matchFilter) params.set("matchId", filters.matchFilter);
  if (filters.userFilter) params.set("userId", filters.userFilter);
  if (filters.questionFilter) params.set("questionId", filters.questionFilter);
  if (filters.voteTargetFilter) params.set("voteTargetId", filters.voteTargetFilter);
  if (filters.kindFilter) params.set("kind", filters.kindFilter);
  if (filters.statusFilter && filters.statusFilter !== "all") {
    params.set("status", filters.statusFilter);
  }
  if (filters.timelineFilter && filters.timelineFilter !== "all") {
    params.set("timeline", filters.timelineFilter);
  }
  if (filters.resolutionFilter && filters.resolutionFilter !== "all") {
    params.set("resolution", filters.resolutionFilter);
  }
  if (filters.outcomeFilter && filters.outcomeFilter !== "all") {
    params.set("outcome", filters.outcomeFilter);
  }

  const query = params.toString();
  return query
    ? `/admin/halisaha/predictions?${query}`
    : "/admin/halisaha/predictions";
}

function getAnswerOutcomeLabel(row: HalisahaAnswerRow) {
  const outcome = getAdminHalisahaAnswerOutcome(row);
  if (outcome === "correct") return "Correct";
  if (outcome === "incorrect") return "Incorrect";
  return row.isFinal ? "Awaiting resolution" : "Draft";
}

function getAnswerOutcomeBadgeClass(row: HalisahaAnswerRow) {
  const outcome = getAdminHalisahaAnswerOutcome(row);
  if (outcome === "correct") return "bg-emerald-100 text-emerald-800";
  if (outcome === "incorrect") return "bg-rose-100 text-rose-800";
  if (row.isFinal) return "bg-sky-100 text-sky-800";
  return "bg-amber-100 text-amber-800";
}

function getResolutionBadgeClass(resolved: boolean) {
  return resolved ? "bg-slate-100 text-slate-700" : "bg-sky-50 text-sky-700";
}

function getLegacyStatusClass(status: HalisahaRecentAnswerRow["status"]) {
  if (status === "correct") return "bg-emerald-100 text-emerald-800";
  if (status === "incorrect") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

export function HalisahaPredictionManagementClient({
  historyContext,
  answers,
  matchOptions,
  questions,
  userOptions,
  mvpVotes,
  legacyRoundSnapshots,
  initialFilters = DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS,
}: {
  historyContext: HalisahaHistoryPageContext;
  answers: HalisahaAnswerRow[];
  matchOptions: HalisahaHistoryMatchOption[];
  questions: QuestionForAdminSelect[];
  userOptions: UserOption[];
  mvpVotes: HalisahaMvpVoteRow[];
  legacyRoundSnapshots: HalisahaLegacyRoundSnapshot[];
  initialFilters?: AdminHalisahaPredictionHistoryFilters;
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const archivedMatches = useMemo(
    () => matchOptions.filter((match) => match.archivedAt !== null),
    [matchOptions],
  );
  const [tab, setTab] = useState<AdminHalisahaPredictionHistoryFilters["tab"]>(
    initialFilters.tab,
  );
  const [matchFilter, setMatchFilter] = useState(initialFilters.matchFilter);
  const [userFilter, setUserFilter] = useState(initialFilters.userFilter);
  const [questionFilter, setQuestionFilter] = useState(initialFilters.questionFilter);
  const [voteTargetFilter, setVoteTargetFilter] = useState(
    initialFilters.voteTargetFilter,
  );
  const [kindFilter, setKindFilter] = useState(initialFilters.kindFilter);
  const [statusFilter, setStatusFilter] = useState(initialFilters.statusFilter);
  const [timelineFilter, setTimelineFilter] = useState(initialFilters.timelineFilter);
  const [resolutionFilter, setResolutionFilter] = useState(
    initialFilters.resolutionFilter,
  );
  const [outcomeFilter, setOutcomeFilter] = useState(initialFilters.outcomeFilter);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resetAlsoMvp, setResetAlsoMvp] = useState(false);
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeCutoffDate, setPurgeCutoffDate] = useState(() => {
    if (archivedMatches.length === 0) return "";
    const oldestArchived = [...archivedMatches]
      .map((match) => match.archivedAt)
      .filter((value): value is string => Boolean(value))
      .sort()[0];
    return oldestArchived
      ? formatDateInputValue(new Date(oldestArchived))
      : formatDateInputValue(new Date());
  });

  const [impUserId, setImpUserId] = useState("");
  const [impMatchId, setImpMatchId] = useState(
    initialFilters.matchFilter || historyContext.activeMatchId,
  );
  const [impQuestionId, setImpQuestionId] = useState("");
  const [impOptionId, setImpOptionId] = useState("");
  const [impCustomHome, setImpCustomHome] = useState("");
  const [impCustomAway, setImpCustomAway] = useState("");
  const [impFinalize, setImpFinalize] = useState(true);
  const [impEnteredAtLocal, setImpEnteredAtLocal] = useState(() =>
    formatDatetimeLocalValue(new Date()),
  );
  const [impBusy, setImpBusy] = useState(false);

  const filters = useMemo<AdminHalisahaPredictionHistoryFilters>(
    () => ({
      tab,
      matchFilter,
      userFilter,
      questionFilter,
      voteTargetFilter,
      kindFilter,
      statusFilter,
      timelineFilter,
      resolutionFilter,
      outcomeFilter,
    }),
    [
      kindFilter,
      matchFilter,
      outcomeFilter,
      questionFilter,
      resolutionFilter,
      statusFilter,
      tab,
      timelineFilter,
      userFilter,
      voteTargetFilter,
    ],
  );

  const questionOptionsForFilters = useMemo(() => {
    if (!matchFilter) return questions;
    return questions.filter((question) => question.matchId === matchFilter);
  }, [matchFilter, questions]);

  const mvpTargetOptions = useMemo<MvpTargetOption[]>(() => {
    const seen = new Set<string>();
    const rows = matchFilter
      ? mvpVotes.filter((vote) => vote.matchId === matchFilter)
      : mvpVotes;

    return rows
      .filter((vote) => {
        if (seen.has(vote.participantId)) return false;
        seen.add(vote.participantId);
        return true;
      })
      .map((vote) => ({
        id: vote.participantId,
        label: `${vote.votedForLabel} · R${vote.match.roundNumber}`,
        matchId: vote.matchId,
      }));
  }, [matchFilter, mvpVotes]);

  const impersonationQuestionOptions = useMemo(() => {
    if (!impMatchId) return [];
    return questions.filter((question) => question.matchId === impMatchId);
  }, [impMatchId, questions]);

  useEffect(() => {
    if (questionFilter && !questionOptionsForFilters.some((q) => q.id === questionFilter)) {
      setQuestionFilter("");
    }
  }, [questionFilter, questionOptionsForFilters]);

  useEffect(() => {
    if (voteTargetFilter && !mvpTargetOptions.some((option) => option.id === voteTargetFilter)) {
      setVoteTargetFilter("");
    }
  }, [mvpTargetOptions, voteTargetFilter]);

  useEffect(() => {
    if (!impMatchId && historyContext.activeMatchId) {
      setImpMatchId(historyContext.activeMatchId);
    }
  }, [historyContext.activeMatchId, impMatchId]);

  useEffect(() => {
    if (
      impersonationQuestionOptions.length > 0 &&
      !impersonationQuestionOptions.some((question) => question.id === impQuestionId)
    ) {
      setImpQuestionId(impersonationQuestionOptions[0]!.id);
      return;
    }

    if (impersonationQuestionOptions.length === 0) {
      setImpQuestionId("");
      setImpOptionId("");
    }
  }, [impQuestionId, impersonationQuestionOptions]);

  const impQuestion = useMemo(
    () => questions.find((question) => question.id === impQuestionId) ?? null,
    [impQuestionId, questions],
  );

  useEffect(() => {
    if (!impQuestion?.options.length) {
      setImpOptionId("");
      return;
    }

    if (!impQuestion.options.some((option) => option.id === impOptionId)) {
      setImpOptionId(impQuestion.options[0]!.id);
    }
  }, [impOptionId, impQuestion]);

  const impSelectedOption = impQuestion?.options.find((option) => option.id === impOptionId);

  const filteredAnswers = useMemo(
    () => applyAdminHalisahaAnswerHistoryFilters(answers, filters, now),
    [answers, filters, now],
  );
  const filteredMvpVotes = useMemo(
    () => applyAdminHalisahaMvpHistoryFilters(mvpVotes, filters, now),
    [filters, mvpVotes, now],
  );
  const answerSummary = useMemo(
    () => buildAdminHalisahaAnswerHistorySummary(filteredAnswers, now),
    [filteredAnswers, now],
  );
  const mvpSummary = useMemo(
    () => buildAdminHalisahaMvpHistorySummary(filteredMvpVotes, now),
    [filteredMvpVotes, now],
  );

  const filteredLegacyRounds = useMemo(() => {
    return legacyRoundSnapshots
      .map((snapshot) => ({
        ...snapshot,
        rows: userFilter
          ? snapshot.rows.filter((row) => row.userId === userFilter)
          : snapshot.rows,
      }))
      .filter((snapshot) => snapshot.rows.length > 0);
  }, [legacyRoundSnapshots, userFilter]);

  const hasActiveFilters = useMemo(
    () =>
      tab !== DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.tab ||
      matchFilter !== DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.matchFilter ||
      userFilter !== DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.userFilter ||
      questionFilter !==
        DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.questionFilter ||
      voteTargetFilter !==
        DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.voteTargetFilter ||
      kindFilter !== DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.kindFilter ||
      statusFilter !== DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.statusFilter ||
      timelineFilter !==
        DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.timelineFilter ||
      resolutionFilter !==
        DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.resolutionFilter ||
      outcomeFilter !== DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.outcomeFilter,
    [
      kindFilter,
      matchFilter,
      outcomeFilter,
      questionFilter,
      resolutionFilter,
      statusFilter,
      tab,
      timelineFilter,
      userFilter,
      voteTargetFilter,
    ],
  );

  const activeMatchOption = useMemo(
    () => matchOptions.find((match) => match.id === historyContext.activeMatchId) ?? null,
    [historyContext.activeMatchId, matchOptions],
  );

  const purgePreview = useMemo(() => {
    if (!purgeCutoffDate) {
      return { count: 0, roundNumbers: [] as number[] };
    }

    const cutoff = new Date(`${purgeCutoffDate}T00:00:00`);
    if (Number.isNaN(cutoff.getTime())) {
      return { count: 0, roundNumbers: [] as number[] };
    }

    const candidates = archivedMatches.filter((match) => {
      if (!match.archivedAt) return false;
      return new Date(match.archivedAt).getTime() < cutoff.getTime();
    });

    return {
      count: candidates.length,
      roundNumbers: candidates.map((match) => match.roundNumber).sort((a, b) => b - a),
    };
  }, [archivedMatches, purgeCutoffDate]);

  useEffect(() => {
    window.history.replaceState(null, "", buildHalisahaHistoryHref(filters));
  }, [filters]);

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const clearFilters = () => {
    setTab(DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.tab);
    setMatchFilter(DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.matchFilter);
    setUserFilter(DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.userFilter);
    setQuestionFilter(DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.questionFilter);
    setVoteTargetFilter(
      DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.voteTargetFilter,
    );
    setKindFilter(DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.kindFilter);
    setStatusFilter(DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.statusFilter);
    setTimelineFilter(DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.timelineFilter);
    setResolutionFilter(
      DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.resolutionFilter,
    );
    setOutcomeFilter(DEFAULT_ADMIN_HALISAHA_PREDICTION_HISTORY_FILTERS.outcomeFilter);
  };

  const runSetPoints = async (answerId: string, mode: "zero" | "full") => {
    setBusyId(answerId);
    clearFeedback();
    const result = await setHalisahaAnswerPointsAction(answerId, mode);
    setBusyId(null);
    if (result.ok) {
      setSuccess(result.message ?? "Done.");
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const runDeleteAnswer = async (answerId: string) => {
    if (!window.confirm("Remove this answer row?")) return;
    setBusyId(answerId);
    clearFeedback();
    const result = await deleteHalisahaAnswerAction(answerId);
    setBusyId(null);
    if (result.ok) {
      setSuccess(result.message ?? "Removed.");
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const runResetUser = async () => {
    if (!userFilter || !matchFilter) return;
    const message = resetAlsoMvp
      ? "Remove all answers and MVP votes for this user on the selected match?"
      : "Remove all answers for this user on the selected match?";
    if (!window.confirm(message)) return;
    setResettingUserId(userFilter);
    clearFeedback();
    const result = await adminResetUserHalisahaMatchAnswersAction(userFilter, matchFilter, {
      deleteMvpVotes: resetAlsoMvp,
    });
    setResettingUserId(null);
    if (result.ok) {
      setSuccess(result.message ?? "Reset.");
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const runImpersonate = async () => {
    if (!impUserId || !impQuestionId || !impOptionId) {
      setError("Select user, match question, and option.");
      return;
    }

    const parsedEntered = new Date(impEnteredAtLocal);
    if (Number.isNaN(parsedEntered.getTime())) {
      setError("Invalid date/time.");
      return;
    }

    let custom: { home: number | null; away: number | null } | undefined;
    if (impSelectedOption?.kind === "custom_score") {
      const home = impCustomHome.trim() === "" ? null : Number(impCustomHome);
      const away = impCustomAway.trim() === "" ? null : Number(impCustomAway);
      if (
        home === null ||
        away === null ||
        !Number.isInteger(home) ||
        !Number.isInteger(away) ||
        home < 0 ||
        away < 0
      ) {
        setError("Enter valid non-negative integer home and away scores.");
        return;
      }
      custom = { home, away };
    }

    setImpBusy(true);
    clearFeedback();
    const result = await adminSetHalisahaAnswerAction(
      impUserId,
      impQuestionId,
      impOptionId,
      impFinalize,
      parsedEntered.toISOString(),
      custom,
    );
    setImpBusy(false);
    if (result.ok) {
      setSuccess(result.message ?? "Saved.");
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const runDeleteMvp = async (voteId: string) => {
    if (!window.confirm("Delete this MVP vote?")) return;
    setBusyId(voteId);
    clearFeedback();
    const result = await deleteHalisahaMvpVoteAction(voteId);
    setBusyId(null);
    if (result.ok) {
      setSuccess(result.message ?? "Removed.");
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const runPurgeArchivedHistory = async () => {
    if (!purgeCutoffDate) {
      setError("Select a cutoff date first.");
      return;
    }

    const cutoff = new Date(`${purgeCutoffDate}T00:00:00`);
    if (Number.isNaN(cutoff.getTime())) {
      setError("Invalid cutoff date.");
      return;
    }

    setPurgeLoading(true);
    clearFeedback();
    const result = await purgeArchivedHalisahaMatchesAction(cutoff.toISOString());
    setPurgeLoading(false);
    if (result.ok) {
      setSuccess(result.message ?? "Archive history purged.");
      setPurgeModalOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <button type="button" onClick={clearFeedback} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
          <button type="button" onClick={clearFeedback} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      ) : null}

      <section className="rounded-2xl border border-nord-frostDark/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(241,245,252,0.94))] px-4 py-4 shadow-[0_16px_40px_rgba(46,52,64,0.06)] sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-nord-frostDark">
              Active match
            </p>
            <p className="mt-1 text-base font-semibold text-nord-polar">
              {historyContext.activeHomeTeamName}{" "}
              <span className="font-normal text-nord-polarLight">vs</span>{" "}
              {historyContext.activeAwayTeamName}
            </p>
            <p className="mt-1 text-xs text-nord-polarLight">
              Round {historyContext.activeRoundNumber} · Kickoff{" "}
              {formatDateTime(historyContext.activeKickoffAt)}
            </p>
            {activeMatchOption ? (
              <p className="mt-1 text-xs text-nord-polarLight">
                Venue: {activeMatchOption.venueName}
              </p>
            ) : null}
          </div>
          <div className="space-y-2 text-left lg:text-right">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                historyContext.activeAnswersResolvedAt
                  ? "bg-nord-frost/25 text-nord-polar"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {historyContext.activeAnswersResolvedAt
                ? "Answers scored / resolved"
                : "Pre-resolution"}
            </span>
            <p className="text-[11px] text-nord-polarLight">
              Archived rounds retained: {historyContext.archivedMatchCount}
            </p>
            <Link
              href="/admin/halisaha"
              className="inline-flex text-sm font-medium text-nord-frostDark hover:underline"
            >
              Halisaha Management →
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-nord-frostDark/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(241,245,252,0.92))] p-4 shadow-[0_16px_40px_rgba(46,52,64,0.06)] sm:p-5">
        <h2 className="text-sm font-semibold text-nord-polar">
          Set answer (any user, any Halisaha round)
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-nord-polarLight">
          Choose a user, archived or active match, then a question and option. This bypasses
          public locks and lets you correct history safely.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(13rem,0.9fr)_minmax(16rem,1.2fr)_minmax(18rem,1.3fr)_auto_auto]">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">User</label>
            <select
              value={impUserId}
              onChange={(event) => setImpUserId(event.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              <option value="">Select user…</option>
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label} (@{user.username})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Match</label>
            <select
              value={impMatchId}
              onChange={(event) => setImpMatchId(event.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              <option value="">Select match…</option>
              {matchOptions.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Question</label>
            <select
              value={impQuestionId}
              onChange={(event) => setImpQuestionId(event.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
              disabled={impersonationQuestionOptions.length === 0}
            >
              {impersonationQuestionOptions.length === 0 ? (
                <option value="">No questions on this match</option>
              ) : null}
              {impersonationQuestionOptions.map((question) => (
                <option key={question.id} value={question.id}>
                  {kindLabel(question.kind)} · {question.prompt}
                </option>
              ))}
            </select>
            {impQuestion ? (
              <p className="text-[11px] text-nord-polarLight">{impQuestion.matchLabel}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Option</label>
            <select
              value={impOptionId}
              onChange={(event) => setImpOptionId(event.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
              disabled={!impQuestion?.options.length}
            >
              {(impQuestion?.options ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar" htmlFor="halisaha-history-entered-at">
              Entered at
            </label>
            <input
              id="halisaha-history-entered-at"
              type="datetime-local"
              value={impEnteredAtLocal}
              onChange={(event) => setImpEnteredAtLocal(event.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            />
          </div>
        </div>

        {impSelectedOption?.kind === "custom_score" ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-nord-polar">Home</label>
              <input
                type="number"
                min={0}
                value={impCustomHome}
                onChange={(event) => setImpCustomHome(event.target.value)}
                className="w-24 rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-nord-polar">Away</label>
              <input
                type="number"
                min={0}
                value={impCustomAway}
                onChange={(event) => setImpCustomAway(event.target.value)}
                className="w-24 rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-nord-polar">
            <input
              type="checkbox"
              checked={impFinalize}
              onChange={(event) => setImpFinalize(event.target.checked)}
              className="h-4 w-4 rounded border-nord-polarLighter accent-nord-frostDark"
            />
            Finalize (lock all answers for user on that match)
          </label>
          <Button
            type="button"
            variant="primary"
            disabled={impBusy || !impQuestion}
            onClick={() => void runImpersonate()}
          >
            {impBusy ? "Saving…" : "Apply answer"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-nord-polarLighter/40 bg-white/85 p-4 shadow-[0_12px_28px_rgba(46,52,64,0.035)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-nord-polar">History filters</h2>
            <p className="mt-1 text-xs leading-relaxed text-nord-polarLight">
              Jump between answers and MVP votes, isolate one Halisaha round or one user,
              and focus on previous / unresolved / incorrect history instantly.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {userFilter && matchFilter ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-nord-polar">
                  <input
                    type="checkbox"
                    checked={resetAlsoMvp}
                    onChange={(event) => setResetAlsoMvp(event.target.checked)}
                    className="h-4 w-4 rounded border-nord-polarLighter accent-nord-frostDark"
                  />
                  Also remove MVP votes
                </label>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={resettingUserId === userFilter}
                  onClick={() => void runResetUser()}
                >
                  {resettingUserId === userFilter
                    ? "Resetting…"
                    : "Reset this user on selected match"}
                </Button>
              </div>
            ) : null}
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex gap-1 rounded-xl border border-[var(--border)] bg-nord-snow/50 p-1">
          <button
            type="button"
            onClick={() => setTab("answers")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === "answers"
                ? "bg-white text-nord-polar shadow-sm ring-1 ring-black/[0.04]"
                : "text-nord-polarLight hover:text-nord-polar"
            }`}
          >
            Answers ({answers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("mvp")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === "mvp"
                ? "bg-white text-nord-polar shadow-sm ring-1 ring-black/[0.04]"
                : "text-nord-polarLight hover:text-nord-polar"
            }`}
          >
            MVP votes ({mvpVotes.length})
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Match</label>
            <select
              value={matchFilter}
              onChange={(event) => setMatchFilter(event.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              <option value="">All Halisaha rounds</option>
              {matchOptions.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">User</label>
            <select
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              <option value="">All users</option>
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.label} (@{user.username})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Timeline</label>
            <select
              value={timelineFilter}
              onChange={(event) =>
                setTimelineFilter(
                  event.target.value as AdminHalisahaPredictionHistoryFilters["timelineFilter"],
                )
              }
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              {TIMELINE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Resolution</label>
            <select
              value={resolutionFilter}
              onChange={(event) =>
                setResolutionFilter(
                  event.target.value as AdminHalisahaPredictionHistoryFilters["resolutionFilter"],
                )
              }
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              {RESOLUTION_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {tab === "answers" ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-nord-polar">Question</label>
                <select
                  value={questionFilter}
                  onChange={(event) => setQuestionFilter(event.target.value)}
                  className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
                >
                  <option value="">All questions</option>
                  {questionOptionsForFilters.map((question) => (
                    <option key={question.id} value={question.id}>
                      {kindLabel(question.kind)} · {question.prompt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-nord-polar">Kind</label>
                <select
                  value={kindFilter}
                  onChange={(event) =>
                    setKindFilter(
                      event.target.value as AdminHalisahaPredictionHistoryFilters["kindFilter"],
                    )
                  }
                  className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
                >
                  {QUESTION_KINDS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-nord-polar">Status</label>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as AdminHalisahaPredictionHistoryFilters["statusFilter"],
                    )
                  }
                  className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
                >
                  {STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-nord-polar">Outcome</label>
                <select
                  value={outcomeFilter}
                  onChange={(event) =>
                    setOutcomeFilter(
                      event.target.value as AdminHalisahaPredictionHistoryFilters["outcomeFilter"],
                    )
                  }
                  className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
                >
                  {OUTCOME_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-nord-polar">Voted for</label>
              <select
                value={voteTargetFilter}
                onChange={(event) => setVoteTargetFilter(event.target.value)}
                className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
              >
                <option value="">All MVP targets</option>
                {mvpTargetOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tab === "answers" ? (
          <>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
                  Rows in view
                </p>
                <p className="mt-2 text-2xl font-semibold text-nord-polar">
                  {answerSummary.total}
                </p>
                <p className="mt-1 text-xs text-nord-polarLight">
                  {answerSummary.uniqueUsers} users · {answerSummary.uniqueMatches} matches
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
                  Answer state
                </p>
                <p className="mt-2 text-2xl font-semibold text-nord-polar">
                  {answerSummary.finalized}
                </p>
                <p className="mt-1 text-xs text-nord-polarLight">
                  finalized · {answerSummary.drafts} drafts
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
                  Match timeline
                </p>
                <p className="mt-2 text-2xl font-semibold text-nord-polar">
                  {answerSummary.previousMatches}
                </p>
                <p className="mt-1 text-xs text-nord-polarLight">
                  previous rows · {answerSummary.total - answerSummary.previousMatches} upcoming
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
                  Result insight
                </p>
                <p className="mt-2 text-2xl font-semibold text-nord-polar">
                  {answerSummary.correctFinalized}
                </p>
                <p className="mt-1 text-xs text-nord-polarLight">
                  correct finalized · {answerSummary.resolvedMatches} resolved rows
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
                  Votes in view
                </p>
                <p className="mt-2 text-2xl font-semibold text-nord-polar">
                  {mvpSummary.total}
                </p>
                <p className="mt-1 text-xs text-nord-polarLight">
                  {mvpSummary.uniqueVoters} voters · {mvpSummary.uniqueMatches} matches
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
                  Previous matches
                </p>
                <p className="mt-2 text-2xl font-semibold text-nord-polar">
                  {mvpSummary.previousMatches}
                </p>
                <p className="mt-1 text-xs text-nord-polarLight">
                  historic vote rows
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
                  Resolved MVP windows
                </p>
                <p className="mt-2 text-2xl font-semibold text-nord-polar">
                  {mvpSummary.resolvedMatches}
                </p>
                <p className="mt-1 text-xs text-nord-polarLight">
                  resolved rows in current view
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
                  Archive state
                </p>
                <p className="mt-2 text-2xl font-semibold text-nord-polar">
                  {historyContext.archivedMatchCount}
                </p>
                <p className="mt-1 text-xs text-nord-polarLight">
                  archived rounds currently retained
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {tab === "answers" ? (
        <div className="overflow-x-auto rounded-xl border border-nord-polarLighter/50 bg-white/90">
          {filteredAnswers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-nord-polarLight">
              No answers match the selected filters.
            </div>
          ) : (
            <table className="w-full min-w-[1220px] text-sm">
              <thead>
                <tr className="border-b border-nord-polarLighter bg-nord-snow/80 text-left text-nord-polarLight">
                  <th className="px-4 py-3 font-semibold">Match</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Question & selection</th>
                  <th className="px-4 py-3 font-semibold">Timeline</th>
                  <th className="px-4 py-3 font-semibold">Resolution</th>
                  <th className="px-4 py-3 font-semibold">Points</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnswers.map((row) => {
                  const isBusy = busyId === row.id;
                  const resolved = isResolvedHalisahaAnswerRow(row);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-nord-polarLighter/30 align-top hover:bg-nord-snow/50"
                    >
                      <td className="px-4 py-3">
                        <div className="text-xs text-nord-polarLight">
                          Round {row.match.roundNumber} · Kickoff {formatDateTime(row.match.kickoffAt)}
                        </div>
                        <div className="mt-1 font-medium text-nord-polar">
                          {row.match.homeTeamName} vs {row.match.awayTeamName}
                        </div>
                        <div className="mt-1 text-xs text-nord-polarLight">
                          {row.match.venueName} · {row.match.archivedAt ? "Archived" : "Active"}
                        </div>
                        <Link
                          href={buildHalisahaHistoryHref({
                            tab: "answers",
                            matchFilter: row.matchId,
                            timelineFilter: "previous",
                          })}
                          className="mt-2 inline-flex text-xs font-medium text-nord-frostDark hover:underline"
                        >
                          Open round history →
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-nord-polar">
                          {row.user.name} {row.user.surname}
                        </div>
                        <div className="mt-1 text-xs text-nord-polarLight">
                          @{row.user.username}
                        </div>
                        <Link
                          href={buildHalisahaHistoryHref({
                            tab: "answers",
                            userFilter: row.userId,
                            timelineFilter: "previous",
                          })}
                          className="mt-2 inline-flex text-xs font-medium text-nord-frostDark hover:underline"
                        >
                          View user history →
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="mb-1 inline-flex rounded-full bg-nord-frostDark/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-nord-frostDark">
                          {kindLabel(row.question.kind)}
                        </div>
                        <div className="font-medium text-nord-polar">{row.question.prompt}</div>
                        <div className="mt-2 text-sm text-nord-polar">
                          {displaySelection(row)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-nord-snow text-nord-polar">
                          {row.isFinal ? "Finalized" : "Draft"}
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-nord-polarLight">
                          <div>
                            Saved:{" "}
                            <span className="text-nord-polar">
                              {formatDateTime(row.createdAt)}
                            </span>
                          </div>
                          <div>
                            Finalized:{" "}
                            <span className="text-nord-polar">
                              {formatDateTime(row.finalizedAt)}
                            </span>
                          </div>
                          <div>
                            Updated:{" "}
                            <span className="text-nord-polar">
                              {formatDateTime(row.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getAnswerOutcomeBadgeClass(
                              row,
                            )}`}
                          >
                            {getAnswerOutcomeLabel(row)}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getResolutionBadgeClass(
                              resolved,
                            )}`}
                          >
                            {resolved ? "Resolved" : "Awaiting resolution"}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-nord-polarLight">
                          <div>
                            Answers scored:{" "}
                            <span className="text-nord-polar">
                              {formatDateTime(row.match.answersResolvedAt)}
                            </span>
                          </div>
                          <div>
                            MVP resolved:{" "}
                            <span className="text-nord-polar">
                              {formatDateTime(row.match.mvpResolvedAt)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-nord-polar">
                        {row.isFinal ? row.awardedPoints : "–"} / {row.question.points}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {row.isFinal ? (
                            <>
                              <Button
                                size="sm"
                                variant={row.awardedPoints === 0 ? "primary" : "secondary"}
                                disabled={isBusy}
                                onClick={() => void runSetPoints(row.id, "zero")}
                              >
                                Set 0
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  row.awardedPoints === row.question.points
                                    ? "primary"
                                    : "secondary"
                                }
                                disabled={isBusy}
                                onClick={() => void runSetPoints(row.id, "full")}
                              >
                                Set {row.question.points}
                              </Button>
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => void runDeleteAnswer(row.id)}
                          >
                            {isBusy ? "…" : "Remove"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-nord-polarLighter/50 bg-white/90">
          {filteredMvpVotes.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-nord-polarLight">
              No MVP votes match the selected filters.
            </div>
          ) : (
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-nord-polarLighter bg-nord-snow/80 text-left text-nord-polarLight">
                  <th className="px-4 py-3 font-semibold">Match</th>
                  <th className="px-4 py-3 font-semibold">Voter</th>
                  <th className="px-4 py-3 font-semibold">Voted for</th>
                  <th className="px-4 py-3 font-semibold">Vote timeline</th>
                  <th className="px-4 py-3 font-semibold">Resolution</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMvpVotes.map((vote) => {
                  const isBusy = busyId === vote.id;
                  const resolved = isResolvedHalisahaMvpVoteRow(vote);
                  return (
                    <tr
                      key={vote.id}
                      className="border-b border-nord-polarLighter/30 align-top hover:bg-nord-snow/50"
                    >
                      <td className="px-4 py-3">
                        <div className="text-xs text-nord-polarLight">
                          Round {vote.match.roundNumber} · Kickoff {formatDateTime(vote.match.kickoffAt)}
                        </div>
                        <div className="mt-1 font-medium text-nord-polar">
                          {vote.match.homeTeamName} vs {vote.match.awayTeamName}
                        </div>
                        <div className="mt-1 text-xs text-nord-polarLight">
                          {vote.match.venueName} · {vote.match.archivedAt ? "Archived" : "Active"}
                        </div>
                        <Link
                          href={buildHalisahaHistoryHref({
                            tab: "mvp",
                            matchFilter: vote.matchId,
                            timelineFilter: "previous",
                          })}
                          className="mt-2 inline-flex text-xs font-medium text-nord-frostDark hover:underline"
                        >
                          Open vote history →
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-nord-polar">{vote.voterLabel}</div>
                        <Link
                          href={buildHalisahaHistoryHref({
                            tab: "mvp",
                            userFilter: vote.userId,
                            timelineFilter: "previous",
                          })}
                          className="mt-2 inline-flex text-xs font-medium text-nord-frostDark hover:underline"
                        >
                          View voter history →
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-nord-polar">{vote.votedForLabel}</div>
                        <div className="mt-1 text-xs text-nord-polarLight">
                          Participant ref: {vote.participantId}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 text-xs text-nord-polarLight">
                          <div>
                            Submitted:{" "}
                            <span className="text-nord-polar">
                              {formatDateTime(vote.createdAt)}
                            </span>
                          </div>
                          <div>
                            Updated:{" "}
                            <span className="text-nord-polar">
                              {formatDateTime(vote.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getResolutionBadgeClass(
                            resolved,
                          )}`}
                        >
                          {resolved ? "Resolved" : "Awaiting resolution"}
                        </span>
                        <div className="mt-2 text-xs text-nord-polarLight">
                          MVP resolved:{" "}
                          <span className="text-nord-polar">
                            {formatDateTime(vote.match.mvpResolvedAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => void runDeleteMvp(vote.id)}
                        >
                          {isBusy ? "…" : "Delete"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {legacyRoundSnapshots.length > 0 ? (
        <section className="rounded-2xl border border-nord-polarLighter/40 bg-white/85 p-4 shadow-[0_12px_28px_rgba(46,52,64,0.035)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-nord-polar">Legacy snapshots</h2>
              <p className="mt-1 text-xs leading-relaxed text-nord-polarLight">
                These rounds existed before full HALISAHA archival history was enabled. Full raw
                answer rows are unavailable, but leaderboard and recent-answer snapshots were
                preserved.
              </p>
            </div>
            <span className="text-xs font-medium text-nord-polarLight">
              {filteredLegacyRounds.length} round snapshot(s) in current user focus
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {filteredLegacyRounds.length === 0 ? (
              <div className="rounded-xl border border-dashed border-nord-polarLighter px-4 py-6 text-sm text-nord-polarLight">
                No legacy snapshot rows match the current user filter.
              </div>
            ) : (
              filteredLegacyRounds.map((snapshot) => (
                <Card key={snapshot.roundNumber}>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
                          Legacy round
                        </p>
                        <p className="mt-1 text-base font-semibold text-nord-polar">
                          Round {snapshot.roundNumber}
                        </p>
                      </div>
                      {snapshot.mvpWinnerLabels.length > 0 ? (
                        <div className="text-right text-xs text-nord-polarLight">
                          MVP winner{snapshot.mvpWinnerLabels.length > 1 ? "s" : ""}:{" "}
                          <span className="font-medium text-nord-polar">
                            {snapshot.mvpWinnerLabels.join(", ")}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      {snapshot.rows
                        .slice(0, userFilter ? snapshot.rows.length : 5)
                        .map((row) => (
                          <div
                            key={`${snapshot.roundNumber}-${row.userId}`}
                            className="rounded-xl border border-nord-polarLighter/30 bg-nord-snow/45 px-3 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="font-medium text-nord-polar">
                                  {row.name} {row.surname}
                                </div>
                                <div className="text-xs text-nord-polarLight">
                                  @{row.username}
                                </div>
                              </div>
                              <div className="text-right text-xs text-nord-polarLight">
                                <div>
                                  Points:{" "}
                                  <span className="font-medium text-nord-polar">
                                    {row.totalPoints}
                                  </span>
                                </div>
                                <div>
                                  Correct:{" "}
                                  <span className="font-medium text-nord-polar">
                                    {row.correctAnswers}
                                  </span>{" "}
                                  / {row.answeredQuestions}
                                </div>
                              </div>
                            </div>
                            {row.recentAnswers.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {row.recentAnswers.map((answer) => (
                                  <span
                                    key={answer.id}
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${getLegacyStatusClass(
                                      answer.status,
                                    )}`}
                                    title={formatLegacyLabel(answer)}
                                  >
                                    {formatLegacyLabel(answer)}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-red-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(254,242,242,0.92))] p-4 shadow-[0_12px_28px_rgba(46,52,64,0.035)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-nord-polar">
              Archive retention
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-nord-polarLight">
              Permanently delete archived HALISAHA rounds older than a cutoff date. Active
              match data is never touched. Related answer rows, MVP votes, and stored round
              snapshots for those archived rounds are also removed.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-nord-polar" htmlFor="archive-cutoff-date">
                Delete archived rounds before
              </label>
              <input
                id="archive-cutoff-date"
                type="date"
                value={purgeCutoffDate}
                onChange={(event) => setPurgeCutoffDate(event.target.value)}
                className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
                disabled={archivedMatches.length === 0}
              />
            </div>
            <Button
              variant="danger"
              size="sm"
              disabled={archivedMatches.length === 0 || purgePreview.count === 0}
              onClick={() => setPurgeModalOpen(true)}
            >
              Purge archived history
            </Button>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-red-100 bg-white/80 px-3 py-3 text-sm text-nord-polar">
          {archivedMatches.length === 0 ? (
            <p>No archived HALISAHA rounds exist yet.</p>
          ) : purgePreview.count > 0 ? (
            <p>
              {purgePreview.count} archived match(es) would be removed. Rounds:{" "}
              <span className="font-medium">{purgePreview.roundNumbers.join(", ")}</span>
            </p>
          ) : (
            <p>No archived matches are older than that cutoff.</p>
          )}
        </div>
      </section>

      <Modal
        open={purgeModalOpen}
        onClose={() => !purgeLoading && setPurgeModalOpen(false)}
        title="Purge archived Halisaha history?"
        confirmLabel="Yes, purge archive"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={runPurgeArchivedHistory}
        loading={purgeLoading}
      >
        <p>
          This will permanently delete <strong>{purgePreview.count}</strong> archived Halisaha
          match(es) and their stored round snapshots. Active match data will stay intact.
        </p>
        {purgePreview.roundNumbers.length > 0 ? (
          <p className="mt-3">
            Affected rounds: <strong>{purgePreview.roundNumbers.join(", ")}</strong>
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
