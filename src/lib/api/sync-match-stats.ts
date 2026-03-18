import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  STATS_RECENT_MATCH_LIMIT,
  STATS_SYNC_LOOKAHEAD_DAYS,
  STATS_SYNC_LOOKBACK_DAYS,
  UCL_SEASON,
} from "@/lib/config";
import {
  fetchFootballDataCompetitionMatches,
  fetchFootballDataCompetitionStandings,
  fetchFootballDataMatchHeadToHead,
  fetchFootballDataUclFixtures,
  getFootballDataOutcomeLabel,
  getFootballDataScore,
  type FootballDataMatch,
  type FootballDataStandingRow,
  type FootballDataStandingsResponse,
} from "./football-data-stats";
import type { ApiFootballFixture } from "./api-football";
import type {
  MatchStatisticsPayload,
  StatsFixtureSection,
  StatsLeagueSnapshot,
  StatsMatchSummary,
  StatsSectionState,
  StatsTeamRecord,
  StatsTeamSection,
} from "@/lib/match-stats/types";
import {
  DEFAULT_STATS_NOTE,
  createUnavailableFixtureSection,
  createUnavailableLeagueSnapshot,
  createUnavailableMatchStatisticsPayload,
  createUnavailableTeamSection,
} from "@/lib/match-stats/types";

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

type MatchProviderFixture = ApiFootballFixture | FootballDataMatch;

type FootballDataStandingRows = {
  overall: FootballDataStandingRow | null;
  home: FootballDataStandingRow | null;
  away: FootballDataStandingRow | null;
};

const FOOTBALL_DATA_DELAY_MS = 6_300;

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

function formatStatusText(statusShort: string | undefined): string | null {
  switch (statusShort) {
    case "FT":
      return "Full-time";
    case "AET":
      return "After extra time";
    case "PEN":
      return "Penalties";
    default:
      return statusShort ?? null;
  }
}

function isFootballDataMatch(fixture: MatchProviderFixture): fixture is FootballDataMatch {
  return "utcDate" in fixture;
}

function getFixtureKickoff(fixture: MatchProviderFixture): string {
  return isFootballDataMatch(fixture) ? fixture.utcDate : fixture.fixture.date;
}

function getFixtureCompetitionName(fixture: MatchProviderFixture): string | null {
  return isFootballDataMatch(fixture)
    ? fixture.competition.name ?? null
    : fixture.league.name ?? null;
}

function getFixtureCompetitionLogo(fixture: MatchProviderFixture): string | null {
  return isFootballDataMatch(fixture)
    ? fixture.competition.emblem ?? null
    : fixture.league.logo ?? null;
}

function getFixtureHomeTeamName(fixture: MatchProviderFixture): string {
  return isFootballDataMatch(fixture)
    ? fixture.homeTeam.name
    : fixture.teams.home.name;
}

function getFixtureAwayTeamName(fixture: MatchProviderFixture): string {
  return isFootballDataMatch(fixture)
    ? fixture.awayTeam.name
    : fixture.teams.away.name;
}

function getFixtureHomeTeamId(fixture: MatchProviderFixture): number {
  return isFootballDataMatch(fixture) ? fixture.homeTeam.id : fixture.teams.home.id;
}

function getFixtureAwayTeamId(fixture: MatchProviderFixture): number {
  return isFootballDataMatch(fixture) ? fixture.awayTeam.id : fixture.teams.away.id;
}

function getFixtureScore(
  fixture: MatchProviderFixture
): { home: number | null; away: number | null } {
  if (isFootballDataMatch(fixture)) {
    const score = getFootballDataScore(fixture.score);
    return {
      home: score?.home ?? null,
      away: score?.away ?? null,
    };
  }

  return {
    home: fixture.goals.home,
    away: fixture.goals.away,
  };
}

function getFixtureOutcomeLabel(fixture: MatchProviderFixture): string | null {
  if (isFootballDataMatch(fixture)) {
    return getFootballDataOutcomeLabel(fixture);
  }

  return formatStatusText(fixture.fixture.status.short);
}

