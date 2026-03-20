"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ScoreAxisWidget } from "@/components/scoreaxis-widget";
import type {
  MatchStatisticsPayload,
  StatsLeagueTableRow,
  StatsMatchSummary,
  StatsPlayerLeadersSection,
  StatsRecordKey,
  StatsTeamRecord,
  StatsTeamSection,
} from "@/lib/match-stats/types";
import { getExactScoreAxisLeagueTableWidget } from "@/lib/scoreaxis";
import { resolveScoreAxisLeagueTableWidget } from "@/lib/providers/scoreaxis-provider";

type Props = {
  open: boolean;
  onToggle: () => void;
  competitionId?: string | null;
  homeTeamName: string;
  homeTeamLogo: string | null;
  awayTeamName: string;
  awayTeamLogo: string | null;
  stats: MatchStatisticsPayload;
  isRefreshing?: boolean;
  isAdmin?: boolean;
  activeTab?: CenterTab;
  onActiveTabChange?: (tab: CenterTab) => void;
};

export type CenterTab = "overview" | "home" | "away" | "leaders";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={`h-4 w-4 transition-transform duration-300 ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M5 7.5l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MatchCenterIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-4 w-4">
      <path
        d="M3 13.5l4-4 3 2 4-5 3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 16h14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-4 w-4">
      <path
        d="M6.5 3.5h7v2.2a3.5 3.5 0 0 1-2.6 3.38V11a2.4 2.4 0 0 0 1.8 2.32l.8.2v1.46H6.5v-1.46l.8-.2A2.4 2.4 0 0 0 9.1 11V9.08A3.5 3.5 0 0 1 6.5 5.7V3.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 4H16a1 1 0 0 1 1 1v.3a2.7 2.7 0 0 1-2.7 2.7h-.85"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M6.5 4H4a1 1 0 0 0-1 1v.3A2.7 2.7 0 0 0 5.7 8h.85"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatKickoff(iso: string) {
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatSyncedAt(iso: string | null) {
  if (!iso) return "Stats sync pending";

  const date = new Date(iso);
  return `Synced ${date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getFreshnessTone(status: MatchStatisticsPayload["freshness"]["status"]) {
  switch (status) {
    case "fresh":
      return "border-emerald-200/80 bg-emerald-50 text-emerald-700";
    case "partial":
      return "border-amber-200/80 bg-amber-50 text-amber-700";
    case "stale":
      return "border-orange-200/80 bg-orange-50 text-orange-700";
    default:
      return "border-nord-polarLighter/15 bg-nord-snow/75 text-nord-polarLight";
  }
}

function renderForm(form: string | null) {
  if (!form) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {form.split("").map((item, index) => {
        const tone =
          item === "W"
            ? "border-emerald-200/80 bg-emerald-50 text-emerald-700"
            : item === "D"
              ? "border-amber-200/80 bg-amber-50 text-amber-700"
              : "border-rose-200/80 bg-rose-50 text-rose-700";
        return (
          <span
            key={`${item}-${index}`}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold shadow-sm ${tone}`}
          >
            {item}
          </span>
        );
      })}
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h4 className="text-sm font-semibold tracking-[0.01em] text-nord-polar">
          {title}
        </h4>
        {subtitle ? (
          <p className="mt-1 text-xs leading-5 text-nord-polarLight">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function EmptySection({
  message,
  tone = "light",
}: {
  message: string | null;
  tone?: "light" | "dark";
}) {
  const normalizedMessage = message?.toLowerCase() ?? "";
  const displayMessage = normalizedMessage.includes("previous meetings")
    ? "Previous meetings for this fixture are coming soon."
    : normalizedMessage.includes("recent domestic")
      ? "Recent domestic match data for this club is coming soon."
      : normalizedMessage.includes("champions league")
        ? "Recent Champions League data for this club is coming soon."
        : normalizedMessage.includes("domestic league table")
          ? "The domestic league table for this club is coming soon."
          : normalizedMessage.includes("competition leaders")
            ? "Competition leaders for this stage are coming soon."
            : normalizedMessage.includes("team profile") ||
                normalizedMessage.includes("team info")
              ? "Detailed team information is coming soon."
              : normalizedMessage.includes("top-player") ||
                  normalizedMessage.includes("top players")
                ? "Top-player insights for this club are coming soon."
                : "This part of Match Center is coming soon while we finish the final data pass.";

  return (
    <div
      className={`rounded-[1.35rem] border border-dashed px-4 py-4 text-sm leading-6 ${
        tone === "light"
          ? "border-nord-polarLighter/18 bg-white/70 text-nord-polarLight"
          : "border-white/12 bg-white/7 text-white/70"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-nord-frostDark">
        Coming soon
      </div>
      <div className="mt-1">{displayMessage}</div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[1.15rem] border border-nord-polarLighter/12 bg-white/84 px-3 py-2 shadow-[0_8px_20px_rgba(46,52,64,0.04)]">
      <div className="text-[10px] uppercase tracking-[0.12em] text-nord-polarLight">
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-semibold leading-5 text-nord-polar">
        {value}
      </div>
    </div>
  );
}

function MetaBadge({
  label,
  tone,
}: {
  label: string;
  tone?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
        tone ??
        "border-nord-polarLighter/15 bg-nord-snow/70 text-nord-polarLight"
      }`}
    >
      {label}
    </span>
  );
}

function MatchCenterMeta({
  stats,
  isRefreshing = false,
  isAdmin = false,
}: {
  stats: MatchStatisticsPayload;
  isRefreshing?: boolean;
  isAdmin?: boolean;
}) {
  if (!isAdmin) return null;

  const freshnessLabel =
    stats.freshness.status === "fresh"
      ? "Fresh cache"
      : stats.freshness.status === "partial"
        ? "Partial data"
        : stats.freshness.status === "stale"
          ? "Stale cache"
          : "Stats pending";
  const providerLabel =
    stats.providerMatchLinkMode === "exact"
      ? "Exact provider match"
      : stats.providerMatchLinkMode === "fuzzy"
        ? "Smart provider match"
        : "No provider link";

  return (
    <section className="rounded-[1.4rem] border border-nord-polarLighter/12 bg-white/85 px-4 py-4 shadow-[0_14px_36px_rgba(46,52,64,0.05)]">
      <div className="flex flex-wrap items-center gap-2.5">
        {isRefreshing ? (
          <MetaBadge
            label="Refreshing"
            tone="border-sky-200/90 bg-sky-50 text-sky-700"
          />
        ) : null}
        <MetaBadge
          label={freshnessLabel}
          tone={getFreshnessTone(stats.freshness.status)}
        />
        <MetaBadge label={providerLabel} />
        {stats.h2h.isTruncated && stats.h2h.knownTotalMeetings ? (
          <MetaBadge
            label={`H2H ${stats.h2h.matches.length}/${stats.h2h.knownTotalMeetings}`}
            tone="border-amber-200/80 bg-amber-50 text-amber-700"
          />
        ) : null}
      </div>
      <div className="mt-3 text-xs leading-5 text-nord-polarLight">
        {formatSyncedAt(stats.freshness.syncedAt)}
        {stats.note ? ` • ${stats.note}` : ""}
      </div>
    </section>
  );
}

function FixtureList({
  matches,
  emptyMessage,
}: {
  matches: StatsMatchSummary[];
  emptyMessage: string | null;
}) {
  if (matches.length === 0) return <EmptySection message={emptyMessage} />;

  return (
    <ul className="space-y-2.5">
      {matches.map((match) => (
        <li
          key={match.id}
          className="rounded-[1rem] border border-nord-polarLighter/10 bg-white/84 px-3 py-2 shadow-[0_8px_20px_rgba(46,52,64,0.035)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.12em] text-nord-polarLight">
                {formatKickoff(match.kickoff)}
              </div>
              <div className="mt-0.5 truncate text-[12.5px] font-semibold leading-5 text-nord-polar">
                {match.homeTeamName} vs {match.awayTeamName}
              </div>
              <div className="mt-0.5 text-[10px] leading-4 text-nord-polarLight">
                {match.competitionName}
                {match.outcomeLabel ? ` • ${match.outcomeLabel}` : ""}
              </div>
            </div>
            <div className="shrink-0 rounded-full bg-nord-snow/72 px-2.5 py-0.5 text-[12px] font-semibold text-nord-polar">
              {match.homeGoals != null && match.awayGoals != null
                ? `${match.homeGoals} - ${match.awayGoals}`
                : "–"}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MatchCenterTabButton({
  active,
  label,
  meta,
  logoSrc,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  meta?: string;
  logoSrc?: string | null;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex min-w-[6.8rem] items-center gap-1.5 rounded-[0.9rem] border px-2 py-1 text-left transition-all sm:px-2.5 ${
        active
          ? "border-nord-frostDark/18 bg-[linear-gradient(135deg,rgba(46,52,64,0.98),rgba(59,66,82,0.94))] text-white shadow-[0_12px_28px_rgba(46,52,64,0.18)]"
          : "border-white/70 bg-white/82 text-nord-polarLight shadow-[0_8px_22px_rgba(46,52,64,0.05)] hover:border-nord-frostDark/12 hover:bg-white hover:text-nord-polar"
      }`}
    >
      {logoSrc || icon ? (
        <span
          className="flex h-6.5 w-6.5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-nord-polarLighter/16 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_4px_rgba(15,23,42,0.08)]"
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- external logos
            <img
              src={logoSrc}
              alt=""
              className="h-5 w-5 rounded-full bg-white p-[1px] object-contain"
            />
          ) : (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-nord-frostDark"
            >
              {icon}
            </span>
          )}
        </span>
      ) : null}
      <span className="min-w-0">
        <span
          className={`block truncate text-[11px] font-semibold leading-4 ${
            active ? "text-white" : "text-nord-polar"
          }`}
        >
          {label}
        </span>
        {meta ? (
          <span
            className={`mt-0.5 block truncate text-[9px] uppercase tracking-[0.14em] ${
              active ? "text-white/62" : "text-nord-polarLight"
            }`}
          >
            {meta}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function SnapshotTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
        active
          ? "border-nord-frostDark/18 bg-[linear-gradient(135deg,rgba(46,52,64,0.98),rgba(59,66,82,0.94))] text-white shadow-[0_10px_24px_rgba(46,52,64,0.18)]"
          : "border-nord-polarLighter/14 bg-white/84 text-nord-polarLight hover:border-nord-frostDark/12 hover:text-nord-polar"
      }`}
    >
      {label}
    </button>
  );
}

function normalizeTeamKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(fc|cf|afc|sc|ac|fk|sk|club|clube|deportivo|calcio|as|sv|nk|ud|sfp)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function buildFormFromMatches(
  teamName: string,
  matches: StatsMatchSummary[]
): string | null {
  const normalizedTeam = normalizeTeamKey(teamName);
  const form = matches
    .map((match) => {
      if (match.homeGoals == null || match.awayGoals == null) return null;

      const normalizedHome = normalizeTeamKey(match.homeTeamName);
      const normalizedAway = normalizeTeamKey(match.awayTeamName);
      const isHome =
        normalizedHome === normalizedTeam || normalizedHome.includes(normalizedTeam);
      const isAway =
        normalizedAway === normalizedTeam || normalizedAway.includes(normalizedTeam);

      if (!isHome && !isAway) return null;

      const goalsFor = isHome ? match.homeGoals : match.awayGoals;
      const goalsAgainst = isHome ? match.awayGoals : match.homeGoals;
      if (goalsFor > goalsAgainst) return "W";
      if (goalsFor < goalsAgainst) return "L";
      return "D";
    })
    .filter((result): result is "W" | "D" | "L" => result !== null)
    .slice(0, 5)
    .join("");

  return form || null;
}

function TeamHeroCard({
  label,
  team,
  fallbackLogo,
}: {
  label: string;
  team: StatsTeamSection;
  fallbackLogo: string | null;
}) {
  const primarySnapshot = team.currentCompetition;
  const form =
    primarySnapshot.standing?.form ??
    buildFormFromMatches(team.teamName, team.recentUclMatches.matches) ??
    buildFormFromMatches(team.teamName, team.recentDomesticMatches.matches);

  return (
    <section className="rounded-[1.5rem] border border-nord-polarLighter/12 bg-white/88 p-4 shadow-[0_20px_55px_rgba(46,52,64,0.06)]">
      <div className="flex items-center gap-3">
        {team.teamLogo ?? fallbackLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- external team logos
          <img
            src={team.teamLogo ?? fallbackLogo ?? undefined}
            alt=""
            className="h-11 w-11 rounded-full bg-white object-contain p-1 shadow-sm"
          />
        ) : null}
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-nord-polarLight">
            {label}
          </div>
          <div className="truncate text-base font-semibold text-nord-polar">
            {team.teamName}
          </div>
          <div className="mt-0.5 truncate text-xs text-nord-polarLight">
            {primarySnapshot.leagueName ?? "Team context pending"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <SummaryChip
          label="Rank"
          value={primarySnapshot.standing?.rank ?? "–"}
        />
        <SummaryChip
          label="Points"
          value={primarySnapshot.standing?.points ?? "–"}
        />
        <SummaryChip
          label="Recent form"
          value={form ? form.length : "–"}
        />
      </div>

      <div className="mt-4">
        {renderForm(form) ?? (
          <div className="text-xs text-nord-polarLight">Form not available yet.</div>
        )}
      </div>
    </section>
  );
}

function RecordToggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-nord-frostDark text-white"
          : "bg-white/80 text-nord-polarLight hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}

function RecordCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[1.1rem] border border-nord-polarLighter/12 bg-white/86 px-3 py-2 shadow-[0_8px_18px_rgba(46,52,64,0.035)]">
      <div className="text-[10px] uppercase tracking-[0.12em] text-nord-polarLight">
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-semibold leading-5 text-nord-polar">
        {value}
      </div>
    </div>
  );
}

function LeagueTableRow({ row }: { row: StatsLeagueTableRow }) {
  return (
    <div
      className={`grid grid-cols-[2.2rem_minmax(0,1fr)_2.4rem_2.6rem] items-center gap-3 rounded-[1rem] px-3 py-2.5 text-sm ${
        row.isHighlighted
          ? "border border-nord-frostDark/18 bg-nord-frostDark/8 shadow-[0_10px_24px_rgba(94,129,172,0.08)]"
          : "border border-transparent bg-white/72"
      }`}
    >
      <div className="text-sm font-semibold text-nord-polar">{row.rank}</div>
      <div className="min-w-0">
        <div className="truncate font-medium text-nord-polar">{row.teamName}</div>
        <div className="mt-0.5 text-[11px] text-nord-polarLight">
          {row.played} MP · {row.wins}-{row.draws}-{row.losses}
        </div>
      </div>
      <div className="text-center font-semibold text-nord-polar">
        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
      </div>
      <div className="text-right text-base font-semibold text-nord-polar">
        {row.points}
      </div>
    </div>
  );
}

function DomesticLeaguePanel({ team }: { team: StatsTeamSection }) {
  const [showAllRows, setShowAllRows] = useState(false);
  const exactLeagueWidget = getExactScoreAxisLeagueTableWidget({
    competitionCode: team.domesticLeague.competitionCode,
    leagueName: team.domesticLeague.leagueName,
  });
  const mappedLeagueWidget = resolveScoreAxisLeagueTableWidget(team);
  const officialLeagueWidget = exactLeagueWidget
    ? {
        src: exactLeagueWidget.src,
        widgetId: exactLeagueWidget.widgetId,
        leagueName: exactLeagueWidget.leagueName,
        preserveQueryWidgetId: true,
      }
    : mappedLeagueWidget.available && mappedLeagueWidget.src
      ? {
          src: mappedLeagueWidget.src,
          widgetId: undefined,
          leagueName:
            team.domesticLeagueTable.leagueName ??
            team.domesticLeague.leagueName ??
            "Domestic league",
          preserveQueryWidgetId: false,
        }
      : null;

  const sectionTitle =
    team.domesticLeagueTable.leagueName ?? team.domesticLeague.leagueName ?? "Domestic league";

  const hasNativeRows = team.domesticLeagueTable.rows.length > 0;
  const visibleRows = showAllRows
    ? team.domesticLeagueTable.rows
    : team.domesticLeagueTable.rows.slice(0, 10);

  useEffect(() => {
    setShowAllRows(false);
  }, [sectionTitle, team.teamName]);

  return (
    <section className="rounded-[1.5rem] border border-nord-polarLighter/12 bg-white/88 p-4 shadow-[0_18px_50px_rgba(46,52,64,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          title="Domestic league widget"
          subtitle={
            hasNativeRows
              ? `Premium in-app league table for ${sectionTitle}.`
              : officialLeagueWidget
                ? `Official ScoreAxis league-table embed for ${officialLeagueWidget.leagueName}.`
                : `League-table view for ${sectionTitle}.`
          }
        />
        {hasNativeRows ? (
          <span className="rounded-full border border-nord-frostDark/12 bg-nord-frostDark/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-nord-frostDark">
            Native first
          </span>
        ) : null}
      </div>
      {hasNativeRows ? (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-[2.2rem_minmax(0,1fr)_2.4rem_2.6rem] gap-3 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-nord-polarLight">
            <div>#</div>
            <div>Club</div>
            <div className="text-center">GD</div>
            <div className="text-right">Pts</div>
          </div>
          {visibleRows.map((row) => (
            <LeagueTableRow
              key={`${row.teamId ?? row.teamName}-${row.rank}`}
              row={row}
            />
          ))}
          {team.domesticLeagueTable.rows.length > 10 ? (
            <button
              type="button"
              onClick={() => setShowAllRows((current) => !current)}
              className="inline-flex items-center rounded-full border border-nord-frostDark/16 bg-white/84 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-nord-frostDark transition hover:bg-white"
            >
              {showAllRows
                ? "Show top 10"
                : `Show all ${team.domesticLeagueTable.rows.length} teams`}
            </button>
          ) : null}
        </div>
      ) : officialLeagueWidget ? (
        <div className="mt-4">
          <ScoreAxisWidget
            src={officialLeagueWidget.src}
            widgetId={officialLeagueWidget.widgetId}
            preserveQueryWidgetId={officialLeagueWidget.preserveQueryWidgetId}
            title={sectionTitle}
            description={null}
            minHeight={420}
            compact
            fallbackMessage={`${officialLeagueWidget.leagueName} official widget is blocked by the provider right now, so this section will switch back automatically as soon as the connection is restored.`}
          />
        </div>
      ) : (
        <div className="mt-4">
          <EmptySection message={team.domesticLeagueTable.message} />
        </div>
      )}
    </section>
  );
}

function TeamTopPlayersPanel({ section }: { section: StatsPlayerLeadersSection }) {
  return (
    <section className="rounded-[1.5rem] border border-nord-polarLighter/12 bg-white/88 p-4 shadow-[0_18px_50px_rgba(46,52,64,0.08)]">
      <SectionHeading
        title="Team Top Players"
        subtitle={
          section.competitionName
            ? `Top scorers and attacking output in ${section.competitionName}.`
            : "Premium native player leaders view."
        }
      />
      {section.players.length > 0 ? (
        <div className="mt-4 space-y-2">
          {section.players.map((player, index) => (
            <div
              key={`${player.playerId ?? player.playerName}-${index}`}
              className="rounded-[1.1rem] border border-nord-polarLighter/12 bg-nord-snow/62 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-nord-polar">
                    {player.playerName}
                  </div>
                  <div className="mt-1 text-xs text-nord-polarLight">
                    {player.position ?? "Outfield"} · {player.playedMatches ?? "–"} matches
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold text-nord-polar">
                    {player.goals != null ? `${player.goals}G` : "Squad"}
                  </div>
                  <div className="mt-1 text-xs text-nord-polarLight">
                    {player.assists != null || player.penalties != null
                      ? `${player.assists ?? 0}A · ${player.penalties ?? 0}P`
                      : "Player profile"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptySection message={section.message} />
        </div>
      )}
    </section>
  );
}

function TeamProfilePanel({ team }: { team: StatsTeamSection }) {
  const info = team.teamInfo;

  return (
    <section className="rounded-[1.5rem] border border-nord-polarLighter/12 bg-white/88 p-4 shadow-[0_18px_50px_rgba(46,52,64,0.08)]">
      <SectionHeading
        title="Team Info"
        subtitle="Premium native club profile driven by structured football data."
      />
      {info.status === "available" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <RecordCard label="Club" value={info.officialName ?? team.teamName} />
          <RecordCard label="Coach" value={info.coachName ?? "–"} />
          <RecordCard label="Venue" value={info.venue ?? "–"} />
          <RecordCard label="Founded" value={info.founded ?? "–"} />
          <RecordCard label="Area" value={info.areaName ?? "–"} />
          <RecordCard label="Squad size" value={info.squadSize ?? "–"} />
        </div>
      ) : (
        <div className="mt-4">
          <EmptySection message={info.message} />
        </div>
      )}
    </section>
  );
}

function TeamNativePanels({
  team,
  showTopPlayers = true,
  showProfile = true,
}: {
  team: StatsTeamSection;
  showTopPlayers?: boolean;
  showProfile?: boolean;
}) {
  if (!showTopPlayers && !showProfile) return null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {showTopPlayers ? <TeamTopPlayersPanel section={team.topPlayers} /> : null}
      {showProfile ? <TeamProfilePanel team={team} /> : null}
    </div>
  );
}

function TeamInsightPanel({ team }: { team: StatsTeamSection }) {
  const hasRecentDomesticMatches = team.recentDomesticMatches.matches.length > 0;
  const preferredSnapshotKey =
    team.currentCompetition.standing || team.recentUclMatches.matches.length > 0
      ? "current"
      : "domestic";
  const [snapshotKey, setSnapshotKey] = useState<"domestic" | "current">(
    preferredSnapshotKey
  );
  const [recordKey, setRecordKey] = useState<StatsRecordKey>("overall");

  useEffect(() => {
    setSnapshotKey(preferredSnapshotKey);
  }, [preferredSnapshotKey, team.teamName]);

  const selectedSnapshot =
    snapshotKey === "domestic" ? team.domesticLeague : team.currentCompetition;
  const selectedRecord: StatsTeamRecord | null =
    selectedSnapshot.standing?.records[recordKey] ??
    selectedSnapshot.standing?.records.overall ??
    null;
  const selectedForm =
    selectedSnapshot.standing?.form ??
    (snapshotKey === "domestic"
      ? buildFormFromMatches(team.teamName, team.recentDomesticMatches.matches)
      : buildFormFromMatches(team.teamName, team.recentUclMatches.matches));
  const contextLabel =
    selectedSnapshot.standing?.description ??
    (snapshotKey === "domestic" ? "League" : "Competition");
  const isUsingOverallFallback =
    recordKey !== "overall" &&
    selectedSnapshot.standing?.records[recordKey] == null &&
    selectedSnapshot.standing?.records.overall != null;

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-nord-polarLighter/12 bg-gradient-to-br from-white/92 via-white/88 to-nord-snow/82 p-4 shadow-[0_22px_55px_rgba(46,52,64,0.07)]">
        <div className="flex flex-col gap-3">
          <SectionHeading
            title="Competition context"
            subtitle="Domestic league and current competition snapshots."
          />
          <div className="rounded-full border border-nord-polarLighter/12 bg-nord-snow/68 p-0.5 shadow-inner">
            <div className="flex flex-wrap gap-1.5">
              <SnapshotTabButton
                active={snapshotKey === "domestic"}
                label="Domestic league"
                onClick={() => setSnapshotKey("domestic")}
              />
              <SnapshotTabButton
                active={snapshotKey === "current"}
                label="Current competition"
                onClick={() => setSnapshotKey("current")}
              />
            </div>
          </div>
        </div>

        {selectedSnapshot.standing ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              {selectedSnapshot.leagueLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- external league logos
                <img
                  src={selectedSnapshot.leagueLogo}
                  alt=""
                  className="h-10 w-10 rounded-full bg-white object-contain p-1 shadow-sm"
                />
              ) : null}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-nord-polar">
                  {selectedSnapshot.leagueName}
                </div>
                <div className="mt-0.5 text-xs text-nord-polarLight">
                  Season {selectedSnapshot.season}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <RecordCard
                label="Rank"
                value={selectedSnapshot.standing.rank ?? "–"}
              />
              <RecordCard
                label="Points"
                value={selectedSnapshot.standing.points ?? "–"}
              />
              <RecordCard
                label="Form"
                value={selectedSnapshot.standing.form ?? "–"}
              />
              <RecordCard label="Context" value={contextLabel} />
            </div>

            <div className="rounded-[1.25rem] bg-nord-snow/68 p-3">
              <div className="flex flex-wrap gap-2">
                <RecordToggle
                  active={recordKey === "overall"}
                  label="Overall"
                  onClick={() => setRecordKey("overall")}
                />
                <RecordToggle
                  active={recordKey === "home"}
                  label="Home"
                  onClick={() => setRecordKey("home")}
                />
                <RecordToggle
                  active={recordKey === "away"}
                  label="Away"
                  onClick={() => setRecordKey("away")}
                />
              </div>

              {selectedRecord ? (
                <>
                  {isUsingOverallFallback ? (
                    <div className="mt-3 rounded-[1rem] border border-nord-polarLighter/12 bg-white/70 px-3 py-2 text-[11px] leading-5 text-nord-polarLight">
                      {recordKey === "home"
                        ? "Home-only split is not available from the provider yet, so Match Center is showing the overall competition record."
                        : "Away-only split is not available from the provider yet, so Match Center is showing the overall competition record."}
                    </div>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <RecordCard
                      label="W-D-L"
                      value={`${selectedRecord.wins}-${selectedRecord.draws}-${selectedRecord.losses}`}
                    />
                    <RecordCard label="Played" value={selectedRecord.played} />
                    <RecordCard
                      label="GF-GA"
                      value={`${selectedRecord.goalsFor}-${selectedRecord.goalsAgainst}`}
                    />
                    <RecordCard
                      label="Goal diff"
                      value={selectedRecord.goalDifference}
                    />
                  </div>
                </>
              ) : (
                <div className="mt-3">
                  <EmptySection message={selectedSnapshot.message} />
                </div>
              )}
            </div>

            {renderForm(selectedForm)}
          </div>
        ) : (
          <div className="mt-4">
            <EmptySection message={selectedSnapshot.message} />
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.9fr)]">
        <div className="space-y-4">
          {hasRecentDomesticMatches ? (
            <section className="rounded-[1.45rem] border border-nord-polarLighter/12 bg-white/88 p-3.5 shadow-[0_18px_48px_rgba(46,52,64,0.05)]">
              <SectionHeading title="Recent domestic matches" />
              <div className="mt-2.5">
                <FixtureList
                  matches={team.recentDomesticMatches.matches}
                  emptyMessage={team.recentDomesticMatches.message}
                />
              </div>
            </section>
          ) : (
            <TeamProfilePanel team={team} />
          )}

          <section className="rounded-[1.45rem] border border-nord-polarLighter/12 bg-white/88 p-3.5 shadow-[0_18px_48px_rgba(46,52,64,0.05)]">
            <SectionHeading title="Recent Champions League matches" />
            <div className="mt-2.5">
              <FixtureList
                matches={team.recentUclMatches.matches}
                emptyMessage={team.recentUclMatches.message}
              />
            </div>
          </section>
        </div>

        <DomesticLeaguePanel team={team} />
      </div>

      <TeamNativePanels team={team} showProfile={hasRecentDomesticMatches} />
    </div>
  );
}

function UclLeadersPanel({
  competitionId,
  stats,
}: {
  competitionId?: string | null;
  stats: MatchStatisticsPayload;
}) {
  if (competitionId !== "CL") {
    return (
      <section className="rounded-[1.5rem] border border-nord-polarLighter/12 bg-white/88 p-4 shadow-[0_18px_50px_rgba(46,52,64,0.08)]">
        <SectionHeading
          title="UCL Leaders"
          subtitle="Competition-wide player leaders are shown on Champions League fixtures."
        />
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] border border-nord-polarLighter/12 bg-white/88 p-4 shadow-[0_18px_50px_rgba(46,52,64,0.08)]">
      <SectionHeading
        title="UCL Leaders"
        subtitle="Premium native Champions League top-player view."
      />
      {stats.competitionLeaders.players.length > 0 ? (
        <div className="mt-4 space-y-2">
          {stats.competitionLeaders.players.map((player, index) => (
            <div
              key={`${player.playerId ?? player.playerName}-${index}`}
              className="rounded-[1.1rem] border border-nord-polarLighter/12 bg-nord-snow/62 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-nord-polar">
                    {player.playerName}
                  </div>
                  <div className="mt-1 text-xs text-nord-polarLight">
                    {player.teamName ?? "Club"} · {player.position ?? "Outfield"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold text-nord-polar">
                    {player.goals ?? 0}G
                  </div>
                  <div className="mt-1 text-xs text-nord-polarLight">
                    {player.assists ?? 0}A · {player.penalties ?? 0}P
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptySection message={stats.competitionLeaders.message} />
        </div>
      )}
    </section>
  );
}

export function MatchCenter({
  open,
  onToggle,
  competitionId,
  homeTeamName,
  homeTeamLogo,
  awayTeamName,
  awayTeamLogo,
  stats,
  isRefreshing = false,
  isAdmin = false,
  activeTab: controlledActiveTab,
  onActiveTabChange,
}: Props) {
  const [localActiveTab, setLocalActiveTab] = useState<CenterTab>("overview");
  const showUclLeaders = competitionId === "CL";
  const activeTab = controlledActiveTab ?? localActiveTab;
  const setActiveTab = onActiveTabChange ?? setLocalActiveTab;

  useEffect(() => {
    if (!showUclLeaders && activeTab === "leaders") {
      setActiveTab("overview");
    }
  }, [activeTab, setActiveTab, showUclLeaders]);

  const displayedMeetings = useMemo(() => {
    return [...stats.h2h.matches]
      .sort(
        (left, right) =>
          new Date(right.kickoff).getTime() - new Date(left.kickoff).getTime()
      )
      .slice(0, 5);
  }, [stats.h2h.matches]);

  const content = useMemo(() => {
    switch (activeTab) {
      case "home":
        return <TeamInsightPanel team={stats.homeTeam} />;
      case "away":
        return <TeamInsightPanel team={stats.awayTeam} />;
      case "leaders":
        return showUclLeaders ? (
          <UclLeadersPanel competitionId={competitionId} stats={stats} />
        ) : null;
      default:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <TeamHeroCard
                label="Home context"
                team={stats.homeTeam}
                fallbackLogo={homeTeamLogo}
              />
              <TeamHeroCard
                label="Away context"
                team={stats.awayTeam}
                fallbackLogo={awayTeamLogo}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-[1.45rem] border border-nord-polarLighter/12 bg-white/88 p-4 shadow-[0_18px_48px_rgba(46,52,64,0.05)]">
                <SectionHeading title={`${homeTeamName} recent UCL matches`} />
                <div className="mt-4">
                  <FixtureList
                    matches={stats.homeTeam.recentUclMatches.matches.slice(0, 5)}
                    emptyMessage={stats.homeTeam.recentUclMatches.message}
                  />
                </div>
              </section>
              <section className="rounded-[1.45rem] border border-nord-polarLighter/12 bg-white/88 p-4 shadow-[0_18px_48px_rgba(46,52,64,0.05)]">
                <SectionHeading title={`${awayTeamName} recent UCL matches`} />
                <div className="mt-4">
                  <FixtureList
                    matches={stats.awayTeam.recentUclMatches.matches.slice(0, 5)}
                    emptyMessage={stats.awayTeam.recentUclMatches.message}
                  />
                </div>
              </section>
            </div>

            <section className="rounded-[1.55rem] border border-nord-polarLighter/12 bg-gradient-to-br from-white/92 via-white/90 to-nord-snow/80 p-4 shadow-[0_24px_60px_rgba(46,52,64,0.07)]">
              <SectionHeading
                title="Previous meetings"
                subtitle="The latest five head-to-head meetings between both clubs."
              />

              {stats.h2h.summary ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <SummaryChip
                      label={
                        stats.h2h.isTruncated ? "Analyzed meetings" : "Total meetings"
                      }
                      value={
                        stats.h2h.isTruncated
                          ? stats.h2h.summary.analyzedMeetings
                          : stats.h2h.summary.totalMeetings
                      }
                    />
                    <SummaryChip
                      label={homeTeamName}
                      value={stats.h2h.summary.homeTeamWins}
                    />
                    <SummaryChip label="Draws" value={stats.h2h.summary.draws} />
                    <SummaryChip
                      label={awayTeamName}
                      value={stats.h2h.summary.awayTeamWins}
                    />
                  </div>

                  <div className="mt-4">
                    <FixtureList
                      matches={displayedMeetings}
                      emptyMessage={stats.h2h.message}
                    />
                  </div>
                </>
              ) : (
                <div className="mt-4">
                  <EmptySection message={stats.h2h.message} />
                </div>
              )}
            </section>
          </div>
        );
    }
  }, [
    activeTab,
    awayTeamLogo,
    awayTeamName,
    competitionId,
    displayedMeetings,
    homeTeamLogo,
    homeTeamName,
    showUclLeaders,
    stats,
  ]);

  return (
    <div className="border-t border-nord-polarLighter/12 bg-gradient-to-b from-nord-snow/45 via-white/42 to-white/28">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-white/35"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/85 text-nord-frostDark shadow-[0_10px_30px_rgba(94,129,172,0.16)] ring-1 ring-nord-polarLighter/10">
            <MatchCenterIcon />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-nord-polar">Match Center</div>
            <div className="truncate text-xs text-nord-polarLight">
              Previous meetings, local leagues, club context and official widgets
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isRefreshing ? (
            <span className="hidden rounded-full border border-sky-200/80 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 sm:inline-flex">
              Refreshing
            </span>
          ) : null}
          <span className="hidden rounded-full border border-nord-frostDark/10 bg-white/72 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-nord-frostDark sm:inline-flex">
            H2H • League • UCL
          </span>
          <span className="shrink-0 text-nord-polarLight">
            <ChevronIcon open={open} />
          </span>
        </div>
      </button>

      {open ? (
        <div className="space-y-4 px-4 pb-4">
          <section className="rounded-[1.2rem] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(236,239,244,0.78))] p-[0.35rem] shadow-[0_18px_44px_rgba(46,52,64,0.07)]">
            <div className="rounded-[0.95rem] border border-white/65 bg-white/42 p-[0.35rem] shadow-inner">
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Match Center tabs">
                <MatchCenterTabButton
                  active={activeTab === "overview"}
                  label="Overview"
                  icon={<MatchCenterIcon />}
                  onClick={() => setActiveTab("overview")}
                />
                <MatchCenterTabButton
                  active={activeTab === "home"}
                  label={homeTeamName}
                  logoSrc={homeTeamLogo}
                  onClick={() => setActiveTab("home")}
                />
                <MatchCenterTabButton
                  active={activeTab === "away"}
                  label={awayTeamName}
                  logoSrc={awayTeamLogo}
                  onClick={() => setActiveTab("away")}
                />
                {showUclLeaders ? (
                  <MatchCenterTabButton
                    active={activeTab === "leaders"}
                    label="UCL Leaders"
                    logoSrc="https://upload.wikimedia.org/wikipedia/en/f/f5/UEFA_Champions_League.svg"
                    icon={<TrophyIcon />}
                    onClick={() => setActiveTab("leaders")}
                  />
                ) : null}
              </div>
            </div>
          </section>

          <MatchCenterMeta stats={stats} isRefreshing={isRefreshing} isAdmin={isAdmin} />
          {content}

          {isAdmin && stats.note ? (
            <div className="px-1 text-xs leading-5 text-nord-polarLight">
              {stats.note}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
