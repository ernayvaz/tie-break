import type {
  MatchStatisticsSources,
  StatsProviderAttempt,
  StatsProviderAttemptStatus,
  StatsProviderName,
  StatsSectionSource,
} from "@/lib/match-stats/types";

export type { MatchStatisticsSources, StatsProviderAttempt, StatsProviderName };

export function createProviderAttempt(
  provider: StatsProviderName,
  status: StatsProviderAttemptStatus,
  detail: string | null = null
): StatsProviderAttempt {
  return {
    provider,
    status,
    detail,
  };
}

export function resolveSectionSource(
  attempts: StatsProviderAttempt[]
): StatsSectionSource {
  const selectedAttempt =
    attempts.find((attempt) => attempt.status === "used") ?? null;

  return {
    selectedProvider: selectedAttempt?.provider ?? null,
    attempts,
  };
}

function formatProviderAttempt(attempt: StatsProviderAttempt): string {
  const prefix = `${attempt.provider}: `;

  switch (attempt.status) {
    case "used":
      return `${prefix}${attempt.detail ?? "used successfully."}`;
    case "missing":
      return `${prefix}${attempt.detail ?? "no matching mapping or entity was found."}`;
    case "unsupported":
      return `${prefix}${attempt.detail ?? "this section is not supported."}`;
    default:
      return `${prefix}${attempt.detail ?? "the section could not be resolved."}`;
  }
}

export function describeProviderChainFailure(
  sectionLabel: string,
  source: StatsSectionSource,
  primaryMessage?: string | null
): string {
  const details = source.attempts.map(formatProviderAttempt).join(" ");
  const prefix = primaryMessage?.trim()
    ? `${primaryMessage.trim()} `
    : `${sectionLabel} is unavailable after checking the provider priority chain. `;

  return `${prefix}${details}`.trim();
}

export function buildDefaultMatchStatisticsSources(): MatchStatisticsSources {
  const empty = resolveSectionSource([]);

  return {
    h2h: empty,
    homeTeam: {
      domesticLeague: empty,
      currentCompetition: empty,
      recentDomesticMatches: empty,
      recentUclMatches: empty,
    },
    awayTeam: {
      domesticLeague: empty,
      currentCompetition: empty,
      recentDomesticMatches: empty,
      recentUclMatches: empty,
    },
  };
}
