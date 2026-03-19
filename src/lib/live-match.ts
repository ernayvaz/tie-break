export type LiveMatchState = {
  isLive: boolean;
  status: string;
  label: string;
  homeScore: number | null;
  awayScore: number | null;
  lastUpdated: string | null;
};

const LIVE_MATCH_STATUSES = new Set([
  "IN_PLAY",
  "PAUSED",
  "LIVE",
  "HALF_TIME",
  "EXTRA_TIME",
  "PENALTY_SHOOTOUT",
]);

const STATUS_LABELS: Record<string, string> = {
  IN_PLAY: "Live now",
  LIVE: "Live now",
  PAUSED: "Paused",
  HALF_TIME: "Half-time",
  EXTRA_TIME: "Extra time",
  PENALTY_SHOOTOUT: "Penalties",
  SCHEDULED: "Scheduled",
  TIMED: "Scheduled",
  FINISHED: "Full-time",
  POSTPONED: "Postponed",
  SUSPENDED: "Suspended",
  CANCELED: "Canceled",
  CANCELLED: "Canceled",
};

export function isLiveMatchStatus(status: string): boolean {
  return LIVE_MATCH_STATUSES.has(status.toUpperCase());
}

export function getLiveMatchStatusLabel(status: string): string {
  const normalized = status.toUpperCase();
  return STATUS_LABELS[normalized] ?? "Match status";
}

export function shouldPollLiveMatch(
  matchDatetime: string | Date,
  now: Date = new Date()
): boolean {
  const kickoffMs = new Date(matchDatetime).getTime();
  if (!Number.isFinite(kickoffMs)) return false;

  const diffMs = kickoffMs - now.getTime();
  const threeHours = 3 * 60 * 60 * 1000;
  const fiveHours = 5 * 60 * 60 * 1000;

  return diffMs <= threeHours && diffMs >= -fiveHours;
}
