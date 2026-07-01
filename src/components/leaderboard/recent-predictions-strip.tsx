"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LeaderboardRecentPredictionItem } from "@/lib/leaderboard";

type MarkerStatus = LeaderboardRecentPredictionItem["status"] | "empty";

type StripItem = {
  id: string;
  status: MarkerStatus;
  isPowerPick: boolean;
  powerPickMultiplier?: number | null;
  pick?: string;
  matchLabel?: string;
  stageLabel?: string;
  scoreLabel?: string | null;
  statusLabel?: string;
  finalizedLabel?: string;
  label: string;
};

function CheckMiniIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 8l2.5 2.5 6-6" />
    </svg>
  );
}

function CrossMiniIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 5l6 6M11 5l-6 6" />
    </svg>
  );
}

const TOOLTIP_MAX_WIDTH = 240;
const TOOLTIP_VIEWPORT_MARGIN = 12;

function markerVisuals(
  status: MarkerStatus,
  isPowerPick: boolean,
  powerPickMultiplier?: number | null
) {
  if (status === "correct") {
    if (isPowerPick) {
      return {
        className:
          "bg-[linear-gradient(135deg,#f7c948,#e08a1e)] text-[10px] font-bold text-white ring-amber-300/60",
        content: <>×{powerPickMultiplier ?? 3}</>,
      };
    }
    return {
      className: "bg-emerald-500/12 text-emerald-600 ring-emerald-500/25",
      content: <CheckMiniIcon className="h-3.5 w-3.5" />,
    };
  }
  if (status === "incorrect") {
    return {
      className: "bg-rose-500/10 text-rose-500 ring-rose-500/20",
      content: <CrossMiniIcon className="h-3.5 w-3.5" />,
    };
  }
  if (status === "pending") {
    return {
      className: "bg-nord-frostDark/10 text-nord-frostDark ring-nord-frostDark/20",
      content: <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />,
    };
  }
  return {
    className: "bg-transparent text-nord-polarLighter/25 ring-nord-polarLighter/15",
    content: null,
  };
}

function statusPillClass(status: MarkerStatus): string {
  if (status === "correct") return "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25";
  if (status === "incorrect") return "bg-rose-500/10 text-rose-600 ring-rose-500/20";
  if (status === "pending") return "bg-nord-frostDark/10 text-nord-frostDark ring-nord-frostDark/20";
  return "bg-nord-polarLighter/15 text-nord-polarLight ring-nord-polarLighter/20";
}

function PredictionTooltip({
  item,
  anchor,
}: {
  item: StripItem;
  anchor: DOMRect;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const viewportWidth = window.innerWidth;
  const tooltipWidth = Math.min(
    TOOLTIP_MAX_WIDTH,
    Math.max(180, viewportWidth - TOOLTIP_VIEWPORT_MARGIN * 2)
  );
  const anchorCenter = anchor.left + anchor.width / 2;
  const minCenter = TOOLTIP_VIEWPORT_MARGIN + tooltipWidth / 2;
  const maxCenter = viewportWidth - TOOLTIP_VIEWPORT_MARGIN - tooltipWidth / 2;
  const left = Math.min(Math.max(anchorCenter, minCenter), maxCenter);
  const arrowLeft = Math.min(
    Math.max(anchorCenter - (left - tooltipWidth / 2), 18),
    tooltipWidth - 18
  );
  const top = anchor.top;

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[120] -translate-y-full pb-2"
      style={{ left: left - tooltipWidth / 2, top, width: tooltipWidth }}
    >
      <div className="w-full overflow-hidden rounded-2xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,252,0.96))] p-3 shadow-[0_22px_60px_rgba(46,52,64,0.22)] ring-1 ring-nord-polarLighter/15 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          {item.stageLabel ? (
            <span className="rounded-full bg-nord-frostDark/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-nord-frostDark">
              {item.stageLabel}
            </span>
          ) : (
            <span />
          )}
          {item.statusLabel ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ring-1 ${statusPillClass(
                item.status,
              )}`}
            >
              {item.statusLabel}
            </span>
          ) : null}
        </div>

        <div className="mt-2 text-sm font-semibold leading-snug text-nord-polar">
          {item.matchLabel ?? item.label}
        </div>

        <div className="mt-2 flex items-center gap-2">
          {item.pick ? (
            <span className="inline-flex items-center gap-1 rounded-lg border border-nord-polarLighter/50 bg-white px-2 py-1 text-xs font-semibold text-nord-polar">
              Pick
              <span className="text-nord-frostDark">{item.pick}</span>
            </span>
          ) : null}
          {item.isPowerPick ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-[linear-gradient(135deg,#f7c948,#e08a1e)] px-2 py-1 text-xs font-bold text-white shadow-sm">
              ★ x{item.powerPickMultiplier ?? 3}
            </span>
          ) : null}
          {item.scoreLabel ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-nord-snow px-2 py-1 text-xs font-semibold tabular-nums text-nord-polar">
              {item.scoreLabel}
            </span>
          ) : null}
        </div>

        {item.finalizedLabel ? (
          <div className="mt-2 border-t border-nord-polarLighter/20 pt-1.5 text-[10px] text-nord-polarLight">
            Finalized {item.finalizedLabel}
          </div>
        ) : null}
      </div>
      <div
        className="absolute top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-[7px] rotate-45 border-b border-r border-white/70 bg-[rgba(244,247,252,0.96)]"
        style={{ left: arrowLeft }}
        aria-hidden
      />
    </div>,
    document.body,
  );
}

export function RecentPredictionsStrip({
  predictions,
}: {
  predictions: LeaderboardRecentPredictionItem[];
}) {
  const visiblePredictions = predictions.slice(0, 5);
  const items: StripItem[] = [
    ...Array.from({ length: Math.max(0, 5 - visiblePredictions.length) }, (_, index) => ({
      id: `empty-${index}`,
      status: "empty" as const,
      label: "No prediction yet",
      isPowerPick: false,
    })),
    ...visiblePredictions,
  ];

  const [active, setActive] = useState<{ item: StripItem; rect: DOMRect } | null>(null);
  const closeTimer = useRef<number | null>(null);

  const show = useCallback((item: StripItem, target: HTMLElement) => {
    if (item.status === "empty") return;
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setActive({ item, rect: target.getBoundingClientRect() });
  }, []);

  const hide = useCallback(() => {
    closeTimer.current = window.setTimeout(() => setActive(null), 60);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <div
      className="flex items-center gap-1.5 whitespace-nowrap"
      aria-label="Last 5 predictions, left to right from newest to oldest"
    >
      {items.map((item, index) => {
        const visuals = markerVisuals(item.status, item.isPowerPick, item.powerPickMultiplier);
        const isInteractive = item.status !== "empty";
        return (
          <span
            key={`${item.id}-${index}`}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full ring-1 ${visuals.className} ${
              isInteractive ? "cursor-default transition-transform hover:scale-110" : ""
            }`}
            tabIndex={isInteractive ? 0 : undefined}
            aria-label={item.label}
            title={undefined}
            onMouseEnter={(e) => show(item, e.currentTarget)}
            onMouseLeave={hide}
            onFocus={(e) => show(item, e.currentTarget)}
            onBlur={hide}
          >
            {visuals.content}
          </span>
        );
      })}
      {active ? <PredictionTooltip item={active.item} anchor={active.rect} /> : null}
    </div>
  );
}