function isFinishedFixture(fixture: MatchProviderFixture): boolean {
  return isFootballDataMatch(fixture)
    ? fixture.status === "FINISHED"
    : ["FT", "AET", "PEN"].includes(fixture.fixture.status.short);
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
    id: String(isFootballDataMatch(fixture) ? fixture.id : fixture.fixture.id),
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
  } = {}
): StatsLeagueSnapshot {
  if (!standingRows?.overall) {
    return {
      status: "unavailable",
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
        home: standingRows.home ? buildRecord(standingRows.home) : null,
        away: standingRows.away ? buildRecord(standingRows.away) : null,
      },
    },
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
  standingRows: FootballDataStandingRows | null;
  currentCompetition: DomesticLeagueResolution | null;
  currentCompetitionStandingRows: FootballDataStandingRows | null;
  currentCompetitionFixtures: MatchProviderFixture[];
  currentCompetitionDescription: string | null;
  recentDomestic: StatsMatchSummary[];
  recentUcl: StatsMatchSummary[];
}): StatsTeamSection {
  if (!input.resolution) {
    return createUnavailableTeamSection(input.localTeamName, input.localTeamLogo);
  }

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
    : createUnavailableLeagueSnapshot(
        "Domestic league data is not available for this team."
      );

  const currentCompetition = input.currentCompetition
    ? input.currentCompetitionStandingRows?.overall
      ? buildLeagueSnapshot(input.currentCompetition, input.currentCompetitionStandingRows, {
          unavailableMessage: "Current competition snapshot is not available for this team.",
          description: input.currentCompetitionDescription,
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
      currentCompetition.status,
      recentDomesticMatches.status,
      recentUclMatches.status,
    ]),
    teamName: input.localTeamName,
    teamLogo: input.localTeamLogo ?? input.resolution.logo,
    providerTeamId: input.resolution.teamId,
    domesticLeague,
    currentCompetition,
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
  currentAwayTeamId: number
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
    totalMeetings: fixtures.length,
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
    const fixtureId = isFootballDataMatch(fixture) ? fixture.id : fixture.fixture.id;
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

export async function syncMatchStatisticsCache(): Promise<SyncResult> {
  const now = new Date();
  const seasonYear = getSeasonYear();
  const { from, to } = getSyncWindow(now);
  const recentCompetitionWindow = getRecentCompetitionWindow(now);

  const matches = await prisma.match.findMany({
    where: {
      homeTeamName: { not: "TBD" },
      awayTeamName: { not: "TBD" },
      matchDatetime: { gte: from, lte: to },
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

  const rateLimitedApiCall = createRateLimitedCaller(FOOTBALL_DATA_DELAY_MS);

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
  const uclFixtureById = new Map(uclFixtures.map((fixture) => [String(fixture.id), fixture]));
  const usedFixtureIds = new Set<number>();
  const matchedFixtureByMatchId = new Map<string, FootballDataMatch>();
  const teamResolutionByName = new Map<string, TeamResolution>();

  for (const match of matches) {
    const exactFixture = match.externalApiId
      ? uclFixtureById.get(match.externalApiId) ?? null
      : null;
    const matchedFixture =
      exactFixture ??
      (findBestFixtureMatch(match, uclFixtures, usedFixtureIds) as FootballDataMatch | null);

    if (!matchedFixture) {
      continue;
    }

    usedFixtureIds.add(matchedFixture.id);
    matchedFixtureByMatchId.set(match.id, matchedFixture);
    teamResolutionByName.set(match.homeTeamName, {
      teamId: matchedFixture.homeTeam.id,
      name: matchedFixture.homeTeam.name,
      logo: match.homeTeamLogo ?? matchedFixture.homeTeam.crest ?? null,
    });
    teamResolutionByName.set(match.awayTeamName, {
      teamId: matchedFixture.awayTeam.id,
      name: matchedFixture.awayTeam.name,
      logo: match.awayTeamLogo ?? matchedFixture.awayTeam.crest ?? null,
    });
  }

  const usedCurrentCompetitionCodes = new Set<string>();
  for (const fixture of matchedFixtureByMatchId.values()) {
    usedCurrentCompetitionCodes.add(fixture.competition.code);
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
  for (const competitionCode of SUPPORTED_DOMESTIC_COMPETITIONS) {
    const standingsResult = await rateLimitedApiCall(() =>
      fetchFootballDataCompetitionStandings(competitionCode, seasonYear)
    );
    if (standingsResult.ok) {
      standingsByCompetitionCode.set(competitionCode, standingsResult.data);
    }
  }

  const domesticCandidates = buildDomesticTeamCandidates(standingsByCompetitionCode);
  const domesticLeagueByTeamId = buildDomesticLeagueByTeamId(domesticCandidates);

  const unresolvedTeamNames = new Set<string>();
  for (const match of matches) {
    if (!teamResolutionByName.has(match.homeTeamName)) {
      unresolvedTeamNames.add(match.homeTeamName);
    }
    if (!teamResolutionByName.has(match.awayTeamName)) {
      unresolvedTeamNames.add(match.awayTeamName);
    }
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

  const domesticFixturesByCompetitionCode = new Map<string, FootballDataMatch[]>();
  for (const competitionCode of usedDomesticCompetitionCodes) {
    const fixturesResult = await rateLimitedApiCall(() =>
      fetchFootballDataCompetitionMatches(competitionCode, {
        season: seasonYear,
        status: "FINISHED",
        dateFrom: recentCompetitionWindow.dateFrom,
        dateTo: recentCompetitionWindow.dateTo,
      })
    );
    if (fixturesResult.ok) {
      domesticFixturesByCompetitionCode.set(competitionCode, fixturesResult.data);
    }
  }

  const currentCompetitionFixturesByCode = new Map<string, FootballDataMatch[]>();
  for (const competitionCode of usedCurrentCompetitionCodes) {
    if (competitionCode === "CL") {
      currentCompetitionFixturesByCode.set(competitionCode, uclFixtures);
      continue;
    }

    const fixturesResult = await rateLimitedApiCall(() =>
      fetchFootballDataCompetitionMatches(competitionCode, {
        season: seasonYear,
        status: "FINISHED",
      })
    );
    if (fixturesResult.ok) {
      currentCompetitionFixturesByCode.set(competitionCode, fixturesResult.data);
    }
  }

  const h2hBySourceMatchId = new Map<string, FootballDataMatch[]>();
  const h2hCacheByApiMatchId = new Map<string, FootballDataMatch[]>();
  for (const match of matches) {
    const sourceMatchId =
      match.externalApiId ?? String(matchedFixtureByMatchId.get(match.id)?.id ?? "");
    if (!sourceMatchId) continue;

    if (h2hCacheByApiMatchId.has(sourceMatchId)) {
      h2hBySourceMatchId.set(match.id, h2hCacheByApiMatchId.get(sourceMatchId) ?? []);
      continue;
    }

    const numericMatchId = Number(sourceMatchId);
    if (!Number.isFinite(numericMatchId)) continue;

    const h2hResult = await rateLimitedApiCall(() =>
      fetchFootballDataMatchHeadToHead(numericMatchId, STATS_RECENT_MATCH_LIMIT)
    );
    const h2hMatches = h2hResult.ok ? h2hResult.data.matches ?? [] : [];
    h2hCacheByApiMatchId.set(sourceMatchId, h2hMatches);
    h2hBySourceMatchId.set(match.id, h2hMatches);
  }

  let syncedCount = 0;
  let unavailableCount = 0;

  for (const match of matches) {
    const fallbackPayload = createUnavailablePayloadForMatch(match);

    const homeResolution = teamResolutionByName.get(match.homeTeamName) ?? null;
    const awayResolution = teamResolutionByName.get(match.awayTeamName) ?? null;
    const matchedFixture = matchedFixtureByMatchId.get(match.id) ?? null;
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
      ? domesticLeagueByTeamId.get(homeResolution.teamId) ?? null
      : null;
    const awayLeague = awayResolution
      ? domesticLeagueByTeamId.get(awayResolution.teamId) ?? null
      : null;

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

    const homeDomesticMatches =
      homeResolution && homeLeague
        ? findRecentUclMatches(
            domesticFixturesByCompetitionCode.get(homeLeague.competitionCode) ?? [],
            homeResolution.teamId
          )
        : [];

    const awayDomesticMatches =
      awayResolution && awayLeague
        ? findRecentUclMatches(
            domesticFixturesByCompetitionCode.get(awayLeague.competitionCode) ?? [],
            awayResolution.teamId
          )
        : [];

    const homeUclMatches = homeResolution
      ? findRecentUclMatches(uclFixtures, homeResolution.teamId)
      : [];
    const awayUclMatches = awayResolution
      ? findRecentUclMatches(uclFixtures, awayResolution.teamId)
      : [];

    const h2hFixtures = h2hBySourceMatchId.get(match.id) ?? [];
    const h2hSummaries = h2hFixtures.map(toMatchSummary);
    const h2hSection =
      (matchedFixture || (homeResolution && awayResolution)) && h2hFixtures.length > 0
        ? {
            status: "available" as const,
            summary: summarizeHeadToHead(
              h2hFixtures,
              matchedFixture?.homeTeam.id ?? homeResolution?.teamId ?? -1,
              matchedFixture?.awayTeam.id ?? awayResolution?.teamId ?? -1
            ),
            matches: h2hSummaries,
            message: null,
          }
        : {
            status: "unavailable" as const,
            summary: null,
            matches: [],
            message: "No previous meetings data available.",
          };

    const homeTeam = buildTeamSection({
      localTeamName: match.homeTeamName,
      localTeamLogo: match.homeTeamLogo,
      resolution: homeResolution,
      league: homeLeague,
      standingRows: homeStandingRows,
      currentCompetition,
      currentCompetitionStandingRows: homeCurrentCompetitionStandingRows,
      currentCompetitionFixtures,
      currentCompetitionDescription,
      recentDomestic: homeDomesticMatches,
      recentUcl: homeUclMatches,
    });

    const awayTeam = buildTeamSection({
      localTeamName: match.awayTeamName,
      localTeamLogo: match.awayTeamLogo,
      resolution: awayResolution,
      league: awayLeague,
      standingRows: awayStandingRows,
      currentCompetition,
      currentCompetitionStandingRows: awayCurrentCompetitionStandingRows,
      currentCompetitionFixtures,
      currentCompetitionDescription,
      recentDomestic: awayDomesticMatches,
      recentUcl: awayUclMatches,
    });

    const payload: MatchStatisticsPayload = {
      status: buildOverallStatus(h2hSection.status, homeTeam.status, awayTeam.status),
      syncedAt: now.toISOString(),
      note: DEFAULT_STATS_NOTE,
      h2h: h2hSection,
      homeTeam,
      awayTeam,
    };

    const finalPayload =
      payload.status === "unavailable" ? fallbackPayload : payload;

    if (finalPayload.status === "unavailable") unavailableCount++;
    else syncedCount++;

    await prisma.matchStatsCache.upsert({
      where: { matchId: match.id },
      update: {
        status: finalPayload.status,
        provider: FOOTBALL_DATA_PROVIDER,
        payload: finalPayload as Prisma.InputJsonValue,
        errorMessage: null,
        syncedAt: now,
      },
      create: {
        matchId: match.id,
        status: finalPayload.status,
        provider: FOOTBALL_DATA_PROVIDER,
        payload: finalPayload as Prisma.InputJsonValue,
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
