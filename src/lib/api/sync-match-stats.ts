import { prisma } from "@/lib/db";
import { getScoreAxisDomesticLeagueInfo } from "@/lib/scoreaxis";
import {
  STATS_H2H_MATCH_LIMIT,
  STATS_RECENT_MATCH_LIMIT,
  STATS_SYNC_LOOKAHEAD_DAYS,
  STATS_SYNC_LOOKBACK_DAYS,
  UCL_SEASON,
} from "@/lib/config";
import {
  fetchFootballDataCompetitionMatches,
  fetchFootballDataCompetitionScorers,
  fetchFootballDataCompetitionStandings,
  fetchFootballDataMatchHeadToHead,
  fetchFootballDataTeam,
  fetchFootballDataTeamMatches,
  fetchFootballDataUclFixtures,
  getFootballDataOutcomeLabel,
  getFootballDataScore,
  type FootballDataMatch,
  type FootballDataScorer,
  type FootballDataStandingRow,
  type FootballDataStandingsResponse,
  type FootballDataTeamResponse,
} from "./football-data-stats";
import type {
  MatchStatisticsPayload,
  StatsFixtureSection,
  StatsH2HSection,
  StatsLeagueTableRow,
  StatsLeagueSnapshot,
  StatsMatchSummary,
  StatsPlayerLeader,
  StatsPlayerLeadersSection,
  StatsProviderLinkMode,
  StatsSectionState,
  StatsTeamInfoSection,
  StatsTeamRecord,
  StatsTeamSection,
} from "@/lib/match-stats/types";
import {
  createUnavailableFixtureSection,
  createUnavailableLeagueSnapshot,
  createUnavailableMatchStatisticsPayload,
  createUnavailableTeamSection,
} from "@/lib/match-stats/types";
import { applyMatchCenterProviderFallbacks } from "@/lib/providers/resolve-match-center";

type SyncResult =
  | {
      ok: true;
      targetCount: number;
      syncedCount: number;
      unavailableCount: number;
    }
  | { ok: false; error: string };

type LocalMatch = {
  id: string;
  externalApiId?: string | null;
  competitionId: string | null;
  matchDatetime: Date;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
};

type TeamResolution = {
  teamId: number;
  name: string;
  logo: string | null;
};

type DomesticLeagueResolution = {
  leagueId: number;
  competitionCode: string;
  leagueName: string;
  leagueLogo: string | null;
  countryName: string | null;
  season: number;
  standingsAvailable: boolean;
};

type MatchProviderFixture = FootballDataMatch;

type FootballDataStandingRows = {
  overall: FootballDataStandingRow | null;
  home: FootballDataStandingRow | null;
  away: FootballDataStandingRow | null;
};

type HeadToHeadResolution = {
  matches: FootballDataMatch[];
  knownTotalMeetings: number | null;
  isTruncated: boolean;
  error: string | null;
};

type MatchedFixtureResolution = {
  fixture: FootballDataMatch;
  linkMode: StatsProviderLinkMode;
};

const FOOTBALL_DATA_DELAY_MS = 6_300;
const MATCH_CENTER_PROVIDER = "provider-priority-chain";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRateLimitedCaller(minDelayMs: number) {
  let lastCallAt = 0;

  return async function call<T>(runner: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const waitMs = Math.max(0, lastCallAt + minDelayMs - now);
    if (waitMs > 0) await sleep(waitMs);
    const result = await runner();
    lastCallAt = Date.now();
    return result;
  };
}

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

function normalizeCompetitionCode(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;

  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  if (union === 0) return 0;
  return intersection / union;
}

function getFixtureKickoff(fixture: MatchProviderFixture): string {
  return fixture.utcDate;
}

function getFixtureCompetitionName(fixture: MatchProviderFixture): string | null {
  return fixture.competition.name ?? null;
}

function getFixtureCompetitionLogo(fixture: MatchProviderFixture): string | null {
  return fixture.competition.emblem ?? null;
}

function getFixtureHomeTeamName(fixture: MatchProviderFixture): string {
  return fixture.homeTeam.name;
}

function getFixtureAwayTeamName(fixture: MatchProviderFixture): string {
  return fixture.awayTeam.name;
}

function getFixtureHomeTeamId(fixture: MatchProviderFixture): number {
  return fixture.homeTeam.id;
}

function getFixtureAwayTeamId(fixture: MatchProviderFixture): number {
  return fixture.awayTeam.id;
}

function getFixtureScore(
  fixture: MatchProviderFixture
): { home: number | null; away: number | null } {
  const score = getFootballDataScore(fixture.score);
  return {
    home: score?.home ?? null,
    away: score?.away ?? null,
  };
}

function getFixtureOutcomeLabel(fixture: MatchProviderFixture): string | null {
  return getFootballDataOutcomeLabel(fixture);
}

function isFinishedFixture(fixture: MatchProviderFixture): boolean {
  return fixture.status === "FINISHED";
}

function normalizeFormString(form: string | null | undefined): string | null {
  if (!form) return null;
  const compact = form.replace(/[^WDL]/gi, "").toUpperCase();
  return compact || null;
}

function formatCompetitionStage(stage: string | null | undefined): string | null {
  if (!stage) return null;

  const normalized = stage.toUpperCase().replace(/\s+/g, "_");
  const stageLabels: Record<string, string> = {
    LEAGUE_STAGE: "League stage",
    GROUP_STAGE: "Group stage",
    PLAYOFFS: "Play-offs",
    LAST_16: "Round of 16",
    ROUND_16: "Round of 16",
    QUARTER_FINAL: "Quarter-final",
    QUARTER_FINALS: "Quarter-finals",
    SEMI_FINAL: "Semi-final",
    SEMI_FINALS: "Semi-finals",
    FINAL: "Final",
  };

  return stageLabels[normalized] ?? stage.replace(/_/g, " ").toLowerCase();
}

function getPerspectiveScore(
  fixture: MatchProviderFixture,
  teamId: number
): { goalsFor: number; goalsAgainst: number } | null {
  const score = getFixtureScore(fixture);
  if (score.home == null || score.away == null) return null;

  const isHome = getFixtureHomeTeamId(fixture) === teamId;
  const isAway = getFixtureAwayTeamId(fixture) === teamId;
  if (!isHome && !isAway) return null;

  return isHome
    ? { goalsFor: score.home, goalsAgainst: score.away }
    : { goalsFor: score.away, goalsAgainst: score.home };
}

function getPerspectiveOutcome(
  fixture: MatchProviderFixture,
  teamId: number
): "W" | "D" | "L" | null {
  const score = getPerspectiveScore(fixture, teamId);
  if (!score) return null;
  if (score.goalsFor > score.goalsAgainst) return "W";
  if (score.goalsFor < score.goalsAgainst) return "L";
  return "D";
}

function buildComputedRecordFromMatches(
  fixtures: MatchProviderFixture[],
  teamId: number,
  venue?: "home" | "away"
): StatsTeamRecord | null {
  const relevantFixtures = fixtures.filter((fixture) => {
    if (!isFinishedFixture(fixture)) return false;

    const isHome = getFixtureHomeTeamId(fixture) === teamId;
    const isAway = getFixtureAwayTeamId(fixture) === teamId;
    if (!isHome && !isAway) return false;
    if (venue === "home" && !isHome) return false;
    if (venue === "away" && !isAway) return false;
    return true;
  });

  if (relevantFixtures.length === 0) return null;

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const fixture of relevantFixtures) {
    const score = getPerspectiveScore(fixture, teamId);
    const outcome = getPerspectiveOutcome(fixture, teamId);
    if (!score || !outcome) continue;

    goalsFor += score.goalsFor;
    goalsAgainst += score.goalsAgainst;

    if (outcome === "W") wins++;
    else if (outcome === "D") draws++;
    else losses++;
  }

  const played = wins + draws + losses;
  if (played === 0) return null;

  return {
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
  };
}

