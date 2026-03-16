"use client";

import { useState, useMemo, useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toDisplay } from "@/lib/prediction-values";
import type { PredictionValue } from "@prisma/client";
import type { PredictionDisplay } from "@/lib/prediction-values";
import { Button, Modal } from "@/components/ui";
import { PredictionPickDisplay } from "@/components/prediction-pick-display";
import {
  submitPredictionAction,
  finalizePredictionAction,
  unfinalizePredictionAction,
  resetUpcomingPredictionsAction,
  resetPastPredictionsAction,
} from "./actions";

const UCL_ID = "CL";

export type ScheduleMatch = {
  id: string;
  competitionId?: string | null;
  matchDatetime: string;
  lockAt: string;
  stage: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  officialResultType: PredictionValue | null;
  homeScore?: number | null;
  awayScore?: number | null;
};

export type UserPrediction = {
  matchId: string;
  selectedPrediction: PredictionDisplay;
  isFinal: boolean;
  finalizedAt: string | null;
};

export type OtherPrediction = {
  name: string;
  surname: string;
  selectedPrediction: string;
  finalizedAt: string;
};

function isSameCalendarDay(iso1: string, iso2: string): boolean {
  const d1 = new Date(iso1);
  const d2 = new Date(iso2);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function formatStage(stage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: "Group stage",
    LEAGUE_STAGE: "Group stage",
    ROUND_16: "Round of 16",
    LAST_16: "Round of 16",
    QUARTER_FINAL: "Quarter-final",
    SEMI_FINAL: "Semi-final",
    FINAL: "Final",
    PLAYOFFS: "Play-offs",
  };
  return map[stage] ?? stage;
}

function formatResult(value: PredictionValue | null): string {
  if (!value) return "–";
  return toDisplay(value);
}

type Props = {
  matches: ScheduleMatch[];
  userPredictions: UserPrediction[];
  othersByMatchId: Record<string, OtherPrediction[]>;
  isAdmin?: boolean;
};

function buildPredictionMap(predictions: UserPrediction[]) {
  const map: Record<string, UserPrediction> = {};
  for (const p of predictions) map[p.matchId] = p;
  return map;
}

function buildOthersMap(othersByMatchId: Record<string, OtherPrediction[]>) {
  return Object.fromEntries(
    Object.entries(othersByMatchId).map(([matchId, list]) => [matchId, [...list]])
  ) as Record<string, OtherPrediction[]>;
}

