"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PredictionPickDisplay } from "@/components/prediction-pick-display";
import type { PredictionDisplay } from "@/lib/prediction-values";
import { Button, Card, CardContent } from "@/components/ui";
import { COMPETITIONS, UCL_COMPETITION_ID, POWER_PICK_COMPETITION_ID } from "@/lib/config";
import { formatStageLabel } from "@/lib/stages";
import {
  applyAdminPredictionHistoryFilters,
  buildAdminPredictionHistorySummary,
  DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS,
  getAdminPredictionOutcome,
  isCompletedPredictionMatch,
  isPastPredictionMatch,
  type AdminPredictionHistoryFilters,
  type AdminPredictionHistoryRow,
} from "@/lib/admin-prediction-history";
import {
  setPredictionPointsAction,
  adminResetUserPredictionAction,
  adminResetUserUpcomingPredictionsAction,
  adminResetUpcomingPredictionsBulkAction,
  adminSetPredictionForUserAction,
  adminSetMatchPowerPickAction,
  adminReclaimUnusedPowerPickAction,
} from "./actions";

const POWER_PICK_ADMIN_OPTIONS = [-1, 0, 3, 4, 5, 6, 10] as const;
/** Per-row inline Power Pick selector: 0 = none/remove, then the valid multipliers. */
const POWER_PICK_ROW_OPTIONS = [0, 3, 4, 5, 6, 10] as const;

export type PredictionRow = AdminPredictionHistoryRow;

export type MatchOption = { id: string; competitionId: string | null; label: string };
export type UserOption = { id: string; label: string; username: string };
export type PowerPickSelectionInfo = { multiplier: number; status: string };
export type PowerPickBalanceInfo = {
  totalGranted: number;
  usedLocked: number;
  selectedUnlocked: number;
  remainingAvailable: number;
  multiplier: number;
};

const TIMELINE_FILTERS = [
  { value: "all", label: "All matches" },
  { value: "previous", label: "Previous matches" },
  { value: "upcoming", label: "Upcoming matches" },
] as const;

const RESULT_FILTERS = [
  { value: "all", label: "All result states" },
  { value: "completed", label: "Completed" },
  { value: "awaiting_result", label: "Awaiting result" },
] as const;

const OUTCOME_FILTERS = [
  { value: "all", label: "All outcomes" },
  { value: "correct", label: "Correct" },
  { value: "incorrect", label: "Incorrect" },
  { value: "pending", label: "Pending / draft" },
] as const;

function displayPick(v: string): string {
  const map: Record<string, string> = {
    ONE: "1",
    X: "X",
    TWO: "2",
    BTTS_YES: "BTTS Yes",
    BTTS_NO: "BTTS No",
  };
  return map[v] ?? v;
}

function displayResult(v: string | null): string {
  if (!v) return "–";
  return displayPick(v);
}

const formatStage = formatStageLabel;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatScore(homeScore: number | null, awayScore: number | null): string {
  if (homeScore == null || awayScore == null) return "–";
  return `${homeScore} – ${awayScore}`;
}

function buildPredictionHistoryHref(
  filters: Partial<AdminPredictionHistoryFilters>
): string {
  const params = new URLSearchParams();
  if (filters.leagueFilter) params.set("league", filters.leagueFilter);
  if (filters.matchFilter) params.set("matchId", filters.matchFilter);
  if (filters.userFilter) params.set("userId", filters.userFilter);
  if (filters.statusFilter && filters.statusFilter !== "all") {
    params.set("status", filters.statusFilter);
  }
  if (filters.timelineFilter && filters.timelineFilter !== "all") {
    params.set("timeline", filters.timelineFilter);
  }
  if (filters.resultFilter && filters.resultFilter !== "all") {
    params.set("result", filters.resultFilter);
  }
  if (filters.outcomeFilter && filters.outcomeFilter !== "all") {
    params.set("outcome", filters.outcomeFilter);
  }

  const query = params.toString();
  return query ? `/admin/predictions?${query}` : "/admin/predictions";
}

function getOutcomeLabel(row: PredictionRow): string {
  const outcome = getAdminPredictionOutcome(row);
  if (outcome === "correct") return "Correct";
  if (outcome === "incorrect") return "Incorrect";
  return row.isFinal ? "Awaiting result" : "Draft";
}

