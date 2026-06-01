"use client";

import Link from "next/link";

export const UCL_ID = "CL";
export const OTHER_ID = "OTHER";

const tabClass =
  "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:rounded-none sm:px-4 sm:py-3 sm:border-b-2 sm:-mb-px";

const UclContent = () => (
  <>
    {/* eslint-disable-next-line @next/next/no-img-element -- external league logo */}
    <img
      src="https://upload.wikimedia.org/wikipedia/en/f/f5/UEFA_Champions_League.svg"
      alt=""
      className="h-6 w-6 shrink-0 object-contain"
    />
    <span className="sm:hidden">UCL</span>
    <span className="hidden sm:inline">UEFA Champions League</span>
  </>
);

export const WorldCup2026Logo = () => (
  <span
    className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d9c08a]/65 bg-[radial-gradient(circle_at_35%_25%,#fff8dc_0%,#d9c08a_30%,#173f35_64%,#102b27_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_10px_rgba(16,43,39,0.16)]"
    aria-hidden
  >
    <svg
      className="absolute inset-[0.18rem] text-white/88"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.2" />
      <path d="M4 12h16M12 4a11.2 11.2 0 0 1 2.7 8A11.2 11.2 0 0 1 12 20a11.2 11.2 0 0 1-2.7-8A11.2 11.2 0 0 1 12 4z" />
    </svg>
    <span className="relative z-[1] mt-[0.05rem] text-[0.48rem] font-black leading-none tracking-[-0.08em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.38)]">
      26
    </span>
  </span>
);

export const WorldCup2026Content = () => (
  <>
    <WorldCup2026Logo />
    <span>World Cup 2026</span>
  </>
);

/** Link-based tabs for Leaderboard (URL-driven). */
type Props = {
  currentCompetitionId: string;
  basePath: string;
};

export function CompetitionTabs({ currentCompetitionId, basePath }: Props) {
  const isUcl = currentCompetitionId === UCL_ID;
  const isOther = currentCompetitionId === OTHER_ID;

  return (
    <div className="mb-0 grid grid-cols-2 gap-1 rounded-xl border border-nord-polarLighter/30 bg-nord-snow/60 p-1 sm:flex sm:gap-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:border-b sm:border-nord-polarLighter/50">
      <Link
        href={`${basePath}?competition=${UCL_ID}`}
        className={`${tabClass} ${
          isUcl
            ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
            : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
        }`}
      >
        <UclContent />
      </Link>
      <Link
        href={`${basePath}?competition=${OTHER_ID}`}
        className={`${tabClass} ${
          isOther
            ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
            : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
        }`}
      >
        <WorldCup2026Content />
      </Link>
    </div>
  );
}

/** Button-based tabs for My predictions (client state). */
type ClientProps = {
  currentCompetitionId: string;
  onSelect: (competitionId: string) => void;
};

export function CompetitionTabsClient({ currentCompetitionId, onSelect }: ClientProps) {
  const isUcl = currentCompetitionId === UCL_ID;
  const isOther = currentCompetitionId === OTHER_ID;

  return (
    <div className="mb-0 grid grid-cols-2 gap-1 rounded-xl border border-nord-polarLighter/30 bg-nord-snow/60 p-1 sm:flex sm:gap-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:border-b sm:border-nord-polarLighter/50">
      <button
        type="button"
        onClick={() => onSelect(UCL_ID)}
        className={`${tabClass} ${
          isUcl
            ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
            : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
        }`}
      >
        <UclContent />
      </button>
      <button
        type="button"
        onClick={() => onSelect(OTHER_ID)}
        className={`${tabClass} ${
          isOther
            ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
            : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
        }`}
      >
        <WorldCup2026Content />
      </button>
    </div>
  );
}