export function ScheduleTabs({
  matches,
  userPredictions,
  othersByMatchId,
  isAdmin = false,
}: Props) {
  const [competitionTab, setCompetitionTab] = useState<"ucl" | "other">("ucl");
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [filterStage, setFilterStage] = useState<string>("");
  const [filterTeam, setFilterTeam] = useState<string>("");
  const [now] = useState(() => new Date());
  const [finalizeModal, setFinalizeModal] = useState<{
    matchId: string;
    matchLabel: string;
  } | null>(null);
  const [pendingFinalizeMatchId, setPendingFinalizeMatchId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedOthers, setExpandedOthers] = useState<Set<string>>(new Set());
  const [optimisticSelections, setOptimisticSelections] = useState<Record<string, PredictionDisplay>>({});
  const [localPredictions, setLocalPredictions] = useState<Record<string, UserPrediction>>(
    () => buildPredictionMap(userPredictions)
  );
  const [localOthersByMatchId, setLocalOthersByMatchId] = useState<Record<string, OtherPrediction[]>>(
    () => buildOthersMap(othersByMatchId)
  );
  const [undoingMatchId, setUndoingMatchId] = useState<string | null>(null);
  const [pendingResetUpcoming, setPendingResetUpcoming] = useState(false);
  const [pendingResetPast, setPendingResetPast] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [, startRefreshTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setLocalPredictions(buildPredictionMap(userPredictions));
  }, [userPredictions]);

  useEffect(() => {
    setLocalOthersByMatchId(buildOthersMap(othersByMatchId));
  }, [othersByMatchId]);

  const userPredictionByMatch = localPredictions;

  const matchesByCompetition = useMemo(() => {
    if (competitionTab === "ucl") {
      return matches.filter((m) => m.competitionId === UCL_ID || m.competitionId == null);
    }
    return matches.filter((m) => m.competitionId != null && m.competitionId !== UCL_ID);
  }, [matches, competitionTab]);

  /** Aynı tarihli maçlarda sıra sabit kalsın diye önce matchDatetime sonra id ile sırala. */
  const sortByDatetimeAsc = useCallback((a: ScheduleMatch, b: ScheduleMatch) => {
    const t =
      new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime();
    return t !== 0 ? t : a.id.localeCompare(b.id);
  }, []);
  const sortByDatetimeDesc = useCallback(
    (a: ScheduleMatch, b: ScheduleMatch) => sortByDatetimeAsc(b, a),
    [sortByDatetimeAsc]
  );

  const { upcoming, past } = useMemo(() => {
    const upcomingList = matchesByCompetition
      .filter((m) => new Date(m.matchDatetime) >= now)
      .sort(sortByDatetimeAsc);
    const pastList = matchesByCompetition
      .filter((m) => new Date(m.matchDatetime) < now)
      .sort(sortByDatetimeDesc);
    return { upcoming: upcomingList, past: pastList };
  }, [matchesByCompetition, now, sortByDatetimeAsc, sortByDatetimeDesc]);

  const currentList = activeTab === "upcoming" ? upcoming : past;

  const stageOptions = useMemo(() => {
    const stages = new Set(currentList.map((m) => m.stage));
    return Array.from(stages).sort((a, b) => {
      const order = ["GROUP_STAGE", "LEAGUE_STAGE", "PLAYOFFS", "ROUND_16", "LAST_16", "QUARTER_FINAL", "SEMI_FINAL", "FINAL"];
      const i = order.indexOf(a);
      const j = order.indexOf(b);
      if (i !== -1 && j !== -1) return i - j;
      if (i !== -1) return -1;
      if (j !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [currentList]);

  const teamOptions = useMemo(() => {
    const teams = new Set<string>();
    currentList.forEach((m) => {
      if (m.homeTeamName && m.homeTeamName !== "TBD") teams.add(m.homeTeamName);
      if (m.awayTeamName && m.awayTeamName !== "TBD") teams.add(m.awayTeamName);
    });
    return Array.from(teams).sort((a, b) => a.localeCompare(b));
  }, [currentList]);

  const filteredList = useMemo(() => {
    return currentList.filter((m) => {
      if (filterStage && m.stage !== filterStage) return false;
      if (filterTeam && m.homeTeamName !== filterTeam && m.awayTeamName !== filterTeam) return false;
      return true;
    });
  }, [currentList, filterStage, filterTeam]);

  /** En erkenden en geçe: tarih ve id ile sabit sıralı liste (upcoming = artan, past = azalan). */
  const sortedList = useMemo(() => {
    const list = [...filteredList];
    return activeTab === "upcoming"
      ? list.sort(sortByDatetimeAsc)
      : list.sort(sortByDatetimeDesc);
  }, [filteredList, activeTab, sortByDatetimeAsc, sortByDatetimeDesc]);

  const resetFilters = () => {
    setFilterStage("");
    setFilterTeam("");
  };

  const handleSubmitPrediction = (
    matchId: string,
    value: PredictionDisplay
  ) => {
    const previousPrediction = userPredictionByMatch[matchId];
    setActionError(null);
    setOptimisticSelections((prev) => ({ ...prev, [matchId]: value }));
    setLocalPredictions((prev) => ({
      ...prev,
      [matchId]: {
        matchId,
        selectedPrediction: value,
        isFinal: prev[matchId]?.isFinal ?? false,
        finalizedAt: prev[matchId]?.finalizedAt ?? null,
      },
    }));

    void submitPredictionAction(matchId, value).then((result) => {
      if (result.ok) return;

      setActionError(result.error);
      setOptimisticSelections((prev) => {
        if (prev[matchId] !== value) return prev;
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      setLocalPredictions((prev) => {
        const current = prev[matchId];
        if (current?.isFinal) return prev;
        if (previousPrediction) return { ...prev, [matchId]: previousPrediction };
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
    });
  };

  const handleFinalizeConfirm = async () => {
    if (!finalizeModal) return;
    const { matchId } = finalizeModal;
    const previousPrediction = userPredictionByMatch[matchId];
    const selectedPrediction =
      optimisticSelections[matchId] ?? previousPrediction?.selectedPrediction;
    const optimisticFinalizedAt = new Date().toISOString();

    setPendingFinalizeMatchId(matchId);
    setActionError(null);
    setFinalizeModal(null);
    if (selectedPrediction) {
      setLocalPredictions((prev) => ({
        ...prev,
        [matchId]: {
          matchId,
          selectedPrediction,
          isFinal: true,
          finalizedAt: optimisticFinalizedAt,
        },
      }));
    }
    const result = await finalizePredictionAction(matchId, selectedPrediction);
    setPendingFinalizeMatchId(null);
    if (result.ok) {
      setOptimisticSelections((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      if (result.others) {
        setLocalOthersByMatchId((prev) => ({ ...prev, [matchId]: result.others ?? [] }));
      }
      startRefreshTransition(() => {
        router.refresh();
      });
      return;
    }
    if (previousPrediction) {
      setLocalPredictions((prev) => ({ ...prev, [matchId]: previousPrediction }));
    } else {
      setLocalPredictions((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
    }
    setActionError(result.error);
  };

  const handleUndo = async (matchId: string) => {
    const previousPrediction = userPredictionByMatch[matchId];
    setActionError(null);
    setUndoingMatchId(matchId);
    if (previousPrediction) {
      setLocalPredictions((prev) => ({
        ...prev,
        [matchId]: {
          ...previousPrediction,
          isFinal: false,
          finalizedAt: null,
        },
      }));
    }
    const result = await unfinalizePredictionAction(matchId);
    setUndoingMatchId(null);
    if (result.ok) {
      setLocalOthersByMatchId((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      startRefreshTransition(() => {
        router.refresh();
      });
    } else {
      if (previousPrediction) {
        setLocalPredictions((prev) => ({ ...prev, [matchId]: previousPrediction }));
      }
      setActionError(result.error);
    }
  };

  const toggleOthers = (matchId: string) => {
    setExpandedOthers((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  const scheduleGrid =
    "grid grid-cols-1 sm:grid-cols-[7rem_minmax(12rem,1fr)_14rem_6rem_5rem] gap-4 px-4 py-3 items-center";

  const ScheduleTableHeader = () => (
    <div
      className={`${scheduleGrid} hidden bg-nord-snow/80 text-nord-polarLight text-xs font-semibold uppercase tracking-wide border-b border-nord-polarLighter/50 sm:grid`}
    >
      <span>Time</span>
      <span>Match</span>
      <span>Prediction</span>
      <span>Match score</span>
      <span className="text-center">Result</span>
    </div>
  );

  function MatchCard({
    m,
    canPredict,
    userPred,
    others,
    displaySelection,
    isUndoing,
    onUndo,
    separatorVariant,
  }: {
    m: ScheduleMatch;
    canPredict: boolean;
    userPred: UserPrediction | undefined;
    others: OtherPrediction[];
    displaySelection: PredictionDisplay | undefined;
    isUndoing: boolean;
    onUndo: (matchId: string) => void;
    /** Same day = thin line; new day = slightly thicker line; none = last item */
    separatorVariant: "same-day" | "new-day" | "none";
  }) {
    const isFinalizing = pendingFinalizeMatchId === m.id;

    const showOthers = userPred?.isFinal && others.length > 0;
    const isExpanded = expandedOthers.has(m.id);
    const matchDate = new Date(m.matchDatetime);

    const borderStyle =
      separatorVariant === "none"
        ? undefined
        : separatorVariant === "same-day"
          ? { borderBottom: "1px solid rgba(76, 86, 106, 0.22)" }
          : { borderBottom: "2px solid rgba(76, 86, 106, 0.45)" };

    return (
      <li
        className="bg-white/60 hover:bg-white/80 transition-colors"
        style={borderStyle}
      >
        <div className="px-4 py-4 sm:hidden">
          <div className="flex items-start gap-4">
            <div className="min-w-[5.5rem] text-nord-polarLight">
              <span className="block text-[11px] font-medium uppercase tracking-[0.12em]">
                Time
              </span>
              <span className="mt-1 block text-base font-semibold text-nord-polar">
                {matchDate.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })}
              </span>
              <span className="mt-0.5 block text-sm">
                {matchDate.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="mt-1 block text-xs">{formatStage(m.stage)}</span>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2.5">
                {m.homeTeamLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external API logo URL
                  <img
                    src={m.homeTeamLogo}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full border border-nord-polarLighter/40 bg-white object-contain"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nord-snow text-xs font-medium text-nord-polarLighter">
                    ?
                  </span>
                )}
                <span className="truncate text-base font-semibold text-nord-polar">
                  {m.homeTeamName}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {m.awayTeamLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external API logo URL
                  <img
                    src={m.awayTeamLogo}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full border border-nord-polarLighter/40 bg-white object-contain"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nord-snow text-xs font-medium text-nord-polarLighter">
                    ?
                  </span>
                )}
                <span className="truncate text-[15px] font-medium text-nord-polar">
                  {m.awayTeamName}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_4.25rem_3.5rem] gap-3 border-t border-nord-polarLighter/20 pt-3">
            <div className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-nord-polarLight">
                Prediction
              </span>
              {canPredict && (
                <div className="space-y-1.5">
                  <span className="block text-[11px] uppercase tracking-wide text-nord-polarLight">
                    Lock {new Date(m.lockAt).toLocaleTimeString("en-GB", { timeStyle: "short" })}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(["1", "X", "2"] as const).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleSubmitPrediction(m.id, val)}
                        className={`min-w-[2rem] rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          displaySelection === val
                            ? "border-nord-frostDark bg-nord-frostDark text-white"
                            : "border-nord-polarLighter bg-white text-nord-polar hover:bg-nord-snow"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      disabled={!displaySelection || isFinalizing}
                      onClick={() =>
                        setFinalizeModal({
                          matchId: m.id,
                          matchLabel: `${m.homeTeamName} vs ${m.awayTeamName}`,
                        })
                      }
                    >
                      Finalize
                    </Button>
                  </div>
                </div>
              )}
              {!canPredict && userPred && (
                <PredictionPickDisplay
                  lockAt={m.lockAt}
                  pick={userPred.selectedPrediction}
                  finalizedAt={userPred.finalizedAt}
                  isFinal={userPred.isFinal}
                  compact
                  onUndo={
                    userPred.isFinal && m.officialResultType === null && isAdmin
                      ? () => onUndo(m.id)
                      : undefined
                  }
                  undoLoading={isUndoing}
                />
              )}
              {!canPredict && !userPred && (
                <span className="mt-0.5 block text-nord-polarLight">–</span>
              )}
            </div>

            <div className="text-right">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-nord-polarLight">
                Score
              </span>
              <span className="block text-sm font-semibold text-nord-polar">
                {m.homeScore != null && m.awayScore != null
                  ? `${m.homeScore} – ${m.awayScore}`
                  : "–"}
              </span>
            </div>

            <div className="text-right">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-nord-polarLight">
                Result
              </span>
              <span className="block text-sm font-semibold text-nord-polar">
                {m.officialResultType != null
                  ? formatResult(m.officialResultType)
                  : "–"}
              </span>
            </div>
          </div>
        </div>

        <div className={`${scheduleGrid} hidden min-h-[4rem] text-sm sm:grid`}>
          <div className="flex flex-col justify-center text-nord-polarLight">
            <span className="font-medium text-nord-polar">
              {matchDate.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
              })}
            </span>
            <span className="mt-0.5">
              {matchDate.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="mt-1 text-xs">{formatStage(m.stage)}</span>
          </div>

          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              {m.homeTeamLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- external API logo URL
                <img
                  src={m.homeTeamLogo}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full object-contain bg-white border border-nord-polarLighter/50"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nord-snow text-xs font-medium text-nord-polarLighter">
                  ?
                </span>
              )}
              <span className="truncate font-semibold text-nord-polar">
                {m.homeTeamName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {m.awayTeamLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- external API logo URL
                <img
                  src={m.awayTeamLogo}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full object-contain bg-white border border-nord-polarLighter/50"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nord-snow text-xs font-medium text-nord-polarLighter">
                  ?
                </span>
              )}
              <span className="truncate text-sm font-medium text-nord-polar">
                {m.awayTeamName}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            {canPredict && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-nord-polarLight uppercase tracking-wide">
                  Lock {new Date(m.lockAt).toLocaleTimeString("en-GB", { timeStyle: "short" })}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["1", "X", "2"] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSubmitPrediction(m.id, val)}
                      className={`min-w-[2rem] rounded border px-2 py-1 text-xs font-medium transition-colors ${
                        displaySelection === val
                          ? "border-nord-frostDark bg-nord-frostDark text-white"
                          : "border-nord-polarLighter bg-white text-nord-polar hover:bg-nord-snow"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    disabled={!displaySelection || isFinalizing}
                    onClick={() =>
                      setFinalizeModal({
                        matchId: m.id,
                        matchLabel: `${m.homeTeamName} vs ${m.awayTeamName}`,
                      })
                    }
                  >
                    Finalize
                  </Button>
                </div>
              </div>
            )}
            {!canPredict && userPred && (
              <PredictionPickDisplay
                lockAt={m.lockAt}
                pick={userPred.selectedPrediction}
                finalizedAt={userPred.finalizedAt}
                isFinal={userPred.isFinal}
                compact
                onUndo={
                  userPred.isFinal && m.officialResultType === null && isAdmin
                    ? () => onUndo(m.id)
                    : undefined
                }
                undoLoading={isUndoing}
              />
            )}
            {!canPredict && !userPred && (
              <span className="text-nord-polarLight mt-0.5">–</span>
            )}
          </div>

          <div className="flex flex-col justify-center">
            {m.homeScore != null && m.awayScore != null ? (
              <span className="font-semibold text-nord-polar">
                {m.homeScore} – {m.awayScore}
              </span>
            ) : (
              <span className="text-nord-polarLight">–</span>
            )}
          </div>

          <div className="flex flex-col justify-center text-center">
            <span className="font-semibold text-nord-polar">
              {m.officialResultType != null
                ? formatResult(m.officialResultType)
                : "–"}
            </span>
          </div>
        </div>

        {showOthers && (
          <div className="bg-nord-snow/50 px-4 pb-3 pt-1">
            <button
              type="button"
              onClick={() => toggleOthers(m.id)}
              className="text-xs font-medium text-nord-frostDark hover:underline py-1"
            >
              {isExpanded
                ? "Hide others' predictions"
                : `Others' predictions (${others.length})`}
            </button>
            {isExpanded && (
              <ul className="mt-2 space-y-1 text-xs text-nord-polarLight">
                {others.map((o, i) => (
                  <li key={i}>
                    {o.name} {o.surname}: {o.selectedPrediction} (finalized{" "}
                    {new Date(o.finalizedAt).toLocaleString("en-GB")})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </li>
    );
  }

  function MatchList({ list }: { list: ScheduleMatch[] }) {
    return (
      <>
        <ScheduleTableHeader />
        <ul className="divide-y-0">
          {list.map((m, index) => {
          const lockAt = new Date(m.lockAt).getTime();
          const canPredict = (now.getTime() < lockAt || isAdmin) && !userPredictionByMatch[m.id]?.isFinal;
          const userPred = userPredictionByMatch[m.id];
          const others = localOthersByMatchId[m.id] ?? [];
          const displaySelection = optimisticSelections[m.id] ?? userPred?.selectedPrediction;
          const isLast = index === list.length - 1;
          const nextMatch = list[index + 1];
          const sameDayAsNext = nextMatch ? isSameCalendarDay(m.matchDatetime, nextMatch.matchDatetime) : false;
          const separatorVariant = isLast ? "none" : sameDayAsNext ? "same-day" : "new-day";

          return (
            <MatchCard
              key={m.id}
              m={m}
              canPredict={canPredict}
              userPred={userPred}
              others={others}
              displaySelection={displaySelection}
              isUndoing={undoingMatchId === m.id}
              onUndo={handleUndo}
              separatorVariant={separatorVariant}
            />
          );
        })}
        </ul>
      </>
    );
  }

  return (
    <div className="mt-6">
      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {actionError}
        </div>
      )}
      {/* Competition / league tabs */}
      <div className="mb-0 grid grid-cols-2 gap-1 rounded-xl border border-nord-polarLighter/30 bg-nord-snow/60 p-1 sm:flex sm:gap-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:border-b sm:border-nord-polarLighter/50">
        <button
          type="button"
          onClick={() => { setCompetitionTab("ucl"); setActiveTab("upcoming"); resetFilters(); }}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:rounded-none sm:px-4 sm:py-3 sm:border-b-2 sm:-mb-px ${
            competitionTab === "ucl"
              ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
              : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- external league logo */}
          <img
            src="https://upload.wikimedia.org/wikipedia/en/f/f5/UEFA_Champions_League.svg"
            alt=""
            className="h-6 w-6 shrink-0 object-contain"
          />
          <span className="sm:hidden">UCL</span>
          <span className="hidden sm:inline">UEFA Champions League</span>
        </button>
        <button
          type="button"
          onClick={() => { setCompetitionTab("other"); setActiveTab("upcoming"); resetFilters(); }}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:rounded-none sm:px-4 sm:py-3 sm:border-b-2 sm:-mb-px ${
            competitionTab === "other"
              ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
              : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
          }`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nord-polarLighter/60" aria-hidden>
            <svg className="h-3.5 w-3.5 text-nord-polar" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </span>
          <span className="sm:hidden">Other</span>
          <span className="hidden sm:inline">Diğer</span>
        </button>
      </div>
      <div className="mt-3 mb-0 grid grid-cols-2 gap-1 rounded-xl border border-nord-polarLighter/30 bg-nord-snow/40 p-1 sm:mt-0 sm:flex sm:gap-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:border-b sm:border-nord-polarLighter/50">
        <button
          type="button"
          onClick={() => { setActiveTab("upcoming"); resetFilters(); }}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:rounded-none sm:px-4 sm:py-3 sm:border-b-2 sm:-mb-px ${
            activeTab === "upcoming"
              ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
              : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
          }`}
        >
          Upcoming matches
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("past"); resetFilters(); }}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:rounded-none sm:px-4 sm:py-3 sm:border-b-2 sm:-mb-px ${
            activeTab === "past"
              ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
              : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
          }`}
        >
          Past matches
        </button>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-nord-polar/5 border border-nord-polarLighter/50 border-t-0 text-sm">
          <span className="font-medium text-nord-polar">Admin:</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={async () => {
              setActionError(null);
              setResetMessage(null);
              setPendingResetUpcoming(true);
              const res = await resetUpcomingPredictionsAction();
              setPendingResetUpcoming(false);
              if (res.ok) {
                setResetMessage(`Upcoming: ${res.count} prediction(s) reset.`);
                router.refresh();
                setTimeout(() => setResetMessage(null), 4000);
              } else {
                setActionError(res.error);
              }
            }}
            disabled={pendingResetUpcoming || pendingResetPast}
          >
            {pendingResetUpcoming ? "Resetting…" : "Reset all my predictions (upcoming)"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={async () => {
              setActionError(null);
              setResetMessage(null);
              setPendingResetPast(true);
              const res = await resetPastPredictionsAction();
              setPendingResetPast(false);
              if (res.ok) {
                setResetMessage(`Past: ${res.count} prediction(s) reset.`);
                router.refresh();
                setTimeout(() => setResetMessage(null), 4000);
              } else {
                setActionError(res.error);
              }
            }}
            disabled={pendingResetUpcoming || pendingResetPast}
          >
            {pendingResetPast ? "Resetting…" : "Reset all my predictions (past)"}
          </Button>
          {resetMessage && (
            <span className="text-nord-frostDark font-medium">{resetMessage}</span>
          )}
        </div>
      )}

      {currentList.length > 0 && (
        <div className="flex flex-col gap-3 border border-nord-polarLighter/50 border-t-0 bg-nord-snow/50 px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <span className="font-medium text-nord-polar">Filters:</span>
          <label className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start sm:gap-2">
            <span className="text-nord-polarLight">Stage</span>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-nord-polar focus:border-nord-frostDark focus:outline-none focus:ring-1 focus:ring-nord-frostDark sm:flex-none"
            >
              <option value="">All stages</option>
              {stageOptions.map((stage) => (
                <option key={stage} value={stage}>
                  {formatStage(stage)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start sm:gap-2">
            <span className="text-nord-polarLight">Team</span>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-nord-polarLighter bg-white px-3 py-2 text-nord-polar focus:border-nord-frostDark focus:outline-none focus:ring-1 focus:ring-nord-frostDark sm:min-w-[12rem] sm:flex-none"
            >
              <option value="">All teams</option>
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          {(filterStage || filterTeam) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-nord-frostDark hover:underline text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="border border-nord-polarLighter/50 border-t-0 rounded-b-lg overflow-hidden">
        {currentList.length === 0 ? (
          <div className="px-4 py-8 text-center text-nord-polarLight text-sm">
            {activeTab === "upcoming" ? "No upcoming matches." : "No past matches."}
          </div>
        ) : sortedList.length === 0 ? (
          <div className="px-4 py-8 text-center text-nord-polarLight text-sm">
            No matches match the selected filters.
          </div>
        ) : (
          <MatchList list={sortedList} />
        )}
      </div>

      <Modal
        open={!!finalizeModal}
        onClose={() => !pendingFinalizeMatchId && setFinalizeModal(null)}
        title="Finalize prediction?"
        confirmLabel="Yes, finalize"
        cancelLabel="Cancel"
        onConfirm={handleFinalizeConfirm}
        loading={!!pendingFinalizeMatchId}
      >
        {finalizeModal && (
          <p>
            Are you sure you want to finalize your prediction for{" "}
            <strong>{finalizeModal.matchLabel}</strong>? You cannot change it
            after finalizing.
          </p>
        )}
      </Modal>
    </div>
  );
}
