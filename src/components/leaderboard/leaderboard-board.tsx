"use client";

import { useCallback, useState } from "react";
import type {
  LeaderboardBoardData,
  LeaderboardBoardEntry,
} from "@/lib/leaderboard";
import type { HeadToHeadData } from "@/lib/head-to-head";
import { getHeadToHeadAction } from "@/app/(app)/leaderboard/actions";
import { RecentPredictionsStrip } from "./recent-predictions-strip";
import { HeadToHeadModal } from "./head-to-head-modal";

type ColumnLabels = {
  rank: string;
  name: string;
  predictions: string;
  completed: string;
  correct: string;
  accuracy: string;
  points: string;
  lastFive: string;
  mobilePredictions: string;
  mobileCompleted: string;
  mobileCorrect: string;
  mobileAccuracy: string;
  mobilePoints: string;
};

const DEFAULT_LABELS: ColumnLabels = {
  rank: "Rank",
  name: "Name",
  predictions: "Predictions",
  completed: "Matches completed",
  correct: "Correct picks",
  accuracy: "Accuracy",
  points: "Points",
  lastFive: "Last 5",
  mobilePredictions: "Pred.",
  mobileCompleted: "Done",
  mobileCorrect: "Correct",
  mobileAccuracy: "Acc.",
  mobilePoints: "Pts",
};

function MedalMiniIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="5.5" r="3.25" />
      <path d="M6.1 8.1 4.5 13l3.5-1.8L11.5 13 9.9 8.1" />
    </svg>
  );
}

