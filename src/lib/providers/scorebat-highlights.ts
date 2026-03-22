import { SCOREBAT_HIGHLIGHTS_API_URL } from "@/lib/config";
import {
  isChampionsLeagueCompetitionLabel,
  parseScoreBatTitle,
} from "@/lib/highlights/match-resolution";

const SCOREBAT_PROVIDER = "scorebat.com" as const;
const SCOREBAT_BROWSER_HEADERS = {
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
} as const;

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

type ScoreBatRouteConfig = {
  p: string;
  a: string;
};

type ScoreBatEncodedRouteConfig = {
  p: string;
  a: string;
};

type ScoreBatEncodedNcdd = {
  r: ScoreBatEncodedRouteConfig[];
  mx: string;
};

type ScoreBatDecodedNcdd = {
  r: ScoreBatRouteConfig[];
  mx: string;
};

type ScoreBatTokenResponse = {
  response?: {
    cfcc?: Record<string, string>;
    mx?: Record<string, ScoreBatTransformRuleSet>;
  };
};

type ScoreBatVideoPayload = {
  response?: {
    u?: unknown;
    x?: unknown;
    d?: unknown;
  };
  ncdd?: ScoreBatEncodedNcdd | ScoreBatDecodedNcdd;
};

type ScoreBatTransformRuleSet = {
  s?: [number, number, string][];
  s2?: [string, string];
  n?: string;
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

function extractBootstrapValue(html: string, key: string): string | null {
  const match = html.match(new RegExp(`${key}:\\s*"([^"]*)"`, "i"));
  return match?.[1] ?? null;
}

function decodeRepeatedBase64(value: string): string {
  const [encoded, depthToken] = value.split("-");
  let decoded = encoded;
  const depth = Number(
    Buffer.from(
      Buffer.from(depthToken, "base64").toString("utf8"),
      "base64"
    ).toString("utf8")
  );

  for (let index = 0; index < depth; index += 1) {
    decoded = Buffer.from(decoded, "base64").toString("utf8");
  }

  return decoded;
}

function normalizeNcdd(input: ScoreBatEncodedNcdd): ScoreBatDecodedNcdd {
  return {
    mx: decodeRepeatedBase64(input.mx),
    r: input.r.map((item) => ({
      p: decodeRepeatedBase64(item.p),
      a: decodeRepeatedBase64(item.a),
    })),
  };
}

function encodeBase64Times(value: string, times: number): string {
  let encoded = value;
  for (let index = 0; index < times; index += 1) {
    encoded = Buffer.from(encoded, "utf8").toString("base64");
  }
  return encoded;
}

function cutSubstring(value: string, start: number, length: number): string {
  return value.slice(0, start) + value.slice(start + length);
}

function decodeStringBySegments(
  value: string,
  rules: [number, number, string][]
): string {
  let decoded = value;
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    decoded = Buffer.from(decoded, "base64").toString("utf8");
    const [offset, base64Depth, insertedValue] = rules[index];
    const encodedInsertedValue = encodeBase64Times(insertedValue, base64Depth);
    decoded = cutSubstring(decoded, offset, encodedInsertedValue.length);
  }
  return Buffer.from(decoded, "base64").toString("utf8");
}

function computeRotationOffset(
  offsetSeed: string,
  characters: string
): number {
  let sum = 0;
  for (const char of offsetSeed) {
    sum += characters.indexOf(char);
  }
  return sum % characters.length;
}

function rotateCharacters(
  value: string,
  characters: string,
  offset: number
): string {
  return value.replace(/./g, (char) => {
    const index = characters.indexOf(char);
    return index < 0
      ? char
      : characters[(index - offset + characters.length) % characters.length];
  });
}

function buildDigitMap(seed: string): Record<string, string> {
  const map: Record<string, string> = {};
  let digit = 0;

  for (let index = 1; index < seed.length && digit < 10; index += 1) {
    if (index % 2 === 1) {
      map[seed[index]] = String(digit);
      digit += 1;
    }
  }

  return map;
}

function decodeNumericString(
  value: string,
  map: Record<string, string>
): number {
  return Number(
    value.replace(/./g, (char) =>
      Object.prototype.hasOwnProperty.call(map, char) ? map[char] : char
    )
  );
}

