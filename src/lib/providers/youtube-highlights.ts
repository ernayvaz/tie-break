/**
 * YouTube Data API v3 provider for official FIFA World Cup 2026 match highlights.
 *
 * Flow (backend only — the API key never reaches the client):
 *   1. search.list — "Home vs Away FIFA World Cup 2026 Highlights", restricted to
 *      FIFA's official channel (channelId), type=video, videoEmbeddable=true,
 *      videoSyndicated=true.
 *   2. videos.list — verify channelId, title, publishedAt and status.embeddable for
 *      the candidates returned by search.
 *   3. Pick the best video whose title mentions BOTH teams, that was published
 *      after the match kickoff and that is embeddable.
 *
 * Videos are never downloaded or re-hosted: callers embed them through
 * youtube-nocookie.com/embed/{videoId}.
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/** Official "FIFA" YouTube channel. Override via FIFA_YOUTUBE_CHANNEL_ID if needed. */
export const DEFAULT_FIFA_YOUTUBE_CHANNEL_ID = "UCpcTrCXblq78GZrTUTLWeBw";

export function getYoutubeApiKey(): string {
  return process.env.YOUTUBE_API_KEY?.trim() || "";
}

export function getFifaYoutubeChannelId(): string {
  return (
    process.env.FIFA_YOUTUBE_CHANNEL_ID?.trim() || DEFAULT_FIFA_YOUTUBE_CHANNEL_ID
  );
}

export function hasYoutubeApiKey(): boolean {
  return getYoutubeApiKey().length > 0;
}

/** Build the youtube-nocookie embed URL for a video id (privacy-enhanced player). */
export function buildYoutubeNoCookieEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export type YoutubeHighlightVideo = {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: Date;
};

export type YoutubeSearchResult =
  | { ok: true; video: YoutubeHighlightVideo | null }
  | { ok: false; error: string; quotaExceeded: boolean };

type YoutubeSearchResponse = {
  items?: { id?: { videoId?: string } }[];
  error?: { errors?: { reason?: string }[]; message?: string };
};

type YoutubeVideosResponse = {
  items?: {
    id: string;
    snippet?: {
      channelId?: string;
      title?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string } | undefined>;
    };
    status?: { embeddable?: boolean };
  }[];
  error?: { errors?: { reason?: string }[]; message?: string };
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Aliases a FIFA video title might use for a team, on top of its canonical English
 * name. Used to verify both teams appear in the title without rejecting legitimate
 * matches that use a common alternate spelling.
 */
const TEAM_TITLE_ALIASES: Record<string, string[]> = {
  "United States": ["usa", "usmnt", "united states"],
  "South Korea": ["korea republic", "korea", "south korea"],
  "Ivory Coast": ["cote d ivoire", "ivory coast"],
  Czechia: ["czech republic", "czechia"],
  "Cape Verde Islands": ["cabo verde", "cape verde"],
  "Congo DR": ["dr congo", "democratic republic of congo", "congo dr"],
  "Bosnia-Herzegovina": ["bosnia and herzegovina", "bosnia herzegovina", "bosnia"],
  "Saudi Arabia": ["saudi arabia", "saudi"],
};

function teamAliases(teamName: string): string[] {
  const aliases = TEAM_TITLE_ALIASES[teamName] ?? [];
  const all = [teamName, ...aliases].map(normalize).filter(Boolean);
  return [...new Set(all)];
}

function titleMentionsTeam(normalizedTitle: string, teamName: string): boolean {
  return teamAliases(teamName).some((alias) => normalizedTitle.includes(alias));
}

function pickThumbnail(
  thumbnails: Record<string, { url?: string } | undefined> | undefined
): string | null {
  if (!thumbnails) return null;
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    null
  );
}

function isQuotaError(body: { error?: { errors?: { reason?: string }[] } }): boolean {
  return (
    body.error?.errors?.some(
      (e) => e.reason === "quotaExceeded" || e.reason === "dailyLimitExceeded"
    ) ?? false
  );
}

