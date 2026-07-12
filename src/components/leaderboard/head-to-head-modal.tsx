"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type {
  HeadToHeadData,
  HeadToHeadPlayer,
  HeadToHeadPrediction,
  HeadToHeadRankPoint,
  HeadToHeadStatus,
} from "@/lib/head-to-head";

const COLOR_A = "#5E81AC";
const COLOR_B = "#BF616A";

function statusChipClass(status: HeadToHeadStatus): string {
  if (status === "correct") return "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25";
  if (status === "incorrect") return "bg-rose-500/10 text-rose-600 ring-rose-500/20";
  return "bg-nord-frostDark/10 text-nord-frostDark ring-nord-frostDark/20";
}

function statusLabel(status: HeadToHeadStatus): string {
  if (status === "correct") return "Correct";
  if (status === "incorrect") return "Incorrect";
  return "Pending";
}

function fullName(player: { name: string; surname: string }): string {
  return `${player.name} ${player.surname}`.trim();
}

function initials(player: { name: string; surname: string }): string {
  return `${player.name?.[0] ?? ""}${player.surname?.[0] ?? ""}`.toUpperCase();
}

function StatRow({
  label,
  a,
  b,
  betterA,
  betterB,
}: {
  label: string;
  a: string;
  b: string;
  betterA: boolean;
  betterB: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2">
      <div
        className={`text-right text-sm tabular-nums ${
          betterA ? "font-extrabold text-nord-polar" : "font-medium text-nord-polarLight"
        }`}
      >
        {a}
      </div>
      <div className="text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-nord-polarLight">
        {label}
      </div>
      <div
        className={`text-left text-sm tabular-nums ${
          betterB ? "font-extrabold text-nord-polar" : "font-medium text-nord-polarLight"
        }`}
      >
        {b}
      </div>
    </div>
  );
}

