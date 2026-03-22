export function formatHighlightStage(stage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: "League Stage",
    LEAGUE_STAGE: "League Stage",
    ROUND_16: "Round of 16",
    LAST_16: "Round of 16",
    QUARTER_FINAL: "Quarter-final",
    SEMI_FINAL: "Semi-final",
    FINAL: "Final",
    PLAYOFFS: "Play-offs",
  };

  return map[stage] ?? stage.replace(/_/g, " ");
}

export function formatHighlightSeason(season: string): string {
  if (!/^\d{4}$/.test(season)) {
    return season;
  }

  const startYear = Number(season);
  const endYear = (startYear + 1).toString().slice(-2);
  return `${startYear}/${endYear}`;
}

export function getStageSortValue(stage: string): number {
  switch (stage) {
    case "FINAL":
      return 0;
    case "SEMI_FINAL":
      return 1;
    case "QUARTER_FINAL":
      return 2;
    case "ROUND_16":
    case "LAST_16":
      return 3;
    case "PLAYOFFS":
      return 4;
    case "GROUP_STAGE":
    case "LEAGUE_STAGE":
      return 5;
    default:
      return 6;
  }
}

export function buildProgramNote(input: {
  homeTeamName: string;
  awayTeamName: string;
  stage: string;
  homeScore?: number | null;
  awayScore?: number | null;
}): string {
  const stageLabel = formatHighlightStage(input.stage);
  if (input.homeScore != null && input.awayScore != null) {
    return `${stageLabel} screening: ${input.homeTeamName} ${input.homeScore}-${input.awayScore} ${input.awayTeamName}.`;
  }

  return `${stageLabel} screening: ${input.homeTeamName} vs ${input.awayTeamName}.`;
}

export function describeHighlightStatus(status: "available" | "stale" | "unavailable"): string {
  switch (status) {
    case "stale":
      return "Stored from the last successful provider sync.";
    case "unavailable":
      return "Provider embed is unavailable right now. Use the source link.";
    default:
      return "Provider embed available.";
  }
}