function buildComputedFormFromMatches(
  fixtures: MatchProviderFixture[],
  teamId: number
): string | null {
  const form = fixtures
    .filter(
      (fixture) =>
        isFinishedFixture(fixture) &&
        (getFixtureHomeTeamId(fixture) === teamId ||
          getFixtureAwayTeamId(fixture) === teamId)
    )
    .sort(
      (a, b) =>
        new Date(getFixtureKickoff(b)).getTime() -
        new Date(getFixtureKickoff(a)).getTime()
    )
    .slice(0, STATS_RECENT_MATCH_LIMIT)
    .map((fixture) => getPerspectiveOutcome(fixture, teamId))
    .filter((result): result is "W" | "D" | "L" => result !== null)
    .join("");

  return form || null;
}

function buildComputedCompetitionSnapshot(input: {
  competition: DomesticLeagueResolution;
  fixtures: MatchProviderFixture[];
  teamId: number;
  description: string | null;
  unavailableMessage: string;
}): StatsLeagueSnapshot {
  const overall = buildComputedRecordFromMatches(input.fixtures, input.teamId);
  if (!overall) {
    return createUnavailableLeagueSnapshot(input.unavailableMessage);
  }

  return {
    status: "available",
    competitionCode: input.competition.competitionCode,
    leagueName: input.competition.leagueName,
    leagueLogo: input.competition.leagueLogo,
    countryName: input.competition.countryName,
    season: input.competition.season,
    standing: {
      rank: null,
      points: null,
      form: buildComputedFormFromMatches(input.fixtures, input.teamId),
      description: input.description,
      records: {
        overall,
        home: buildComputedRecordFromMatches(input.fixtures, input.teamId, "home"),
        away: buildComputedRecordFromMatches(input.fixtures, input.teamId, "away"),
      },
    },
    message: null,
  };
}

function toMatchSummary(fixture: MatchProviderFixture): StatsMatchSummary {
  const score = getFixtureScore(fixture);
  return {
    id: String(fixture.id),
    kickoff: getFixtureKickoff(fixture),
    competitionName: getFixtureCompetitionName(fixture),
    competitionLogo: getFixtureCompetitionLogo(fixture),
    homeTeamName: getFixtureHomeTeamName(fixture),
    awayTeamName: getFixtureAwayTeamName(fixture),
    homeGoals: score.home,
    awayGoals: score.away,
    outcomeLabel: getFixtureOutcomeLabel(fixture),
  };
}

function buildRecord(
  entry:
    | {
        played: number;
        win: number;
        draw: number;
        lose: number;
        goals: { for: number; against: number };
      }
    | FootballDataStandingRow
): StatsTeamRecord {
  if ("playedGames" in entry) {
    return {
      played: entry.playedGames,
      wins: entry.won,
      draws: entry.draw,
      losses: entry.lost,
      goalsFor: entry.goalsFor,
      goalsAgainst: entry.goalsAgainst,
      goalDifference: entry.goalDifference,
    };
  }

  return {
    played: entry.played,
    wins: entry.win,
    draws: entry.draw,
    losses: entry.lose,
    goalsFor: entry.goals.for,
    goalsAgainst: entry.goals.against,
    goalDifference: entry.goals.for - entry.goals.against,
  };
}

function buildLeagueSnapshot(
  league: DomesticLeagueResolution,
  standingRows: FootballDataStandingRows | null,
  options: {
    unavailableMessage?: string | null;
    description?: string | null;
    computedRecordFallback?: {
      fixtures: MatchProviderFixture[];
      teamId: number;
    } | null;
  } = {}
): StatsLeagueSnapshot {
  if (!standingRows?.overall) {
    return {
      status: "unavailable",
      competitionCode: league.competitionCode,
      leagueName: league.leagueName,
      leagueLogo: league.leagueLogo,
      countryName: league.countryName,
      season: league.season,
      standing: null,
      message:
        options.unavailableMessage ??
        "Domestic league data is not available for this team.",
    };
  }

  return {
    status: "available",
    competitionCode: league.competitionCode,
    leagueName: league.leagueName,
    leagueLogo: league.leagueLogo,
    countryName: league.countryName,
    season: league.season,
    standing: {
      rank: standingRows.overall.position,
      points: standingRows.overall.points,
      form: normalizeFormString(standingRows.overall.form),
      description: options.description ?? null,
      records: {
        overall: buildRecord(standingRows.overall),
        home:
          standingRows.home
            ? buildRecord(standingRows.home)
            : options.computedRecordFallback
              ? buildComputedRecordFromMatches(
                  options.computedRecordFallback.fixtures,
                  options.computedRecordFallback.teamId,
                  "home"
                )
              : null,
        away:
          standingRows.away
            ? buildRecord(standingRows.away)
            : options.computedRecordFallback
              ? buildComputedRecordFromMatches(
                  options.computedRecordFallback.fixtures,
                  options.computedRecordFallback.teamId,
                  "away"
                )
              : null,
      },
    },
    message: null,
  };
}

function buildLeagueTableSection(input: {
  standingsResponse: FootballDataStandingsResponse | undefined;
  highlightedTeamId: number;
  leagueName: string | null;
}) {
  const overallTable =
    input.standingsResponse?.standings.find((standing) => standing.type === "TOTAL")
      ?.table ?? [];

  if (overallTable.length === 0) {
    return {
      status: "unavailable" as const,
      leagueName: input.leagueName,
      rows: [] as StatsLeagueTableRow[],
      message: "Domestic league table is not available right now.",
    };
  }

  return {
    status: "available" as const,
    leagueName: input.leagueName,
    rows: overallTable.map((row) => ({
      rank: row.position,
      teamId: row.team.id,
      teamName: row.team.name,
      teamLogo: row.team.crest ?? null,
      played: row.playedGames,
      wins: row.won,
      draws: row.draw,
      losses: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      points: row.points,
      form: normalizeFormString(row.form),
      isHighlighted: row.team.id === input.highlightedTeamId,
    })),
    message: null,
  };
}

function buildTeamInfoSection(
  team: FootballDataTeamResponse | undefined,
  fallback?: {
    officialName: string;
    shortName?: string | null;
    tla?: string | null;
    areaName?: string | null;
  }
): StatsTeamInfoSection {
  if (!team) {
    if (fallback) {
      return {
        status: "partial",
        officialName: fallback.officialName,
        shortName: fallback.shortName ?? null,
        tla: fallback.tla ?? null,
        founded: null,
        venue: null,
        website: null,
        clubColors: null,
        coachName: null,
        squadSize: null,
        areaName: fallback.areaName ?? null,
        message:
          "Detailed team profile fields are unavailable right now, but core club identity is still shown.",
      };
    }

    return {
      status: "unavailable",
      officialName: null,
      shortName: null,
      tla: null,
      founded: null,
      venue: null,
      website: null,
      clubColors: null,
      coachName: null,
      squadSize: null,
      areaName: null,
      message: "Team profile data is not available for this club.",
    };
  }

  return {
    status: "available",
    officialName: team.name,
    shortName: team.shortName ?? null,
    tla: team.tla ?? null,
    founded: team.founded ?? null,
    venue: team.venue ?? null,
    website: team.website ?? null,
    clubColors: team.clubColors ?? null,
    coachName: team.coach?.name ?? null,
    squadSize: team.squad?.length ?? null,
    areaName: team.area?.name ?? null,
    message: null,
  };
}

function buildSquadFallbackLeaders(
  team: FootballDataTeamResponse | undefined,
  competitionName: string | null
): StatsPlayerLeadersSection | null {
  const players =
    team?.squad
      ?.filter((player) => Boolean(player.name))
      .slice(0, 5)
      .map((player) => ({
        playerId: player.id ?? null,
        playerName: player.name ?? "Player",
        teamName: team?.name ?? null,
        position: player.position ?? null,
        playedMatches: null,
        goals: null,
        assists: null,
        penalties: null,
      })) ?? [];

  if (players.length === 0) return null;

  return {
    status: "partial",
    title: "Team top players",
    competitionName,
    players,
    message:
      "Competition scorer data is unavailable, so this panel falls back to the current squad list.",
  };
}

