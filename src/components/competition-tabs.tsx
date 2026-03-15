"use client";

import Link from "next/link";

export const UCL_ID = "CL";
export const OTHER_ID = "OTHER";

const tabClass = "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors";

const UclContent = () => (
  <>
    {/* eslint-disable-next-line @next/next/no-img-element -- external league logo */}
    <img
      src="https://upload.wikimedia.org/wikipedia/en/f/f5/UEFA_Champions_League.svg"
      alt=""
      className="h-6 w-6 shrink-0 object-contain"
    />
    UEFA Champions League
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
    Diğer
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
    <div className="flex border-b border-nord-polarLighter/50 mb-0">
      <Link
        href={`${basePath}?competition=${UCL_ID}`}
        className={`${tabClass} ${
          isUcl ? "border-nord-frostDark text-nord-polar" : "border-transparent text-nord-polarLight hover:text-nord-polar"
        }`}
      >
        <UclContent />
      </Link>
      <Link
        href={`${basePath}?competition=${OTHER_ID}`}
        className={`${tabClass} ${
          isOther ? "border-nord-frostDark text-nord-polar" : "border-transparent text-nord-polarLight hover:text-nord-polar"
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
    <div className="flex border-b border-nord-polarLighter/50 mb-0">
      <button
        type="button"
        onClick={() => onSelect(UCL_ID)}
        className={`${tabClass} ${
          isUcl ? "border-nord-frostDark text-nord-polar" : "border-transparent text-nord-polarLight hover:text-nord-polar"
        }`}
      >
        <UclContent />
      </button>
      <button
        type="button"
        onClick={() => onSelect(OTHER_ID)}
        className={`${tabClass} ${
          isOther ? "border-nord-frostDark text-nord-polar" : "border-transparent text-nord-polarLight hover:text-nord-polar"
        }`}
      >
        <OtherContent />
      </button>
    </div>
  );
}
