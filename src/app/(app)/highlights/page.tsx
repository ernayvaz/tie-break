import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/get-user";
import { CompetitionTabs } from "@/components/competition-tabs";
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
import { OTHER_COMPETITION_ID, UCL_COMPETITION_ID } from "@/lib/config";

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

type Props = {
  searchParams: Promise<{ competition?: string }>;
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

function normalizeCompetitionLabel(
  competitionLabel: string,
  competitionId: string | null
) {
  if (
    competitionId === UCL_COMPETITION_ID ||
    competitionLabel.toLowerCase().includes("champions league")
  ) {
    return "Champions League";
  }

  const beforeStage = competitionLabel.split(",")[0] ?? competitionLabel;
  const afterRegion = beforeStage.includes(":")
    ? beforeStage.split(":").slice(1).join(":").trim()
    : beforeStage.trim();

  return afterRegion || "Other competition";
}

function getCompetitionBucket(competition?: string) {
  return competition === OTHER_COMPETITION_ID
    ? OTHER_COMPETITION_ID
    : UCL_COMPETITION_ID;
}

function belongsToCompetitionBucket(
  competitionId: string | null,
  currentCompetitionId: string
) {
  if (currentCompetitionId === UCL_COMPETITION_ID) {
    return competitionId === UCL_COMPETITION_ID || competitionId == null;
  }

  return competitionId != null && competitionId !== UCL_COMPETITION_ID;
}

function buildHighlightHref(matchId: string, competitionId: string | null) {
  const bucket = belongsToCompetitionBucket(competitionId, OTHER_COMPETITION_ID)
    ? OTHER_COMPETITION_ID
    : UCL_COMPETITION_ID;

  return `/highlights/${matchId}?competition=${bucket}`;
}

function toHighlightCardModel(input: Awaited<ReturnType<typeof fetchHighlights>>[number]): HubHighlightModel {
  const homeScore = input.homeScore ?? input.match.homeScore ?? null;
  const awayScore = input.awayScore ?? input.match.awayScore ?? null;
  const competitionLabel = normalizeCompetitionLabel(
    input.competitionLabel,
    input.competitionId
  );

  return {
    matchId: input.matchId,
    competitionId: input.competitionId,
    competitionLabel,
    href: buildHighlightHref(input.matchId, input.competitionId),
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

export default async function HighlightsPage({ searchParams }: Props) {
  await requireAuth();

  const params = await searchParams;
  const currentCompetitionId = getCompetitionBucket(params.competition);
  const allHighlights = await fetchHighlights();
  const filteredRawHighlights = allHighlights.filter((highlight) =>
    belongsToCompetitionBucket(highlight.competitionId, currentCompetitionId)
  );
  const highlights = filteredRawHighlights
    .map(toHighlightCardModel)
    .sort((a, b) => {
      if (b.publishedAtMs !== a.publishedAtMs) {
        return b.publishedAtMs - a.publishedAtMs;
      }
      return getStageSortValue(a.stageKey) - getStageSortValue(b.stageKey);
    });

  const featuredMatchId =
    filteredRawHighlights.find((item) => item.isFeatured)?.matchId ??
    filteredRawHighlights[0]?.matchId ??
    null;
  const featured =
    highlights.find((item) => item.matchId === featuredMatchId) ?? highlights[0] ?? null;

  const remaining = highlights.filter((item) => item.matchId !== featured?.matchId);
  const stageArchiveIds = new Set<string>();
  const stageSections = STAGE_ROOM_ORDER.map((stageKey) => {
    const items = remaining
      .filter((item) => item.stageKey === stageKey)
      .slice(0, 3);
    for (const item of items) {
      stageArchiveIds.add(item.matchId);
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
  const otherArchiveIds = new Set<string>();
  const competitionSections = Array.from(
    remaining.reduce((map, item) => {
      const key = item.competitionId ?? item.competitionLabel;
      const group = map.get(key) ?? {
        title: item.competitionLabel,
        items: [] as HubHighlightModel[],
      };
      group.items.push(item);
      map.set(key, group);
      return map;
    }, new Map<string, { title: string; items: HubHighlightModel[] }>())
  )
    .map(([key, group]) => ({
      key,
      title: group.title,
      description:
        group.items.length === 1
          ? "The first stored screening in this competition salon."
          : `${group.items.length} stored replays curated into a single competition salon.`,
      items: group.items.slice(0, 3),
    }))
    .sort((a, b) => {
      const aLatest = a.items[0]?.publishedAtMs ?? 0;
      const bLatest = b.items[0]?.publishedAtMs ?? 0;
      return bLatest - aLatest;
    });
  for (const section of competitionSections) {
    for (const item of section.items) {
      otherArchiveIds.add(item.matchId);
    }
  }
  const isUclView = currentCompetitionId === UCL_COMPETITION_ID;
  const archive = remaining.filter((item) =>
    isUclView
      ? !stageArchiveIds.has(item.matchId)
      : !otherArchiveIds.has(item.matchId)
  );
  const curationCards = isUclView
    ? [
        {
          label: "Curator lane",
          value: "European Nights",
          note: "Champions League lives in a dedicated premium lane.",
        },
        {
          label: "Structure",
          value: `${stageSections.length} stage room${stageSections.length === 1 ? "" : "s"}`,
          note: "Knockout chapters are grouped by stage, not buried in a generic feed.",
        },
        {
          label: "Library",
          value: `${highlights.length} stored replay${highlights.length === 1 ? "" : "s"}`,
          note: "Featured premiere, stage rooms, then a quiet archive.",
        },
      ]
    : [
        {
          label: "Curator lane",
          value: "Open Archive",
          note: "Every non-Champions-League tournament lands here.",
        },
        {
          label: "Competition salons",
          value: `${competitionSections.length} active salon${competitionSections.length === 1 ? "" : "s"}`,
          note: "Each tournament earns its own room as soon as highlights exist.",
        },
        {
          label: "Library",
          value: `${highlights.length} stored replay${highlights.length === 1 ? "" : "s"}`,
          note: "Ready for domestic cups, Europa nights and future additions.",
        },
      ];
  const heroConfig = isUclView
    ? {
        eyebrow: "European Nights",
        title: "Champions League highlights",
        description:
          "A separate premium screening room for stored Champions League recaps, curated into featured premieres, stage rooms and a growing archive.",
        highlightCards: [
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
        ],
      }
    : {
        eyebrow: "Open Archive",
        title: "Other competition highlights",
        description:
          "A second premium lane reserved for every non-Champions-League tournament, organized into competition salons so new tournaments can slot in without breaking the editorial rhythm.",
        highlightCards: [
          {
            label: "Lead screening",
            value: featured
              ? `${featured.competitionLabel}: ${featured.title}`
              : "Waiting for the first non-CL recap.",
          },
          {
            label: "Competition salons",
            value: `${competitionSections.length} tournament group${competitionSections.length === 1 ? "" : "s"}`,
          },
          {
            label: "Archive",
            value: `${archive.length} additional replay${archive.length === 1 ? "" : "s"}`,
          },
        ],
      };

  return (
    <div className="space-y-3 sm:space-y-6">
      <PageHeroBand
        eyebrow={heroConfig.eyebrow}
        title={heroConfig.title}
        description={heroConfig.description}
        highlights={heroConfig.highlightCards}
        footerNote={
          <>
            Highlights now live in two editorial lanes: <strong>European Nights</strong> for
            Champions League and <strong>Open Archive</strong> for every other tournament. As
            new competitions are synced, they slot into the <strong>Others</strong> lane
            automatically without changing the core page structure.
          </>
        }
      />

      <section className="space-y-3">
        <CompetitionTabs currentCompetitionId={currentCompetitionId} basePath="/highlights" />
        <div className="grid gap-2 md:grid-cols-3">
          {curationCards.map((card) => (
            <div
              key={card.label}
              className="rounded-[1.2rem] border border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(236,239,244,0.76))] px-4 py-3 shadow-[0_16px_42px_rgba(46,52,64,0.05)]"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-nord-frostDark">
                {card.label}
              </div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-nord-polar">
                {card.value}
              </div>
              <p className="mt-1 text-sm leading-6 text-nord-polarLight">
                {card.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      {highlights.length === 0 ? (
        <HighlightsEmptyState
          eyebrow={isUclView ? "European Nights" : "Open Archive"}
          title={
            isUclView
              ? "No highlights have been synced yet"
              : "The second lane is ready for new tournaments"
          }
          description={
            isUclView
              ? "Run the Champions League highlights sync from the admin API page. Once recaps are stored, European Nights will surface them here automatically."
              : "As soon as another competition is synced, it will open here inside its own competition salon. Champions League remains curated separately in European Nights."
          }
        />
      ) : (
        <>
          {featured ? <FeaturedHighlightCard highlight={featured} /> : null}
          {isUclView
            ? stageSections.map((section) => (
                <StageSection
                  key={section.key}
                  title={section.title}
                  description={section.description}
                  items={section.items}
                />
              ))
            : competitionSections.map((section) => (
                <StageSection
                  key={section.key}
                  eyebrowLabel="Competition salon"
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
                    {isUclView ? "Archive" : "Mixed archive"}
                  </span>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-nord-polar">
                    {isUclView ? "Historical screenings" : "Extended competition library"}
                  </h2>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-nord-polarLight">
                  {isUclView
                    ? "Every additional stored replay stays accessible here without turning the page into a generic thumbnail wall."
                    : "Everything that sits outside the lead salons still remains accessible here, so the Others lane can grow without becoming noisy."}
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
                            {isUclView
                              ? `${item.stageLabel} • ${item.publishedLabel}`
                              : `${item.competitionLabel} • ${item.stageLabel} • ${item.publishedLabel}`}
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
