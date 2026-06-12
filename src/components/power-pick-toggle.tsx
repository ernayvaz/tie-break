"use client";

type PowerPickToggleProps = {
  on: boolean;
  /** Cannot be changed (lock time passed, no rights, or in-flight). */
  disabled?: boolean;
  /** Lock time has passed for this match. */
  locked?: boolean;
  /** A request is in flight. */
  pending?: boolean;
  /** Accessible + hover hint describing the current interaction. */
  title?: string;
  onToggle: () => void;
  className?: string;
};

/**
 * Premium Power Pick x3 booster toggle. The label lives INSIDE the pill.
 * OFF → muted neutral. ON → warm gold/amber with a subtle glow. Locked → dimmed + lock glyph.
 */
export function PowerPickToggle({
  on,
  disabled = false,
  locked = false,
  pending = false,
  title,
  onToggle,
  className = "",
}: PowerPickToggleProps) {
  const isInteractive = !disabled && !locked && !pending;

  const base =
    "group relative inline-flex w-full max-w-[12.5rem] select-none items-center justify-between gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-offset-1";

  const stateClass = on
    ? "border-amber-300/70 bg-[linear-gradient(135deg,#f7c948_0%,#f0a92b_55%,#e08a1e_100%)] text-[#5c3a00] shadow-[0_6px_16px_rgba(224,138,30,0.32),inset_0_1px_0_rgba(255,255,255,0.55)]"
    : "border-nord-polarLighter/70 bg-white/85 text-nord-polarLight hover:border-amber-300/60 hover:text-nord-polar";

  const lockedClass = locked
    ? "cursor-not-allowed opacity-60 saturate-[0.85]"
    : disabled
      ? "cursor-not-allowed opacity-55"
      : "cursor-pointer hover:-translate-y-[1px] active:translate-y-0";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Power Pick x3 booster"
      title={title}
      disabled={!isInteractive}
      onClick={() => {
        if (!isInteractive) return;
        onToggle();
      }}
      className={`${base} ${stateClass} ${lockedClass} ${className}`}
    >
      <span className="flex items-center gap-1.5 truncate">
        <span
          aria-hidden
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold transition-colors ${
            on ? "bg-white/35 text-[#5c3a00]" : "bg-nord-snow text-nord-polarLight"
          }`}
        >
          {locked ? (
            <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5" aria-hidden>
              <path
                d="M4.5 7V5.5a3.5 3.5 0 1 1 7 0V7M4 7h8v5.5H4z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            "★"
          )}
        </span>
        <span className="truncate">Power Pick x3</span>
      </span>
      <span
        aria-hidden
        className={`relative flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${
          on ? "bg-white/45" : "bg-nord-polarLighter/45"
        }`}
      >
        <span
          className={`absolute h-3 w-3 rounded-full bg-white shadow-[0_1px_2px_rgba(46,52,64,0.35)] transition-transform duration-200 ${
            on ? "translate-x-[0.85rem]" : "translate-x-[0.15rem]"
          }`}
        />
      </span>
    </button>
  );
}
