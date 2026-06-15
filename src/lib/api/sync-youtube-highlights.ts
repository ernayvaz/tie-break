/**
 * Sync official FIFA World Cup 2026 highlights from YouTube onto finished fixtures.
 *
 * Fixtures / scores / finished state come from OpenLigaDB (stored on Match). We only
 * search YouTube for matches that are finished and have a final score, and we stop
 * searching a match once an embeddable official video is stored — both to keep the
 * page useful and to protect the YouTube Data API daily quota.
 *
 * Results are written to the shared MatchHighlight / MatchHighlightClip tables with
 * provider "youtube", so the existing highlights UI renders them with no changes.
 */
import { prisma } from "@/lib/db";
import {
  WORLD_CUP_2026_COMPETITION_ID,
  WORLD_CUP_2026_SEASON,
} from "@/lib/config";
import { buildProgramNote, formatHighlightSeason } from "@/lib/highlights/presentation";
import {
  searchFifaWorldCupHighlight,
  buildYoutubeNoCookieEmbedUrl,
  hasYoutubeApiKey,
} from "@/lib/providers/youtube-highlights";

const YOUTUBE_PROVIDER = "youtube";
const SCOREBAT_PROVIDER = "scorebat.com";
/** Cap searches per run so a single sync never blows the daily YouTube quota. */
const MAX_SEARCHES_PER_RUN = 40;

export type SyncYoutubeHighlightsResult =
  | {
      ok: true;
      finishedCount: number;
      searched: number;
      foundCount: number;
      notFoundCount: number;
      skippedAlreadyFound: number;
      quotaExceeded: boolean;
    }
  | { ok: false; error: string };