function collectPathTargets(
  target: Record<string, unknown>,
  path: string
): Array<{ obj: Record<string, unknown>; key: string }> {
  const steps = path.split(".");
  const matches: Array<{ obj: Record<string, unknown>; key: string }> = [];

  function walk(current: Record<string, unknown> | unknown, stepIndex: number) {
    if (!current || typeof current !== "object" || stepIndex >= steps.length) {
      return;
    }

    const step = steps[stepIndex];
    const match = step.match(/^(\w+)(\[(\*)\])?$/);
    if (!match) return;

    const key = match[1];
    const iterateArray = !!match[3];
    const next = (current as Record<string, unknown>)[key];
    if (next == null) return;

    if (stepIndex === steps.length - 1) {
      matches.push({
        obj: current as Record<string, unknown>,
        key,
      });
      return;
    }

    if (iterateArray && Array.isArray(next)) {
      for (const item of next) {
        walk(item, stepIndex + 1);
      }
      return;
    }

    walk(next, stepIndex + 1);
  }

  walk(target, 0);
  return matches;
}

function decodeVideoPayload(
  payload: ScoreBatVideoPayload,
  transforms: Record<string, ScoreBatTransformRuleSet>
): ScoreBatVideoPayload {
  if (!payload.response || !payload.ncdd) {
    return payload;
  }

  const normalizedNcdd = normalizeNcdd(payload.ncdd as ScoreBatEncodedNcdd);
  const transformSet = transforms[normalizedNcdd.mx];
  if (!transformSet) {
    return {
      ...payload,
      ncdd: normalizedNcdd,
    };
  }

  const response = { ...payload.response } as Record<string, unknown>;
  let charRotationOffset: number | null = null;
  let numericMap: Record<string, string> | null = null;

  for (const route of normalizedNcdd.r) {
    const targets = collectPathTargets(response, route.p);
    for (const target of targets) {
      const value = target.obj[target.key];
      if (typeof value !== "string") continue;

      switch (route.a) {
        case "s":
          if (transformSet.s) {
            target.obj[target.key] = decodeStringBySegments(
              value,
              transformSet.s
            );
          }
          break;
        case "s2":
          if (transformSet.s2) {
            charRotationOffset ??= computeRotationOffset(
              transformSet.s2[1],
              transformSet.s2[0]
            );
            target.obj[target.key] = rotateCharacters(
              value,
              transformSet.s2[0],
              charRotationOffset
            );
          }
          break;
        case "n":
          if (transformSet.n) {
            numericMap ??= buildDigitMap(transformSet.n);
            target.obj[target.key] = decodeNumericString(value, numericMap);
          }
          break;
        default:
          break;
      }
    }
  }

  return {
    ...payload,
    response,
    ncdd: normalizedNcdd,
  };
}

async function requestScoreBatJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...SCOREBAT_BROWSER_HEADERS,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ScoreBat request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function resolveScoreBatPlayableClip(
  embedUrl: string | null
): Promise<{
  embedUrl: string | null;
  pageUrl: string | null;
  providerLabel: string | null;
}> {
  if (!embedUrl) {
    return {
      embedUrl: null,
      pageUrl: null,
      providerLabel: null,
    };
  }

  try {
    const embedPage = await fetch(embedUrl, {
      headers: SCOREBAT_BROWSER_HEADERS,
      cache: "no-store",
    });

    if (!embedPage.ok) {
      return {
        embedUrl: null,
        pageUrl: null,
        providerLabel: null,
      };
    }

    const html = await embedPage.text();
    const requestId = extractBootstrapValue(html, "rq");
    const initToken = extractBootstrapValue(html, "i");
    const token = extractBootstrapValue(html, "token") ?? "";

    if (!requestId || !initToken) {
      return {
        embedUrl: null,
        pageUrl: null,
        providerLabel: null,
      };
    }

    const tokenPayload = await requestScoreBatJson<ScoreBatTokenResponse>(
      "https://api.scorebat.com/rftk/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Origin: "https://www.scorebat.com",
          Referer: embedUrl,
        },
        body: new URLSearchParams({
          inittk: initToken,
        }),
      }
    );

    const cfcc = tokenPayload.response?.cfcc;
    const mx = tokenPayload.response?.mx;
    if (!cfcc || !mx) {
      return {
        embedUrl: null,
        pageUrl: null,
        providerLabel: null,
      };
    }

    const params = new URLSearchParams(cfcc);
    const videoPayload = await requestScoreBatJson<ScoreBatVideoPayload>(
      `https://www.scorebat.com/api/v2cf/video/mbv/${requestId}/${token ? `${token}/` : ""}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Origin: "https://www.scorebat.com",
          Referer: embedUrl,
        },
      }
    );

    const decodedPayload = decodeVideoPayload(videoPayload, mx);
    return {
      embedUrl: asString(decodedPayload.response?.u),
      pageUrl: asString(decodedPayload.response?.x),
      providerLabel: asString(decodedPayload.response?.d),
    };
  } catch {
    return {
      embedUrl: null,
      pageUrl: null,
      providerLabel: null,
    };
  }
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
