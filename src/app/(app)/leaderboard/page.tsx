import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/get-user";
import { getLeaderboardStatsForUser } from "@/lib/scoring";
import { Card, CardContent } from "@/components/ui";
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
        <div className="grid gap-4 sm:grid-cols-3">
          {prizes.map((p) => (
            <Card key={p.id}>
              <CardContent className="py-4">
                <div className="text-sm font-medium text-nord-frostDark">
                  Place {p.place}
                </div>
                <div className="font-semibold text-nord-polar">{p.title}</div>
                {p.description && (
                  <p className="mt-1 text-sm text-nord-polarLight">{p.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
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
                      <div className="rounded-lg bg-nord-frostDark/10 px-3 py-2 text-right">
                        <div className="text-[11px] uppercase tracking-wide text-nord-polarLight">
                          Points
                        </div>
                        <div className="text-lg font-semibold text-nord-frostDark">
                          {e.totalPoints}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-nord-polarLighter/20 pt-3 text-center">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-nord-polarLight">
                          Predictions
                        </div>
                        <div className="mt-1 font-medium text-nord-polar">
                          {e.finalizedPredictionCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-nord-polarLight">
                          Completed
                        </div>
                        <div className="mt-1 font-medium text-nord-polar">
                          {e.completedMatchCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-nord-polarLight">
                          Accuracy
                        </div>
                        <div className="mt-1 font-medium text-nord-polar">
                          {e.finalizedPredictionCount > 0
                            ? `${Math.round(e.accuracyRate * 100)}%`
                            : "–"}
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
                    <th className="pb-2 pr-4">Points</th>
                    <th className="pb-2 pr-4">Predictions</th>
                    <th className="pb-2 pr-4">Matches completed</th>
                    <th className="pb-2 pr-4">Last 5</th>
                    <th className="pb-2">Accuracy</th>
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
                        <td className="py-3 pr-4 text-nord-polar">{e.totalPoints}</td>
                        <td className="py-3 pr-4 text-nord-polarLight">
                          {e.finalizedPredictionCount}
                        </td>
                        <td className="py-3 pr-4 text-nord-polarLight">
                          {e.completedMatchCount}
                        </td>
                        <td className="py-3 pr-4">
                          <RecentPredictionsStrip
                            predictions={recentPredictionsByUser.get(e.userId) ?? []}
                          />
                        </td>
                        <td className="py-3 text-nord-polar">
                          {e.finalizedPredictionCount > 0
                            ? `${Math.round(e.accuracyRate * 100)}%`
                            : "–"}
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