function mapScorerToLeader(scorer: FootballDataScorer): StatsPlayerLeader | null {
  if (!scorer.player?.name) return null;

  return {
    playerId: scorer.player.id ?? null,
    playerName: scorer.player.name,
    teamName: scorer.team?.name ?? null,
    position: scorer.player.position ?? null,
    playedMatches: scorer.playedMatches ?? null,
    goals: scorer.goals ?? null,
    assists: scorer.assists ?? null,
    penalties: scorer.penalties ?? null,
  };
}

function buildPlayerLeadersSection(input: {
  scorers: FootballDataScorer[];
  title: string;
  competitionName: string | null;
  teamId?: number;
  message: string;
  limit?: number;
}): StatsPlayerLeadersSection {
  const filteredScorers =
    input.teamId == null
      ? input.scorers
      : input.scorers.filter((scorer) => scorer.team?.id === input.teamId);
  const players = filteredScorers
    .map(mapScorerToLeader)
    .filter((player): player is StatsPlayerLeader => player !== null)
    .slice(0, input.limit ?? 5);

  if (players.length === 0) {
    return {
      status: "unavailable",
      title: input.title,
      competitionName: input.competitionName,
      players: [],
      message: input.message,
    };
  }

  return {
    status: "available",
    title: input.title,
    competitionName: input.competitionName,
    players,
    message: null,
  };
}

function buildFixtureSection(
  matches: StatsMatchSummary[],
  unavailableMessage: string
): StatsFixtureSection {
  if (matches.length === 0) {
    return createUnavailableFixtureSection(unavailableMessage);
  }

  return {
    status: "available",
    matches,
    message: null,
  };
}

function combineStatuses(statuses: StatsSectionState[]): StatsSectionState {
  if (statuses.every((status) => status === "available")) return "available";
  if (statuses.every((status) => status === "unavailable")) return "unavailable";
  return "partial";
}

function buildTeamSection(input: {
  localTeamName: string;
  localTeamLogo: string | null;
  resolution: TeamResolution | null;
  league: DomesticLeagueResolution | null;
  leagueStandingsResponse: FootballDataStandingsResponse | undefined;
  standingRows: FootballDataStandingRows | null;
  currentCompetition: DomesticLeagueResolution | null;
  currentCompetitionStandingRows: FootballDataStandingRows | null;
  currentCompetitionFixtures: MatchProviderFixture[];
  currentCompetitionDescription: string | null;
  teamDetails: FootballDataTeamResponse | undefined;
  topPlayers: FootballDataScorer[];
  recentDomestic: StatsMatchSummary[];
  recentUcl: StatsMatchSummary[];
}): StatsTeamSection {
  if (!input.resolution) {
    return createUnavailableTeamSection(input.localTeamName, input.localTeamLogo);
  }

  const fallbackDomesticLeagueInfo = getScoreAxisDomesticLeagueInfo(
    input.localTeamName
  );

  const domesticLeague = input.league
    ? buildLeagueSnapshot(
        input.league,
        input.standingRows,
        {
          unavailableMessage: input.league.standingsAvailable
            ? null
            : "Domestic league standings are not available for this competition.",
        }
      )
    : {
        ...createUnavailableLeagueSnapshot(
          "Domestic league data is not available for this team."
        ),
        leagueName: fallbackDomesticLeagueInfo?.leagueName ?? null,
      };
  const domesticLeagueTable =
    input.league && input.resolution
      ? buildLeagueTableSection({
          standingsResponse: input.leagueStandingsResponse,
          highlightedTeamId: input.resolution.teamId,
          leagueName:
            domesticLeague.leagueName ??
            input.league.leagueName ??
            fallbackDomesticLeagueInfo?.leagueName ??
            null,
        })
      : {
          status: "unavailable" as const,
          leagueName: fallbackDomesticLeagueInfo?.leagueName ?? null,
          rows: [] as StatsLeagueTableRow[],
          message: "Domestic league table is not available for this team.",
        };

  const currentCompetition = input.currentCompetition
    ? input.currentCompetitionStandingRows?.overall
      ? buildLeagueSnapshot(input.currentCompetition, input.currentCompetitionStandingRows, {
          unavailableMessage: "Current competition snapshot is not available for this team.",
          description: input.currentCompetitionDescription,
          computedRecordFallback: {
            fixtures: input.currentCompetitionFixtures,
            teamId: input.resolution.teamId,
          },
        })
      : buildComputedCompetitionSnapshot({
          competition: input.currentCompetition,
          fixtures: input.currentCompetitionFixtures,
          teamId: input.resolution.teamId,
          description: input.currentCompetitionDescription,
          unavailableMessage:
            "Current competition snapshot is not available for this team.",
        })
    : createUnavailableLeagueSnapshot(
        "Current competition snapshot is not available for this team."
      );
  const competitionNameForPlayers =
    domesticLeague.leagueName ?? currentCompetition.leagueName ?? null;
  const scorerTopPlayers = buildPlayerLeadersSection({
    scorers: input.topPlayers,
    teamId: input.resolution.teamId,
    title: "Top players",
    competitionName: competitionNameForPlayers,
    message: "Top-player data is not available for this team right now.",
  });
  const topPlayers =
    scorerTopPlayers.status === "available"
      ? scorerTopPlayers
      : buildSquadFallbackLeaders(input.teamDetails, competitionNameForPlayers) ??
        scorerTopPlayers;
  const teamInfo = buildTeamInfoSection(input.teamDetails, {
    officialName: input.resolution.name || input.localTeamName,
    shortName: input.localTeamName,
    areaName:
      input.league?.countryName ??
      input.currentCompetition?.countryName ??
      null,
  });

  const recentDomesticMatches = buildFixtureSection(
    input.recentDomestic,
    "No recent domestic matches available."
  );
  const recentUclMatches = buildFixtureSection(
    input.recentUcl,
    "No recent Champions League matches available."
  );

  return {
    status: combineStatuses([
      domesticLeague.status,
      domesticLeagueTable.status,
      currentCompetition.status,
      topPlayers.status,
      teamInfo.status,
      recentDomesticMatches.status,
      recentUclMatches.status,
    ]),
    teamName: input.localTeamName,
    teamLogo: input.localTeamLogo ?? input.resolution.logo,
    providerTeamId: input.resolution.teamId,
    domesticLeague,
    domesticLeagueTable,
    currentCompetition,
    topPlayers,
    teamInfo,
    recentDomesticMatches,
    recentUclMatches,
  };
}

const FOOTBALL_DATA_PROVIDER = "football-data.org";
const SUPPORTED_DOMESTIC_COMPETITIONS = [
  "PL",
  "PD",
  "BL1",
  "SA",
  "FL1",
  "DED",
  "PPL",
] as const;
const RECENT_COMPETITION_LOOKBACK_DAYS = 120;

type FootballDataTeamCandidate = {
  teamId: number;
  name: string;
  shortName: string | null;
  logo: string | null;
  competitionId: number;
  competitionCode: string;
  competitionName: string;
  competitionLogo: string | null;
  countryName: string | null;
  season: number;
};

