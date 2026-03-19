"use client";

import { useMemo, useState } from "react";
import type {
  MatchStatisticsPayload,
  StatsMatchSummary,
  StatsRecordKey,
  StatsTeamRecord,
  StatsTeamSection,
} from "@/lib/match-stats/types";

type Props = {
  open: boolean;
  onToggle: () => void;
  homeTeamName: string;
  homeTeamLogo: string | null;
  awayTeamName: string;
  awayTeamLogo: string | null;
  stats: MatchStatisticsPayload;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={`h-4 w-4 transition-transform duration-200 ${
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

function SparklineIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="h-4 w-4"
    >
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

function renderForm(form: string | null) {
  if (!form) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {form.split("").map((item, index) => {
        const tone =
          item === "W"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : item === "D"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-rose-200 bg-rose-50 text-rose-700";
        return (
          <span
            key={`${item}-${index}`}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${tone}`}
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
        <h4 className="text-sm font-semibold text-nord-polar">{title}</h4>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-nord-polarLight">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function EmptySection({ message }: { message: string | null }) {
  return (
    <div className="rounded-2xl border border-dashed border-nord-polarLighter/20 bg-white/60 px-4 py-4 text-sm text-nord-polarLight">
      {message}
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
    <div className="rounded-2xl border border-nord-polarLighter/12 bg-white/80 px-3 py-2 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.12em] text-nord-polarLight">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-nord-polar">{value}</div>
    </div>
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
    <ul className="space-y-2">
      {matches.map((match) => (
        <li
          key={match.id}
          className="rounded-2xl border border-nord-polarLighter/12 bg-white/80 px-3 py-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.12em] text-nord-polarLight">
                {formatKickoff(match.kickoff)}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-nord-polar">
                {match.homeTeamName} vs {match.awayTeamName}
              </div>
              <div className="mt-1 text-xs text-nord-polarLight">
                {match.competitionName}
                {match.outcomeLabel ? ` • ${match.outcomeLabel}` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold text-nord-polar">
                {match.homeGoals != null && match.awayGoals != null
                  ? `${match.homeGoals} - ${match.awayGoals}`
                  : "–"}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TeamTabButton({
  active,
  label,
  logo,
  onClick,
}: {
  active: boolean;
  label: string;
  logo: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all ${
        active
          ? "border-nord-frostDark/25 bg-white text-nord-polar shadow-sm"
          : "border-transparent bg-transparent text-nord-polarLight hover:bg-white/60"
      }`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- external team logos
        <img
          src={logo}
          alt=""
          className="h-5 w-5 shrink-0 rounded-full bg-white object-contain"
        />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] text-nord-polarLight">
          ?
        </span>
      )}
      <span className="truncate">{label}</span>
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
      className={`rounded-full px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
        active
          ? "bg-nord-frostDark text-white shadow-sm"
          : "bg-white/75 text-nord-polarLight hover:bg-white"
      }`}
    >
      {label}
    </button>
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
    <div className="rounded-2xl border border-nord-polarLighter/12 bg-white/85 px-3 py-3 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.12em] text-nord-polarLight">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-nord-polar">{value}</div>
    </div>
  );
}

function TeamInsightPanel({
  team,
}: {
  team: StatsTeamSection;
}) {
  const [snapshotKey, setSnapshotKey] = useState<"domestic" | "current">(
    "domestic"
  );
  const [recordKey, setRecordKey] = useState<StatsRecordKey>("overall");
  const selectedSnapshot =
    snapshotKey === "domestic" ? team.domesticLeague : team.currentCompetition;
  const selectedRecord: StatsTeamRecord | null =
    selectedSnapshot.standing?.records[recordKey] ?? null;
  const snapshotTitle =
    snapshotKey === "domestic"
      ? "Domestic league snapshot"
      : "Current competition snapshot";
  const contextLabel =
    selectedSnapshot.standing?.description ??
    (snapshotKey === "domestic" ? "League" : "Competition");

  return (
    <div className="space-y-4">
      <section className="rounded-[1.4rem] border border-nord-polarLighter/12 bg-gradient-to-br from-white/90 to-nord-snow/80 px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <SectionHeading title={snapshotTitle} subtitle={selectedSnapshot.countryName} />
          <div className="rounded-[1.1rem] border border-nord-polarLighter/12 bg-nord-snow/70 p-1.5 shadow-inner">
            <div className="flex flex-wrap gap-2">
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
              <RecordCard
                label="Context"
                value={contextLabel}
              />
            </div>

            <div className="rounded-2xl bg-nord-snow/65 p-3">
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
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <RecordCard label="W-D-L" value={`${selectedRecord.wins}-${selectedRecord.draws}-${selectedRecord.losses}`} />
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
              ) : (
                <div className="mt-3">
                  <EmptySection message={selectedSnapshot.message} />
                </div>
              )}
            </div>

            {renderForm(selectedSnapshot.standing.form)}
          </div>
        ) : (
          <div className="mt-4">
            <EmptySection message={selectedSnapshot.message} />
          </div>
        )}
      </section>

      <section className="rounded-[1.4rem] border border-nord-polarLighter/12 bg-white/85 px-4 py-4 shadow-sm">
        <SectionHeading title="Recent domestic matches" />
        <div className="mt-4">
          <FixtureList
            matches={team.recentDomesticMatches.matches}
            emptyMessage={team.recentDomesticMatches.message}
          />
        </div>
      </section>

      <section className="rounded-[1.4rem] border border-nord-polarLighter/12 bg-white/85 px-4 py-4 shadow-sm">
        <SectionHeading title="Recent Champions League matches" />
        <div className="mt-4">
          <FixtureList
            matches={team.recentUclMatches.matches}
            emptyMessage={team.recentUclMatches.message}
          />
        </div>
      </section>
    </div>
  );
}

export function StatisticsDrawer({
  open,
  onToggle,
  homeTeamName,
  homeTeamLogo,
  awayTeamName,
  awayTeamLogo,
  stats,
}: Props) {
  const [activeTeam, setActiveTeam] = useState<"home" | "away">("home");

  const selectedTeam = useMemo(
    () => (activeTeam === "home" ? stats.homeTeam : stats.awayTeam),
    [activeTeam, stats.awayTeam, stats.homeTeam]
  );

  return (
    <div className="border-t border-nord-polarLighter/12 bg-gradient-to-b from-nord-snow/40 via-white/40 to-white/25">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-white/35"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/85 text-nord-frostDark shadow-sm ring-1 ring-nord-polarLighter/12">
            <SparklineIcon />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-nord-polar">
              Statistics
            </div>
            <div className="truncate text-xs text-nord-polarLight">
              Previous meetings, league context and recent form
            </div>
          </div>
        </div>
        <span className="shrink-0 text-nord-polarLight">
          <ChevronIcon open={open} />
        </span>
      </button>

      {open ? (
        <div className="space-y-4 px-4 pb-4">
          <section className="rounded-[1.5rem] border border-nord-polarLighter/12 bg-gradient-to-br from-white/90 to-nord-snow/75 px-4 py-4 shadow-sm">
            <SectionHeading title="Previous meetings" />

            {stats.h2h.summary ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <SummaryChip
                    label="Total meetings"
                    value={stats.h2h.summary.totalMeetings}
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
                    matches={stats.h2h.matches}
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

          <section className="rounded-[1.6rem] border border-nord-polarLighter/12 bg-nord-snow/55 p-2 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <TeamTabButton
                active={activeTeam === "home"}
                label={homeTeamName}
                logo={stats.homeTeam.teamLogo ?? homeTeamLogo}
                onClick={() => setActiveTeam("home")}
              />
              <TeamTabButton
                active={activeTeam === "away"}
                label={awayTeamName}
                logo={stats.awayTeam.teamLogo ?? awayTeamLogo}
                onClick={() => setActiveTeam("away")}
              />
            </div>
          </section>

          <TeamInsightPanel team={selectedTeam} />

          {stats.note ? (
            <div className="px-1 text-xs text-nord-polarLight">{stats.note}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
