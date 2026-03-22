import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { UCL_COMPETITION_ID, UCL_SEASON } from "@/lib/config";
import {
  buildProgramNote,
  formatHighlightSeason,
  getStageSortValue,
} from "@/lib/highlights/presentation";
import { resolveHighlightMatch } from "@/lib/highlights/match-resolution";
import {
  fetchScoreBatHighlights,
  type ScoreBatHighlightEntry,
} from "@/lib/providers/scorebat-highlights";

const SCOREBAT_PROVIDER = "scorebat.com";
const STALE_LOOKBACK_DAYS = 21;

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
        competitionId: UCL_COMPETITION_ID,
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
      take: 500,
    });

    const bestByMatchId = new Map<string, MatchedHighlight>();

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

      const current = bestByMatchId.get(resolution.candidate.id);
      const candidate = { entry, resolution };
      bestByMatchId.set(
        resolution.candidate.id,
        current ? chooseBetterMatch(current, candidate) : candidate
      );
    }

    const matchedHighlights = [...bestByMatchId.values()];
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
        const seasonLabel = formatHighlightSeason(UCL_SEASON);
        const baseData = {
          competitionId: localMatch.competitionId ?? UCL_COMPETITION_ID,
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
            competitionId: UCL_COMPETITION_ID,
            publishedAt: { gte: recentWindowStart },
            matchId: { notIn: touchedMatchIds },
            syncStatus: { not: "unavailable" },
          },
          data: {
            syncStatus: "stale",
          },
        });
      }

      const featureCandidates = await tx.matchHighlight.findMany({
        where: {
          competitionId: UCL_COMPETITION_ID,
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
        where: { competitionId: UCL_COMPETITION_ID, isFeatured: true },
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

      return writeCount;
    });

    const staleCount =
      touchedMatchIds.length > 0
        ? await prisma.matchHighlight.count({
            where: {
              competitionId: UCL_COMPETITION_ID,
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