function summarizeHeadToHead(
  fixtures: MatchProviderFixture[],
  currentHomeTeamId: number,
  currentAwayTeamId: number,
  knownTotalMeetings: number | null
) {
  let homeTeamWins = 0;
  let awayTeamWins = 0;
  let draws = 0;

  for (const fixture of fixtures) {
    const { home: homeGoals, away: awayGoals } = getFixtureScore(fixture);
    if (homeGoals == null || awayGoals == null) continue;

    const fixtureHomeId = getFixtureHomeTeamId(fixture);
    const fixtureAwayId = getFixtureAwayTeamId(fixture);

    let currentHomeGoals = 0;
    let currentAwayGoals = 0;
    if (
      fixtureHomeId === currentHomeTeamId &&
      fixtureAwayId === currentAwayTeamId
    ) {
      currentHomeGoals = homeGoals;
      currentAwayGoals = awayGoals;
    } else if (
      fixtureHomeId === currentAwayTeamId &&
      fixtureAwayId === currentHomeTeamId
    ) {
      currentHomeGoals = awayGoals;
      currentAwayGoals = homeGoals;
    } else {
      continue;
    }

    if (currentHomeGoals > currentAwayGoals) homeTeamWins++;
    else if (currentAwayGoals > currentHomeGoals) awayTeamWins++;
    else draws++;
  }

  return {
    totalMeetings: knownTotalMeetings ?? fixtures.length,
    analyzedMeetings: fixtures.length,
    homeTeamWins,
    draws,
    awayTeamWins,
  };
}

function createUnavailablePayloadForMatch(match: LocalMatch): MatchStatisticsPayload {
  return createUnavailableMatchStatisticsPayload({
    homeTeamName: match.homeTeamName,
    homeTeamLogo: match.homeTeamLogo,
    awayTeamName: match.awayTeamName,
    awayTeamLogo: match.awayTeamLogo,
  });
}

function getSyncWindow(now: Date) {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - STATS_SYNC_LOOKBACK_DAYS);

  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + STATS_SYNC_LOOKAHEAD_DAYS);

  return { from, to };
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getRecentCompetitionWindow(now: Date) {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - RECENT_COMPETITION_LOOKBACK_DAYS);
  return {
    dateFrom: formatDateOnly(from),
    dateTo: formatDateOnly(now),
  };
}

function getSeasonYear(): number {
  return Number(UCL_SEASON);
}

function getSeasonStartYear(startDate: string | undefined): number {
  if (!startDate) return getSeasonYear();
  const year = Number(startDate.slice(0, 4));
  return Number.isFinite(year) ? year : getSeasonYear();
}

function getStandingRowsForTeam(
  standingsResponse: FootballDataStandingsResponse | undefined,
  teamId: number
): FootballDataStandingRows | null {
  if (!standingsResponse) return null;

  const getRowByType = (type: "TOTAL" | "HOME" | "AWAY") =>
    standingsResponse.standings
      .find((standing) => standing.type === type)
      ?.table.find((row) => row.team.id === teamId) ?? null;

  const overall = getRowByType("TOTAL");
  if (!overall) return null;

  return {
    overall,
    home: getRowByType("HOME"),
    away: getRowByType("AWAY"),
  };
}

function buildDomesticTeamCandidates(
  standingsByCompetitionCode: Map<string, FootballDataStandingsResponse>
): FootballDataTeamCandidate[] {
  const candidates: FootballDataTeamCandidate[] = [];

  for (const [competitionCode, response] of standingsByCompetitionCode.entries()) {
    const overallTable =
      response.standings.find((standing) => standing.type === "TOTAL")?.table ?? [];
    const season = getSeasonStartYear(response.season.startDate);

    for (const row of overallTable) {
      candidates.push({
        teamId: row.team.id,
        name: row.team.name,
        shortName: row.team.shortName ?? null,
        logo: row.team.crest ?? null,
        competitionId: response.competition.id,
        competitionCode,
        competitionName: response.competition.name,
        competitionLogo: response.competition.emblem ?? null,
        countryName: response.area?.name ?? null,
        season,
      });
    }
  }

  return candidates;
}

function buildDomesticLeagueByTeamId(
  candidates: FootballDataTeamCandidate[]
): Map<number, DomesticLeagueResolution> {
  const domesticLeagueByTeamId = new Map<number, DomesticLeagueResolution>();

  for (const candidate of candidates) {
    if (domesticLeagueByTeamId.has(candidate.teamId)) continue;

    domesticLeagueByTeamId.set(candidate.teamId, {
      leagueId: candidate.competitionId,
      competitionCode: candidate.competitionCode,
      leagueName: candidate.competitionName,
      leagueLogo: candidate.competitionLogo,
      countryName: candidate.countryName,
      season: candidate.season,
      standingsAvailable: true,
    });
  }

  return domesticLeagueByTeamId;
}

function inferDomesticLeagueFromTeamDetails(
  team: FootballDataTeamResponse | undefined
): DomesticLeagueResolution | null {
  const domesticCompetition = team?.runningCompetitions?.find(
    (competition) => competition.type === "LEAGUE"
  );
  if (!domesticCompetition) return null;

  return {
    leagueId: domesticCompetition.id,
    competitionCode: domesticCompetition.code,
    leagueName: domesticCompetition.name,
    leagueLogo: domesticCompetition.emblem ?? null,
    countryName: team?.area?.name ?? null,
    season: getSeasonYear(),
    standingsAvailable: false,
  };
}

function inferDomesticLeagueFromTeamMatches(
  fixtures: MatchProviderFixture[],
  excludedCompetitionCodes: Set<string>
): DomesticLeagueResolution | null {
  const competitionCandidates = new Map<
    string,
    {
      count: number;
      latestKickoffMs: number;
      fixture: MatchProviderFixture;
    }
  >();

  for (const fixture of fixtures) {
    if (!isFinishedFixture(fixture)) continue;

    const competitionCode = normalizeCompetitionCode(fixture.competition.code);
    if (!competitionCode || excludedCompetitionCodes.has(competitionCode)) continue;
    if (fixture.competition.type && fixture.competition.type !== "LEAGUE") continue;

    const kickoffMs = new Date(getFixtureKickoff(fixture)).getTime();
    const existing = competitionCandidates.get(competitionCode);
    if (!existing) {
      competitionCandidates.set(competitionCode, {
        count: 1,
        latestKickoffMs: kickoffMs,
        fixture,
      });
      continue;
    }

    existing.count += 1;
    if (kickoffMs > existing.latestKickoffMs) {
      existing.latestKickoffMs = kickoffMs;
      existing.fixture = fixture;
    }
  }

  const bestCandidate = [...competitionCandidates.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return right.latestKickoffMs - left.latestKickoffMs;
  })[0];

  if (!bestCandidate) return null;

  return {
    leagueId: bestCandidate.fixture.competition.id,
    competitionCode: bestCandidate.fixture.competition.code,
    leagueName: bestCandidate.fixture.competition.name,
    leagueLogo: bestCandidate.fixture.competition.emblem ?? null,
    countryName: bestCandidate.fixture.area?.name ?? null,
    season: getSeasonStartYear(bestCandidate.fixture.season?.startDate),
    standingsAvailable: false,
  };
}

function findRecentUclMatches(
  fixtures: MatchProviderFixture[],
  teamId: number
): StatsMatchSummary[] {
  return fixtures
    .filter((fixture) => {
      return (
        isFinishedFixture(fixture) &&
        (getFixtureHomeTeamId(fixture) === teamId ||
          getFixtureAwayTeamId(fixture) === teamId)
      );
    })
    .sort(
      (a, b) =>
        new Date(getFixtureKickoff(b)).getTime() -
        new Date(getFixtureKickoff(a)).getTime()
    )
    .slice(0, STATS_RECENT_MATCH_LIMIT)
    .map(toMatchSummary);
}

