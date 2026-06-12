export const HIGHLIGHT_MATCH_WINDOW_HOURS = 48;

export type HighlightMatchCandidate = {
  id: string;
  competitionId?: string | null;
  matchDatetime: Date | string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number | null;
  awayScore?: number | null;
  stage: string;
};

export type ParsedHighlightTitle = {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type HighlightMatchResolution = {
  candidate: HighlightMatchCandidate;
  mode: "exact" | "fuzzy";
  score: number;
  parsedTitle: ParsedHighlightTitle;
};

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeTeamName(name: string): string {
  return compactWhitespace(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(fc|cf|afc|sc|ac|fk|sk|club|clube|deportivo|calcio|as|sv|nk|ud|bk|if|cfr)\b/g,
      " "
    )
    .replace(/\bmunchen\b/g, "munich")
    .replace(/\binternazionale\b/g, "inter")
    .replace(/\bpsg\b/g, "paris saint germain")
    .replace(/\butd\b/g, "united")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;

  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;

  return union === 0 ? 0 : intersection / union;
}

export function parseScoreBatTitle(title: string): ParsedHighlightTitle | null {
  const clean = compactWhitespace(title);
  if (!clean) return null;

  const scorePattern =
    /^(.*?)\s+(\d+)\s*[-–:]\s*(\d+)\s+(.*)$/;
  const scoredMatch = clean.match(scorePattern);
  if (scoredMatch) {
    return {
      homeTeamName: compactWhitespace(scoredMatch[1]),
      homeScore: Number(scoredMatch[2]),
      awayScore: Number(scoredMatch[3]),
      awayTeamName: compactWhitespace(scoredMatch[4]),
    };
  }

  const dashMatch = clean.match(/^(.*?)\s*[-–]\s*(.*?)$/);
  if (dashMatch) {
    return {
      homeTeamName: compactWhitespace(dashMatch[1]),
      homeScore: null,
      awayScore: null,
      awayTeamName: compactWhitespace(dashMatch[2]),
    };
  }

  const vsMatch = clean.match(/^(.*?)\s+vs\.?\s+(.*?)$/i);
  if (vsMatch) {
    return {
      homeTeamName: compactWhitespace(vsMatch[1]),
      homeScore: null,
      awayScore: null,
      awayTeamName: compactWhitespace(vsMatch[2]),
    };
  }

  return null;
}

export function isChampionsLeagueCompetitionLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return normalized.includes("champions league") && !normalized.includes("women");
}

export function isWorldCupCompetitionLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return (
    normalized.includes("world cup") &&
    !normalized.includes("women") &&
    !normalized.includes("qualif") &&
    !normalized.includes("u-") &&
    !normalized.includes("u17") &&
    !normalized.includes("u20") &&
    !normalized.includes("u21") &&
    !normalized.includes("u23")
  );
}

/**
 * A ScoreBat competition label is only allowed to bind to a local fixture when
 * the label is consistent with that fixture's competition. This keeps the old
 * Champions League guard intact (domestic leagues are rejected) while also
 * letting genuine World Cup clips attach to World Cup fixtures.
 */
export function isHighlightLabelTrackable(label: string): boolean {
  return (
    isChampionsLeagueCompetitionLabel(label) || isWorldCupCompetitionLabel(label)
  );
}

function isLabelCompatibleWithCompetition(
  label: string,
  competitionId: string | null | undefined
): boolean {
  if (competitionId === "WC") {
    return isWorldCupCompetitionLabel(label);
  }
  // CL bucket (and legacy null rows) require a Champions League label.
  return isChampionsLeagueCompetitionLabel(label);
}

export function resolveHighlightMatch(input: {
  title: string;
  competition: string;
  publishedAt: Date | string;
  matches: HighlightMatchCandidate[];
  maxWindowHours?: number;
}): HighlightMatchResolution | null {
  // Only Champions League and World Cup labels are trackable. Each entry is then
  // bound to a local fixture whose competition is consistent with the label, so
  // a Premier League clip never attaches to a same-day Champions League fixture
  // while genuine World Cup clips attach to World Cup fixtures.
  if (!isHighlightLabelTrackable(input.competition)) {
    return null;
  }

  const parsedTitle = parseScoreBatTitle(input.title);
  if (!parsedTitle) {
    return null;
  }

  const publishedAt = new Date(input.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) {
    return null;
  }

  const normalizedHome = normalizeTeamName(parsedTitle.homeTeamName);
  const normalizedAway = normalizeTeamName(parsedTitle.awayTeamName);
  if (!normalizedHome || !normalizedAway) {
    return null;
  }

  const maxWindowHours = input.maxWindowHours ?? HIGHLIGHT_MATCH_WINDOW_HOURS;
  let best: HighlightMatchResolution | null = null;

  for (const candidate of input.matches) {
    if (!isLabelCompatibleWithCompetition(input.competition, candidate.competitionId)) {
      continue;
    }

    const candidateKickoff = new Date(candidate.matchDatetime);
    if (Number.isNaN(candidateKickoff.getTime())) {
      continue;
    }

    const timeDiffHours = Math.abs(candidateKickoff.getTime() - publishedAt.getTime()) / 36e5;
    if (timeDiffHours > maxWindowHours) {
      continue;
    }

    const homeSimilarity = tokenSimilarity(
      normalizedHome,
      normalizeTeamName(candidate.homeTeamName)
    );
    const awaySimilarity = tokenSimilarity(
      normalizedAway,
      normalizeTeamName(candidate.awayTeamName)
    );
    if (homeSimilarity < 0.55 || awaySimilarity < 0.55) {
      continue;
    }

    const titleHasScore =
      parsedTitle.homeScore != null &&
      parsedTitle.awayScore != null &&
      candidate.homeScore != null &&
      candidate.awayScore != null;

    if (
      titleHasScore &&
      (parsedTitle.homeScore !== candidate.homeScore ||
        parsedTitle.awayScore !== candidate.awayScore)
    ) {
      continue;
    }

    const scoreBonus = titleHasScore ? 1.6 : 0;
    const timeBonus = Math.max(0, 2 - timeDiffHours / 12);
    const score = homeSimilarity * 5 + awaySimilarity * 5 + scoreBonus + timeBonus;
    const mode =
      homeSimilarity > 0.985 && awaySimilarity > 0.985 && timeDiffHours <= 6
        ? "exact"
        : "fuzzy";

    if (!best || score > best.score) {
      best = {
        candidate,
        mode,
        score,
        parsedTitle,
      };
    }
  }

  return best;
}