function RankHistoryChart({ data }: { data: HeadToHeadData }) {
  const points = data.rankHistory;
  // Default ON: chart shows the real ranks (Power Picks counted). Toggling off
  // shows how the two players would rank had neither used Power Picks. State lives
  // here so it persists for as long as the modal (and this chart) stays mounted.
  const [withPowerPick, setWithPowerPick] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(
    points.length > 0 ? points.length - 1 : null,
  );
  if (points.length === 0) {
    return (
      <p className="rounded-xl border border-nord-polarLighter/30 bg-white/70 px-4 py-6 text-center text-xs text-nord-polarLight">
        Not enough completed matches yet to chart rank history.
      </p>
    );
  }

  const rankOf = (p: HeadToHeadRankPoint, side: "a" | "b"): number | null => {
    if (side === "a") return withPowerPick ? p.rankA : p.rankANoPp;
    return withPowerPick ? p.rankB : p.rankBNoPp;
  };

  const width = 340;
  const height = 188;
  const padLeft = 34;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 30;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const rankValues = points.flatMap((p) =>
    [rankOf(p, "a"), rankOf(p, "b")].filter((n): n is number => n != null),
  );
  const minRank = rankValues.length > 0 ? Math.min(...rankValues) : 1;
  const maxRank = rankValues.length > 0 ? Math.max(...rankValues) : 1;
  const rankSpan = maxRank - minRank || 1;

  const xFor = (index: number) =>
    points.length === 1
      ? padLeft + innerW / 2
      : padLeft + (index * innerW) / (points.length - 1);
  // Lower rank number is better → placed higher (smaller y).
  const yFor = (rank: number) => padTop + ((rank - minRank) / rankSpan) * innerH;

  // Evenly spaced integer rank ticks between best and worst (e.g. #1 … #6 … #11).
  const desiredTicks = Math.min(5, maxRank - minRank + 1);
  const tickRanks: number[] = [];
  if (maxRank === minRank) {
    tickRanks.push(minRank);
  } else {
    const step = (maxRank - minRank) / (desiredTicks - 1);
    for (let t = 0; t < desiredTicks; t++) {
      const value = Math.round(minRank + step * t);
      if (!tickRanks.includes(value)) tickRanks.push(value);
    }
    if (!tickRanks.includes(maxRank)) tickRanks.push(maxRank);
  }

  const buildPath = (side: "a" | "b") =>
    points
      .map((p, i) => {
        const rank = rankOf(p, side);
        if (rank == null) return null;
        return `${xFor(i)},${yFor(rank)}`;
      })
      .filter((v): v is string => v != null);

  const pathA = buildPath("a");
  const pathB = buildPath("b");

  const columnLeft = (i: number) =>
    i === 0 ? padLeft - 4 : (xFor(i - 1) + xFor(i)) / 2;
  const columnRight = (i: number) =>
    i === points.length - 1 ? padLeft + innerW + 4 : (xFor(i) + xFor(i + 1)) / 2;

  const activePoint = activeIndex != null ? points[activeIndex] : null;

  return (
    <div className="rounded-2xl border border-nord-polarLighter/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,252,0.92))] p-3 shadow-[0_10px_28px_rgba(46,52,64,0.05)]">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-nord-frostDark">
          Rank journey
        </span>
        <div className="flex items-center gap-3 text-[10px] font-medium text-nord-polarLight">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: COLOR_A }} />
            {data.a.name}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: COLOR_B }} />
            {data.b.name}
          </span>
        </div>
      </div>

      {/* Power Pick impact toggle (default ON = real ranks with Power Picks) */}
      <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-300/40 bg-[linear-gradient(180deg,rgba(255,251,240,0.9),rgba(253,244,222,0.8))] px-3 py-1.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[10px] font-semibold text-[#7a4a00]">
            <span aria-hidden>★</span> Power Pick impact
          </p>
          <p className="text-[9px] leading-tight text-[#8a5a12]">
            {withPowerPick
              ? "Real ranks — Power Picks counted"
              : "Hypothetical — as if no one used Power Picks"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={withPowerPick}
          aria-label="Toggle Power Pick impact on the rank chart"
          onClick={() => setWithPowerPick((v) => !v)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            withPowerPick
              ? "bg-[linear-gradient(135deg,#e08a1e,#f7c948)]"
              : "bg-nord-polarLighter/60"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              withPowerPick ? "translate-x-[1.15rem]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Rank history comparison chart"
      >
        {/* Horizontal rank gridlines + ticks */}
        {tickRanks.map((rank) => (
          <g key={`tick-${rank}`}>
            <line
              x1={padLeft}
              y1={yFor(rank)}
              x2={padLeft + innerW}
              y2={yFor(rank)}
              stroke="rgba(76,86,106,0.1)"
              strokeWidth="1"
            />
            <text
              x={padLeft - 6}
              y={yFor(rank) + 3}
              textAnchor="end"
              className="fill-nord-polarLight"
              fontSize="9"
            >
              #{rank}
            </text>
          </g>
        ))}
        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + innerH}
          stroke="rgba(76,86,106,0.18)"
          strokeWidth="1"
        />

        {/* Active guide line */}
        {activeIndex != null ? (
          <line
            x1={xFor(activeIndex)}
            y1={padTop}
            x2={xFor(activeIndex)}
            y2={padTop + innerH}
            stroke="rgba(76,86,106,0.3)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}

        {pathB.length > 1 ? (
          <polyline
            points={pathB.join(" ")}
            fill="none"
            stroke={COLOR_B}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {pathA.length > 1 ? (
          <polyline
            points={pathA.join(" ")}
            fill="none"
            stroke={COLOR_A}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {points.map((p, i) => {
          const isActive = i === activeIndex;
          const rA = rankOf(p, "a");
          const rB = rankOf(p, "b");
          return (
            <g key={`${p.label}-${i}`}>
              {rB != null ? (
                <circle
                  cx={xFor(i)}
                  cy={yFor(rB)}
                  r={isActive ? 4.6 : 3.2}
                  fill={COLOR_B}
                  stroke="#fff"
                  strokeWidth={isActive ? 1.4 : 0}
                />
              ) : null}
              {rA != null ? (
                <circle
                  cx={xFor(i)}
                  cy={yFor(rA)}
                  r={isActive ? 4.6 : 3.2}
                  fill={COLOR_A}
                  stroke="#fff"
                  strokeWidth={isActive ? 1.4 : 0}
                />
              ) : null}
              <text
                x={xFor(i)}
                y={height - 10}
                textAnchor="middle"
                className={isActive ? "fill-nord-polar" : "fill-nord-polarLight"}
                fontSize="9"
                fontWeight={isActive ? 700 : 400}
              >
                {p.matchIndex}
              </text>
              {/* Wide invisible hit area for tapping this milestone. */}
              <rect
                x={columnLeft(i)}
                y={padTop}
                width={Math.max(1, columnRight(i) - columnLeft(i))}
                height={innerH}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={() => setActiveIndex((prev) => (prev === i ? null : i))}
              />
            </g>
          );
        })}
      </svg>

      {/* Selected-point rank readout */}
      {activePoint ? (
        <div className="mt-1 flex items-center justify-center gap-4 rounded-lg border border-nord-polarLighter/25 bg-white/80 px-3 py-1.5 text-[11px]">
          <span className="font-semibold text-nord-polarLight">
            After {activePoint.matchIndex} matches
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-nord-polar">
            <span className="h-2 w-2 rounded-full" style={{ background: COLOR_A }} />
            {data.a.name}:{" "}
            {rankOf(activePoint, "a") != null ? `#${rankOf(activePoint, "a")}` : "–"}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-nord-polar">
            <span className="h-2 w-2 rounded-full" style={{ background: COLOR_B }} />
            {data.b.name}:{" "}
            {rankOf(activePoint, "b") != null ? `#${rankOf(activePoint, "b")}` : "–"}
          </span>
        </div>
      ) : null}

      <p className="mt-1 text-center text-[9px] text-nord-polarLight">
        {withPowerPick
          ? "Tap a point to see both ranks · position after N completed matches (top = better)."
          : "Power Picks removed league-wide · tap a point to compare their would-be ranks."}
      </p>
    </div>
  );
}

function RecentColumn({
  player,
  accent,
}: {
  player: HeadToHeadPlayer;
  accent: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: accent }}
        >
          {initials(player)}
        </span>
        <span className="truncate text-xs font-semibold text-nord-polar">
          {fullName(player)}
        </span>
      </div>
      {player.recent.length === 0 ? (
        <p className="rounded-lg border border-nord-polarLighter/30 bg-white/70 px-3 py-4 text-center text-[11px] text-nord-polarLight">
          No predictions yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {player.recent.map((p: HeadToHeadPrediction) => (
            <li
              key={p.id}
              className="rounded-lg border border-nord-polarLighter/30 bg-white/85 px-2.5 py-1.5 shadow-[0_3px_10px_rgba(46,52,64,0.03)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-semibold text-nord-polar">
                  {p.matchLabel}
                </span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ring-1 ${statusChipClass(
                    p.status,
                  )}`}
                >
                  {statusLabel(p.status)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-nord-polarLight">
                <span className="rounded bg-nord-frostDark/8 px-1.5 py-0.5 font-semibold text-nord-frostDark">
                  {p.stageLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-nord-polarLighter/40 bg-white px-1.5 py-0.5 font-semibold text-nord-polar">
                  Pick {p.pick}
                </span>
                {p.isPowerPick ? (
                  <span className="rounded bg-[linear-gradient(135deg,#f7c948,#e08a1e)] px-1.5 py-0.5 font-bold text-white">
                    ★ {p.powerPickMultiplier ?? 3} pts
                  </span>
                ) : null}
                {p.scoreLabel ? (
                  <span className="ml-auto tabular-nums font-semibold text-nord-polar">
                    {p.scoreLabel}
                  </span>
                ) : (
                  <span className="ml-auto">{p.playedLabel}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HeadToHeadModal({
  open,
  onClose,
  loading,
  error,
  data,
  fallbackNames,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: HeadToHeadData | null;
  fallbackNames: { a: string; b: string };
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      // Height is pinned to the DYNAMIC viewport (dvh) rather than inset-0 (which
      // resolves to the large viewport). On mobile the browser toolbar shrinks the
      // visible area; using dvh keeps the bottom-sheet aligned to the *visible*
      // bottom so the header (names + close) never overflows above the screen.
      className="fixed inset-x-0 top-0 z-[130] flex h-[100dvh] items-end justify-center bg-nord-polar/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Head to head comparison"
    >
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(241,245,252,0.97))] shadow-[0_30px_90px_rgba(46,52,64,0.3)] sm:rounded-3xl">
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-nord-polarLighter/25 px-4 py-4 sm:px-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(circle at 15% 0%, rgba(94,129,172,0.12), transparent 55%), radial-gradient(circle at 85% 0%, rgba(191,97,86,0.1), transparent 55%)",
            }}
            aria-hidden
          />
          <div className="relative flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-nord-frostDark">
              Head to head
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-nord-polarLighter/40 bg-white/80 text-nord-polarLight transition-colors hover:text-nord-polar"
              aria-label="Close comparison"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
          <div className="relative mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="min-w-0 text-right">
              <div className="truncate text-sm font-bold text-nord-polar sm:text-base">
                {data ? fullName(data.a) : fallbackNames.a}
              </div>
              {data?.a.rank != null ? (
                <div className="text-[11px] font-medium text-nord-polarLight">Rank #{data.a.rank}</div>
              ) : null}
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-[linear-gradient(135deg,#5E81AC,#4C566A)] text-sm font-black uppercase tracking-tight text-white shadow-[0_10px_24px_rgba(46,52,64,0.28)]">
              VS
            </div>
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-bold text-nord-polar sm:text-base">
                {data ? fullName(data.b) : fallbackNames.b}
              </div>
              {data?.b.rank != null ? (
                <div className="text-[11px] font-medium text-nord-polarLight">Rank #{data.b.rank}</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-nord-polarLight">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-nord-frostDark/30 border-t-nord-frostDark" />
              Building comparison…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
              {error}
            </div>
          ) : data ? (
            <div className="space-y-5">
              {/* Stat comparison */}
              <div className="rounded-2xl border border-nord-polarLighter/30 bg-white/80 px-4 py-2 shadow-[0_8px_22px_rgba(46,52,64,0.04)]">
                <StatRow
                  label="Predictions"
                  a={String(data.a.totalPredictions)}
                  b={String(data.b.totalPredictions)}
                  betterA={data.a.totalPredictions > data.b.totalPredictions}
                  betterB={data.b.totalPredictions > data.a.totalPredictions}
                />
                <StatRow
                  label="Correct"
                  a={String(data.a.correct)}
                  b={String(data.b.correct)}
                  betterA={data.a.correct > data.b.correct}
                  betterB={data.b.correct > data.a.correct}
                />
                <StatRow
                  label="Accuracy"
                  a={data.a.accuracyLabel}
                  b={data.b.accuracyLabel}
                  betterA={
                    data.a.completedMatches > 0 &&
                    data.a.correct / Math.max(1, data.a.completedMatches) >
                      data.b.correct / Math.max(1, data.b.completedMatches)
                  }
                  betterB={
                    data.b.completedMatches > 0 &&
                    data.b.correct / Math.max(1, data.b.completedMatches) >
                      data.a.correct / Math.max(1, data.a.completedMatches)
                  }
                />
                <StatRow
                  label="Power Pick hits"
                  a={data.a.powerPickUsed > 0 ? `${data.a.powerPickHits}/${data.a.powerPickUsed}` : "–"}
                  b={data.b.powerPickUsed > 0 ? `${data.b.powerPickHits}/${data.b.powerPickUsed}` : "–"}
                  betterA={data.a.powerPickHits > data.b.powerPickHits}
                  betterB={data.b.powerPickHits > data.a.powerPickHits}
                />
                <StatRow
                  label="Points"
                  a={String(data.a.points)}
                  b={String(data.b.points)}
                  betterA={data.a.points > data.b.points}
                  betterB={data.b.points > data.a.points}
                />
              </div>

              <RankHistoryChart data={data} />

              {/* Last 10 predictions */}
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-nord-frostDark">
                  Last 10 predictions
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <RecentColumn player={data.a} accent={COLOR_A} />
                  <RecentColumn player={data.b} accent={COLOR_B} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