function findBestFixtureMatch(
  match: LocalMatch,
  fixtures: MatchProviderFixture[],
  usedFixtureIds: Set<number>
): MatchProviderFixture | null {
  const localHome = normalizeTeamName(match.homeTeamName);
  const localAway = normalizeTeamName(match.awayTeamName);
  const matchTime = match.matchDatetime.getTime();

  let best: { score: number; fixture: MatchProviderFixture } | null = null;

  for (const fixture of fixtures) {
    const fixtureId = fixture.id;
    if (usedFixtureIds.has(fixtureId)) continue;
    const timeDiffHours =
      Math.abs(new Date(getFixtureKickoff(fixture)).getTime() - matchTime) / 36e5;
    if (timeDiffHours > 36) continue;

    const homeScore = tokenSimilarity(
      localHome,
      normalizeTeamName(getFixtureHomeTeamName(fixture))
    );
    const awayScore = tokenSimilarity(
      localAway,
      normalizeTeamName(getFixtureAwayTeamName(fixture))
    );
    const totalScore = homeScore * 4 + awayScore * 4 - timeDiffHours / 24;

    if (homeScore < 0.55 || awayScore < 0.55) continue;
    if (!best || totalScore > best.score) {
      best = { score: totalScore, fixture };
    }
  }

  return best?.fixture ?? null;
}

function buildHeadToHeadFromTeamMatches(
  fixtures: MatchProviderFixture[],
  homeTeamId: number,
  awayTeamId: number
): HeadToHeadResolution {
  const relevantMatches = fixtures
    .filter((fixture) => {
      if (!isFinishedFixture(fixture)) return false;

      const fixtureHomeId = getFixtureHomeTeamId(fixture);
      const fixtureAwayId = getFixtureAwayTeamId(fixture);

      return (
        (fixtureHomeId === homeTeamId && fixtureAwayId === awayTeamId) ||
        (fixtureHomeId === awayTeamId && fixtureAwayId === homeTeamId)
      );
    })
    .sort(
      (a, b) =>
        new Date(getFixtureKickoff(b)).getTime() -
        new Date(getFixtureKickoff(a)).getTime()
    );

  const limitedMatches = relevantMatches.slice(0, STATS_H2H_MATCH_LIMIT);

  return {
    matches: limitedMatches,
    knownTotalMeetings: relevantMatches.length,
    isTruncated: relevantMatches.length > limitedMatches.length,
    error: null,
  };
}

function findBestTeamCandidate(
  teamName: string,
  candidates: FootballDataTeamCandidate[]
): TeamResolution | null {
  const normalizedQuery = normalizeTeamName(teamName);
  let best: { score: number; candidate: FootballDataTeamCandidate } | null = null;

  for (const candidate of candidates) {
    const score = Math.max(
      tokenSimilarity(normalizedQuery, normalizeTeamName(candidate.name)),
      candidate.shortName
        ? tokenSimilarity(normalizedQuery, normalizeTeamName(candidate.shortName))
        : 0
    );

    if (!best || score > best.score) {
      best = { score, candidate };
    }
  }

  if (!best || best.score < 0.6) return null;
  return {
    teamId: best.candidate.teamId,
    name: best.candidate.name,
    logo: best.candidate.logo,
  };
}

function buildOverallStatus(
  h2hStatus: StatsSectionState,
  homeStatus: StatsSectionState,
  awayStatus: StatsSectionState
): StatsSectionState {
  return combineStatuses([h2hStatus, homeStatus, awayStatus]);
}

function buildProviderLinkMode(
  linkMode: StatsProviderLinkMode
): StatsProviderLinkMode {
  return linkMode;
}

function buildStatsNote(input: {
  providerMatchLinkMode: StatsProviderLinkMode;
  isH2HTruncated: boolean;
}): string | null {
  const notes: string[] = [];

  if (input.providerMatchLinkMode === "fuzzy") {
    notes.push("This fixture is paired to provider data using team and kickoff matching.");
  }

  if (input.isH2HTruncated) {
    notes.push(
      `Historical meetings are limited to the provider response window of ${STATS_H2H_MATCH_LIMIT} matches.`
    );
  }

  return notes.length > 0 ? notes.join(" ") : null;
}

