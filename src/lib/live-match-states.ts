import {
  fetchFootballDataCompetitionMatches,
  getFootballDataScore,
} from "@/lib/api/football-data-stats";
import { COMPETITIONS, normalizeCompetitionId } from "@/lib/config";
import {
  getLiveMatchStatusLabel,
  isLiveMatchStatus,
  type LiveMatchState,
} from "@/lib/live-match";

export type LiveMatchCandidate = {
  id: string;
  competitionId?: string | null;
  externalApiId?: string | null;
};

async function fetchCompetitionSnapshot(competitionId: string) {
  const competition = COMPETITIONS.find((item) => item.id === competitionId);
  const season = competition?.season ? Number(competition.season) : undefined;

  return fetchFootballDataCompetitionMatches(competitionId, { season });
}

export async function getLiveMatchStates(
  candidates: LiveMatchCandidate[]
): Promise<Record<string, LiveMatchState>> {
  const normalizedCandidates = candidates.filter(
    (candidate) => candidate.id && candidate.externalApiId
  );
  if (normalizedCandidates.length === 0) return {};

  const byCompetition = new Map<string, LiveMatchCandidate[]>();
  for (const candidate of normalizedCandidates) {
    const competitionId = normalizeCompetitionId(candidate.competitionId);

    const list = byCompetition.get(competitionId) ?? [];
    list.push(candidate);
    byCompetition.set(competitionId, list);
  }

  const lastUpdated = new Date().toISOString();
  const states: Record<string, LiveMatchState> = {};

  await Promise.all(
    [...byCompetition.entries()].map(async ([competitionId, competitionMatches]) => {
      const result = await fetchCompetitionSnapshot(competitionId);
      if (!result.ok) return;

      const byExternalId = new Map(
        result.data.map((match) => [String(match.id), match])
      );

      for (const candidate of competitionMatches) {
        const fixture = byExternalId.get(String(candidate.externalApiId));
        if (!fixture) continue;

        const status = String(fixture.status ?? "").toUpperCase();
        const score = getFootballDataScore(fixture.score);

        states[candidate.id] = {
          isLive: isLiveMatchStatus(status),
          status,
          label: getLiveMatchStatusLabel(status),
          homeScore: score?.home ?? null,
          awayScore: score?.away ?? null,
          lastUpdated,
        };
      }
    })
  );

  return states;
}