function getOutcomeBadgeClass(row: PredictionRow): string {
  const outcome = getAdminPredictionOutcome(row);
  if (outcome === "correct") return "bg-emerald-100 text-emerald-800";
  if (outcome === "incorrect") return "bg-rose-100 text-rose-800";
  if (row.isFinal) return "bg-sky-100 text-sky-800";
  return "bg-amber-100 text-amber-800";
}

/** Value for `<input type="datetime-local" />` in local timezone (minute precision). */
function formatDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PredictionManagementClient({
  predictions,
  matchOptions,
  userOptions,
  powerPickByUserMatch = {},
  powerPickBalances = {},
  initialFilters = DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS,
}: {
  predictions: PredictionRow[];
  matchOptions: MatchOption[];
  userOptions: UserOption[];
  powerPickByUserMatch?: Record<string, PowerPickSelectionInfo>;
  powerPickBalances?: Record<string, PowerPickBalanceInfo>;
  initialFilters?: AdminPredictionHistoryFilters;
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [leagueFilter, setLeagueFilter] = useState<AdminPredictionHistoryFilters["leagueFilter"]>(
    initialFilters.leagueFilter
  );
  const [matchFilter, setMatchFilter] = useState(initialFilters.matchFilter);
  const [userFilter, setUserFilter] = useState(initialFilters.userFilter);
  const [statusFilter, setStatusFilter] = useState<AdminPredictionHistoryFilters["statusFilter"]>(
    initialFilters.statusFilter
  );
  const [timelineFilter, setTimelineFilter] = useState<
    AdminPredictionHistoryFilters["timelineFilter"]
  >(initialFilters.timelineFilter);
  const [resultFilter, setResultFilter] = useState<
    AdminPredictionHistoryFilters["resultFilter"]
  >(initialFilters.resultFilter);
  const [outcomeFilter, setOutcomeFilter] = useState<
    AdminPredictionHistoryFilters["outcomeFilter"]
  >(initialFilters.outcomeFilter);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [ppBusyKey, setPpBusyKey] = useState<string | null>(null);
  const [reclaimBusy, setReclaimBusy] = useState(false);
  const [reclaimAmount, setReclaimAmount] = useState(1);

  const [bulkResetMode, setBulkResetMode] = useState<"all" | "selected">("all");
  const [bulkResetUserIds, setBulkResetUserIds] = useState<string[]>([]);
  const [bulkResetSearch, setBulkResetSearch] = useState("");
  const [bulkResetConfirm, setBulkResetConfirm] = useState(false);
  const [bulkResetBusy, setBulkResetBusy] = useState(false);

  const [impUserId, setImpUserId] = useState("");
  const [impMatchId, setImpMatchId] = useState("");
  const [impPick, setImpPick] = useState<PredictionDisplay>("1");
  const [impPowerPickMultiplier, setImpPowerPickMultiplier] = useState<number>(-1);
  const [impFinalize, setImpFinalize] = useState(true);
  const [impEnteredAtLocal, setImpEnteredAtLocal] = useState(() => formatDatetimeLocalValue(new Date()));
  const [impBusy, setImpBusy] = useState(false);

  const filters = useMemo<AdminPredictionHistoryFilters>(
    () => ({
      leagueFilter,
      matchFilter,
      userFilter,
      statusFilter,
      timelineFilter,
      resultFilter,
      outcomeFilter,
    }),
    [
      leagueFilter,
      matchFilter,
      userFilter,
      statusFilter,
      timelineFilter,
      resultFilter,
      outcomeFilter,
    ]
  );

  const filtered = useMemo(() => {
    return applyAdminPredictionHistoryFilters(predictions, filters, now);
  }, [predictions, filters, now]);

  const summary = useMemo(() => {
    return buildAdminPredictionHistorySummary(filtered, now);
  }, [filtered, now]);

  const matchOptionsFilteredByLeague = useMemo(() => {
    if (!leagueFilter) return matchOptions;
    if (leagueFilter === UCL_COMPETITION_ID) {
      return matchOptions.filter(
        (m) => m.competitionId === UCL_COMPETITION_ID || m.competitionId == null,
      );
    }
    return matchOptions.filter((m) => m.competitionId === leagueFilter);
  }, [matchOptions, leagueFilter]);

  const selectedUser = useMemo(
    () => userOptions.find((user) => user.id === userFilter) ?? null,
    [userFilter, userOptions]
  );
  const selectedMatch = useMemo(
    () => matchOptions.find((match) => match.id === matchFilter) ?? null,
    [matchFilter, matchOptions]
  );

  const hasActiveFilters = useMemo(() => {
    return (
      leagueFilter !== DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.leagueFilter ||
      matchFilter !== DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.matchFilter ||
      userFilter !== DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.userFilter ||
      statusFilter !== DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.statusFilter ||
      timelineFilter !== DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.timelineFilter ||
      resultFilter !== DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.resultFilter ||
      outcomeFilter !== DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.outcomeFilter
    );
  }, [
    leagueFilter,
    matchFilter,
    userFilter,
    statusFilter,
    timelineFilter,
    resultFilter,
    outcomeFilter,
  ]);

  const focusSummary = [
    selectedUser ? `${selectedUser.label} (@${selectedUser.username})` : null,
    selectedMatch ? selectedMatch.label : null,
    timelineFilter === "previous"
      ? "Previous matches"
      : timelineFilter === "upcoming"
        ? "Upcoming matches"
        : null,
    resultFilter === "completed"
      ? "Completed only"
      : resultFilter === "awaiting_result"
        ? "Awaiting result only"
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    window.history.replaceState(null, "", buildPredictionHistoryHref(filters));
  }, [filters]);

  const runSetPoints = async (predictionId: string, points: 0 | 1) => {
    setBusyId(predictionId);
    setError(null);
    setSuccess(null);
    const result = await setPredictionPointsAction(predictionId, points);
    setBusyId(null);
    if (result.ok) {
      setSuccess(result.message ?? "Done.");
      router.refresh();
    } else setError(result.error);
  };

  const runResetOne = async (userId: string, matchId: string) => {
    const id = `${userId}-${matchId}`;
    setBusyId(id);
    setError(null);
    setSuccess(null);
    const result = await adminResetUserPredictionAction(userId, matchId);
    setBusyId(null);
    if (result.ok) {
      setSuccess(result.message ?? "Reset.");
      router.refresh();
    } else setError(result.error);
  };

  const runImpersonatePrediction = async () => {
    if (!impUserId || !impMatchId) {
      setError("Select both a user and a match.");
      return;
    }
    setImpBusy(true);
    setError(null);
    setSuccess(null);
    const parsedEntered = new Date(impEnteredAtLocal);
    if (Number.isNaN(parsedEntered.getTime())) {
      setImpBusy(false);
      setError("Invalid date/time.");
      return;
    }
    const result = await adminSetPredictionForUserAction(
      impUserId,
      impMatchId,
      impPick,
      impFinalize,
      parsedEntered.toISOString(),
      impPowerPickMultiplier
    );
    setImpBusy(false);
    if (result.ok) {
      setSuccess(result.message ?? "Saved.");
      router.refresh();
    } else setError(result.error);
  };

  const runSetMatchPowerPick = async (
    userId: string,
    matchId: string,
    multiplier: number
  ) => {
    const key = `${userId}__${matchId}`;
    setPpBusyKey(key);
    setError(null);
    setSuccess(null);
    const result = await adminSetMatchPowerPickAction(userId, matchId, multiplier);
    setPpBusyKey(null);
    if (result.ok) {
      setSuccess(result.message ?? "Power Pick updated.");
      router.refresh();
    } else setError(result.error);
  };

  const runReclaimUnused = async (userId: string, amount: number) => {
    setReclaimBusy(true);
    setError(null);
    setSuccess(null);
    const result = await adminReclaimUnusedPowerPickAction(userId, amount);
    setReclaimBusy(false);
    if (result.ok) {
      setSuccess(result.message ?? "Reclaimed.");
      router.refresh();
    } else setError(result.error);
  };

  const runResetAllUpcomingForUser = async (userId: string) => {
    setResettingUserId(userId);
    setError(null);
    setSuccess(null);
    const result = await adminResetUserUpcomingPredictionsAction(userId);
    setResettingUserId(null);
    if (result.ok) {
      setSuccess(result.message ?? "Reset.");
      router.refresh();
    } else setError(result.error);
  };

  const bulkResetSelectedCount = bulkResetUserIds.length;
  const bulkResetDisabled =
    bulkResetBusy || (bulkResetMode === "selected" && bulkResetSelectedCount === 0);
  const bulkResetUserOptions = useMemo(() => {
    const q = bulkResetSearch.trim().toLowerCase();
    if (!q) return userOptions;
    return userOptions.filter(
      (u) =>
        u.label.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
  }, [userOptions, bulkResetSearch]);

  const toggleBulkResetUser = (userId: string) => {
    setBulkResetUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const runBulkResetUpcoming = async () => {
    setBulkResetBusy(true);
    setError(null);
    setSuccess(null);
    const targets = bulkResetMode === "selected" ? bulkResetUserIds : null;
    const result = await adminResetUpcomingPredictionsBulkAction(targets);
    setBulkResetBusy(false);
    setBulkResetConfirm(false);
    if (result.ok) {
      setSuccess(result.message ?? "Upcoming predictions reset.");
      router.refresh();
    } else setError(result.error);
  };

  const clearFilters = () => {
    setLeagueFilter(DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.leagueFilter);
    setMatchFilter(DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.matchFilter);
    setUserFilter(DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.userFilter);
    setStatusFilter(DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.statusFilter);
    setTimelineFilter(DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.timelineFilter);
    setResultFilter(DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.resultFilter);
    setOutcomeFilter(DEFAULT_ADMIN_PREDICTION_HISTORY_FILTERS.outcomeFilter);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
          <button type="button" onClick={() => setSuccess(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-nord-frostDark/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(241,245,252,0.92))] p-4 shadow-[0_16px_40px_rgba(46,52,64,0.06)] sm:p-5">
        <h2 className="text-sm font-semibold text-nord-polar">Set prediction (any user, any match)</h2>
        <p className="mt-1 text-xs leading-relaxed text-nord-polarLight">
          Match lock time does not apply. Pick a user and match, choose <strong className="text-nord-polar">1</strong>,{" "}
          <strong className="text-nord-polar">2</strong>, <strong className="text-nord-polar">BTTS Yes</strong>, or{" "}
          <strong className="text-nord-polar">BTTS No</strong>, then save as
          draft or finalize. Optionally attach Power Pick x3/x4/x5/x6/x10, even for started or completed matches. Set <strong className="text-nord-polar">Entered at</strong> to control the timestamp shown on
          the site (finalized time if locked, or “Saved …” for drafts). If the match already has an official result and you
          finalize, points are recalculated for that fixture and the leaderboard is refreshed.
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">User</label>
            <select
              value={impUserId}
              onChange={(e) => setImpUserId(e.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              <option value="">Select user…</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[240px] flex-[1.2] flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Match</label>
            <select
              value={impMatchId}
              onChange={(e) => setImpMatchId(e.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              <option value="">Select match…</option>
              {matchOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-nord-polar">Pick</span>
            <div className="flex flex-wrap gap-3">
              {(["1", "2", "BTTS Yes", "BTTS No"] as const).map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-nord-polar">
                  <input
                    type="radio"
                    name="admin-pick"
                    checked={impPick === v}
                    onChange={() => setImpPick(v)}
                    className="h-4 w-4 accent-nord-frostDark"
                  />
                  <span className="font-semibold">{v}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex min-w-[125px] flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Power Pick</label>
            <select
              value={impPowerPickMultiplier}
              onChange={(e) => setImpPowerPickMultiplier(Number(e.target.value))}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm font-semibold text-nord-polar"
            >
              {POWER_PICK_ADMIN_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === -1 ? "Leave unchanged" : value === 0 ? "None / remove" : `x${value}`}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-nord-polar">
            <input
              type="checkbox"
              checked={impFinalize}
              onChange={(e) => setImpFinalize(e.target.checked)}
              className="h-4 w-4 rounded border-nord-polarLighter accent-nord-frostDark"
            />
            Finalize (lock for this user)
          </label>
          <div className="flex min-w-[220px] flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar" htmlFor="admin-entered-at">
              Entered at (shown on site)
            </label>
            <input
              id="admin-entered-at"
              type="datetime-local"
              value={impEnteredAtLocal}
              onChange={(e) => setImpEnteredAtLocal(e.target.value)}
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            />
          </div>
          <Button type="button" variant="primary" disabled={impBusy} onClick={() => void runImpersonatePrediction()}>
            {impBusy ? "Saving…" : "Apply prediction"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-300/40 bg-[linear-gradient(180deg,rgba(255,251,240,0.95),rgba(254,243,220,0.75))] p-4 shadow-[0_16px_40px_rgba(46,52,64,0.06)] sm:p-5">
        <h2 className="text-sm font-semibold text-nord-polar">Reset upcoming predictions (bulk)</h2>
        <p className="mt-1 text-xs leading-relaxed text-nord-polarLight">
          Reset finalized predictions on{" "}
          <strong className="text-nord-polar">matches that have not started yet</strong> back to
          editable drafts. Completed / locked fixtures and any points already earned are never
          touched. Choose all users or a specific set of users.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-nord-polar">
            <input
              type="radio"
              name="bulk-reset-mode"
              checked={bulkResetMode === "all"}
              onChange={() => {
                setBulkResetMode("all");
                setBulkResetConfirm(false);
              }}
              className="h-4 w-4 accent-nord-frostDark"
            />
            <span className="font-medium">All users</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-nord-polar">
            <input
              type="radio"
              name="bulk-reset-mode"
              checked={bulkResetMode === "selected"}
              onChange={() => {
                setBulkResetMode("selected");
                setBulkResetConfirm(false);
              }}
              className="h-4 w-4 accent-nord-frostDark"
            />
            <span className="font-medium">Selected users</span>
          </label>
          {bulkResetMode === "selected" ? (
            <span className="text-xs font-medium text-nord-frostDark">
              {bulkResetSelectedCount} selected
            </span>
          ) : null}
        </div>

        {bulkResetMode === "selected" ? (
          <div className="mt-3 rounded-xl border border-nord-polarLighter/50 bg-white/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={bulkResetSearch}
                onChange={(e) => setBulkResetSearch(e.target.value)}
                placeholder="Search users…"
                className="min-w-[180px] flex-1 rounded-lg border border-nord-polarLighter bg-white px-3 py-1.5 text-sm text-nord-polar"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBulkResetUserIds(bulkResetUserOptions.map((u) => u.id))}
              >
                Select shown
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={bulkResetSelectedCount === 0}
                onClick={() => setBulkResetUserIds([])}
              >
                Clear
              </Button>
            </div>
            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-nord-polarLighter/40 bg-white/80">
              {bulkResetUserOptions.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-nord-polarLight">
                  No users match your search.
                </p>
              ) : (
                <ul className="divide-y divide-nord-polarLighter/30">
                  {bulkResetUserOptions.map((u) => (
                    <li key={u.id}>
                      <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-nord-polar hover:bg-nord-snow/60">
                        <input
                          type="checkbox"
                          checked={bulkResetUserIds.includes(u.id)}
                          onChange={() => toggleBulkResetUser(u.id)}
                          className="h-4 w-4 rounded border-nord-polarLighter accent-nord-frostDark"
                        />
                        <span className="truncate">
                          {u.label}{" "}
                          <span className="text-nord-polarLight">@{u.username}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!bulkResetConfirm ? (
            <Button
              type="button"
              variant="secondary"
              disabled={bulkResetDisabled}
              onClick={() => setBulkResetConfirm(true)}
            >
              {bulkResetMode === "all"
                ? "Reset upcoming for all users"
                : `Reset upcoming for ${bulkResetSelectedCount} selected user(s)`}
            </Button>
          ) : (
            <>
              <span className="text-sm font-medium text-nord-polar">
                {bulkResetMode === "all"
                  ? "Reset upcoming predictions for ALL users?"
                  : `Reset upcoming predictions for ${bulkResetSelectedCount} selected user(s)?`}
              </span>
              <Button
                type="button"
                variant="primary"
                disabled={bulkResetBusy}
                onClick={() => void runBulkResetUpcoming()}
              >
                {bulkResetBusy ? "Resetting…" : "Confirm reset"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={bulkResetBusy}
                onClick={() => setBulkResetConfirm(false)}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-nord-polarLighter/40 bg-white/85 p-4 shadow-[0_12px_28px_rgba(46,52,64,0.035)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-nord-polar">Prediction history filters</h2>
            <p className="mt-1 text-xs leading-relaxed text-nord-polarLight">
              Focus on previous fixtures, completed results, one user, or one match to inspect the full prediction timeline.
            </p>
            {focusSummary ? (
              <p className="mt-2 text-xs font-medium text-nord-frostDark">
                Active focus: {focusSummary}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {userFilter && (
              <Button
                variant="secondary"
                size="sm"
                disabled={!!resettingUserId}
                onClick={() => runResetAllUpcomingForUser(userFilter)}
              >
                {resettingUserId === userFilter
                  ? "Resetting…"
                  : "Reset all upcoming for this user"}
              </Button>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
            <Link
              href="/admin/scoring"
              className="text-sm font-medium text-nord-frostDark hover:underline"
            >
              Recalculate all scores & leaderboard →
            </Link>
          </div>
        </div>

        {selectedUser && powerPickBalances[selectedUser.id] ? (
          <PowerPickReclaimPanel
            userLabel={selectedUser.label}
            balance={powerPickBalances[selectedUser.id]}
            amount={reclaimAmount}
            onAmountChange={setReclaimAmount}
            busy={reclaimBusy}
            onReclaim={() =>
              runReclaimUnused(
                selectedUser.id,
                Math.min(
                  reclaimAmount,
                  powerPickBalances[selectedUser.id].remainingAvailable
                )
              )
            }
          />
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Tournament</label>
            <select
              value={leagueFilter}
              onChange={(e) =>
                setLeagueFilter(e.target.value as AdminPredictionHistoryFilters["leagueFilter"])
              }
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              <option value="">All tournaments</option>
              {COMPETITIONS.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Match</label>
            <select
              value={matchFilter}
              onChange={(e) => setMatchFilter(e.target.value)}
              className="min-w-[220px] rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              <option value="">All matches</option>
              {matchOptionsFilteredByLeague.map((match) => (
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
              onChange={(e) => setUserFilter(e.target.value)}
              className="min-w-[200px] rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
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
            <label className="text-xs font-medium text-nord-polar">Status</label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as AdminPredictionHistoryFilters["statusFilter"]
                )
              }
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              <option value="all">All</option>
              <option value="finalized">Finalized</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Timeline</label>
            <select
              value={timelineFilter}
              onChange={(e) =>
                setTimelineFilter(
                  e.target.value as AdminPredictionHistoryFilters["timelineFilter"]
                )
              }
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              {TIMELINE_FILTERS.map((filterOption) => (
                <option key={filterOption.value} value={filterOption.value}>
                  {filterOption.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Result state</label>
            <select
              value={resultFilter}
              onChange={(e) =>
                setResultFilter(
                  e.target.value as AdminPredictionHistoryFilters["resultFilter"]
                )
              }
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              {RESULT_FILTERS.map((filterOption) => (
                <option key={filterOption.value} value={filterOption.value}>
                  {filterOption.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-nord-polar">Outcome</label>
            <select
              value={outcomeFilter}
              onChange={(e) =>
                setOutcomeFilter(
                  e.target.value as AdminPredictionHistoryFilters["outcomeFilter"]
                )
              }
              className="rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-sm text-nord-polar"
            >
              {OUTCOME_FILTERS.map((filterOption) => (
                <option key={filterOption.value} value={filterOption.value}>
                  {filterOption.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <div className="rounded-xl border border-nord-frostDark/15 bg-nord-snow/70 px-3 py-2 text-sm text-nord-polar">
              Showing <span className="font-semibold">{filtered.length}</span> of{" "}
              <span className="font-semibold">{predictions.length}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
              Rows in view
            </p>
            <p className="mt-2 text-2xl font-semibold text-nord-polar">{summary.total}</p>
            <p className="mt-1 text-xs text-nord-polarLight">
              {summary.uniqueUsers} users · {summary.uniqueMatches} matches
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
              Prediction state
            </p>
            <p className="mt-2 text-2xl font-semibold text-nord-polar">
              {summary.finalized}
            </p>
            <p className="mt-1 text-xs text-nord-polarLight">
              finalized · {summary.drafts} drafts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
              Match timeline
            </p>
            <p className="mt-2 text-2xl font-semibold text-nord-polar">
              {summary.previousMatches}
            </p>
            <p className="mt-1 text-xs text-nord-polarLight">
              previous fixtures · {summary.total - summary.previousMatches} upcoming
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-nord-polarLight">
              Result insight
            </p>
            <p className="mt-2 text-2xl font-semibold text-nord-polar">
              {summary.correctFinalized}
            </p>
            <p className="mt-1 text-xs text-nord-polarLight">
              correct finalized picks · {summary.completedMatches} completed rows
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-xl border border-nord-polarLighter/50 bg-white/90">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-nord-polarLight">
            No predictions match the selected filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nord-polarLighter bg-nord-snow/80 text-left text-nord-polarLight">
                <th className="px-4 py-3 font-semibold">Match</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Prediction timeline</th>
                <th className="px-4 py-3 font-semibold">Result detail</th>
                <th className="px-4 py-3 font-semibold">Points</th>
                <th className="px-4 py-3 font-semibold">Power Pick</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isBusy =
                  busyId === p.id || busyId === `${p.userId}-${p.matchId}`;
                const matchCompleted = isCompletedPredictionMatch(p);
                const previousMatch = isPastPredictionMatch(p, now);
                const focusedMatchHref = buildPredictionHistoryHref({
                  matchFilter: p.matchId,
                  timelineFilter: previousMatch ? "previous" : "all",
                });
                const focusedUserHref = buildPredictionHistoryHref({
                  userFilter: p.userId,
                  timelineFilter: "previous",
                });

                return (
                  <tr key={p.id} className="border-b border-nord-polarLighter/30 hover:bg-nord-snow/50">
                    <td className="px-4 py-3">
                      <span className="block text-xs text-nord-polarLight">
                        Kickoff {formatDateTime(p.match.matchDatetime)}
                      </span>
                      <span className="text-nord-polar font-medium">
                        {p.match.homeTeamName} vs {p.match.awayTeamName}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-nord-polarLight">
                        <span>{formatStage(p.match.stage)}</span>
                        <span>·</span>
                        <span>Lock {formatDateTime(p.match.lockAt)}</span>
                        <span>·</span>
                        <span>{previousMatch ? "Previous match" : "Upcoming match"}</span>
                      </div>
                      <Link
                        href={focusedMatchHref}
                        className="mt-2 inline-flex text-xs font-medium text-nord-frostDark hover:underline"
                      >
                        Open fixture history →
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-nord-polar">
                        {p.user.name} {p.user.surname}
                      </div>
                      <div className="mt-1 text-xs text-nord-polarLight">
                        @{p.user.username}
                      </div>
                      <Link
                        href={focusedUserHref}
                        className="mt-2 inline-flex text-xs font-medium text-nord-frostDark hover:underline"
                      >
                        View previous-match history →
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <PredictionPickDisplay
                        pick={p.selectedPrediction}
                        finalizedAt={p.finalizedAt}
                        createdAt={p.createdAt}
                        lockAt={p.match.lockAt}
                        isFinal={p.isFinal}
                        compact
                      />
                      <div className="mt-2 space-y-1 text-xs text-nord-polarLight">
                        <div>
                          First saved:{" "}
                          <span className="text-nord-polar">
                            {formatDateTime(p.createdAt)}
                          </span>
                        </div>
                        <div>
                          Last updated:{" "}
                          <span className="text-nord-polar">
                            {formatDateTime(p.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getOutcomeBadgeClass(
                            p
                          )}`}
                        >
                          {getOutcomeLabel(p)}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            matchCompleted
                              ? "bg-slate-100 text-slate-700"
                              : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {matchCompleted ? "Completed" : "Awaiting result"}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-nord-polarLight">
                        <div>
                          Official result:{" "}
                          <span className="font-medium text-nord-polar">
                            {displayResult(p.match.officialResultType)}
                          </span>
                        </div>
                        <div>
                          Score:{" "}
                          <span className="font-medium text-nord-polar">
                            {formatScore(p.match.homeScore, p.match.awayScore)}
                          </span>
                        </div>
                        <div>
                          Pick detail:{" "}
                          <span className="font-medium text-nord-polar">
                            {displayPick(p.selectedPrediction)} ·{" "}
                            {p.isFinal ? "Locked" : "Draft"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-nord-polar align-top">
                      {p.isFinal ? p.awardedPoints : "–"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <PowerPickCell
                        isWorldCup={
                          p.match.competitionId === POWER_PICK_COMPETITION_ID
                        }
                        selection={
                          powerPickByUserMatch[`${p.userId}__${p.matchId}`] ?? null
                        }
                        busy={ppBusyKey === `${p.userId}__${p.matchId}`}
                        onChange={(multiplier) =>
                          runSetMatchPowerPick(p.userId, p.matchId, multiplier)
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex flex-wrap justify-end gap-1">
                        {p.isFinal && (
                          <>
                            <Button
                              size="sm"
                              variant={p.awardedPoints === 0 ? "primary" : "secondary"}
                              onClick={() => runSetPoints(p.id, 0)}
                              disabled={isBusy}
                            >
                              Set 0
                            </Button>
                            <Button
                              size="sm"
                              variant={p.awardedPoints === 1 ? "primary" : "secondary"}
                              onClick={() => runSetPoints(p.id, 1)}
                              disabled={isBusy}
                            >
                              Set 1
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => runResetOne(p.userId, p.matchId)}
                              disabled={isBusy}
                            >
                              {busyId === `${p.userId}-${p.matchId}` ? "…" : "Reset"}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function powerPickStatusLabel(status: string): string {
  if (status === "locked") return "Used";
  if (status === "active") return "Armed";
  return "On";
}

/** Per-row Power Pick badge + inline assign/remove selector (World Cup only). */
function PowerPickCell({
  isWorldCup,
  selection,
  busy,
  onChange,
}: {
  isWorldCup: boolean;
  selection: PowerPickSelectionInfo | null;
  busy: boolean;
  onChange: (multiplier: number) => void;
}) {
  if (!isWorldCup) {
    return (
      <span
        className="text-xs text-nord-polarLight"
        title="Power Pick applies to World Cup matches only."
      >
        —
      </span>
    );
  }

  const current = selection?.multiplier ?? 0;
  const isLocked = selection?.status === "locked";

  return (
    <div className="flex flex-col gap-1.5">
      {selection ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-300/70 bg-[linear-gradient(135deg,#fde9b8,#f6c560)] px-2 py-0.5 text-[11px] font-bold text-[#7a4a00] shadow-[0_1px_3px_rgba(224,138,30,0.25)]">
          ★ x{selection.multiplier}
          <span className="font-semibold uppercase tracking-[0.06em] opacity-80">
            · {powerPickStatusLabel(selection.status)}
          </span>
        </span>
      ) : (
        <span className="inline-flex w-fit items-center rounded-full border border-nord-polarLighter/60 bg-nord-snow/70 px-2 py-0.5 text-[11px] font-medium text-nord-polarLight">
          No Power Pick
        </span>
      )}
      <select
        value={current}
        disabled={busy}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-[7.5rem] rounded-lg border border-nord-polarLighter bg-white px-2 py-1 text-xs font-semibold text-nord-polar disabled:opacity-50"
        aria-label="Set Power Pick multiplier"
      >
        {POWER_PICK_ROW_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {value === 0 ? "None / remove" : `x${value}`}
          </option>
        ))}
      </select>
      {isLocked ? (
        <span className="text-[10px] text-nord-polarLight">
          Locked pick · editing rescopes points
        </span>
      ) : null}
    </div>
  );
}

/** Reclaim a focused user's unused (freed-up) Power Pick rights. */
function PowerPickReclaimPanel({
  userLabel,
  balance,
  amount,
  onAmountChange,
  busy,
  onReclaim,
}: {
  userLabel: string;
  balance: PowerPickBalanceInfo;
  amount: number;
  onAmountChange: (value: number) => void;
  busy: boolean;
  onReclaim: () => void;
}) {
  const available = balance.remainingAvailable;
  const canReclaim = available > 0 && !busy;

  return (
    <div className="mt-4 rounded-xl border border-amber-300/50 bg-[linear-gradient(180deg,rgba(255,251,240,0.95),rgba(253,244,222,0.85))] p-4 shadow-[0_10px_26px_rgba(224,138,30,0.08)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#7a4a00]">
            Power Pick balance · {userLabel}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <BalanceChip label="Granted" value={balance.totalGranted} />
            <BalanceChip label="Used" value={balance.usedLocked} />
            <BalanceChip label="Armed" value={balance.selectedUnlocked} />
            <BalanceChip label="Unused" value={available} highlight />
          </div>
          <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-[#8a5a12]">
            Only <strong>unused</strong> rights can be reclaimed — committed picks
            (used on locked matches and armed on open matches) are never touched.
            Remove a Power Pick from a match above to free its right, then reclaim it
            here.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-[#7a4a00]">Amount</label>
            <input
              type="number"
              min={1}
              max={Math.max(1, available)}
              value={amount}
              disabled={available === 0}
              onChange={(e) => onAmountChange(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="w-20 rounded-lg border border-amber-300/70 bg-white px-2 py-1.5 text-sm font-semibold text-nord-polar disabled:opacity-50"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!canReclaim}
            onClick={onReclaim}
          >
            {busy ? "Reclaiming…" : "Reclaim unused"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BalanceChip({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        highlight
          ? "border-amber-400/70 bg-white text-[#7a4a00]"
          : "border-nord-polarLighter/60 bg-white/70 text-nord-polar"
      }`}
    >
      <span className="uppercase tracking-[0.08em] opacity-70">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}
