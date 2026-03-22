import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/get-user";
import { PageHeroBand } from "@/components/page-hero-band";
import { FeaturedHighlightCard } from "@/components/highlights/featured-highlight-card";
import { HighlightsEmptyState } from "@/components/highlights/highlights-empty-state";
import { StageSection } from "@/components/highlights/stage-section";
import type { HighlightCardModel } from "@/components/highlights/types";
import {
  formatHighlightSeason,
  formatHighlightStage,
  getStageSortValue,
} from "@/lib/highlights/presentation";

const STAGE_ROOM_ORDER = [
  "FINAL",
  "SEMI_FINAL",
  "QUARTER_FINAL",
  "ROUND_16",
  "PLAYOFFS",
  "GROUP_STAGE",
  "LEAGUE_STAGE",
] as const;

const STAGE_ROOM_DESCRIPTIONS: Record<string, string> = {
  FINAL: "The defining night of the campaign, staged as a headline replay.",
  SEMI_FINAL: "High-pressure ties, late swings and nights that shaped the final.",
  QUARTER_FINAL: "The premium middle act, where the bracket sharpens and the margins narrow.",
  ROUND_16: "First knockout screenings from the business end of Europe.",
  PLAYOFFS: "Play-off nights that set the tone for the wider campaign.",
  GROUP_STAGE: "League-phase recaps and early European statements.",
  LEAGUE_STAGE: "League-phase recaps and early European statements.",
};

type HubHighlightModel = HighlightCardModel & {
  stageKey: string;
  publishedAtMs: number;
};

function formatPublishedLabel(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toScoreline(homeScore: number | null, awayScore: number | null) {
  if (homeScore != null && awayScore != null) {
    return `${homeScore} - ${awayScore}`;
  }

  return "Replay";
}

function toHighlightCardModel(input: Awaited<ReturnType<typeof fetchHighlights>>[number]): HubHighlightModel {
  const homeScore = input.homeScore ?? input.match.homeScore ?? null;
  const awayScore = input.awayScore ?? input.match.awayScore ?? null;

  return {
    matchId: input.matchId,
    href: `/highlights/${input.matchId}`,
    title: input.title,
    stageLabel: formatHighlightStage(input.stage),
    seasonLabel: formatHighlightSeason(input.season),
    publishedLabel: formatPublishedLabel(input.publishedAt),
    homeTeamName: input.homeTeamName,
    awayTeamName: input.awayTeamName,
    homeTeamLogo: input.match.homeTeamLogo ?? null,
    awayTeamLogo: input.match.awayTeamLogo ?? null,
    scoreline: toScoreline(homeScore, awayScore),
    thumbnailUrl: input.thumbnailUrl ?? null,
    programNote: input.programNote ?? null,
    status: input.syncStatus,
    clipCount: input.clips.length,
    stageKey: input.stage,
    publishedAtMs: input.publishedAt.getTime(),
  };
}

async function fetchHighlights() {
  return prisma.matchHighlight.findMany({
    where: {
      competitionId: "CL",
    },
    include: {
      clips: {
        orderBy: { sortOrder: "asc" },
      },
      match: {
        select: {
          homeTeamLogo: true,
          awayTeamLogo: true,
          homeScore: true,
          awayScore: true,
        },
      },
    },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: 120,
  });
}

export default async function HighlightsPage() {
  await requireAuth();

  const rawHighlights = await fetchHighlights();
  const highlights = rawHighlights
    .map(toHighlightCardModel)
    .sort((a, b) => {
      if (b.publishedAtMs !== a.publishedAtMs) {
        return b.publishedAtMs - a.publishedAtMs;
      }
      return getStageSortValue(a.stageKey) - getStageSortValue(b.stageKey);
    });

  const featuredMatchId =
    rawHighlights.find((item) => item.isFeatured)?.matchId ??
    rawHighlights[0]?.matchId ??
    null;
  const featured =
    highlights.find((item) => item.matchId === featuredMatchId) ?? highlights[0] ?? null;

  const remaining = highlights.filter((item) => item.matchId !== featured?.matchId);
  const usedArchiveIds = new Set<string>();
  const stageSections = STAGE_ROOM_ORDER.map((stageKey) => {
    const items = remaining
      .filter((item) => item.stageKey === stageKey)
      .slice(0, 3);
    for (const item of items) {
      usedArchiveIds.add(item.matchId);
    }
    return {
      key: stageKey,
      title: formatHighlightStage(stageKey),
      description:
        STAGE_ROOM_DESCRIPTIONS[stageKey] ??
        "Curated Champions League replays from the archive.",
      items,
    };
  }).filter((section) => section.items.length > 0);
  const archive = remaining.filter((item) => !usedArchiveIds.has(item.matchId));

  return (
    <div className="space-y-3 sm:space-y-6">
      <PageHeroBand
        eyebrow="European Nights"
        title="Champions League highlights"
        description="A separate premium screening room for stored Champions League recaps, curated into featured premieres, stage rooms and a growing archive."
        highlights={[
          {
            label: "Featured premiere",
            value: featured ? featured.title : "Waiting for the first synced recap.",
          },
          {
            label: "Stage rooms",
            value: `${stageSections.length} curated section${stageSections.length === 1 ? "" : "s"}`,
          },
          {
            label: "Archive",
            value: `${archive.length} additional replay${archive.length === 1 ? "" : "s"}`,
          },
        ]}
      />

      {highlights.length === 0 ? (
        <HighlightsEmptyState
          title="No highlights have been synced yet"
          description="Run the Champions League highlights sync from the admin API page. Once ScoreBat recaps are stored, European Nights will surface them here automatically."
        />
      ) : (
        <>
          {featured ? <FeaturedHighlightCard highlight={featured} /> : null}
          {stageSections.map((section) => (
            <StageSection
              key={section.key}
              title={section.title}
              description={section.description}
              items={section.items}
            />
          ))}
          {archive.length > 0 ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="inline-flex rounded-full border border-nord-frostDark/12 bg-white/75 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-nord-frostDark">
                    Archive
                  </span>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-nord-polar">
                    Historical screenings
                  </h2>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-nord-polarLight">
                  Every additional stored replay stays accessible here without turning
                  the page into a generic thumbnail wall.
                </p>
              </div>
              <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/78 shadow-[0_22px_65px_rgba(46,52,64,0.06)]">
                <ul className="divide-y divide-nord-polarLighter/18">
                  {archive.map((item) => (
                    <li key={item.matchId}>
                      <Link
                        href={item.href}
                        className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-nord-snow/70 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-nord-polarLight">
                            {item.stageLabel} • {item.publishedLabel}
                          </div>
                          <div className="mt-2 truncate text-base font-semibold text-nord-polar">
                            {item.title}
                          </div>
                          <div className="mt-1 truncate text-sm text-nord-polarLight">
                            {item.programNote ?? `${item.homeTeamName} vs ${item.awayTeamName}`}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-4 text-sm">
                          <span className="font-medium text-nord-polar">
                            {item.scoreline}
                          </span>
                          <span className="text-nord-frostDark">Open</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