export async function syncMatchStatisticsCache(options?: {
  matchIds?: string[];
}): Promise<SyncResult> {
  const now = new Date();
  const seasonYear = getSeasonYear();
  const { from, to } = getSyncWindow(now);
  const recentCompetitionWindow = getRecentCompetitionWindow(now);
  const targetMatchIds =
    options?.matchIds?.filter(Boolean).map((matchId) => matchId.trim()) ?? [];
  const isTargetedRefresh = targetMatchIds.length > 0;

  const matches = await prisma.match.findMany({
    where: {
      homeTeamName: { not: "TBD" },
      awayTeamName: { not: "TBD" },
      ...(targetMatchIds.length > 0
        ? { id: { in: targetMatchIds } }
        : { matchDatetime: { gte: from, lte: to } }),
    },
    orderBy: { matchDatetime: "asc" },
    select: {
      id: true,
      externalApiId: true,
      competitionId: true,
      matchDatetime: true,
      homeTeamName: true,
      awayTeamName: true,
      homeTeamLogo: true,
      awayTeamLogo: true,
    },
  });

  if (matches.length === 0) {
    return { ok: true, targetCount: 0, syncedCount: 0, unavailableCount: 0 };
  }

  // Single-match interactive refreshes should complete quickly when a user opens
  // Match Center, while broad background syncs stay conservative with provider limits.
  const rateLimitedApiCall = createRateLimitedCaller(
    isTargetedRefresh && targetMatchIds.length <= 2
      ? 250
      : FOOTBALL_DATA_DELAY_MS
  );

  const uclFixturesResult = await rateLimitedApiCall(() =>
    fetchFootballDataUclFixtures()
  );
  if (!uclFixturesResult.ok) {
    await prisma.apiSyncLog.create({
      data: {
        provider: FOOTBALL_DATA_PROVIDER,
        action: "sync_match_statistics",
        status: "error",
        errorMessage: uclFixturesResult.error,
      },
    });
    return { ok: false, error: uclFixturesResult.error };
  }

  const uclFixtures = uclFixturesResult.data;
  const competitionFixturesByCode = new Map<string, FootballDataMatch[]>([
    ["CL", uclFixtures],
  ]);
  const requestedCompetitionCodes = new Set<string>();
  for (const match of matches) {
    const competitionCode = normalizeCompetitionCode(match.competitionId);
    if (competitionCode && competitionCode !== "CL") {
      requestedCompetitionCodes.add(competitionCode);
    }
  }

  for (const competitionCode of requestedCompetitionCodes) {
    const fixturesResult = await rateLimitedApiCall(() =>
      fetchFootballDataCompetitionMatches(competitionCode, {
        season: seasonYear,
      })
    );
    if (fixturesResult.ok) {
      competitionFixturesByCode.set(competitionCode, fixturesResult.data);
    }
  }

  const allFetchedFixtures = Array.from(
    new Map(
      [...competitionFixturesByCode.values()]
        .flat()
        .map((fixture) => [String(fixture.id), fixture])
    ).values()
  );
  const allFetchedFixturesById = new Map(
    allFetchedFixtures.map((fixture) => [String(fixture.id), fixture])
  );
  const usedFixtureIds = new Set<number>();
  const matchedFixtureByMatchId = new Map<string, MatchedFixtureResolution>();
  const teamResolutionByName = new Map<string, TeamResolution>();

  for (const match of matches) {
    const preferredCompetitionCode = normalizeCompetitionCode(match.competitionId);
    const preferredFixtures = preferredCompetitionCode
      ? competitionFixturesByCode.get(preferredCompetitionCode) ?? []
      : [];
    const exactFixture = match.externalApiId
      ? preferredFixtures.find((fixture) => String(fixture.id) === match.externalApiId) ??
        allFetchedFixturesById.get(match.externalApiId) ??
        null
      : null;
    const fuzzyFixture = exactFixture
      ? null
      : findBestFixtureMatch(
          match,
          preferredFixtures.length > 0 ? preferredFixtures : allFetchedFixtures,
          usedFixtureIds
        );
    const resolvedFixture = exactFixture ?? fuzzyFixture;
    const linkMode: StatsProviderLinkMode = exactFixture
      ? "exact"
      : fuzzyFixture
        ? "fuzzy"
        : "none";

    if (!resolvedFixture) {
      continue;
    }

    usedFixtureIds.add(resolvedFixture.id);
    matchedFixtureByMatchId.set(match.id, {
      fixture: resolvedFixture,
      linkMode,
    });
    teamResolutionByName.set(match.homeTeamName, {
      teamId: resolvedFixture.homeTeam.id,
      name: resolvedFixture.homeTeam.name,
      logo: match.homeTeamLogo ?? resolvedFixture.homeTeam.crest ?? null,
    });
    teamResolutionByName.set(match.awayTeamName, {
      teamId: resolvedFixture.awayTeam.id,
      name: resolvedFixture.awayTeam.name,
      logo: match.awayTeamLogo ?? resolvedFixture.awayTeam.crest ?? null,
    });
  }

  const usedCurrentCompetitionCodes = new Set<string>();
  const currentCompetitionCodesByTeamId = new Map<number, Set<string>>();
  for (const resolution of matchedFixtureByMatchId.values()) {
    usedCurrentCompetitionCodes.add(resolution.fixture.competition.code);
    const teamIds = [resolution.fixture.homeTeam.id, resolution.fixture.awayTeam.id];
    for (const teamId of teamIds) {
      const codes = currentCompetitionCodesByTeamId.get(teamId) ?? new Set<string>();
      codes.add(resolution.fixture.competition.code);
      currentCompetitionCodesByTeamId.set(teamId, codes);
    }
  }

  const currentCompetitionStandingsByCode = new Map<
    string,
    FootballDataStandingsResponse
  >();
  for (const competitionCode of usedCurrentCompetitionCodes) {
    const standingsResult = await rateLimitedApiCall(() =>
      fetchFootballDataCompetitionStandings(competitionCode, seasonYear)
    );
    if (standingsResult.ok) {
      currentCompetitionStandingsByCode.set(competitionCode, standingsResult.data);
    }
  }

  const standingsByCompetitionCode = new Map<string, FootballDataStandingsResponse>();
  if (!isTargetedRefresh) {
    for (const competitionCode of SUPPORTED_DOMESTIC_COMPETITIONS) {
      const standingsResult = await rateLimitedApiCall(() =>
        fetchFootballDataCompetitionStandings(competitionCode, seasonYear)
      );
      if (standingsResult.ok) {
        standingsByCompetitionCode.set(competitionCode, standingsResult.data);
      }
    }
  }

  let domesticCandidates = buildDomesticTeamCandidates(standingsByCompetitionCode);
  let domesticLeagueByTeamId = buildDomesticLeagueByTeamId(domesticCandidates);

  const unresolvedTeamNames = new Set<string>();
  for (const match of matches) {
    if (!teamResolutionByName.has(match.homeTeamName)) {
      unresolvedTeamNames.add(match.homeTeamName);
    }
    if (!teamResolutionByName.has(match.awayTeamName)) {
      unresolvedTeamNames.add(match.awayTeamName);
    }
  }

  if (isTargetedRefresh && unresolvedTeamNames.size > 0 && standingsByCompetitionCode.size === 0) {
    for (const competitionCode of SUPPORTED_DOMESTIC_COMPETITIONS) {
      const standingsResult = await rateLimitedApiCall(() =>
        fetchFootballDataCompetitionStandings(competitionCode, seasonYear)
      );
      if (standingsResult.ok) {
        standingsByCompetitionCode.set(competitionCode, standingsResult.data);
      }
    }

    domesticCandidates = buildDomesticTeamCandidates(standingsByCompetitionCode);
    domesticLeagueByTeamId = buildDomesticLeagueByTeamId(domesticCandidates);
  }

  for (const teamName of unresolvedTeamNames) {
    const resolved = findBestTeamCandidate(teamName, domesticCandidates);
    if (!resolved) continue;
    teamResolutionByName.set(teamName, resolved);
  }

  const usedDomesticCompetitionCodes = new Set<string>();
  for (const resolution of teamResolutionByName.values()) {
    const league = domesticLeagueByTeamId.get(resolution.teamId);
    if (league?.competitionCode) {
      usedDomesticCompetitionCodes.add(league.competitionCode);
    }
  }

  const usedTeamIds = new Set<number>();
  for (const resolution of teamResolutionByName.values()) {
    usedTeamIds.add(resolution.teamId);
  }

  const teamDetailsByTeamId = new Map<number, FootballDataTeamResponse>();
  for (const teamId of usedTeamIds) {
    const teamResult = await rateLimitedApiCall(() => fetchFootballDataTeam(teamId));
    if (teamResult.ok) {
      teamDetailsByTeamId.set(teamId, teamResult.data);
    }
  }

  const inferredDomesticLeagueByTeamId = new Map<number, DomesticLeagueResolution>();
  for (const [teamId, teamDetails] of teamDetailsByTeamId.entries()) {
    const inferredLeague = inferDomesticLeagueFromTeamDetails(teamDetails);
    if (!inferredLeague) continue;

    inferredDomesticLeagueByTeamId.set(teamId, inferredLeague);
    usedDomesticCompetitionCodes.add(inferredLeague.competitionCode);

    if (!standingsByCompetitionCode.has(inferredLeague.competitionCode)) {
      const standingsResult = await rateLimitedApiCall(() =>
        fetchFootballDataCompetitionStandings(
          inferredLeague.competitionCode,
          seasonYear
        )
      );
      if (standingsResult.ok) {
        standingsByCompetitionCode.set(
          inferredLeague.competitionCode,
          standingsResult.data
        );
      }
    }

    if (!domesticLeagueByTeamId.has(teamId)) {
      const hasStandings = standingsByCompetitionCode.has(
        inferredLeague.competitionCode
      );
      domesticLeagueByTeamId.set(teamId, {
        ...inferredLeague,
        standingsAvailable: hasStandings,
      });
    }
  }

  const competitionScorersByCode = new Map<string, FootballDataScorer[]>();
  for (const competitionCode of new Set([
    ...usedDomesticCompetitionCodes,
    ...usedCurrentCompetitionCodes,
  ])) {
    const scorersResult = await rateLimitedApiCall(() =>
      fetchFootballDataCompetitionScorers(competitionCode, { limit: 40 })
    );
    if (scorersResult.ok) {
      competitionScorersByCode.set(
        competitionCode,
        scorersResult.data.scorers ?? []
      );
    }
  }

  const domesticFixturesByCompetitionCode = new Map<string, FootballDataMatch[]>();
  for (const competitionCode of usedDomesticCompetitionCodes) {
    const fixturesResult = await rateLimitedApiCall(() =>
      fetchFootballDataCompetitionMatches(competitionCode, {
        season: seasonYear,
        status: "FINISHED",
        ...(targetMatchIds.length > 0 && targetMatchIds.length <= 2
          ? {}
          : {
              dateFrom: recentCompetitionWindow.dateFrom,
              dateTo: recentCompetitionWindow.dateTo,
            }),
      })
    );
    if (fixturesResult.ok) {
      domesticFixturesByCompetitionCode.set(competitionCode, fixturesResult.data);
    }
  }

  const currentCompetitionFixturesByCode = new Map<string, FootballDataMatch[]>();
  for (const competitionCode of usedCurrentCompetitionCodes) {
    const existingFixtures = competitionFixturesByCode.get(competitionCode);
    if (existingFixtures) {
      currentCompetitionFixturesByCode.set(competitionCode, existingFixtures);
      continue;
    }

    const fixturesResult = await rateLimitedApiCall(() =>
      fetchFootballDataCompetitionMatches(competitionCode, {
        season: seasonYear,
      })
    );
    if (fixturesResult.ok) {
      currentCompetitionFixturesByCode.set(competitionCode, fixturesResult.data);
    }
  }

  const h2hBySourceMatchId = new Map<string, HeadToHeadResolution>();
  const h2hCacheByApiMatchId = new Map<string, HeadToHeadResolution>();
  for (const match of matches) {
    const matchedFixtureResolution = matchedFixtureByMatchId.get(match.id) ?? null;
    const sourceMatchId =
      matchedFixtureResolution?.linkMode === "exact"
        ? match.externalApiId ??
          String(matchedFixtureResolution.fixture.id)
        : String(matchedFixtureResolution?.fixture.id ?? "");
    if (!sourceMatchId) continue;

    if (h2hCacheByApiMatchId.has(sourceMatchId)) {
      h2hBySourceMatchId.set(
        match.id,
        h2hCacheByApiMatchId.get(sourceMatchId) ?? {
          matches: [],
          knownTotalMeetings: null,
          isTruncated: false,
          error: null,
        }
      );
      continue;
    }

    const numericMatchId = Number(sourceMatchId);
    if (!Number.isFinite(numericMatchId)) continue;

    const h2hResult = await rateLimitedApiCall(() =>
      fetchFootballDataMatchHeadToHead(numericMatchId, STATS_H2H_MATCH_LIMIT)
    );
    const resolution: HeadToHeadResolution = h2hResult.ok
      ? {
          matches: h2hResult.data.matches ?? [],
          knownTotalMeetings:
            h2hResult.data.aggregates?.numberOfMatches ??
            h2hResult.data.resultSet?.count ??
            (h2hResult.data.matches ?? []).length,
          isTruncated:
            (h2hResult.data.aggregates?.numberOfMatches ??
              h2hResult.data.resultSet?.count ??
              (h2hResult.data.matches ?? []).length) >
            (h2hResult.data.matches ?? []).length,
          error: null,
        }
      : {
          matches: [],
          knownTotalMeetings: null,
          isTruncated: false,
          error: h2hResult.error,
        };

    h2hCacheByApiMatchId.set(sourceMatchId, resolution);
    h2hBySourceMatchId.set(match.id, resolution);
  }

  const allowTeamLevelFallbacks =
    targetMatchIds.length > 0 && targetMatchIds.length <= 4;
  const teamMatchesCacheByKey = new Map<string, FootballDataMatch[]>();
  const getTeamMatches = async (
    teamId: number,
    options: { competitions?: string | string[] } = {}
  ) => {
    const competitionsKey = Array.isArray(options.competitions)
      ? options.competitions.join(",")
      : options.competitions ?? "all";
    const cacheKey = `${teamId}:${competitionsKey}`;

    if (teamMatchesCacheByKey.has(cacheKey)) {
      return teamMatchesCacheByKey.get(cacheKey) ?? [];
    }

    const result = await rateLimitedApiCall(() =>
      fetchFootballDataTeamMatches(teamId, {
        competitions: options.competitions,
        status: "FINISHED",
        limit: Math.max(STATS_H2H_MATCH_LIMIT, STATS_RECENT_MATCH_LIMIT * 4),
      })
    );
    const fixtures = result.ok ? result.data : [];
    teamMatchesCacheByKey.set(cacheKey, fixtures);
    return fixtures;
  };

  for (const teamId of usedTeamIds) {
    if (domesticLeagueByTeamId.has(teamId) || inferredDomesticLeagueByTeamId.has(teamId)) {
      continue;
    }

    const inferredLeague = inferDomesticLeagueFromTeamMatches(
      await getTeamMatches(teamId),
      currentCompetitionCodesByTeamId.get(teamId) ?? new Set(["CL"])
    );
    if (!inferredLeague) continue;

    inferredDomesticLeagueByTeamId.set(teamId, inferredLeague);
    usedDomesticCompetitionCodes.add(inferredLeague.competitionCode);

    if (!standingsByCompetitionCode.has(inferredLeague.competitionCode)) {
      const standingsResult = await rateLimitedApiCall(() =>
        fetchFootballDataCompetitionStandings(
          inferredLeague.competitionCode,
          seasonYear
        )
      );
      if (standingsResult.ok) {
        standingsByCompetitionCode.set(
          inferredLeague.competitionCode,
          standingsResult.data
        );
      }
    }

    if (!domesticLeagueByTeamId.has(teamId)) {
      domesticLeagueByTeamId.set(teamId, {
        ...inferredLeague,
        standingsAvailable: standingsByCompetitionCode.has(
          inferredLeague.competitionCode
        ),
      });
    }
  }

  let syncedCount = 0;
  let unavailableCount = 0;

  for (const match of matches) {
    const fallbackPayload = createUnavailablePayloadForMatch(match);

    const homeResolution = teamResolutionByName.get(match.homeTeamName) ?? null;
    const awayResolution = teamResolutionByName.get(match.awayTeamName) ?? null;
    const matchedFixtureResolution = matchedFixtureByMatchId.get(match.id) ?? null;
    const matchedFixture = matchedFixtureResolution?.fixture ?? null;
    const currentCompetition = matchedFixture
      ? {
          leagueId: matchedFixture.competition.id,
          competitionCode: matchedFixture.competition.code,
          leagueName: matchedFixture.competition.name,
          leagueLogo: matchedFixture.competition.emblem ?? null,
          countryName: matchedFixture.area?.name ?? null,
          season: getSeasonStartYear(matchedFixture.season?.startDate),
          standingsAvailable: currentCompetitionStandingsByCode.has(
            matchedFixture.competition.code
          ),
        }
      : null;
    const currentCompetitionDescription =
      formatCompetitionStage(matchedFixture?.stage) ?? "Competition";
    const currentCompetitionFixtures = currentCompetition
      ? currentCompetitionFixturesByCode.get(currentCompetition.competitionCode) ?? []
      : [];

    const homeLeague = homeResolution
      ? domesticLeagueByTeamId.get(homeResolution.teamId) ??
        inferredDomesticLeagueByTeamId.get(homeResolution.teamId) ??
        null
      : null;
    const awayLeague = awayResolution
      ? domesticLeagueByTeamId.get(awayResolution.teamId) ??
        inferredDomesticLeagueByTeamId.get(awayResolution.teamId) ??
        null
      : null;
    const homeTeamDetails = homeResolution
      ? teamDetailsByTeamId.get(homeResolution.teamId)
      : undefined;
    const awayTeamDetails = awayResolution
      ? teamDetailsByTeamId.get(awayResolution.teamId)
      : undefined;
    const homeTopPlayersScorers = homeLeague
      ? competitionScorersByCode.get(homeLeague.competitionCode) ?? []
      : currentCompetition
        ? competitionScorersByCode.get(currentCompetition.competitionCode) ?? []
        : [];
    const awayTopPlayersScorers = awayLeague
      ? competitionScorersByCode.get(awayLeague.competitionCode) ?? []
      : currentCompetition
        ? competitionScorersByCode.get(currentCompetition.competitionCode) ?? []
        : [];
    const competitionLeaders = buildPlayerLeadersSection({
      scorers:
        currentCompetition
          ? competitionScorersByCode.get(currentCompetition.competitionCode) ?? []
          : [],
      title: "Competition leaders",
      competitionName: currentCompetition?.leagueName ?? null,
      message: "Competition leaders are not available right now.",
      limit: 10,
    });

    const homeStandingRows = homeResolution && homeLeague
      ? getStandingRowsForTeam(
          standingsByCompetitionCode.get(homeLeague.competitionCode),
          homeResolution.teamId
        )
      : null;
    const awayStandingRows = awayResolution && awayLeague
      ? getStandingRowsForTeam(
          standingsByCompetitionCode.get(awayLeague.competitionCode),
          awayResolution.teamId
        )
      : null;
    const homeCurrentCompetitionStandingRows = homeResolution && currentCompetition
      ? getStandingRowsForTeam(
          currentCompetitionStandingsByCode.get(currentCompetition.competitionCode),
          homeResolution.teamId
        )
      : null;
    const awayCurrentCompetitionStandingRows = awayResolution && currentCompetition
      ? getStandingRowsForTeam(
          currentCompetitionStandingsByCode.get(currentCompetition.competitionCode),
          awayResolution.teamId
        )
      : null;

    let homeDomesticMatches =
      homeResolution && homeLeague
        ? findRecentUclMatches(
            domesticFixturesByCompetitionCode.get(homeLeague.competitionCode) ?? [],
            homeResolution.teamId
          )
        : [];
    if (
      allowTeamLevelFallbacks &&
      homeDomesticMatches.length === 0 &&
      homeResolution &&
      homeLeague
    ) {
      homeDomesticMatches = findRecentUclMatches(
        await getTeamMatches(homeResolution.teamId, {
          competitions: homeLeague.competitionCode,
        }),
        homeResolution.teamId
      );
      if (homeDomesticMatches.length === 0) {
        homeDomesticMatches = findRecentUclMatches(
          (await getTeamMatches(homeResolution.teamId)).filter(
            (fixture) => fixture.competition.code === homeLeague.competitionCode
          ),
          homeResolution.teamId
        );
      }
    }

    let awayDomesticMatches =
      awayResolution && awayLeague
        ? findRecentUclMatches(
            domesticFixturesByCompetitionCode.get(awayLeague.competitionCode) ?? [],
            awayResolution.teamId
          )
        : [];
    if (
      allowTeamLevelFallbacks &&
      awayDomesticMatches.length === 0 &&
      awayResolution &&
      awayLeague
    ) {
      awayDomesticMatches = findRecentUclMatches(
        await getTeamMatches(awayResolution.teamId, {
          competitions: awayLeague.competitionCode,
        }),
        awayResolution.teamId
      );
      if (awayDomesticMatches.length === 0) {
        awayDomesticMatches = findRecentUclMatches(
          (await getTeamMatches(awayResolution.teamId)).filter(
            (fixture) => fixture.competition.code === awayLeague.competitionCode
          ),
          awayResolution.teamId
        );
      }
    }

    const homeUclMatches = homeResolution
      ? findRecentUclMatches(uclFixtures, homeResolution.teamId)
      : [];
    const awayUclMatches = awayResolution
      ? findRecentUclMatches(uclFixtures, awayResolution.teamId)
      : [];

    const providerMatchLinkMode = buildProviderLinkMode(
      matchedFixtureResolution?.linkMode ?? "none"
    );
    let h2hResolution = h2hBySourceMatchId.get(match.id) ?? {
      matches: [],
      knownTotalMeetings: null,
      isTruncated: false,
      error: null,
    };
    if (
      allowTeamLevelFallbacks &&
      homeResolution &&
      awayResolution &&
      (h2hResolution.error || h2hResolution.matches.length === 0)
    ) {
      const fallbackH2HResolution = buildHeadToHeadFromTeamMatches(
        await getTeamMatches(homeResolution.teamId),
        homeResolution.teamId,
        awayResolution.teamId
      );
      if (fallbackH2HResolution.matches.length > 0) {
        h2hResolution = fallbackH2HResolution;
      }
    }
    const h2hFixtures = h2hResolution.matches;
    const h2hSummaries = h2hFixtures.map(toMatchSummary);
    const canBuildH2H = Boolean(matchedFixture || (homeResolution && awayResolution));
    const h2hSection: StatsH2HSection = h2hResolution.error
      ? {
          status: "partial",
          summary: null,
          matches: [],
          knownTotalMeetings: null,
          isTruncated: false,
          message:
            "Historical meetings could not be refreshed from the provider right now.",
        }
      : canBuildH2H && h2hFixtures.length > 0
        ? {
            status: h2hResolution.isTruncated ? "partial" : "available",
            summary: summarizeHeadToHead(
              h2hFixtures,
              matchedFixture?.homeTeam.id ?? homeResolution?.teamId ?? -1,
              matchedFixture?.awayTeam.id ?? awayResolution?.teamId ?? -1,
              h2hResolution.knownTotalMeetings
            ),
            matches: h2hSummaries,
            knownTotalMeetings: h2hResolution.knownTotalMeetings,
            isTruncated: h2hResolution.isTruncated,
            message: h2hResolution.isTruncated
              ? `Showing ${h2hFixtures.length} of ${h2hResolution.knownTotalMeetings ?? h2hFixtures.length} known meetings from the provider.`
              : null,
          }
        : {
            status: "unavailable",
            summary: null,
            matches: [],
            knownTotalMeetings: null,
            isTruncated: false,
            message: "No previous meetings data available.",
          };

    const homeTeam = buildTeamSection({
      localTeamName: match.homeTeamName,
      localTeamLogo: match.homeTeamLogo,
      resolution: homeResolution,
      league: homeLeague,
      leagueStandingsResponse: homeLeague
        ? standingsByCompetitionCode.get(homeLeague.competitionCode)
        : undefined,
      standingRows: homeStandingRows,
      currentCompetition,
      currentCompetitionStandingRows: homeCurrentCompetitionStandingRows,
      currentCompetitionFixtures,
      currentCompetitionDescription,
      teamDetails: homeTeamDetails,
      topPlayers: homeTopPlayersScorers,
      recentDomestic: homeDomesticMatches,
      recentUcl: homeUclMatches,
    });

    const awayTeam = buildTeamSection({
      localTeamName: match.awayTeamName,
      localTeamLogo: match.awayTeamLogo,
      resolution: awayResolution,
      league: awayLeague,
      leagueStandingsResponse: awayLeague
        ? standingsByCompetitionCode.get(awayLeague.competitionCode)
        : undefined,
      standingRows: awayStandingRows,
      currentCompetition,
      currentCompetitionStandingRows: awayCurrentCompetitionStandingRows,
      currentCompetitionFixtures,
      currentCompetitionDescription,
      teamDetails: awayTeamDetails,
      topPlayers: awayTopPlayersScorers,
      recentDomestic: awayDomesticMatches,
      recentUcl: awayUclMatches,
    });

    const payload = applyMatchCenterProviderFallbacks({
      status: buildOverallStatus(h2hSection.status, homeTeam.status, awayTeam.status),
      syncedAt: now.toISOString(),
      note: buildStatsNote({
        providerMatchLinkMode,
        isH2HTruncated: h2hSection.isTruncated,
      }),
      freshness: {
        status: "fresh",
        syncedAt: now.toISOString(),
        ageMinutes: 0,
      },
      providerMatchLinkMode,
      h2h: h2hSection,
      competitionLeaders,
      homeTeam,
      awayTeam,
    });

    const finalPayload =
      payload.status === "unavailable"
        ? applyMatchCenterProviderFallbacks(fallbackPayload)
        : payload;
    const jsonPayload = JSON.parse(JSON.stringify(finalPayload));

    if (finalPayload.status === "unavailable") unavailableCount++;
    else syncedCount++;

    await prisma.matchStatsCache.upsert({
      where: { matchId: match.id },
      update: {
        status: finalPayload.status,
        provider: MATCH_CENTER_PROVIDER,
        payload: jsonPayload,
        errorMessage: null,
        syncedAt: now,
      },
      create: {
        matchId: match.id,
        status: finalPayload.status,
        provider: MATCH_CENTER_PROVIDER,
        payload: jsonPayload,
        errorMessage: null,
        syncedAt: now,
      },
    });
  }

  await prisma.apiSyncLog.create({
    data: {
      provider: FOOTBALL_DATA_PROVIDER,
      action: "sync_match_statistics",
      status: "success",
      errorMessage: null,
    },
  });

  return {
    ok: true,
    targetCount: matches.length,
    syncedCount,
    unavailableCount,
  };
}