export async function syncWorldCupYoutubeHighlights(options?: {
  maxSearches?: number;
}): Promise<SyncYoutubeHighlightsResult> {
  if (!hasYoutubeApiKey()) {
    await prisma.apiSyncLog.create({
      data: {
        provider: YOUTUBE_PROVIDER,
        action: "sync_wc_highlights",
        status: "error",
        errorMessage: "YOUTUBE_API_KEY is not configured.",
      },
    });
    return { ok: false, error: "YOUTUBE_API_KEY is not configured." };
  }

  const maxSearches = Math.max(1, options?.maxSearches ?? MAX_SEARCHES_PER_RUN);

  // Finished World Cup fixtures with a valid final score (OpenLigaDB-driven).
  const finished = await prisma.match.findMany({
    where: {
      competitionId: WORLD_CUP_2026_COMPETITION_ID,
      officialResultType: { not: null },
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: {
      id: true,
      matchDatetime: true,
      homeTeamName: true,
      awayTeamName: true,
      homeScore: true,
      awayScore: true,
      stage: true,
      highlight: {
        select: { id: true, provider: true, syncStatus: true, syncedAt: true, _count: { select: { clips: true } } },
      },
    },
  });

  // Skip when a playable highlight already exists (ScoreBat preferred, or prior YouTube).
  const pending = finished.filter((m) => {
    const h = m.highlight;
    if (!h) return true;
    const hasPlayable =
      h.syncStatus === "available" && h._count.clips > 0;
    if (hasPlayable && h.provider === SCOREBAT_PROVIDER) return false;
    if (hasPlayable && h.provider === YOUTUBE_PROVIDER) return false;
    return true;
  });

  // Search the never-tried fixtures first, then those whose last attempt is oldest.
  pending.sort((a, b) => {
    const aTried = a.highlight?.syncedAt?.getTime() ?? 0;
    const bTried = b.highlight?.syncedAt?.getTime() ?? 0;
    return aTried - bTried;
  });

  const now = new Date();
  const seasonLabel = formatHighlightSeason(WORLD_CUP_2026_SEASON);
  let searched = 0;
  let foundCount = 0;
  let notFoundCount = 0;
  let quotaExceeded = false;

  for (const match of pending) {
    if (searched >= maxSearches) break;
    searched += 1;

    const result = await searchFifaWorldCupHighlight({
      homeTeamName: match.homeTeamName,
      awayTeamName: match.awayTeamName,
      matchDateUtc: match.matchDatetime,
    });

    if (!result.ok) {
      // Stop the whole run on quota exhaustion; otherwise skip this match and continue.
      if (result.quotaExceeded) {
        quotaExceeded = true;
        searched -= 1; // this match was not actually consumed against quota budget
        break;
      }
      continue;
    }

    const baseData = {
      competitionId: WORLD_CUP_2026_COMPETITION_ID,
      provider: YOUTUBE_PROVIDER,
      competitionLabel: "FIFA World Cup 2026",
      homeTeamName: match.homeTeamName,
      awayTeamName: match.awayTeamName,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      stage: match.stage,
      season: seasonLabel,
      syncedAt: now,
    } as const;

    if (result.video) {
      const video = result.video;
      // Keep a few candidates so the player can fall through Content-ID embed blocks.
      const candidates = result.videos.slice(0, 3);
      const highlight = await prisma.matchHighlight.upsert({
        where: { matchId: match.id },
        update: {
          ...baseData,
          providerMatchId: video.videoId,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt,
          syncStatus: "available",
          programNote: buildProgramNote({
            homeTeamName: match.homeTeamName,
            awayTeamName: match.awayTeamName,
            stage: match.stage,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
          }),
        },
        create: {
          matchId: match.id,
          ...baseData,
          providerMatchId: video.videoId,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt,
          syncStatus: "available",
          isFeatured: false,
          programNote: buildProgramNote({
            homeTeamName: match.homeTeamName,
            awayTeamName: match.awayTeamName,
            stage: match.stage,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
          }),
        },
        select: { id: true },
      });

      await prisma.matchHighlightClip.deleteMany({ where: { highlightId: highlight.id } });
      await prisma.matchHighlightClip.createMany({
        data: candidates.map((candidate, index) => ({
          highlightId: highlight.id,
          provider: YOUTUBE_PROVIDER,
          externalVideoId: candidate.videoId,
          title: candidate.title,
          embedUrl: buildYoutubeNoCookieEmbedUrl(candidate.videoId),
          pageUrl: `https://www.youtube.com/watch?v=${candidate.videoId}`,
          sortOrder: index,
        })),
      });
      foundCount += 1;
    } else {
      // No qualifying official video yet — record the attempt so the next run retries
      // other fixtures first, and the match page shows the graceful "not available" state.
      notFoundCount += 1;
      const existing = match.highlight;
      if (existing) {
        // Never downgrade an existing playable highlight; just touch the attempt time.
        if (!(existing.provider === YOUTUBE_PROVIDER && existing.syncStatus === "available")) {
          await prisma.matchHighlight.update({
            where: { matchId: match.id },
            data: { ...baseData, syncStatus: "unavailable" },
          });
        }
      } else {
        await prisma.matchHighlight.create({
          data: {
            matchId: match.id,
            ...baseData,
            providerMatchId: `pending-${match.id}`,
            title: `${match.homeTeamName} vs ${match.awayTeamName}`,
            thumbnailUrl: null,
            publishedAt: match.matchDatetime,
            syncStatus: "unavailable",
            isFeatured: false,
            programNote: buildProgramNote({
              homeTeamName: match.homeTeamName,
              awayTeamName: match.awayTeamName,
              stage: match.stage,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
            }),
          },
        });
      }
    }
  }

  // Feature the most recent playable World Cup highlight so its tab has a hero card.
  const featureTarget = await prisma.matchHighlight.findFirst({
    where: {
      competitionId: WORLD_CUP_2026_COMPETITION_ID,
      provider: YOUTUBE_PROVIDER,
      syncStatus: "available",
    },
    orderBy: { publishedAt: "desc" },
    select: { id: true },
  });
  if (featureTarget) {
    await prisma.matchHighlight.updateMany({
      where: { competitionId: WORLD_CUP_2026_COMPETITION_ID, isFeatured: true },
      data: { isFeatured: false },
    });
    await prisma.matchHighlight.update({
      where: { id: featureTarget.id },
      data: { isFeatured: true },
    });
  }

  await prisma.apiSyncLog.create({
    data: {
      provider: YOUTUBE_PROVIDER,
      action: "sync_wc_highlights",
      status: "success",
      errorMessage: quotaExceeded ? "Stopped early: YouTube quota exceeded." : null,
    },
  });

  return {
    ok: true,
    finishedCount: finished.length,
    searched,
    foundCount,
    notFoundCount,
    skippedAlreadyFound: finished.length - pending.length,
    quotaExceeded,
  };
}
