import type {
  LeaderboardBoardData,
  LeaderboardBoardEntry,
  LeaderboardRecentPredictionItem,
} from "@/lib/leaderboard";

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

function RecentPredictionMarker({
  status,
  label,
}: {
  status: LeaderboardRecentPredictionItem["status"] | "empty";
  label: string;
}) {
  const sharedClassName =
    "inline-flex h-6 w-6 items-center justify-center rounded-full ring-1";

  if (status === "correct") {
    return (
      <span
        className={`${sharedClassName} bg-emerald-500/12 text-emerald-600 ring-emerald-500/25`}
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
        className={`${sharedClassName} bg-rose-500/10 text-rose-500 ring-rose-500/20`}
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
        className={`${sharedClassName} bg-nord-frostDark/10 text-nord-frostDark ring-nord-frostDark/20`}
        title={label}
        aria-label={label}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={`${sharedClassName} bg-transparent text-nord-polarLighter/25 ring-nord-polarLighter/15`}
      title={label}
      aria-hidden
    />
  );
}

function RecentPredictionsStrip({
  predictions,
}: {
  predictions: LeaderboardRecentPredictionItem[];
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
    <div
      className="flex items-center gap-1.5 whitespace-nowrap"
      title="Last 5 predictions, left to right from oldest to newest"
      aria-label="Last 5 predictions, left to right from oldest to newest"
    >
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
            <div className="relative flex min-h-[4.5rem] flex-col justify-between px-2 py-2 sm:min-h-0 sm:px-4 sm:py-3.5">
              <div>
                <div className="text-[7.5px] font-semibold uppercase tracking-[0.14em] text-nord-frostDark sm:text-[10px] sm:tracking-[0.18em]">
                  Place {prize.place}
                </div>
                <h3 className="mt-1 line-clamp-3 text-[10.5px] font-semibold leading-[1.3] tracking-tight text-nord-polar sm:mt-1.5 sm:line-clamp-none sm:text-base sm:leading-snug">
                  {prize.title}
                </h3>
              </div>
              {prize.description ? (
                <p className="mt-1 line-clamp-2 text-[8.5px] leading-[1.35] text-nord-polarLight sm:mt-2 sm:line-clamp-4 sm:text-[13px] sm:leading-relaxed">
                  {prize.description}
                </p>
              ) : null}
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
}: {
  entry: LeaderboardBoardEntry;
  labels: ColumnLabels;
}) {
  return (
    <li
      key={`${entry.userId}-${entry.competitionId}-mobile`}
      className={`rounded-xl border border-nord-polarLighter/35 bg-white/85 px-4 py-3 shadow-sm ${
        entry.isAdminRow ? "bg-nord-snow/80" : ""
      }`}
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
        <div>
          <div className="text-[9px] uppercase tracking-wide text-nord-polarLight">
            {labels.mobileAccuracy}
          </div>
          <div className="mt-0.5 text-xs font-medium tabular-nums text-nord-polar sm:text-sm">
            {entry.accuracyLabel}
          </div>
        </div>
        <div className="rounded-md bg-nord-frostDark/8 px-0.5 py-0.5">
          <div className="text-[9px] uppercase tracking-wide text-nord-polarLight">
            {labels.mobilePoints}
          </div>
          <div className="mt-0.5 text-xs font-semibold tabular-nums text-nord-frostDark sm:text-sm">
            {entry.totalPoints}
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-nord-polarLighter/20 pt-3">
        <div className="text-[11px] uppercase tracking-wide text-nord-polarLight">
          {labels.lastFive} (old to new)
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
            <ul className="space-y-3 sm:hidden">
              {data.entries.map((entry) => (
                <LeaderboardMobileCard
                  key={`${entry.userId}-${entry.competitionId}-mobile`}
                  entry={entry}
                  labels={mergedLabels}
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
                    <th className="pb-2 pr-4">{mergedLabels.accuracy}</th>
                    <th className="pb-2 pr-4">{mergedLabels.points}</th>
                    <th className="pb-2">{mergedLabels.lastFive}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr
                      key={`${entry.userId}-${entry.competitionId}`}
                      className={`border-b border-nord-polarLighter/50 ${
                        entry.isAdminRow ? "bg-nord-snow/60" : ""
                      }`}
                    >
                      <td className="py-3 pr-4 font-medium text-nord-polar">
                        {entry.rank ?? "–"}
                      </td>
                      <td className="py-3 pr-4 text-nord-polar">
                        <div className="flex items-center gap-2">
                          <span>
                            {entry.name} {entry.surname}
                          </span>
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
                      <td className="py-3 pr-4 text-nord-polar">
                        {entry.accuracyLabel}
                      </td>
                      <td className="py-3 pr-4 font-medium text-nord-polar">
                        {entry.totalPoints}
                      </td>
                      <td className="py-3">
                        <RecentPredictionsStrip
                          predictions={entry.recentPredictions}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