/**
 * Search FIFA's official channel for the highlight of a single finished match.
 * Returns the best embeddable video published after kickoff whose title mentions
 * both teams, or null when none qualifies.
 */
export async function searchFifaWorldCupHighlight(params: {
  homeTeamName: string;
  awayTeamName: string;
  matchDateUtc: Date;
}): Promise<YoutubeSearchResult> {
  const apiKey = getYoutubeApiKey();
  if (!apiKey) {
    return { ok: false, error: "YOUTUBE_API_KEY is not configured.", quotaExceeded: false };
  }
  const channelId = getFifaYoutubeChannelId();
  const query = `${params.homeTeamName} vs ${params.awayTeamName} FIFA World Cup 2026 Highlights`;

  // 1) search.list (100 quota units)
  const searchUrl =
    `${YOUTUBE_API_BASE}/search?part=snippet&type=video` +
    `&videoEmbeddable=true&videoSyndicated=true&maxResults=5&order=relevance` +
    `&channelId=${encodeURIComponent(channelId)}` +
    `&q=${encodeURIComponent(query)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  let searchBody: YoutubeSearchResponse;
  try {
    const res = await fetch(searchUrl, { next: { revalidate: 0 } });
    searchBody = (await res.json()) as YoutubeSearchResponse;
    if (!res.ok) {
      return {
        ok: false,
        error: searchBody.error?.message ?? `YouTube search failed (HTTP ${res.status}).`,
        quotaExceeded: isQuotaError(searchBody),
      };
    }
  } catch (e) {
    return {
      ok: false,
      error: `YouTube search request failed: ${e instanceof Error ? e.message : String(e)}`,
      quotaExceeded: false,
    };
  }

  const candidateIds = (searchBody.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (candidateIds.length === 0) {
    return { ok: true, video: null };
  }

  // 2) videos.list (1 quota unit) — verify channel, embeddable, title, date.
  const videosUrl =
    `${YOUTUBE_API_BASE}/videos?part=snippet,status` +
    `&id=${encodeURIComponent(candidateIds.join(","))}` +
    `&key=${encodeURIComponent(apiKey)}`;

  let videosBody: YoutubeVideosResponse;
  try {
    const res = await fetch(videosUrl, { next: { revalidate: 0 } });
    videosBody = (await res.json()) as YoutubeVideosResponse;
    if (!res.ok) {
      return {
        ok: false,
        error: videosBody.error?.message ?? `YouTube videos lookup failed (HTTP ${res.status}).`,
        quotaExceeded: isQuotaError(videosBody),
      };
    }
  } catch (e) {
    return {
      ok: false,
      error: `YouTube videos request failed: ${e instanceof Error ? e.message : String(e)}`,
      quotaExceeded: false,
    };
  }

  // Preserve search relevance order when choosing among valid candidates.
  const byId = new Map((videosBody.items ?? []).map((v) => [v.id, v]));
  for (const id of candidateIds) {
    const video = byId.get(id);
    if (!video?.snippet) continue;
    if (video.status?.embeddable !== true) continue;
    if (video.snippet.channelId !== channelId) continue;

    const publishedAt = video.snippet.publishedAt
      ? new Date(video.snippet.publishedAt)
      : null;
    if (!publishedAt || Number.isNaN(publishedAt.getTime())) continue;
    if (publishedAt.getTime() < params.matchDateUtc.getTime()) continue;

    const normalizedTitle = normalize(video.snippet.title ?? "");
    if (
      !titleMentionsTeam(normalizedTitle, params.homeTeamName) ||
      !titleMentionsTeam(normalizedTitle, params.awayTeamName)
    ) {
      continue;
    }

    return {
      ok: true,
      video: {
        videoId: id,
        title: video.snippet.title ?? `${params.homeTeamName} vs ${params.awayTeamName}`,
        thumbnailUrl: pickThumbnail(video.snippet.thumbnails),
        publishedAt,
      },
    };
  }

  return { ok: true, video: null };
}
