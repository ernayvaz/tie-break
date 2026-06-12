import { unstable_cache } from "next/cache";
import { fetchFootballDataCompetitionStandings } from "@/lib/api/football-data-stats";
import {
  WORLD_CUP_2026_COMPETITION_ID,
  WORLD_CUP_2026_SEASON,
} from "@/lib/config";

export type WorldCupStandingRow = {
  rank: number;
  teamName: string;
  teamCrest: string | null;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string | null;
};

export type WorldCupStandingsGroup = {
  name: string;
  rows: WorldCupStandingRow[];
};

const STANDINGS_REVALIDATE_SECONDS = 600;

function formatGroupName(group: string | null | undefined, index: number): string {
  if (!group || !group.trim()) {
    return index === 0 ? "Group stage" : `Group stage ${index + 1}`;
  }

  return group
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

async function fetchWorldCupStandings(): Promise<WorldCupStandingsGroup[]> {
  const result = await fetchFootballDataCompetitionStandings(
    WORLD_CUP_2026_COMPETITION_ID,
    WORLD_CUP_2026_SEASON
  );

  if (!result.ok) {
    return [];
  }

  const groups: WorldCupStandingsGroup[] = [];
  const totalStandings = (result.data.standings ?? []).filter(
    (standing) => (standing.type ?? "TOTAL") === "TOTAL"
  );

  totalStandings.forEach((standing, index) => {
    const rows = (standing.table ?? [])
      .map((row) => ({
        rank: row.position,
        teamName: row.team?.name ?? row.team?.shortName ?? "TBD",
        teamCrest: row.team?.crest ?? null,
        played: row.playedGames ?? 0,
        won: row.won ?? 0,
        draw: row.draw ?? 0,
        lost: row.lost ?? 0,
        goalsFor: row.goalsFor ?? 0,
        goalsAgainst: row.goalsAgainst ?? 0,
        goalDifference: row.goalDifference ?? 0,
        points: row.points ?? 0,
        form: row.form ?? null,
      }))
      .filter((row) => row.teamName !== "TBD" || row.played > 0);

    if (rows.length === 0) return;

    groups.push({
      name: formatGroupName(standing.group, index),
      rows,
    });
  });

  return groups;
}

/**
 * Cached so traffic on the schedule page never floods football-data.org. The
 * standings are refreshed at most once per revalidate window, which keeps the
 * shared API key well clear of the free-tier rate limit while still following
 * the provider-priority rule (football-data.org first, ScoreAxis as fallback).
 */
export const getWorldCupStandings = unstable_cache(
  fetchWorldCupStandings,
  ["world-cup-2026-standings"],
  { revalidate: STANDINGS_REVALIDATE_SECONDS, tags: ["world-cup-standings"] }
);
