import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  UCL_COMPETITION_ID,
  UCL_SEASON,
  WORLD_CUP_2026_COMPETITION_ID,
  WORLD_CUP_2026_SEASON,
} from "@/lib/config";
import {
  buildProgramNote,
  formatHighlightSeason,
  getStageSortValue,
} from "@/lib/highlights/presentation";
import { resolveHighlightMatch } from "@/lib/highlights/match-resolution";
import {
  fetchScoreBatHighlights,
  resolveScoreBatPlayableClip,
  type ScoreBatHighlightEntry,
} from "@/lib/providers/scorebat-highlights";

const SCOREBAT_PROVIDER = "scorebat.com";
const STALE_LOOKBACK_DAYS = 21;
/** Competitions we keep highlights for. Highlights are bound to local fixtures
 *  in these competitions; CL also absorbs legacy rows stored with a null id. */
const TRACKED_HIGHLIGHT_COMPETITION_IDS = [
  WORLD_CUP_2026_COMPETITION_ID,
  UCL_COMPETITION_ID,
];

function seasonLabelForCompetition(competitionId: string | null): string {
  return competitionId === WORLD_CUP_2026_COMPETITION_ID
    ? formatHighlightSeason(WORLD_CUP_2026_SEASON)
    : formatHighlightSeason(UCL_SEASON);
}

export type SyncHighlightsResult =
  | {
      ok: true;
      fetchedCount: number;
      matchedCount: number;
      storedCount: number;
      staleCount: number;
      unmatchedCount: number;
    }
  | {
      ok: false;
      error: string;
    };

type MatchedHighlight = {
  entry: ScoreBatHighlightEntry;
  resolution: NonNullable<ReturnType<typeof resolveHighlightMatch>>;
};

function toProviderPayload(
  entry: ScoreBatHighlightEntry
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(entry.rawPayload)) as Prisma.InputJsonValue;
}

function chooseBetterMatch(current: MatchedHighlight, next: MatchedHighlight) {
  if (next.resolution.score !== current.resolution.score) {
    return next.resolution.score > current.resolution.score ? next : current;
  }

  return next.entry.publishedAt > current.entry.publishedAt ? next : current;
}

async function hydratePlayableVideos(
  entry: ScoreBatHighlightEntry
): Promise<ScoreBatHighlightEntry> {
  const videos = await Promise.all(
    entry.videos.map(async (video) => {
      const playable = await resolveScoreBatPlayableClip(video.embedUrl);

      return {
        ...video,
        embedUrl: playable.embedUrl,
        pageUrl: playable.pageUrl ?? video.pageUrl,
      };
    })
  );

  return {
    ...entry,
    videos,
  };
}

