"use client";

import type { HalisahaResultRow } from "@/lib/halisaha/server";

const placeholderResults: HalisahaResultRow[] = [
  {
    userId: "placeholder-1",
    name: "Golden",
    surname: "Striker",
    totalPoints: 14,
    correctAnswers: 5,
    answeredQuestions: 5,
    mvpWins: 2,
    accuracyLabel: "100%",
    rank: 1,
    podiumPlace: 1,
    recentAnswers: [
      { id: "p1-1", status: "correct", label: "Placeholder answer" },
      { id: "p1-2", status: "correct", label: "Placeholder answer" },
      { id: "p1-3", status: "correct", label: "Placeholder answer" },
      { id: "p1-4", status: "correct", label: "Placeholder answer" },
      { id: "p1-5", status: "correct", label: "Placeholder answer" },
    ],
  },
  {
    userId: "placeholder-2",
    name: "Silver",
    surname: "Playmaker",
    totalPoints: 11,
    correctAnswers: 4,
    answeredQuestions: 5,
    mvpWins: 1,
    accuracyLabel: "80%",
    rank: 2,
    podiumPlace: 2,
    recentAnswers: [
      { id: "p2-1", status: "correct", label: "Placeholder answer" },
      { id: "p2-2", status: "correct", label: "Placeholder answer" },
      { id: "p2-3", status: "pending", label: "Placeholder answer" },
      { id: "p2-4", status: "correct", label: "Placeholder answer" },
      { id: "p2-5", status: "correct", label: "Placeholder answer" },
    ],
  },
  {
    userId: "placeholder-3",
    name: "Bronze",
    surname: "Captain",
    totalPoints: 9,
    correctAnswers: 3,
    answeredQuestions: 5,
    mvpWins: 0,
    accuracyLabel: "60%",
    rank: 3,
    podiumPlace: 3,
    recentAnswers: [
      { id: "p3-1", status: "correct", label: "Placeholder answer" },
      { id: "p3-2", status: "incorrect", label: "Placeholder answer" },
      { id: "p3-3", status: "correct", label: "Placeholder answer" },
      { id: "p3-4", status: "pending", label: "Placeholder answer" },
      { id: "p3-5", status: "correct", label: "Placeholder answer" },
    ],
  },
];

function PremiumBootIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M2.85 14.55c2.9-.06 5.63-.98 7.62-2.54 1.35-1.06 2.37-2.4 2.9-3.86l.63-1.74 2.88.52.3 2.55c.08.66.44 1.24.99 1.58l3.14 1.92c.75.46 1.22 1.27 1.22 2.15V18H2v-.42c0-1.88.27-2.9.85-3.03Z"
        fill="currentColor"
      />
      <path
        d="M13.95 6.38 16.18 6.79"
        stroke="rgba(255,255,255,0.52)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M7.55 18.08h1.02M10.88 18.08H12M14.16 18.08h1.04M17.26 18.08h1.02M20.08 18.08h.84"
        stroke="rgba(255,255,255,0.54)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M6.18 13.12c1.74-.27 3.38-.94 4.72-1.92 1.01-.74 1.8-1.68 2.3-2.72"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M16.3 8.42c.9.54 1.62 1.26 2.08 2.1"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