function TopPlacementBadge({ place }: { place?: 1 | 2 | 3 }) {
  if (!place) return null;

  const config: Record<
    1 | 2 | 3,
    { label: string; className: string }
  > = {
    1: {
      label: "1st",
      className:
        "border-amber-200/90 bg-amber-50 text-amber-700 ring-amber-100/80",
    },
    2: {
      label: "2nd",
      className:
        "border-slate-200/90 bg-slate-50 text-slate-600 ring-slate-100/80",
    },
    3: {
      label: "3rd",
      className:
        "border-orange-200/90 bg-orange-50 text-orange-700 ring-orange-100/80",
    },
  };

  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border shadow-sm ring-1 ${config[place].className}`}
      title={`${config[place].label} place`}
      aria-label={`${config[place].label} place`}
    >
      <MedalMiniIcon className="h-3.5 w-3.5" />
    </span>
  );
}

function VsInfoButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="How head-to-head comparison works"
        className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-semibold transition-colors ${
          open
            ? "border-nord-frostDark/40 bg-nord-frostDark/[0.06] text-nord-polar"
            : "border-nord-polarLighter/40 bg-white/80 text-nord-polarLight hover:text-nord-polar"
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[linear-gradient(135deg,#5E81AC,#4C566A)] text-[8.5px] font-black uppercase tracking-tight text-white">
          VS
        </span>
        How it works
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7.4v3.2M8 5.1h.01" />
        </svg>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-[80] mt-2 w-72 overflow-hidden rounded-2xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(244,247,252,0.97))] p-3.5 shadow-[0_22px_60px_rgba(46,52,64,0.22)] ring-1 ring-nord-polarLighter/20">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#5E81AC,#4C566A)] text-[10px] font-black uppercase text-white shadow-[0_6px_16px_rgba(46,52,64,0.25)]">
                VS
              </span>
              <span className="text-sm font-bold text-nord-polar">Head-to-head</span>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-nord-polarLight">
              Compare any two players side by side. Tap one player&apos;s row, then a
              second row — a <span className="font-semibold text-nord-polar">VS</span> button
              appears at the bottom. Open it to see total predictions, correct calls,
              accuracy, Power Pick hits, points, each player&apos;s last 10 results, and a
              rank-journey chart of how their standings changed over the tournament.
            </p>
            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-nord-frostDark/15 bg-nord-frostDark/[0.04] px-2.5 py-1.5 text-[11px] text-nord-frostDark">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-nord-frostDark/12 text-[9px] font-bold">
                1
              </span>
              Tap two players, then hit VS to compare.
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SelectionBadge({ order }: { order: number }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#5E81AC,#4C566A)] text-[10px] font-bold text-white shadow-[0_3px_8px_rgba(46,52,64,0.25)]"
      aria-label={`Selected for comparison, position ${order}`}
    >
      {order}
    </span>
  );
}

function ordinalPrizeLabel(place: number): string {
  const suffix =
    place % 10 === 1 && place % 100 !== 11
      ? "st"
      : place % 10 === 2 && place % 100 !== 12
        ? "nd"
        : place % 10 === 3 && place % 100 !== 13
          ? "rd"
          : "th";
  return `${place}${suffix} Prize`;
}

function PrizeGrid({ data }: { data: LeaderboardBoardData }) {
  if (data.prizes.length === 0) return null;

  return (
    <div
      className="grid grid-cols-3 gap-2 sm:gap-3"
      role="list"
      aria-label="Prizes for leaderboard places"
    >
      {data.prizes.map((prize) => {
        const placeSurface =
          prize.place === 1
            ? "border-amber-200/75 bg-[linear-gradient(168deg,rgba(255,251,235,0.97),rgba(255,255,255,0.93),rgba(254,243,199,0.2))] shadow-[0_14px_40px_rgba(180,130,40,0.09)] ring-1 ring-amber-100/70"
            : prize.place === 2
              ? "border-slate-200/85 bg-[linear-gradient(168deg,rgba(248,250,252,0.98),rgba(255,255,255,0.95),rgba(226,232,240,0.35))] shadow-[0_12px_36px_rgba(46,52,64,0.07)] ring-1 ring-slate-200/50"
              : prize.place === 3
                ? "border-orange-100/90 bg-[linear-gradient(168deg,rgba(255,247,237,0.97),rgba(255,255,255,0.93),rgba(255,237,213,0.45))] shadow-[0_12px_36px_rgba(180,90,40,0.07)] ring-1 ring-orange-100/55"
                : "border-nord-polarLighter/45 bg-[linear-gradient(168deg,rgba(255,255,255,0.96),rgba(241,245,252,0.9))] shadow-[0_10px_28px_rgba(46,52,64,0.05)] ring-1 ring-white/80";

        return (
          <article
            key={prize.id}
            role="listitem"
            className={`group relative min-w-0 overflow-hidden rounded-[0.85rem] border ${placeSurface} sm:rounded-2xl`}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-50 bg-[radial-gradient(ellipse_at_35%_-10%,rgba(255,255,255,0.95),transparent_58%)]"
              aria-hidden
            />
            <div className="relative flex min-h-[4.5rem] flex-col justify-between px-2 py-2 sm:min-h-0 sm:px-4 sm:py-4">
              <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-nord-frostDark sm:text-[11px] sm:tracking-[0.18em]">
                {ordinalPrizeLabel(prize.place)}
              </div>
              {prize.description?.trim() ? (
                <p className="mt-1.5 line-clamp-2 text-lg font-extrabold leading-none tracking-tight text-nord-polar sm:mt-3 sm:text-3xl">
                  {prize.description}
                </p>
              ) : (
                <p className="mt-1.5 line-clamp-2 text-sm font-bold leading-tight tracking-tight text-nord-polar sm:mt-3 sm:text-xl">
                  {prize.title}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function LeaderboardMobileCard({
  entry,
  labels,
  highlightAccuracy,
  highlightPoints,
  selectionOrder,
  selectable,
  onSelect,
}: {
  entry: LeaderboardBoardEntry;
  labels: ColumnLabels;
  highlightAccuracy: boolean;
  highlightPoints: boolean;
  selectionOrder: number | null;
  selectable: boolean;
  onSelect: (userId: string) => void;
}) {
  const isSelected = selectionOrder != null;
  return (
    <li
      key={`${entry.userId}-${entry.competitionId}-mobile`}
      onClick={selectable ? () => onSelect(entry.userId) : undefined}
      className={`rounded-xl border bg-white/85 px-4 py-3 shadow-sm transition-shadow ${
        entry.isAdminRow ? "bg-nord-snow/80" : ""
      } ${
        isSelected
          ? "border-nord-frostDark/60 ring-2 ring-nord-frostDark/30 shadow-[0_10px_28px_rgba(94,129,172,0.18)]"
          : "border-nord-polarLighter/35"
      } ${selectable ? "cursor-pointer active:scale-[0.995]" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-nord-polarLight">
            {entry.isAdminRow ? "Admin row" : `Rank #${entry.rank}`}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="min-w-0 truncate font-semibold text-nord-polar">
              {entry.name} {entry.surname}
            </div>
            {selectionOrder != null ? <SelectionBadge order={selectionOrder} /> : null}
            {!entry.isAdminRow ? (
              <TopPlacementBadge place={entry.podiumPlace} />
            ) : null}
          </div>
          {entry.isAdminRow ? (
            <div className="mt-1 text-xs text-nord-polarLight">
              Not visible to other users
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1 border-t border-nord-polarLighter/20 pt-3 text-center">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-nord-polarLight">
            {labels.mobilePredictions}
          </div>
          <div className="mt-0.5 text-xs font-medium tabular-nums text-nord-polar sm:text-sm">
            {entry.finalizedPredictionCount}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-nord-polarLight">
            {labels.mobileCompleted}
          </div>
          <div className="mt-0.5 text-xs font-medium tabular-nums text-nord-polar sm:text-sm">
            {entry.completedMatchCount}
          </div>
        </div>
        <div title="Correct picks — finalized 1/X/2 choices that matched the official result">
          <div className="text-[9px] uppercase tracking-wide text-nord-polarLight">
            {labels.mobileCorrect}
          </div>
          <div className="mt-0.5 text-xs font-medium tabular-nums text-nord-polar sm:text-sm">
            {entry.correctCalls}
          </div>
        </div>
        <div
          title="Correct picks ÷ matches completed (predictions on not-yet-played matches don't count)."
          className={
            highlightAccuracy
              ? "rounded-md border border-emerald-200 bg-emerald-50/80 px-0.5 py-0.5 shadow-[0_8px_18px_rgba(16,185,129,0.10)]"
              : ""
          }
        >
          <div className="text-[9px] uppercase tracking-wide text-nord-polarLight">
            {labels.mobileAccuracy}
          </div>
          <div
            className={`mt-0.5 text-xs font-medium tabular-nums sm:text-sm ${
              highlightAccuracy ? "font-extrabold text-emerald-700" : "text-nord-polar"
            }`}
          >
            {entry.accuracyLabel}
          </div>
        </div>
        <div
          className={`rounded-md px-0.5 py-0.5 ${
            highlightPoints
              ? "border border-amber-200 bg-amber-50/90 shadow-[0_8px_18px_rgba(245,158,11,0.12)]"
              : "bg-nord-frostDark/8"
          }`}
        >
          <div className="text-[9px] uppercase tracking-wide text-nord-polarLight">
            {labels.mobilePoints}
          </div>
          <div
            className={`mt-0.5 text-xs font-semibold tabular-nums sm:text-sm ${
              highlightPoints ? "font-extrabold text-amber-700" : "text-nord-frostDark"
            }`}
          >
            {entry.totalPoints}
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-nord-polarLighter/20 pt-3">
        <div className="text-[11px] uppercase tracking-wide text-nord-polarLight">
          {labels.lastFive} (new to old)
        </div>
        <div className="mt-2">
          <RecentPredictionsStrip predictions={entry.recentPredictions} />
        </div>
      </div>
    </li>
  );
}

export function LeaderboardBoard({
  data,
  emptyMessage,
  labels,
  showPrizes = true,
  showAdminNotes = true,
}: {
  data: LeaderboardBoardData;
  emptyMessage?: string;
  labels?: Partial<ColumnLabels>;
  showPrizes?: boolean;
  showAdminNotes?: boolean;
}) {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const publicEntries = data.entries.filter((entry) => !entry.isAdminRow);
  const averagePredictions =
    publicEntries.length > 0
      ? publicEntries.reduce((sum, entry) => sum + entry.finalizedPredictionCount, 0) /
        publicEntries.length
      : 0;
  const highlightEligible = publicEntries.filter(
    (entry) => entry.finalizedPredictionCount > averagePredictions
  );
  const bestAccuracy =
    highlightEligible.length > 0
      ? Math.max(
          ...highlightEligible.map((entry) =>
            entry.completedMatchCount > 0 ? entry.correctCalls / entry.completedMatchCount : -1
          )
        )
      : -1;
  const bestPoints =
    highlightEligible.length > 0
      ? Math.max(...highlightEligible.map((entry) => entry.totalPoints))
      : -1;
  const isAccuracyHighlighted = (entry: LeaderboardBoardEntry) =>
    !entry.isAdminRow &&
    bestAccuracy >= 0 &&
    entry.finalizedPredictionCount > averagePredictions &&
    entry.completedMatchCount > 0 &&
    entry.correctCalls / entry.completedMatchCount === bestAccuracy;
  const isPointsHighlighted = (entry: LeaderboardBoardEntry) =>
    !entry.isAdminRow &&
    bestPoints >= 0 &&
    entry.finalizedPredictionCount > averagePredictions &&
    entry.totalPoints === bestPoints;

  const nameByUserId = new Map(
    data.entries.map((entry) => [entry.userId, `${entry.name} ${entry.surname}`.trim()]),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [h2hOpen, setH2hOpen] = useState(false);
  const [h2hLoading, setH2hLoading] = useState(false);
  const [h2hError, setH2hError] = useState<string | null>(null);
  const [h2hData, setH2hData] = useState<HeadToHeadData | null>(null);

  const toggleSelect = useCallback((userId: string) => {
    setSelected((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      if (prev.length >= 2) return [userId];
      return [...prev, userId];
    });
  }, []);

  const selectionOrderOf = (userId: string): number | null => {
    const index = selected.indexOf(userId);
    return index === -1 ? null : index + 1;
  };

  const clearSelection = useCallback(() => setSelected([]), []);

  const openHeadToHead = useCallback(async () => {
    if (selected.length !== 2) return;
    const [a, b] = selected;
    setH2hOpen(true);
    setH2hLoading(true);
    setH2hError(null);
    setH2hData(null);
    try {
      const result = await getHeadToHeadAction(a, b, data.competitionId);
      if (result.ok) {
        setH2hData(result.data);
      } else {
        setH2hError(result.error);
      }
    } catch {
      setH2hError("Could not load the comparison. Please try again.");
    } finally {
      setH2hLoading(false);
    }
  }, [selected, data.competitionId]);

  return (
    <div>
      {showAdminNotes && data.hasAdminRows ? (
        <div className="mb-3 rounded-lg border border-nord-polarLighter/25 bg-nord-snow/60 px-4 py-3 text-sm text-nord-polarLight">
          Admin entries are shown at the bottom for testing only; other users do not
          see them.
          {data.adminHasLiveRow ? (
            <span className="mt-1 block">
              Your row is computed from your predictions. Run{" "}
              <strong>Recalculate scores & leaderboard</strong> in Admin → Scoring to
              update the stored board.
            </span>
          ) : null}
        </div>
      ) : null}

      {showPrizes ? <PrizeGrid data={data} /> : null}

      <div className={showPrizes ? "mt-4" : ""}>
        {data.entries.length === 0 ? (
          <p className="text-sm text-nord-polarLight">
            {emptyMessage ??
              'No leaderboard data yet. Make predictions and run "Recalculate scores & leaderboard" in the admin panel.'}
          </p>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-nord-polarLight">
                Rankings
              </span>
              <VsInfoButton />
            </div>
            <ul className="space-y-3 sm:hidden">
              {data.entries.map((entry) => (
                <LeaderboardMobileCard
                  key={`${entry.userId}-${entry.competitionId}-mobile`}
                  entry={entry}
                  labels={mergedLabels}
                  highlightAccuracy={isAccuracyHighlighted(entry)}
                  highlightPoints={isPointsHighlighted(entry)}
                  selectable={!entry.isAdminRow}
                  selectionOrder={selectionOrderOf(entry.userId)}
                  onSelect={toggleSelect}
                />
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-nord-polarLighter text-left text-nord-polarLight">
                    <th className="pb-2 pr-4">{mergedLabels.rank}</th>
                    <th className="pb-2 pr-4">{mergedLabels.name}</th>
                    <th className="pb-2 pr-4">{mergedLabels.predictions}</th>
                    <th className="pb-2 pr-4">{mergedLabels.completed}</th>
                    <th
                      className="pb-2 pr-4"
                      title="Number of finalized picks that matched the official result (1 / X / 2)."
                    >
                      {mergedLabels.correct}
                    </th>
                    <th
                      className="pb-2 pr-4"
                      title="Correct picks ÷ matches completed (predictions on not-yet-played matches don't count)."
                    >
                      {mergedLabels.accuracy}
                    </th>
                    <th className="pb-2 pr-4">{mergedLabels.points}</th>
                    <th className="pb-2">{mergedLabels.lastFive}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => {
                    const highlightAccuracy = isAccuracyHighlighted(entry);
                    const highlightPoints = isPointsHighlighted(entry);
                    const selectable = !entry.isAdminRow;
                    const selectionOrder = selectionOrderOf(entry.userId);
                    return (
                    <tr
                      key={`${entry.userId}-${entry.competitionId}`}
                      onClick={selectable ? () => toggleSelect(entry.userId) : undefined}
                      className={`border-b border-nord-polarLighter/50 transition-colors ${
                        entry.isAdminRow ? "bg-nord-snow/60" : ""
                      } ${
                        selectionOrder != null
                          ? "bg-nord-frostDark/[0.06] ring-1 ring-inset ring-nord-frostDark/25"
                          : selectable
                            ? "hover:bg-nord-snow/50"
                            : ""
                      } ${selectable ? "cursor-pointer" : ""}`}
                    >
                      <td className="py-3 pr-4 font-medium text-nord-polar">
                        {entry.rank ?? "–"}
                      </td>
                      <td className="py-3 pr-4 text-nord-polar">
                        <div className="flex items-center gap-2">
                          <span>
                            {entry.name} {entry.surname}
                          </span>
                          {selectionOrder != null ? (
                            <SelectionBadge order={selectionOrder} />
                          ) : null}
                          {!entry.isAdminRow ? (
                            <TopPlacementBadge place={entry.podiumPlace} />
                          ) : null}
                        </div>
                        {entry.isAdminRow ? (
                          <span className="ml-2 text-xs text-nord-polarLight">
                            (Admin – not visible to others)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 text-nord-polarLight">
                        {entry.finalizedPredictionCount}
                      </td>
                      <td className="py-3 pr-4 text-nord-polarLight">
                        {entry.completedMatchCount}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-nord-polarLight">
                        {entry.correctCalls}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 tabular-nums ${
                            highlightAccuracy
                              ? "border border-emerald-200 bg-emerald-50 font-extrabold text-emerald-700 shadow-[0_8px_18px_rgba(16,185,129,0.10)] ring-1 ring-emerald-100"
                              : "text-nord-polar"
                          }`}
                        >
                          {entry.accuracyLabel}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 tabular-nums ${
                            highlightPoints
                              ? "border border-amber-200 bg-amber-50 font-extrabold text-amber-700 shadow-[0_8px_18px_rgba(245,158,11,0.12)] ring-1 ring-amber-100"
                              : "font-medium text-nord-polar"
                          }`}
                        >
                          {entry.totalPoints}
                        </span>
                      </td>
                      <td className="py-3">
                        <RecentPredictionsStrip
                          predictions={entry.recentPredictions}
                        />
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            {highlightEligible.length > 0 ? (
              <p className="mt-3 rounded-full border border-nord-polarLighter/25 bg-white/75 px-4 py-2 text-[11px] leading-5 text-nord-polarLight shadow-[0_10px_28px_rgba(46,52,64,0.04)]">
                Highlighted Accuracy and Points belong to users above the average prediction count, then show the best rate and score within that active group.
              </p>
            ) : null}
            <p className="mt-3 rounded-full border border-nord-frostDark/15 bg-nord-frostDark/[0.04] px-4 py-2 text-center text-[11px] leading-5 text-nord-frostDark">
              Tip: tap any two players to compare them head to head.
            </p>
          </>
        )}
      </div>

      {selected.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex justify-center px-4 sm:bottom-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/70 bg-white/95 py-2 pl-3 pr-2 shadow-[0_18px_48px_rgba(46,52,64,0.22)] ring-1 ring-nord-polarLighter/30 backdrop-blur">
            <button
              type="button"
              onClick={openHeadToHead}
              disabled={selected.length !== 2}
              className={`group flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition ${
                selected.length === 2
                  ? "cursor-pointer hover:bg-nord-snow/70"
                  : "cursor-not-allowed opacity-70"
              }`}
              aria-label="Open head to head comparison"
            >
              <span className="flex flex-col items-center leading-tight">
                <span className="max-w-[7rem] truncate text-[10px] font-semibold text-nord-polar">
                  {nameByUserId.get(selected[0]) ?? "Player 1"}
                </span>
                <span className="text-base font-black uppercase tracking-tight text-nord-frostDark">
                  VS
                </span>
                <span className="max-w-[7rem] truncate text-[10px] font-semibold text-nord-polarLight">
                  {selected.length === 2
                    ? nameByUserId.get(selected[1]) ?? "Player 2"
                    : "Pick a rival"}
                </span>
              </span>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-white shadow-[0_8px_20px_rgba(46,52,64,0.28)] ${
                  selected.length === 2
                    ? "bg-[linear-gradient(135deg,#5E81AC,#4C566A)]"
                    : "bg-nord-polarLighter"
                }`}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-nord-polarLighter/40 bg-white text-nord-polarLight transition-colors hover:text-nord-polar"
              aria-label="Clear selection"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      <HeadToHeadModal
        open={h2hOpen}
        onClose={() => setH2hOpen(false)}
        loading={h2hLoading}
        error={h2hError}
        data={h2hData}
        fallbackNames={{
          a: nameByUserId.get(selected[0] ?? "") ?? "Player 1",
          b: nameByUserId.get(selected[1] ?? "") ?? "Player 2",
        }}
      />
    </div>
  );
}
