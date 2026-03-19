"use client";

import { Button } from "@/components/ui";

/** Normalize pick to display form "1" | "X" | "2" */
function displayPick(value: string): string {
  const map: Record<string, string> = { ONE: "1", X: "X", TWO: "2" };
  return map[value] ?? value;
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5 7V4a3 3 0 016 0v3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8l3 3 7-7" />
    </svg>
  );
}

export type PredictionPickDisplayProps = {
  /** Lock time (ISO string); shown as "Locks HH:MM" when provided */
  lockAt?: string | null;
  /** Pick value: "1" | "X" | "2" or ONE/X/TWO */
  pick: string;
  /** When the prediction was finalized (ISO string) */
  finalizedAt?: string | null;
  /** Draft only: when the pick was first saved (ISO string); shown as “Saved …” */
  createdAt?: string | null;
  /** Show "Finalized" only when true */
  isFinal?: boolean;
  /** Optional undo button (e.g. for admin) */
  onUndo?: () => void;
  undoLoading?: boolean;
  /** Compact variant for inline use (e.g. in table cell) */
  compact?: boolean;
};

function formatEnteredLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PredictionPickDisplay({
  lockAt,
  pick,
  finalizedAt,
  createdAt,
  isFinal = true,
  onUndo,
  undoLoading = false,
  compact = false,
}: PredictionPickDisplayProps) {
  const value = displayPick(pick);
  const lockTime = lockAt
    ? new Date(lockAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;
  const finalizedLabel =
    isFinal && finalizedAt
      ? formatEnteredLabel(finalizedAt)
      : null;
  const draftSavedLabel =
    !isFinal && createdAt ? formatEnteredLabel(createdAt) : null;
  const isDraft = !isFinal;

  if (compact) {
    return (
      <div className="flex flex-col items-start gap-1">
        {lockTime != null && (
          <span className="flex items-center gap-1 text-[11px] text-nord-polarLight uppercase tracking-wide">
            <LockIcon className="h-3 w-3 opacity-80" />
            {lockTime}
          </span>
        )}
        <span
          className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-nord-frostDark/10 px-3 text-sm font-semibold text-nord-frostDark ring-1 ring-nord-frostDark/20"
          aria-label={`Your pick: ${value}`}
        >
          {value}
        </span>
        {finalizedLabel != null && (
          <span className="flex items-center gap-1 text-[11px] text-nord-polarLight">
            <CheckIcon className="h-3 w-3 text-nord-frostDark/60" />
            {finalizedLabel}
          </span>
        )}
        {isDraft && (
          <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-nord-polarLight italic">
            <span>Draft</span>
            {draftSavedLabel != null && (
              <span className="not-italic text-nord-polarLight/90">· Saved {draftSavedLabel}</span>
            )}
          </span>
        )}
        {onUndo != null && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs -ml-1" disabled={undoLoading} onClick={onUndo}>
            {undoLoading ? "…" : "Undo"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-nord-polarLighter/40 bg-nord-snow/70 px-3 py-2.5 shadow-sm">
      {lockTime != null && (
        <div className="flex items-center gap-1.5 text-xs text-nord-polarLight uppercase tracking-wide mb-2">
          <LockIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span>Locks {lockTime}</span>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex h-9 min-w-[2.5rem] items-center justify-center rounded-lg bg-nord-frostDark/12 px-4 text-base font-semibold text-nord-frostDark ring-1 ring-nord-frostDark/25"
          aria-label={`Your pick: ${value}`}
        >
          {value}
        </span>
        {finalizedLabel != null && (
          <span className="flex items-center gap-1.5 text-xs text-nord-polarLight">
            <CheckIcon className="h-3.5 w-3.5 shrink-0 text-nord-frostDark/50" />
            {finalizedLabel}
          </span>
        )}
        {isDraft && (
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-nord-polarLight italic">
            <span>Draft</span>
            {draftSavedLabel != null && (
              <span className="not-italic text-nord-polarLight/90">· Saved {draftSavedLabel}</span>
            )}
          </span>
        )}
      </div>
      {onUndo != null && (
        <div className="mt-2 pt-2 border-t border-nord-polarLighter/30">
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" disabled={undoLoading} onClick={onUndo}>
            {undoLoading ? "…" : "Undo"}
          </Button>
        </div>
      )}
    </div>
  );
}