function BootPlacementBadge({ place }: { place?: 1 | 2 | 3 }) {
  if (!place) return null;

  const config: Record<
    1 | 2 | 3,
    { label: string; className: string; iconClass: string }
  > = {
    1: {
      label: "Golden Boot",
      className:
        "border-[#f3d787]/45 bg-[linear-gradient(180deg,rgba(243,215,135,0.24),rgba(145,102,19,0.18))] ring-[#f3d787]/22 shadow-[0_10px_22px_rgba(243,215,135,0.12)]",
      iconClass: "text-[#f8dfa1]",
    },
    2: {
      label: "Silver Boot",
      className:
        "border-[#d8dee9]/40 bg-[linear-gradient(180deg,rgba(216,222,233,0.18),rgba(94,105,125,0.16))] ring-white/14 shadow-[0_10px_22px_rgba(216,222,233,0.08)]",
      iconClass: "text-[#dde4ef]",
    },
    3: {
      label: "Bronze Boot",
      className:
        "border-[#d8a07a]/38 bg-[linear-gradient(180deg,rgba(216,160,122,0.18),rgba(120,70,42,0.16))] ring-[#d8a07a]/18 shadow-[0_10px_22px_rgba(216,160,122,0.08)]",
      iconClass: "text-[#e2b08e]",
    },
  };

  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ring-1 ${config[place].className}`}
      title={config[place].label}
      aria-label={config[place].label}
    >
      <PremiumBootIcon className={`h-4.5 w-4.5 ${config[place].iconClass}`} />
    </span>
  );
}

function RecentPredictionMarker({
  status,
  label,
}: {
  status: HalisahaResultRow["recentAnswers"][number]["status"] | "empty";
  label: string;
}) {
  const sharedClassName =
    "inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/30 ring-1 ring-white/14";

  if (status === "correct") {
    return (
      <span
        className={`${sharedClassName} bg-emerald-400/10 text-emerald-200`}
        title={label}
        aria-label={label}
      >
        <CheckMiniIcon className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (status === "incorrect") {
    return (
      <span
        className={`${sharedClassName} bg-rose-400/10 text-rose-200`}
        title={label}
        aria-label={label}
      >
        <CrossMiniIcon className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span
        className={`${sharedClassName} bg-white/[0.06] text-[#d7e4e2]`}
        title={label}
        aria-label={label}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={`${sharedClassName} bg-white/[0.03] text-white/22`}
      title={label}
      aria-hidden
    />
  );
}

function RecentPredictionsStrip({
  predictions,
}: {
  predictions: HalisahaResultRow["recentAnswers"];
}) {
  const visiblePredictions = predictions.slice(-5);
  const items = [
    ...Array.from(
      { length: Math.max(0, 5 - visiblePredictions.length) },
      (_, index) => ({
        id: `empty-${index}`,
        status: "empty" as const,
        label: "No prediction yet",
      }),
    ),
    ...visiblePredictions,
  ];

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      {items.map((item, index) => (
        <RecentPredictionMarker
          key={`${item.id}-${index}`}
          status={item.status}
          label={item.label}
        />
      ))}
    </div>
  );
}

function HalisahaLeaderboardMobileCard({
  result,
}: {
  result: HalisahaResultRow;
}) {
  return (
    <li className="rounded-[1.1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] px-4 py-3.5 shadow-[0_16px_36px_rgba(0,0,0,0.16)]">
      {/* Header: rank + name + badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[0.58rem] font-semibold uppercase tracking-[0.26em] text-white/38">
            Rank #{result.rank}
          </div>
          <div className="mt-0.5 inline-flex max-w-full items-center gap-2">
            <div className="min-w-0 truncate text-[1rem] font-semibold tracking-[-0.01em] text-white">
              {result.name} {result.surname}
            </div>
            <BootPlacementBadge place={result.podiumPlace} />
          </div>
        </div>
      </div>

      {/* Stats row – matches desktop columns: ANSWERS SENT, CORRECT HITS, SUCCESS RATE, MVP, FUN POINTS */}
      <div className="mt-3 border-t border-white/8 pt-2.5">
        <div className="grid grid-cols-5 gap-x-0 divide-x divide-white/8 text-center">
          <InlineStat label="Answers sent" value={result.answeredQuestions} />
          <InlineStat label="Correct hits" value={result.correctAnswers} />
          <InlineStat label="Success rate" value={result.accuracyLabel} />
          <InlineStat label="MVP" value={result.mvpWins} />
          <InlineStat label="Fun points" value={result.totalPoints} highlight />
        </div>
      </div>

      {/* Recent predictions */}
      <div className="mt-3 border-t border-white/8 pt-2.5">
        <div className="mb-1.5 text-[0.56rem] font-semibold uppercase tracking-[0.22em] text-white/36">
          Last 5 (old to new)
        </div>
        <RecentPredictionsStrip predictions={result.recentAnswers} />
      </div>
    </li>
  );
}

function InlineStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-1">
      <div className="flex min-h-[2.75rem] w-full flex-col justify-end text-center">
        <div className="text-[0.52rem] font-semibold uppercase leading-[1.2] tracking-[0.18em] text-white/38">
          {label}
        </div>
      </div>
      <div
        className={`mt-1 text-[0.92rem] font-semibold tabular-nums leading-none ${
          highlight ? "text-[#d8ece8]" : "text-white/86"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function HalisahaLeaderboardBoard({
  results,
  answersResolved,
}: {
  results: HalisahaResultRow[];
  answersResolved: boolean;
}) {
  const displayResults = results.length > 0 ? results : placeholderResults;
  const isPlaceholder = results.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3 shadow-[0_20px_54px_rgba(0,0,0,0.24)] sm:rounded-[1.55rem] sm:p-4">
      <div className="mb-3 border-b border-white/8 pb-2.5">
        <div className="text-[0.66rem] font-semibold uppercase tracking-[0.3em] text-[#d5e6e1]/74">
          Halisaha Leaderboard
        </div>
      </div>

      <>
        {isPlaceholder ? (
          <div className="mb-3 rounded-[1rem] border border-dashed border-white/12 bg-white/[0.03] px-4 py-4 text-center text-sm text-white/45 sm:hidden">
            {answersResolved
              ? "Showing a temporary podium preview until the first real Halisaha answers are scored."
              : "Showing a temporary podium preview until players start answering."}
          </div>
        ) : (
          <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1 sm:hidden">
            {displayResults.map((result) => (
              <HalisahaLeaderboardMobileCard
                key={result.userId}
                result={result}
              />
            ))}
          </ul>
        )}

        <div className="hidden min-h-0 flex-1 overflow-x-auto sm:block">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[0.7rem] uppercase tracking-[0.18em] text-white/34">
                <th className="pb-3 pr-4 text-center">Place</th>
                <th className="pb-3 pr-4 text-left">Player</th>
                <th className="pb-3 pr-4 text-center">Answers sent</th>
                <th className="pb-3 pr-4 text-center">Correct hits</th>
                <th className="pb-3 pr-4 text-center">Success rate</th>
                <th className="pb-3 pr-4 text-center">MVP</th>
                <th className="pb-3 pr-4 text-center">Fun points</th>
                <th className="pb-3 text-left">Form</th>
              </tr>
            </thead>
            <tbody>
              {displayResults.length > 0 ? (
                displayResults.map((result) => (
                  <tr
                    key={result.userId}
                    className="border-b border-white/8 align-middle"
                  >
                    <td className="py-3.5 pr-4 text-center text-white/78">
                      {result.rank}
                    </td>
                    <td className="py-3.5 pr-4 text-left">
                      <div className="inline-flex max-w-full items-center justify-start gap-[0.5rem]">
                        <div className="min-w-0">
                          <div className="truncate text-left font-semibold text-white">
                            {result.name} {result.surname}
                          </div>
                        </div>
                        <BootPlacementBadge place={result.podiumPlace} />
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-center tabular-nums text-white/72">
                      {result.answeredQuestions}
                    </td>
                    <td className="py-3.5 pr-4 text-center tabular-nums text-white/72">
                      {result.correctAnswers}
                    </td>
                    <td className="py-3.5 pr-4 text-center text-white/78">
                      {result.accuracyLabel}
                    </td>
                    <td className="py-3.5 pr-4 text-center tabular-nums text-white/78">
                      {result.mvpWins}
                    </td>
                    <td className="py-3.5 pr-4 text-center">
                      <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-[#d7ebe7]/14 bg-[#d7ebe7]/8 px-3 py-1 text-sm font-semibold tabular-nums text-[#d8ece8]">
                        {result.totalPoints}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <RecentPredictionsStrip predictions={result.recentAnswers} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-sm text-white/42"
                  >
                    Leaderboard is ready.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    </div>
  );
}
