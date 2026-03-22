export type HighlightStatus = "available" | "stale" | "unavailable";

export type HighlightCardModel = {
  matchId: string;
  competitionId: string | null;
  competitionLabel: string;
  href: string;
  title: string;
  stageLabel: string;
  seasonLabel: string;
  publishedLabel: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  scoreline: string;
  thumbnailUrl: string | null;
  programNote: string | null;
  status: HighlightStatus;
  clipCount: number;
};

export type HighlightClipModel = {
  id: string;
  title: string;
  href: string;
  isActive: boolean;
  embedUrl: string | null;
  pageUrl: string | null;
};