export async function syncHighlightsFromApi(options?: {
  markUnmatchedAsStale?: boolean;
}): Promise<SyncHighlightsResult> {
  const providerResult = await fetchScoreBatHighlights();
  if (!providerResult.ok) {
    await prisma.apiSyncLog.create({
      data: {
        provider: SCOREBAT_PROVIDER,
        action: "sync_highlights",
        status: "error",
        errorMessage: providerResult.error,
      },
    });

    return {
      ok: false,
      error: providerResult.error,
    };
  }

  try {
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { competitionId: { in: TRACKED_HIGHLIGHT_COMPETITION_IDS } },
          { competitionId: null },
        ],
      },
      select: {
        id: true,
        competitionId: true,
        matchDatetime: true,
        homeTeamName: true,
        awayTeamName: true,
        homeScore: true,
        awayScore: true,
        stage: true,
      },
      take: 1000,
    });

    // Resolve against the raw (non-hydrated) provider entries first so we only
    // pay the per-video hydration cost for entries that actually bind to a
    // tracked local fixture (World Cup / Champions League).
    const bestRawByMatchId = new Map<
      string,
      {
        entry: ScoreBatHighlightEntry;
        resolution: NonNullable<ReturnType<typeof resolveHighlightMatch>>;
      }
    >();

    for (const entry of providerResult.entries) {
      const resolution = resolveHighlightMatch({
        title: entry.title,
        competition: entry.competition,
        publishedAt: entry.publishedAt,
        matches,
      });
      if (!resolution) {
        continue;
      }

      const current = bestRawByMatchId.get(resolution.candidate.id);
      const candidate = { entry, resolution };
      bestRawByMatchId.set(
        resolution.candidate.id,
        current ? chooseBetterMatch(current, candidate) : candidate
      );
    }

    const matchedHighlights: MatchedHighlight[] = await Promise.all(
      [...bestRawByMatchId.values()].map(async ({ entry, resolution }) => ({
        entry: await hydratePlayableVideos(entry),
        resolution,
      }))
    );
    const touchedMatchIds = matchedHighlights.map(
      ({ resolution }) => resolution.candidate.id
    );
    const now = new Date();
    const recentWindowStart = new Date(now);
    recentWindowStart.setDate(recentWindowStart.getDate() - STALE_LOOKBACK_DAYS);

    const storedCount = await prisma.$transaction(async (tx) => {
      let writeCount = 0;

      for (const { entry, resolution } of matchedHighlights) {
        const localMatch = resolution.candidate;
        const syncStatus =
          entry.videos.some((video) => video.embedUrl) ? "available" : "unavailable";
        const competitionId = localMatch.competitionId ?? UCL_COMPETITION_ID;
        const seasonLabel = seasonLabelForCompetition(competitionId);
        const baseData = {
          competitionId,
          provider: entry.provider,
          providerMatchId: entry.providerMatchId,
          title: entry.title,
          competitionLabel: entry.competition,
          competitionUrl: entry.competitionUrl,
          matchviewUrl: entry.matchviewUrl,
          thumbnailUrl: entry.thumbnailUrl,
          publishedAt: entry.publishedAt,
          homeTeamName: localMatch.homeTeamName,
          awayTeamName: localMatch.awayTeamName,
          homeScore: localMatch.homeScore ?? entry.homeScore,
          awayScore: localMatch.awayScore ?? entry.awayScore,
          stage: localMatch.stage,
          season: seasonLabel,
          programNote: buildProgramNote({
            homeTeamName: localMatch.homeTeamName,
            awayTeamName: localMatch.awayTeamName,
            stage: localMatch.stage,
            homeScore: localMatch.homeScore ?? entry.homeScore,
            awayScore: localMatch.awayScore ?? entry.awayScore,
          }),
          syncStatus,
          syncedAt: now,
          providerPayload: toProviderPayload(entry),
        } as const;

        const highlight = await tx.matchHighlight.upsert({
          where: { matchId: localMatch.id },
          update: baseData,
          create: {
            matchId: localMatch.id,
            isFeatured: false,
            ...baseData,
          },
          select: { id: true },
        });

        await tx.matchHighlightClip.deleteMany({
          where: { highlightId: highlight.id },
        });

        if (entry.videos.length > 0) {
          await tx.matchHighlightClip.createMany({
            data: entry.videos.map((video) => ({
              highlightId: highlight.id,
              provider: video.provider,
              externalVideoId: video.externalVideoId,
              title: video.title,
              embedUrl: video.embedUrl,
              pageUrl: video.pageUrl,
              sortOrder: video.sortOrder,
            })),
          });
        }

        writeCount += 1;
      }

      if ((options?.markUnmatchedAsStale ?? true) && touchedMatchIds.length > 0) {
        await tx.matchHighlight.updateMany({
          where: {
            publishedAt: { gte: recentWindowStart },
            matchId: { notIn: touchedMatchIds },
            syncStatus: { not: "unavailable" },
          },
          data: {
            syncStatus: "stale",
          },
        });
      }

      // Feature one highlight per tracked competition so each tab (World Cup,
      // Champions League) gets its own hero card. MatchHighlight.competitionId is
      // always stored non-null (legacy null rows only live on Match itself).
      for (const competitionId of TRACKED_HIGHLIGHT_COMPETITION_IDS) {
        const featureCandidates = await tx.matchHighlight.findMany({
          where: {
            competitionId,
            syncStatus: { in: ["available", "stale"] },
          },
          select: {
            id: true,
            stage: true,
            publishedAt: true,
          },
          take: 200,
        });

        await tx.matchHighlight.updateMany({
          where: { competitionId, isFeatured: true },
          data: { isFeatured: false },
        });

        const featured = [...featureCandidates].sort((a, b) => {
          if (b.publishedAt.getTime() !== a.publishedAt.getTime()) {
            return b.publishedAt.getTime() - a.publishedAt.getTime();
          }
          return getStageSortValue(a.stage) - getStageSortValue(b.stage);
        })[0];

        if (featured) {
          await tx.matchHighlight.update({
            where: { id: featured.id },
            data: { isFeatured: true },
          });
        }
      }

      return writeCount;
    });

    const staleCount =
      touchedMatchIds.length > 0
        ? await prisma.matchHighlight.count({
            where: {
              publishedAt: { gte: recentWindowStart },
              matchId: { notIn: touchedMatchIds },
              syncStatus: "stale",
            },
          })
        : 0;

    const unmatchedCount = Math.max(
      0,
      providerResult.entries.length - matchedHighlights.length
    );

    await prisma.apiSyncLog.create({
      data: {
        provider: SCOREBAT_PROVIDER,
        action: "sync_highlights",
        status: "success",
        errorMessage: null,
      },
    });

    return {
      ok: true,
      fetchedCount: providerResult.entries.length,
      matchedCount: matchedHighlights.length,
      storedCount,
      staleCount,
      unmatchedCount,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown highlight sync error.";

    await prisma.apiSyncLog.create({
      data: {
        provider: SCOREBAT_PROVIDER,
        action: "sync_highlights",
        status: "error",
        errorMessage: message,
      },
    });

    return {
      ok: false,
      error: message,
    };
  }
}
