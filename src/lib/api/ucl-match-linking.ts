import {
  fetchUclMatches,
  type ApiMatch,
} from "@/lib/api/football-data";
import { UCL_COMPETITION_ID, UCL_SEASON } from "@/lib/config";

export type ResolvedUclFixtureLink = {
  externalApiId: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  providerMatch: ApiMatch;
  linkMode: "exact" | "fuzzy";
};

function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(fc|cf|afc|sc|ac|fk|sk|club|clube|deportivo|calcio|as|sv|nk|ud)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;

  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;

  return union === 0 ? 0 : intersection / union;
}

function findBestProviderFixture(input: {
  matchDatetime: Date;
  homeTeamName: string;
  awayTeamName: string;
  fixtures: ApiMatch[];
}): ApiMatch | null {
  const localHome = normalizeTeamName(input.homeTeamName);
  const localAway = normalizeTeamName(input.awayTeamName);
  const kickoffMs = input.matchDatetime.getTime();

  let best: { score: number; fixture: ApiMatch } | null = null;

  for (const fixture of input.fixtures) {
    const fixtureKickoffMs = new Date(fixture.utcDate).getTime();
    const timeDiffHours = Math.abs(fixtureKickoffMs - kickoffMs) / 36e5;
    if (timeDiffHours > 36) continue;

    const homeScore = tokenSimilarity(
      localHome,
      normalizeTeamName(fixture.homeTeam?.name ?? "")
    );
    const awayScore = tokenSimilarity(
      localAway,
      normalizeTeamName(fixture.awayTeam?.name ?? "")
    );
    if (homeScore < 0.55 || awayScore < 0.55) continue;

    const score = homeScore * 4 + awayScore * 4 - timeDiffHours / 24;
    if (!best || score > best.score) {
      best = { score, fixture };
    }
  }

  return best?.fixture ?? null;
}

export async function resolveUclFixtureLink(input: {
  matchDatetime: Date | string;
  homeTeamName: string;
  awayTeamName: string;
  externalApiId?: string | null;
}): Promise<ResolvedUclFixtureLink | null> {
  const result = await fetchUclMatches(UCL_COMPETITION_ID, UCL_SEASON);
  if (!result.ok) return null;

  const exactMatch =
    input.externalApiId != null
      ? result.matches.find((fixture) => String(fixture.id) === input.externalApiId)
      : null;
  const providerMatch =
    exactMatch ??
    findBestProviderFixture({
      matchDatetime:
        input.matchDatetime instanceof Date
          ? input.matchDatetime
          : new Date(input.matchDatetime),
      homeTeamName: input.homeTeamName,
      awayTeamName: input.awayTeamName,
      fixtures: result.matches,
    });

  if (!providerMatch) return null;

  return {
    externalApiId: String(providerMatch.id),
    homeTeamLogo: providerMatch.homeTeam?.crest ?? null,
    awayTeamLogo: providerMatch.awayTeam?.crest ?? null,
    providerMatch,
    linkMode: exactMatch ? "exact" : "fuzzy",
  };
}
