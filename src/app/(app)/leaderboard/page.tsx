import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/get-user";
import { getLeaderboardStatsForUser } from "@/lib/scoring";
import { CompetitionTabs } from "@/components/competition-tabs";
import { PageHeroBand } from "@/components/page-hero-band";
import { UCL_COMPETITION_ID, OTHER_COMPETITION_ID } from "@/lib/config";
import { toDisplay } from "@/lib/prediction-values";

type RecentPredictionStatus = "correct" | "incorrect" | "pending";

type RecentPredictionItem = {
  id: string;
  status: RecentPredictionStatus;
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
  status: RecentPredictionStatus | "empty";
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
  predictions: RecentPredictionItem[];
}) {
  const visiblePredictions = predictions.slice(-5);
  const items = [
    ...Array.from({ length: Math.max(0, 5 - visiblePredictions.length) }, (_, index) => ({
      id: `empty-${index}`,
      status: "empty" as const,
      label: "No prediction yet",
    })),
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

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  const currentUser = await requireAuth();
  const params = await searchParams;
  const competitionId = params.competition === OTHER_COMPETITION_ID ? OTHER_COMPETITION_ID : UCL_COMPETITION_ID;

  const allEntries = await prisma.leaderboardEntry.findMany({
    where: { competitionId },
    orderBy: { currentRank: "asc" },
    include: { user: { select: { name: true, surname: true, role: true } } },
  });

  const isAdmin = currentUser.role === "admin";
  const publicEntries = allEntries.filter((e) => e.user.role !== "admin");
  let adminEntries = allEntries.filter((e) => e.user.role === "admin");

  // If admin has predictions but no leaderboard entry yet (Recalculate not run), show them at the bottom with live stats
  if (isAdmin && !adminEntries.some((e) => e.userId === currentUser.id)) {
    const liveStats = await getLeaderboardStatsForUser(currentUser.id, competitionId);
    if (liveStats && liveStats.finalizedPredictionCount > 0) {
      adminEntries = [
        ...adminEntries,
        {
          competitionId,
          userId: currentUser.id,
          totalPoints: liveStats.totalPoints,
          finalizedPredictionCount: liveStats.finalizedPredictionCount,
          completedMatchCount: liveStats.completedMatchCount,
          correctPredictionCount: liveStats.correctPredictionCount,
          accuracyRate: liveStats.accuracyRate,
          averageFinalizedTimeMetric: null,
          currentRank: 0,
          knockoutPoints: 0,
          semifinalFinalPoints: 0,
          user: {
            name: currentUser.name,
            surname: currentUser.surname,
            role: "admin" as const,
          },
        },
      ];
    }
  }

  const entries = isAdmin
    ? [...publicEntries, ...adminEntries]
    : publicEntries;

  const podiumPlaces = new Map<string, 1 | 2 | 3>();
  publicEntries.slice(0, 3).forEach((entry, index) => {
    podiumPlaces.set(entry.userId, (index + 1) as 1 | 2 | 3);
  });

  const adminHasLiveRow =
    isAdmin &&
    adminEntries.length > 0 &&
    !allEntries.some((e) => e.userId === currentUser.id);

  const entryUserIds = [...new Set(entries.map((e) => e.userId))];
  const recentPredictionRows =
    entryUserIds.length > 0
      ? await prisma.prediction.findMany({
          where: {
            userId: { in: entryUserIds },
            isFinal: true,
            match:
              competitionId === UCL_COMPETITION_ID
                ? { OR: [{ competitionId: UCL_COMPETITION_ID }, { competitionId: null }] }
                : { competitionId },
          },
          orderBy: [{ userId: "asc" }, { finalizedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            userId: true,
            selectedPrediction: true,
            finalizedAt: true,
            awardedPoints: true,
            match: {
              select: {
                officialResultType: true,
              },
            },
          },
        })
      : [];

  const recentPredictionsByUser = new Map<string, RecentPredictionItem[]>();
  for (const prediction of recentPredictionRows) {
    const items = recentPredictionsByUser.get(prediction.userId) ?? [];
    if (items.length >= 5) continue;

    const status: RecentPredictionStatus =
      prediction.match.officialResultType === null
        ? "pending"
        : prediction.awardedPoints === 1
          ? "correct"
          : "incorrect";

    const statusLabel =
      status === "correct"
        ? "Correct"
        : status === "incorrect"
          ? "Incorrect"
          : "Pending";
    const finalizedLabel = prediction.finalizedAt
      ? new Date(prediction.finalizedAt).toLocaleString("en-GB", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "Time unavailable";

    items.push({
      id: prediction.id,
      status,
      label: `${toDisplay(prediction.selectedPrediction)} - ${statusLabel} - ${finalizedLabel}`,
    });
    recentPredictionsByUser.set(prediction.userId, items);
  }

  for (const items of recentPredictionsByUser.values()) {
    items.reverse();
  }

  const prizes = await prisma.prize.findMany({
    where: { competitionId },
    orderBy: { place: "asc" },
  });

  return (
    <div className="space-y-3 sm:space-y-6">
      <PageHeroBand
        eyebrow="Premium Ranking"
        title="Leaderboard"
        description="Track the board with a cleaner premium overview ranked by points first and accuracy second."
        highlights={[
          {
            label: "Ranking logic",
            value: "Total points decide the order, with accuracy used as the tie-break.",
          },
          {
            label: "Recent form",
            value: "The latest 5 prediction reads stay visible for every row.",
          },
        ]}
        footerNote={
          <>
            Username is never shown. Last 5 reads left to right from oldest to newest.
            {isAdmin && adminEntries.length > 0 && (
              <span className="mt-1 block text-nord-polarLight/95">
                Admin entries are shown at the bottom for testing only; other users do not see them.
              </span>
            )}
            {adminHasLiveRow && (
              <span className="mt-1 block text-nord-polarLight/95">
                Your row is computed from your predictions. Run{" "}
                <strong>Recalculate scores & leaderboard</strong> in Admin → Scoring to update the stored board.
              </span>
            )}
          </>
        }
      />

      <div>
        <CompetitionTabs currentCompetitionId={competitionId} basePath="/leaderboard" />
      </div>

      {prizes.length > 0 && (
        <div
          className="grid grid-cols-3 gap-2 sm:gap-3"
          role="list"
          aria-label="Prizes for leaderboard places"
        >
          {prizes.map((p) => {
            const placeSurface =
              p.place === 1
                ? "border-amber-200/75 bg-[linear-gradient(168deg,rgba(255,251,235,0.97),rgba(255,255,255,0.93),rgba(254,243,199,0.2))] shadow-[0_14px_40px_rgba(180,130,40,0.09)] ring-1 ring-amber-100/70"
                : p.place === 2
                  ? "border-slate-200/85 bg-[linear-gradient(168deg,rgba(248,250,252,0.98),rgba(255,255,255,0.95),rgba(226,232,240,0.35))] shadow-[0_12px_36px_rgba(46,52,64,0.07)] ring-1 ring-slate-200/50"
                  : p.place === 3
                    ? "border-orange-100/90 bg-[linear-gradient(168deg,rgba(255,247,237,0.97),rgba(255,255,255,0.93),rgba(255,237,213,0.45))] shadow-[0_12px_36px_rgba(180,90,40,0.07)] ring-1 ring-orange-100/55"
                    : "border-nord-polarLighter/45 bg-[linear-gradient(168deg,rgba(255,255,255,0.96),rgba(241,245,252,0.9))] shadow-[0_10px_28px_rgba(46,52,64,0.05)] ring-1 ring-white/80";

            return (
              <article
                key={p.id}
                role="listitem"
                className={`group relative min-w-0 overflow-hidden rounded-[0.85rem] sm:rounded-2xl border ${placeSurface}`}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-50 bg-[radial-gradient(ellipse_at_35%_-10%,rgba(255,255,255,0.95),transparent_58%)]"
                  aria-hidden
                />
                <div className="relative flex min-h-[4.5rem] flex-col justify-between px-2 py-2 sm:min-h-0 sm:px-4 sm:py-3.5">
                  <div>
                    <div className="text-[7.5px] font-semibold uppercase tracking-[0.14em] text-nord-frostDark sm:text-[10px] sm:tracking-[0.18em]">
                      Place {p.place}
                    </div>
                    <h3 className="mt-1 line-clamp-3 text-[10.5px] font-semibold leading-[1.3] tracking-tight text-nord-polar sm:mt-1.5 sm:line-clamp-none sm:text-base sm:leading-snug">
                      {p.title}
                    </h3>
                  </div>
                  {p.description ? (
                    <p className="mt-1 line-clamp-2 text-[8.5px] leading-[1.35] text-nord-polarLight sm:mt-2 sm:line-clamp-4 sm:text-[13px] sm:leading-relaxed">
                      {p.description}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div>
        {entries.length === 0 ? (
          <p className="text-nord-polarLight text-sm">
            No leaderboard data yet. Make predictions and run &quot;Recalculate scores & leaderboard&quot; in the admin panel.
          </p>
        ) : (
          <>
            <ul className="space-y-3 sm:hidden">
              {entries.map((e) => {
                const isAdminRow = e.user.role === "admin";
                return (
                  <li
                    key={`${e.userId}-${e.competitionId}-mobile`}
                    className={`rounded-xl border border-nord-polarLighter/35 bg-white/85 px-4 py-3 shadow-sm ${isAdminRow ? "bg-nord-snow/80" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs uppercase tracking-wide text-nord-polarLight">
                          {isAdminRow ? "Admin row" : `Rank #${e.currentRank}`}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="min-w-0 truncate font-semibold text-nord-polar">
                            {e.user.name} {e.user.surname}
                          </div>
                          {!isAdminRow && (
                            <TopPlacementBadge place={podiumPlaces.get(e.userId)} />
                          )}
                        </div>
                        {isAdminRow && (
                          <div className="mt-1 text-xs text-nord-polarLight">
                            Not visible to other users
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-5 gap-1 border-t border-nord-polarLighter/20 pt-3 text-center">
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-nord-polarLight">
                          Pred.
                        </div>
                        <div className="mt-0.5 text-xs font-medium tabular-nums text-nord-polar sm:text-sm">
                          {e.finalizedPredictionCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-nord-polarLight">
                          Done
                        </div>
                        <div className="mt-0.5 text-xs font-medium tabular-nums text-nord-polar sm:text-sm">
                          {e.completedMatchCount}
                        </div>
                      </div>
                      <div title="Correct calls — right 1/X/2 picks on finished matches">
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-nord-frostDark/80">
                          Hits
                        </div>
                        <div className="mt-0.5 text-xs font-semibold tabular-nums text-nord-frostDark sm:text-sm">
                          {e.correctPredictionCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wide text-nord-polarLight">
                          Acc.
                        </div>
                        <div className="mt-0.5 text-xs font-medium tabular-nums text-nord-polar sm:text-sm">
                          {e.finalizedPredictionCount > 0
                            ? `${Math.round(e.accuracyRate * 100)}%`
                            : "–"}
                        </div>
                      </div>
                      <div className="rounded-md bg-nord-frostDark/8 px-0.5 py-0.5">
                        <div className="text-[9px] uppercase tracking-wide text-nord-polarLight">
                          Pts
                        </div>
                        <div className="mt-0.5 text-xs font-semibold tabular-nums text-nord-frostDark sm:text-sm">
                          {e.totalPoints}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-nord-polarLighter/20 pt-3">
                      <div className="text-[11px] uppercase tracking-wide text-nord-polarLight">
                        Last 5 (old to new)
                      </div>
                      <div className="mt-2">
                        <RecentPredictionsStrip
                          predictions={recentPredictionsByUser.get(e.userId) ?? []}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-nord-polarLighter text-left text-nord-polarLight">
                    <th className="pb-2 pr-4">Rank</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Predictions</th>
                    <th className="pb-2 pr-4">Matches completed</th>
                    <th
                      className="pb-2 pr-4 font-medium text-nord-polar/90"
                      title="Number of finalized picks that matched the official result (1 / X / 2)."
                    >
                      Correct calls
                    </th>
                    <th className="pb-2 pr-4">Accuracy</th>
                    <th className="pb-2 pr-4">Points</th>
                    <th className="pb-2">Last 5</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const isAdminRow = e.user.role === "admin";
                    return (
                      <tr
                        key={`${e.userId}-${e.competitionId}`}
                        className={`border-b border-nord-polarLighter/50 ${isAdminRow ? "bg-nord-snow/60" : ""}`}
                      >
                        <td className="py-3 pr-4 font-medium text-nord-polar">
                          {isAdminRow ? "–" : e.currentRank}
                        </td>
                        <td className="py-3 pr-4 text-nord-polar">
                          <div className="flex items-center gap-2">
                            <span>
                              {e.user.name} {e.user.surname}
                            </span>
                            {!isAdminRow && (
                              <TopPlacementBadge place={podiumPlaces.get(e.userId)} />
                            )}
                          </div>
                          {isAdminRow && (
                            <span className="ml-2 text-xs text-nord-polarLight">(Admin – not visible to others)</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-nord-polarLight">
                          {e.finalizedPredictionCount}
                        </td>
                        <td className="py-3 pr-4 text-nord-polarLight">
                          {e.completedMatchCount}
                        </td>
                        <td className="py-3 pr-4 font-medium tabular-nums text-nord-polar">
                          {e.correctPredictionCount}
                        </td>
                        <td className="py-3 pr-4 text-nord-polar">
                          {e.finalizedPredictionCount > 0
                            ? `${Math.round(e.accuracyRate * 100)}%`
                            : "–"}
                        </td>
                        <td className="py-3 pr-4 font-medium text-nord-polar">{e.totalPoints}</td>
                        <td className="py-3">
                          <RecentPredictionsStrip
                            predictions={recentPredictionsByUser.get(e.userId) ?? []}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
