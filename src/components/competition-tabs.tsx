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

const OtherContent = () => (
  <>
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nord-polarLighter/60" aria-hidden>
      <svg className="h-3.5 w-3.5 text-nord-polar" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    </span>
    <span className="sm:hidden">Other</span>
    <span className="hidden sm:inline">Diğer</span>
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
        <OtherContent />
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
        <OtherContent />
      </button>
    </div>
  );
}
