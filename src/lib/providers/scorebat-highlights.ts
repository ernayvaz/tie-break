import { SCOREBAT_HIGHLIGHTS_API_URL } from "@/lib/config";
import {
  isChampionsLeagueCompetitionLabel,
  parseScoreBatTitle,
} from "@/lib/highlights/match-resolution";

const SCOREBAT_PROVIDER = "scorebat.com" as const;

type ScoreBatApiResponse = {
  response?: unknown;
};

type ScoreBatApiClip = {
  id?: unknown;
  title?: unknown;
  embed?: unknown;
};

type ScoreBatApiEntry = {
  title?: unknown;
  competition?: unknown;
  matchviewUrl?: unknown;
  competitionUrl?: unknown;
  thumbnail?: unknown;
  date?: unknown;
  videos?: unknown;
};

export type ScoreBatHighlightClip = {
  provider: typeof SCOREBAT_PROVIDER;
  externalVideoId: string;
  title: string;
  embedUrl: string | null;
  pageUrl: string | null;
  sortOrder: number;
};

export type ScoreBatHighlightEntry = {
  provider: typeof SCOREBAT_PROVIDER;
  providerMatchId: string | null;
  title: string;
  competition: string;
  competitionUrl: string | null;
  matchviewUrl: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  videos: ScoreBatHighlightClip[];
  rawPayload: ScoreBatApiEntry;
};

export type ScoreBatHighlightsResult =
  | { ok: true; entries: ScoreBatHighlightEntry[] }
  | { ok: false; error: string };

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractEmbedUrl(embedHtml: string | null): string | null {
  if (!embedHtml) return null;
  const match = embedHtml.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
  return match?.[1] ?? null;
}

function extractProviderMatchId(matchviewUrl: string | null): string | null {
  if (!matchviewUrl) return null;
  const match = matchviewUrl.match(/\/matchview\/(\d+)\//);
  return match?.[1] ?? null;
}

function normalizeClip(
  value: unknown,
  index: number,
  fallbackPageUrl: string | null,
  fallbackKey: string
): ScoreBatHighlightClip | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as ScoreBatApiClip;
  const title = asString(raw.title) ?? "Highlights";
  const externalVideoId = asString(raw.id) ?? `${fallbackKey}-${index}`;
  const embedUrl = extractEmbedUrl(asString(raw.embed));

  if (!externalVideoId) return null;

  return {
    provider: SCOREBAT_PROVIDER,
    externalVideoId,
    title,
    embedUrl,
    pageUrl: fallbackPageUrl,
    sortOrder: index,
  };
}

function normalizeEntry(value: unknown): ScoreBatHighlightEntry | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as ScoreBatApiEntry;
  const title = asString(raw.title);
  const competition = asString(raw.competition);
  const matchviewUrl = asString(raw.matchviewUrl);
  const competitionUrl = asString(raw.competitionUrl);
  const thumbnailUrl = asString(raw.thumbnail);
  const dateValue = asString(raw.date);

  if (!title || !competition || !dateValue) {
    return null;
  }

  if (!isChampionsLeagueCompetitionLabel(competition)) {
    return null;
  }

  const parsedTitle = parseScoreBatTitle(title);
  if (!parsedTitle) {
    return null;
  }

  const publishedAt = new Date(dateValue);
  if (Number.isNaN(publishedAt.getTime())) {
    return null;
  }

  const providerMatchId = extractProviderMatchId(matchviewUrl);
  const videosRaw = Array.isArray(raw.videos) ? raw.videos : [];
  const videos = videosRaw
    .map((clip, index) =>
      normalizeClip(
        clip,
        index,
        matchviewUrl,
        providerMatchId ?? `${parsedTitle.homeTeamName}-${parsedTitle.awayTeamName}`
      )
    )
    .filter((clip): clip is ScoreBatHighlightClip => clip !== null);

  if (videos.length === 0 && !matchviewUrl) {
    return null;
  }

  return {
    provider: SCOREBAT_PROVIDER,
    providerMatchId,
    title,
    competition,
    competitionUrl,
    matchviewUrl,
    thumbnailUrl,
    publishedAt,
    homeTeamName: parsedTitle.homeTeamName,
    awayTeamName: parsedTitle.awayTeamName,
    homeScore: parsedTitle.homeScore,
    awayScore: parsedTitle.awayScore,
    videos,
    rawPayload: raw,
  };
}

export async function fetchScoreBatHighlights(): Promise<ScoreBatHighlightsResult> {
  try {
    const response = await fetch(SCOREBAT_HIGHLIGHTS_API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `ScoreBat highlights request failed with ${response.status}.`,
      };
    }

    const data = (await response.json()) as ScoreBatApiResponse;
    const entries = Array.isArray(data.response)
      ? data.response
          .map(normalizeEntry)
          .filter((entry): entry is ScoreBatHighlightEntry => entry !== null)
      : [];

    return {
      ok: true,
      entries,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown ScoreBat highlights error.",
    };
  }
}
