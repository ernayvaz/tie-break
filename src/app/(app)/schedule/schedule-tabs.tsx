"use client";

import { useState, useMemo, useCallback, useEffect, useTransition, useRef, memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toDisplay } from "@/lib/prediction-values";
import type { PredictionValue } from "@prisma/client";
import type { PredictionDisplay } from "@/lib/prediction-values";
import type { MatchStatisticsPayload } from "@/lib/match-stats/types";
import { createUnavailableMatchStatisticsPayload } from "@/lib/match-stats/types";
import {
  shouldPollLiveMatch,
  type LiveMatchState,
} from "@/lib/live-match";
import { Button, Modal } from "@/components/ui";
import { PredictionPickDisplay } from "@/components/prediction-pick-display";
import { PowerPickToggle } from "@/components/power-pick-toggle";
import { CompetitionTabsClient } from "@/components/competition-tabs";
import type {
  PowerPickBalanceSummary,
  PowerPickMatchState,
} from "@/lib/power-pick";
import {
  DEFAULT_COMPETITION_ID,
  UCL_COMPETITION_ID,
  WORLD_CUP_2026_COMPETITION_ID,
} from "@/lib/config";
import { formatStageLabel, STAGE_ORDER } from "@/lib/stages";
import { MatchCenter, type CenterTab } from "./match-center";
import { LiveMatchSheet } from "./live-match-sheet";
import {
  submitPredictionAction,
  finalizePredictionAction,
  syncPredictionDerivedDataAction,
  unfinalizePredictionAction,
  rebuildCompetitionLeaderboardsAction,
  resetUpcomingPredictionsAction,
  resetPastPredictionsAction,
  togglePowerPickAction,
} from "./actions";

const EMPTY_POWER_PICK_BALANCE: PowerPickBalanceSummary = {
  competitionId: WORLD_CUP_2026_COMPETITION_ID,
  totalGranted: 0,
  usedLocked: 0,
  selectedUnlocked: 0,
  remainingAvailable: 0,
};

const MATCH_CENTER_TAB_STORAGE_KEY = "tie-break-match-center-tabs";
const SCHEDULE_DISPLAY_TIME_ZONE = "Europe/Istanbul";
const WORLD_CUP_KNOCKOUT_WIDGET_SRC =
  "https://widgets.sofascore.com/embed/unique-tournament/16/season/58210/cuptree/10560975?widgetTitle=Knockout%20stage&showCompetitionLogo=true&widgetTheme=light";
// Height of the provider promo band ("Never miss / See much more") pinned to the
// bottom of the cup-tree embed. We clip this many pixels so no third-party
// branding is shown inside our knockout panel.
const WORLD_CUP_KNOCKOUT_FOOTER_CLIP = 120;

type ScheduleTab = "upcoming" | "past" | "standings" | "knockout";

const scheduleDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: SCHEDULE_DISPLAY_TIME_ZONE,
});

const scheduleTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SCHEDULE_DISPLAY_TIME_ZONE,
});

const scheduleDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SCHEDULE_DISPLAY_TIME_ZONE,
});

export type ScheduleMatch = {
  id: string;
  competitionId?: string | null;
  externalApiId?: string | null;
  matchDatetime: string;
  lockAt: string;
  stage: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  officialResultType: PredictionValue | null;
  homeScore?: number | null;
  awayScore?: number | null;
  highlightHref?: string | null;
};

export type UserPrediction = {
  matchId: string;
  selectedPrediction: PredictionDisplay;
  isFinal: boolean;
  finalizedAt: string | null;
  /** First saved time (shown for drafts) */
  createdAt: string | null;
};

export type OtherPrediction = {
  name: string;
  surname: string;
  selectedPrediction: string;
  finalizedAt: string;
  isPowerPick: boolean;
};

function isSameCalendarDay(iso1: string, iso2: string): boolean {
  const d1 = new Date(iso1);
  const d2 = new Date(iso2);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

const formatStage = formatStageLabel;

function formatResult(value: PredictionValue | null): string {
  if (!value) return "–";
  return toDisplay(value);
}

function formatScheduleDate(dateLike: string | Date) {
  return scheduleDateFormatter.format(new Date(dateLike));
}

function formatScheduleTime(dateLike: string | Date) {
  return scheduleTimeFormatter.format(new Date(dateLike));
}

function formatScheduleDateTime(dateLike: string | Date) {
  return scheduleDateTimeFormatter.format(new Date(dateLike));
}

function initialsOf(name: string, surname: string): string {
  const initials = `${name.trim().charAt(0)}${surname.trim().charAt(0)}`.toUpperCase();
  return initials || "?";
}

const OTHER_PICK_PILL_CLASS: Record<string, string> = {
  "1": "bg-nord-frostDark/12 text-nord-frostDark ring-nord-frostDark/25",
  X: "bg-nord-polarLighter/20 text-nord-polar ring-nord-polarLighter/35",
  "2": "bg-violet-500/12 text-violet-600 ring-violet-500/25",
};

function OtherPickPill({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex h-7 min-w-[1.85rem] items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums ring-1 ${
        OTHER_PICK_PILL_CLASS[value] ?? OTHER_PICK_PILL_CLASS.X
      }`}
      aria-label={`Pick ${value}`}
    >
      {value}
    </span>
  );
}

type Props = {
  matches: ScheduleMatch[];
  userPredictions: UserPrediction[];
  othersByMatchId: Record<string, OtherPrediction[]>;
  statsByMatchId?: Record<string, MatchStatisticsPayload>;
  liveByMatchId?: Record<string, LiveMatchState>;
  powerPickBalance?: PowerPickBalanceSummary;
  powerPickByMatchId?: Record<string, PowerPickMatchState>;
  isAdmin?: boolean;
};

function buildPredictionMap(predictions: UserPrediction[]) {
  const map: Record<string, UserPrediction> = {};
  for (const p of predictions) map[p.matchId] = p;
  return map;
}

function buildOthersMap(othersByMatchId: Record<string, OtherPrediction[]>) {
  return Object.fromEntries(
    Object.entries(othersByMatchId).map(([matchId, list]) => [matchId, [...list]])
  ) as Record<string, OtherPrediction[]>;
}

function shouldRefreshMatchStats(stats?: MatchStatisticsPayload): boolean {
  if (!stats) return true;
  if (stats.status === "unavailable") return true;
  if (stats.status === "partial") return true;
  return (
    stats.freshness.status === "stale" ||
    stats.freshness.status === "partial" ||
    stats.freshness.status === "unavailable"
  );
}

// Sofascore standings embeds for the World Cup group stage (Groups A–L) plus the
// third-placed teams ranking. Standings are sourced exclusively from Sofascore.
// Defined at module scope (stable identity) so live polling / clock re-renders of
// ScheduleTabs never remount the iframes (which would blank the tables).
const WORLD_CUP_SOFASCORE_SEASON_ID = 58210;
// Each Sofascore embed pins its promo footer ("Never miss / See much more") to the
// bottom of the widget; we clip that band off via an overflow-hidden wrapper.
const WORLD_CUP_SOFASCORE_FOOTER_CLIP = 122;

const WORLD_CUP_SOFASCORE_STANDINGS = [
  { name: "Group A", tournamentId: 3954, height: 431 },
  { name: "Group B", tournamentId: 3955, height: 431 },
  { name: "Group C", tournamentId: 3956, height: 431 },
  { name: "Group D", tournamentId: 3957, height: 431 },
  { name: "Group E", tournamentId: 3958, height: 431 },
  { name: "Group F", tournamentId: 3959, height: 431 },
  { name: "Group G", tournamentId: 3960, height: 431 },
  { name: "Group H", tournamentId: 3961, height: 431 },
  { name: "Group I", tournamentId: 139403, height: 431 },
  { name: "Group J", tournamentId: 139404, height: 431 },
  { name: "Group K", tournamentId: 139405, height: 431 },
  { name: "Group L", tournamentId: 139406, height: 431 },
  { name: "Third-placed teams", tournamentId: 182545, height: 751 },
] as const;

// Memoized with no props so the surrounding ScheduleTabs re-renders (the 1-minute
// clock tick, 45s live polling, Match Center stat refreshes) never re-render this
// subtree. That keeps every embed mounted exactly once and prevents the tables from
// reloading/blanking after they first appear.
const WorldCupSofascoreStandings = memo(function WorldCupSofascoreStandings() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {WORLD_CUP_SOFASCORE_STANDINGS.map((group) => {
        const encodedName = encodeURIComponent(group.name);
        const src = `https://widgets.sofascore.com/embed/tournament/${group.tournamentId}/season/${WORLD_CUP_SOFASCORE_SEASON_ID}/standings/${encodedName}?widgetTitle=${encodedName}&showCompetitionLogo=true`;
        const visibleHeight = Math.max(group.height - WORLD_CUP_SOFASCORE_FOOTER_CLIP, 160);
        const spanFull = group.name === "Third-placed teams";
        return (
          <section
            key={group.name}
            className={`overflow-hidden rounded-[1.45rem] border border-nord-polarLighter/12 bg-white/92 p-3 shadow-[0_14px_40px_rgba(46,52,64,0.05)]${
              spanFull ? " lg:col-span-2" : ""
            }`}
          >
            <div className="overflow-hidden rounded-xl" style={{ height: `${visibleHeight}px` }}>
              <iframe
                id={`sofa-standings-embed-${group.tournamentId}-${WORLD_CUP_SOFASCORE_SEASON_ID}`}
                title={`${group.name} standings`}
                src={src}
                // Lazy-load so a wide desktop grid does not request all 13 embeds at
                // once (which the provider throttles, leaving blank tables).
                loading="lazy"
                className="block w-full"
                style={{ height: `${group.height}px`, maxWidth: "768px", width: "100%", border: 0 }}
                scrolling="no"
              />
            </div>
          </section>
        );
      })}
    </div>
  );
});

function WorldCupStandingsPanel() {
  return (
    <div className="border border-nord-polarLighter/50 border-t-0 rounded-b-lg bg-gradient-to-b from-white to-nord-snow/35 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-nord-polar">
            World Cup 2026 standings
          </h4>
          <p className="mt-1 text-xs leading-5 text-nord-polarLight">
            Group tables (A–L) and the third-placed teams ranking.
          </p>
        </div>
        <span className="rounded-full border border-nord-frostDark/15 bg-nord-frostDark/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nord-frostDark">
          Live
        </span>
      </div>
      <WorldCupSofascoreStandings />
    </div>
  );
}

function WorldCupKnockoutPanel() {
  return (
    <div className="border border-nord-polarLighter/50 border-t-0 rounded-b-lg bg-gradient-to-b from-white to-nord-snow/35 p-3 sm:p-4">
      <section className="rounded-[1.5rem] border border-nord-polarLighter/12 bg-white/88 p-4 shadow-[0_18px_50px_rgba(46,52,64,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-nord-polar">
              World Cup 2026 knockout bracket
            </h4>
            <p className="mt-1 text-xs leading-5 text-nord-polarLight">
              Official cup tree for the World Cup knockout stage.
            </p>
          </div>
          <span className="rounded-full border border-nord-frostDark/15 bg-nord-frostDark/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nord-frostDark">
            Official
          </span>
        </div>
        {/* The cup-tree embed pins a provider promo footer ("Never miss / See much
            more") to the bottom of the widget. We clip that band off via an
            overflow-hidden wrapper so no third-party branding is shown. */}
        <div
          className="mt-4 overflow-hidden rounded-[1.2rem] border border-nord-polarLighter/10 bg-white shadow-inner"
          style={{ height: `${872 - WORLD_CUP_KNOCKOUT_FOOTER_CLIP}px` }}
        >
          <iframe
            id="sofa-cupTree-embed-16-58210-10560975"
            src={WORLD_CUP_KNOCKOUT_WIDGET_SRC}
            title="World Cup 2026 knockout stage"
            className="w-full max-w-[700px]"
            style={{ height: "872px" }}
            frameBorder="0"
            scrolling="no"
          />
        </div>
      </section>
    </div>
  );
}

export function ScheduleTabs({
  matches,
  userPredictions,
  othersByMatchId,
  statsByMatchId = {},
  liveByMatchId = {},
  powerPickBalance,
  powerPickByMatchId = {},
  isAdmin = false,
}: Props) {
  const [competitionId, setCompetitionId] = useState<string>(DEFAULT_COMPETITION_ID);
  const [activeTab, setActiveTab] = useState<ScheduleTab>("upcoming");
  const [filterStage, setFilterStage] = useState<string>("");
  const [filterTeam, setFilterTeam] = useState<string>("");
  const [now, setNow] = useState(() => new Date());
  const [finalizeModal, setFinalizeModal] = useState<{
    matchId: string;
    matchLabel: string;
  } | null>(null);
  const [pendingFinalizeMatchIds, setPendingFinalizeMatchIds] = useState<Record<string, true>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedOthers, setExpandedOthers] = useState<Set<string>>(new Set());
  const [expandedStats, setExpandedStats] = useState<Set<string>>(new Set());
  const [matchCenterTabByMatchId, setMatchCenterTabByMatchId] = useState<
    Record<string, CenterTab>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.sessionStorage.getItem(MATCH_CENTER_TAB_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, CenterTab>;
    } catch {
      return {};
    }
  });
  const [optimisticSelections, setOptimisticSelections] = useState<Record<string, PredictionDisplay>>({});
  const [localPredictions, setLocalPredictions] = useState<Record<string, UserPrediction>>(
    () => buildPredictionMap(userPredictions)
  );
  const [localOthersByMatchId, setLocalOthersByMatchId] = useState<Record<string, OtherPrediction[]>>(
    () => buildOthersMap(othersByMatchId)
  );
  const [localStatsByMatchId, setLocalStatsByMatchId] = useState<
    Record<string, MatchStatisticsPayload>
  >(() => ({ ...statsByMatchId }));
  const [undoingMatchId, setUndoingMatchId] = useState<string | null>(null);
  const [powerPickBalanceState, setPowerPickBalanceState] =
    useState<PowerPickBalanceSummary>(powerPickBalance ?? EMPTY_POWER_PICK_BALANCE);
  const [localPowerPickByMatch, setLocalPowerPickByMatch] = useState<
    Record<string, PowerPickMatchState>
  >(() => ({ ...powerPickByMatchId }));
  const [pendingPowerPickMatchIds, setPendingPowerPickMatchIds] = useState<
    Record<string, true>
  >({});
  const [pendingResetUpcoming, setPendingResetUpcoming] = useState(false);
  const [pendingResetPast, setPendingResetPast] = useState(false);
  const [pendingStatsRefreshMatchIds, setPendingStatsRefreshMatchIds] =
    useState<Record<string, true>>({});
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [liveSheetMatchId, setLiveSheetMatchId] = useState<string | null>(null);
  const [liveStateByMatchId, setLiveStateByMatchId] =
    useState<Record<string, LiveMatchState>>(liveByMatchId);
  const [, startRefreshTransition] = useTransition();
  const autoRefreshedStatsMatchIdsRef = useRef<Set<string>>(new Set());
  const router = useRouter();
  const modalIsFinalizing = finalizeModal
    ? !!pendingFinalizeMatchIds[finalizeModal.matchId]
    : false;

  useEffect(() => {
    setLocalPredictions(buildPredictionMap(userPredictions));
  }, [userPredictions]);

  useEffect(() => {
    setPowerPickBalanceState(powerPickBalance ?? EMPTY_POWER_PICK_BALANCE);
  }, [powerPickBalance]);

  useEffect(() => {
    setLocalPowerPickByMatch({ ...powerPickByMatchId });
  }, [powerPickByMatchId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setLocalOthersByMatchId(buildOthersMap(othersByMatchId));
  }, [othersByMatchId]);

  useEffect(() => {
    setLocalStatsByMatchId((current) => ({
      ...current,
      ...statsByMatchId,
    }));
  }, [statsByMatchId]);

  useEffect(() => {
    setLiveStateByMatchId(liveByMatchId);
  }, [liveByMatchId]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        MATCH_CENTER_TAB_STORAGE_KEY,
        JSON.stringify(matchCenterTabByMatchId)
      );
    } catch {
      // Persisting tab choice is best-effort.
    }
  }, [matchCenterTabByMatchId]);

  const userPredictionByMatch = localPredictions;

  const matchesByCompetition = useMemo(() => {
    if (competitionId === UCL_COMPETITION_ID) {
      return matches.filter(
        (m) => m.competitionId === UCL_COMPETITION_ID || m.competitionId == null,
      );
    }
    return matches.filter((m) => m.competitionId === competitionId);
  }, [matches, competitionId]);

  /** Aynı tarihli maçlarda sıra sabit kalsın diye önce matchDatetime sonra id ile sırala. */
  const sortByDatetimeAsc = useCallback((a: ScheduleMatch, b: ScheduleMatch) => {
    const t =
      new Date(a.matchDatetime).getTime() - new Date(b.matchDatetime).getTime();
    return t !== 0 ? t : a.id.localeCompare(b.id);
  }, []);
  const sortByDatetimeDesc = useCallback(
    (a: ScheduleMatch, b: ScheduleMatch) => sortByDatetimeAsc(b, a),
    [sortByDatetimeAsc]
  );

  const { upcoming, past } = useMemo(() => {
    const upcomingList = matchesByCompetition
      .filter((m) => new Date(m.matchDatetime) >= now)
      .sort(sortByDatetimeAsc);
    const pastList = matchesByCompetition
      .filter((m) => new Date(m.matchDatetime) < now)
      .sort(sortByDatetimeDesc);
    return { upcoming: upcomingList, past: pastList };
  }, [matchesByCompetition, now, sortByDatetimeAsc, sortByDatetimeDesc]);

  const isWorldCupTab = competitionId === WORLD_CUP_2026_COMPETITION_ID;
  const isMatchTab = activeTab === "upcoming" || activeTab === "past";
  const currentList = activeTab === "past" ? past : upcoming;

  useEffect(() => {
    if (!isWorldCupTab && (activeTab === "standings" || activeTab === "knockout")) {
      setActiveTab("upcoming");
    }
  }, [activeTab, isWorldCupTab]);

  const stageOptions = useMemo(() => {
    const stages = new Set(currentList.map((m) => m.stage));
    return Array.from(stages).sort((a, b) => {
      const i = STAGE_ORDER.indexOf(a as (typeof STAGE_ORDER)[number]);
      const j = STAGE_ORDER.indexOf(b as (typeof STAGE_ORDER)[number]);
      if (i !== -1 && j !== -1) return i - j;
      if (i !== -1) return -1;
      if (j !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [currentList]);

  const teamOptions = useMemo(() => {
    const teams = new Set<string>();
    currentList.forEach((m) => {
      if (m.homeTeamName && m.homeTeamName !== "TBD") teams.add(m.homeTeamName);
      if (m.awayTeamName && m.awayTeamName !== "TBD") teams.add(m.awayTeamName);
    });
    return Array.from(teams).sort((a, b) => a.localeCompare(b));
  }, [currentList]);

  const filteredList = useMemo(() => {
    return currentList.filter((m) => {
      if (filterStage && m.stage !== filterStage) return false;
      if (filterTeam && m.homeTeamName !== filterTeam && m.awayTeamName !== filterTeam) return false;
      return true;
    });
  }, [currentList, filterStage, filterTeam]);

  /** En erkenden en geçe: tarih ve id ile sabit sıralı liste (upcoming = artan, past = azalan). */
  const sortedList = useMemo(() => {
    const list = [...filteredList];
    return activeTab === "upcoming"
      ? list.sort(sortByDatetimeAsc)
      : list.sort(sortByDatetimeDesc);
  }, [filteredList, activeTab, sortByDatetimeAsc, sortByDatetimeDesc]);

  const livePollCandidates = useMemo(
    () =>
      matches
        .filter((match) => {
          if (!match.externalApiId) return false;
          if (liveStateByMatchId[match.id]?.isLive) return true;
          if (liveSheetMatchId === match.id) return true;
          return shouldPollLiveMatch(match.matchDatetime, now);
        })
        .map((match) => ({
          id: match.id,
          competitionId: match.competitionId ?? null,
          externalApiId: match.externalApiId ?? null,
        })),
    [liveSheetMatchId, liveStateByMatchId, matches, now]
  );

  useEffect(() => {
    if (livePollCandidates.length === 0) return;

    let cancelled = false;

    const refreshLiveStates = async () => {
      try {
        const response = await fetch("/api/live-states", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matches: livePollCandidates }),
        });
        if (!response.ok) return;

        const data = (await response.json()) as {
          ok?: boolean;
          liveByMatchId?: Record<string, LiveMatchState>;
        };
        if (!data.ok || cancelled || !data.liveByMatchId) return;

        setLiveStateByMatchId((current) => ({
          ...current,
          ...data.liveByMatchId,
        }));
      } catch {
        // Live polling is best-effort and should not interrupt predictions UI.
      }
    };

    void refreshLiveStates();
    const intervalId = window.setInterval(() => {
      void refreshLiveStates();
    }, 45_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [livePollCandidates]);

  const resetFilters = () => {
    setFilterStage("");
    setFilterTeam("");
  };

  const applyLocalReset = useCallback((matchIds: string[]) => {
    if (matchIds.length === 0) return;
    const matchIdSet = new Set(matchIds);

    setLocalPredictions((prev) => {
      const next = { ...prev };
      for (const matchId of matchIds) {
        const existing = next[matchId];
        if (!existing) continue;
        next[matchId] = {
          ...existing,
          isFinal: false,
          finalizedAt: null,
          createdAt: existing.createdAt ?? null,
        };
      }
      return next;
    });

    setLocalOthersByMatchId((prev) => {
      const next = { ...prev };
      for (const matchId of matchIds) delete next[matchId];
      return next;
    });

    setExpandedOthers((prev) => {
      const next = new Set(prev);
      for (const matchId of matchIdSet) next.delete(matchId);
      return next;
    });
  }, []);

  const handleSubmitPrediction = (
    matchId: string,
    value: PredictionDisplay
  ) => {
    const previousPrediction = userPredictionByMatch[matchId];
    setActionError(null);
    setOptimisticSelections((prev) => ({ ...prev, [matchId]: value }));
    setLocalPredictions((prev) => ({
      ...prev,
      [matchId]: {
        matchId,
        selectedPrediction: value,
        isFinal: prev[matchId]?.isFinal ?? false,
        finalizedAt: prev[matchId]?.finalizedAt ?? null,
        createdAt: prev[matchId]?.createdAt ?? new Date().toISOString(),
      },
    }));

    void submitPredictionAction(matchId, value).then((result) => {
      if (result.ok) return;

      setActionError(result.error);
      setOptimisticSelections((prev) => {
        if (prev[matchId] !== value) return prev;
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      setLocalPredictions((prev) => {
        const current = prev[matchId];
        if (current?.isFinal) return prev;
        if (previousPrediction) return { ...prev, [matchId]: previousPrediction };
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
    });
  };

  const handleTogglePowerPick = (matchId: string, nextOn: boolean) => {
    setActionError(null);
    const prevMatch = localPowerPickByMatch[matchId];
    const prevBalance = powerPickBalanceState;

    setPendingPowerPickMatchIds((prev) => ({ ...prev, [matchId]: true }));
    setLocalPowerPickByMatch((prev) => ({
      ...prev,
      [matchId]: {
        matchId,
        isOn: nextOn,
        isLocked: prev[matchId]?.isLocked ?? false,
      },
    }));
    setPowerPickBalanceState((prev) => {
      const selectedUnlocked = Math.max(
        0,
        prev.selectedUnlocked + (nextOn ? 1 : -1)
      );
      return {
        ...prev,
        selectedUnlocked,
        remainingAvailable: Math.max(
          0,
          prev.totalGranted - prev.usedLocked - selectedUnlocked
        ),
      };
    });

    void togglePowerPickAction(matchId, nextOn).then((result) => {
      setPendingPowerPickMatchIds((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      if (result.ok) {
        setPowerPickBalanceState(result.balance);
        setLocalPowerPickByMatch((prev) => ({
          ...prev,
          [matchId]: result.matchState ?? { matchId, isOn: false, isLocked: false },
        }));
        return;
      }
      setActionError(result.error);
      setPowerPickBalanceState(prevBalance);
      setLocalPowerPickByMatch((prev) => {
        const next = { ...prev };
        if (prevMatch) next[matchId] = prevMatch;
        else delete next[matchId];
        return next;
      });
    });
  };

  const handleFinalizeConfirm = () => {
    if (!finalizeModal) return;
    const { matchId } = finalizeModal;
    const previousPrediction = userPredictionByMatch[matchId];
    const selectedPrediction =
      optimisticSelections[matchId] ?? previousPrediction?.selectedPrediction;
    const optimisticFinalizedAt = new Date().toISOString();

    setPendingFinalizeMatchIds((prev) => ({ ...prev, [matchId]: true }));
    setActionError(null);
    setFinalizeModal(null);
    if (selectedPrediction) {
      setLocalPredictions((prev) => ({
        ...prev,
        [matchId]: {
          matchId,
          selectedPrediction,
          isFinal: true,
          finalizedAt: optimisticFinalizedAt,
          createdAt: prev[matchId]?.createdAt ?? optimisticFinalizedAt,
        },
      }));
    }

    void (async () => {
      const result = await finalizePredictionAction(matchId, selectedPrediction);
      setPendingFinalizeMatchIds((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      if (result.ok) {
        setOptimisticSelections((prev) => {
          const next = { ...prev };
          delete next[matchId];
          return next;
        });
        if (result.others) {
          setLocalOthersByMatchId((prev) => ({ ...prev, [matchId]: result.others ?? [] }));
        }
        void syncPredictionDerivedDataAction(matchId);
        startRefreshTransition(() => {
          router.refresh();
        });
        return;
      }
      if (previousPrediction) {
        setLocalPredictions((prev) => ({ ...prev, [matchId]: previousPrediction }));
      } else {
        setLocalPredictions((prev) => {
          const next = { ...prev };
          delete next[matchId];
          return next;
        });
      }
      setActionError(result.error);
    })();
  };

  const handleUndo = async (matchId: string) => {
    const previousPrediction = userPredictionByMatch[matchId];
    setActionError(null);
    setUndoingMatchId(matchId);
    if (previousPrediction) {
      setLocalPredictions((prev) => ({
        ...prev,
        [matchId]: {
          ...previousPrediction,
          isFinal: false,
          finalizedAt: null,
        },
      }));
    }
    const result = await unfinalizePredictionAction(matchId);
    setUndoingMatchId(null);
    if (result.ok) {
      setLocalOthersByMatchId((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      void syncPredictionDerivedDataAction(matchId);
      startRefreshTransition(() => {
        router.refresh();
      });
    } else {
      if (previousPrediction) {
        setLocalPredictions((prev) => ({ ...prev, [matchId]: previousPrediction }));
      }
      setActionError(result.error);
    }
  };

  const toggleOthers = (matchId: string) => {
    setExpandedOthers((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  const refreshMatchStatsBatch = useCallback(
    async (matchIds: string[], options?: { silent?: boolean }) => {
      // Background auto-refreshes are best-effort: never surface a page-level error
      // banner (e.g. a temporarily disabled/rate-limited provider key) to the user.
      const silent = options?.silent === true;
      const ids = Array.from(
        new Set(matchIds.filter((matchId) => matchId && !pendingStatsRefreshMatchIds[matchId]))
      ).slice(0, 25);
      if (ids.length === 0) return;

      setPendingStatsRefreshMatchIds((prev) => {
        const next = { ...prev };
        ids.forEach((matchId) => {
          next[matchId] = true;
        });
        return next;
      });

      try {
        const response = await fetch("/api/match-stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchIds: ids }),
        });
        const data = (await response.json()) as {
          ok?: boolean;
          error?: string;
          refreshError?: string | null;
          statsByMatchId?: Record<string, MatchStatisticsPayload>;
        };

        if (!response.ok || !data.ok) {
          ids.forEach((matchId) => {
            autoRefreshedStatsMatchIdsRef.current.delete(matchId);
          });
          if (!silent) {
            setActionError(
              data.error ?? "Match Center data could not be refreshed right now."
            );
          }
          return;
        }

        if (data.statsByMatchId) {
          setLocalStatsByMatchId((current) => ({
            ...current,
            ...data.statsByMatchId,
          }));
        }

        if (data.refreshError) {
          ids.forEach((matchId) => {
            autoRefreshedStatsMatchIdsRef.current.delete(matchId);
          });
          if (!silent) setActionError(data.refreshError);
        }
      } catch {
        ids.forEach((matchId) => {
          autoRefreshedStatsMatchIdsRef.current.delete(matchId);
        });
        if (!silent) {
          setActionError("Match Center data could not be refreshed right now.");
        }
      } finally {
        setPendingStatsRefreshMatchIds((prev) => {
          const next = { ...prev };
          ids.forEach((matchId) => {
            delete next[matchId];
          });
          return next;
        });
      }
    },
    [pendingStatsRefreshMatchIds]
  );

  const refreshMatchStats = useCallback(
    async (matchId: string, options?: { silent?: boolean }) => {
      await refreshMatchStatsBatch([matchId], options);
    },
    [refreshMatchStatsBatch]
  );

  // NOTE: Match Center statistics are loaded lazily — only when a user actually
  // opens a fixture's Match Center (see `toggleStats`). We intentionally do NOT
  // pre-fetch/refresh stats for every visible match here. Proactively pulling the
  // (large) stats payloads for all matches was the dominant database egress source
  // and would quickly exhaust the hosting data-transfer quota.

  const toggleStats = (matchId: string, competitionId?: string | null) => {
    const willOpen = !expandedStats.has(matchId);
    setExpandedStats((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });

    // World Cup Match Center renders the official ScoreBat embed (its own data
    // source), so we must not pull the heavy native stats payload for it.
    if (competitionId === WORLD_CUP_2026_COMPETITION_ID) return;

    if (willOpen && shouldRefreshMatchStats(localStatsByMatchId[matchId])) {
      void refreshMatchStats(matchId);
    }
  };

  const setMatchCenterTab = useCallback((matchId: string, tab: CenterTab) => {
    setMatchCenterTabByMatchId((prev) =>
      prev[matchId] === tab ? prev : { ...prev, [matchId]: tab }
    );
  }, []);

  const scheduleGrid =
    "grid grid-cols-1 gap-4 px-4 py-3 items-center sm:grid-cols-[7rem_minmax(12rem,1fr)_14rem_6rem_5rem] sm:pl-[6.1rem]";

  const ScheduleTableHeader = () => (
    <div
      className={`${scheduleGrid} hidden bg-nord-snow/80 text-nord-polarLight text-xs font-semibold uppercase tracking-wide border-b border-nord-polarLighter/50 sm:grid`}
    >
      <span>Time</span>
      <span>Match</span>
      <span>Prediction</span>
      <span>Match score</span>
      <span className="text-center">Result</span>
    </div>
  );

  function MatchCard({
    m,
    canPredict,
    userPred,
    others,
    stats,
    liveState,
    displaySelection,
    isUndoing,
    onUndo,
    onOpenLive,
    separatorVariant,
  }: {
    m: ScheduleMatch;
    canPredict: boolean;
    userPred: UserPrediction | undefined;
    others: OtherPrediction[];
    stats: MatchStatisticsPayload;
    liveState: LiveMatchState | null;
    displaySelection: PredictionDisplay | undefined;
    isUndoing: boolean;
    onUndo: (matchId: string) => void;
    onOpenLive: (matchId: string) => void;
    /** Same day = thin line; new day = slightly thicker line; none = last item */
    separatorVariant: "same-day" | "new-day" | "none";
  }) {
    const teamsDetermined =
      m.homeTeamName !== "TBD" && m.awayTeamName !== "TBD";
    const isFinalizing = !!pendingFinalizeMatchIds[m.id];

    const showOthers = userPred?.isFinal && others.length > 0;
    const isExpanded = expandedOthers.has(m.id);
    const isStatsExpanded = expandedStats.has(m.id);
    const isLive = !!liveState?.isLive;
    const matchDate = new Date(m.matchDatetime);

    // Power Pick x3 — World Cup only, and only once an admin has granted rights.
    const isWorldCupMatch = m.competitionId === WORLD_CUP_2026_COMPETITION_ID;
    const powerPickFeatureOn = powerPickBalanceState.totalGranted > 0;
    const ppMatch = localPowerPickByMatch[m.id];
    const ppOn = ppMatch?.isOn ?? false;
    const lockPassedForPP = now.getTime() >= new Date(m.lockAt).getTime();
    const ppPending = !!pendingPowerPickMatchIds[m.id];
    const hasPrediction = !!displaySelection;
    const remainingPicks = powerPickBalanceState.remainingAvailable;
    const showPowerPick =
      isWorldCupMatch &&
      powerPickFeatureOn &&
      teamsDetermined &&
      (!lockPassedForPP || ppOn || isAdmin);
    const ppLockedVisual = lockPassedForPP && !isAdmin;
    const ppDisabled =
      ppPending ||
      ppLockedVisual ||
      (!ppOn && remainingPicks <= 0) ||
      (!ppOn && !hasPrediction);
    let ppTitle = "Correct Power Pick x3 predictions are worth 3 points.";
    if (ppLockedVisual) ppTitle = "Power Pick x3 is locked for this match.";
    else if (!ppOn && !hasPrediction) ppTitle = "Please select a prediction first.";
    else if (!ppOn && remainingPicks <= 0) ppTitle = "No Power Pick x3 picks remaining.";

    const powerPickBadge =
      isWorldCupMatch && ppOn ? (
        <span
          title={
            ppLockedVisual
              ? "Power Pick x3 is locked for this match."
              : "Correct Power Pick x3 predictions are worth 3 points."
          }
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/70 bg-[linear-gradient(135deg,#fde9b8,#f6c560)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#7a4a00] shadow-[0_1px_3px_rgba(224,138,30,0.25)]"
        >
          ★ x3
        </span>
      ) : null;

    const powerPickNode = showPowerPick ? (
      <PowerPickToggle
        on={ppOn}
        locked={ppLockedVisual}
        disabled={ppDisabled}
        pending={ppPending}
        title={ppTitle}
        onToggle={() => handleTogglePowerPick(m.id, !ppOn)}
        className="mb-2"
      />
    ) : null;

    const borderStyle =
      separatorVariant === "none"
        ? undefined
        : separatorVariant === "same-day"
          ? { borderBottom: "1px solid rgba(76, 86, 106, 0.22)" }
          : { borderBottom: "2px solid rgba(76, 86, 106, 0.45)" };

    return (
      <li
        className={`relative bg-white/60 transition-colors hover:bg-white/80 ${
          isLive ? "ring-1 ring-rose-300/30" : ""
        }`}
        style={borderStyle}
      >
        {isLive ? (
          <button
            type="button"
            onClick={() => onOpenLive(m.id)}
            className="absolute left-2 top-1/2 z-10 hidden w-[4.35rem] -translate-y-1/2 flex-col items-center gap-2 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(46,52,64,0.98),rgba(59,66,82,0.94))] px-2 py-3 text-white shadow-[0_22px_55px_rgba(46,52,64,0.26)] transition-transform hover:-translate-y-[52%] sm:flex"
            aria-label={`Open live match for ${m.homeTeamName} versus ${m.awayTeamName}`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-3.5 w-3.5">
                <path
                  d="M7 5l6 5-6 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/75">
              Open
            </span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.7)]" />
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/90">
              Live
            </span>
            <span className="text-[10px] font-medium text-white/80">
              {liveState.homeScore != null && liveState.awayScore != null
                ? `${liveState.homeScore}-${liveState.awayScore}`
                : "Now"}
            </span>
          </button>
        ) : null}

        <div className="px-4 py-4 sm:hidden">
          {isLive ? (
            <button
              type="button"
              onClick={() => onOpenLive(m.id)}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-300/35 bg-[linear-gradient(180deg,rgba(46,52,64,0.96),rgba(46,52,64,0.9))] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-[0_18px_44px_rgba(46,52,64,0.22)]"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-3 w-3">
                  <path
                    d="M7 5l6 5-6 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.7)]" />
              </span>
              Open Live Match
              <span className="rounded-full bg-white/12 px-2 py-0.5 text-[10px] tracking-[0.08em] text-white/85">
                {liveState.homeScore != null && liveState.awayScore != null
                  ? `${liveState.homeScore}-${liveState.awayScore}`
                  : liveState.label}
              </span>
            </button>
          ) : null}

          <div className="flex items-start gap-4">
            <div className="min-w-[5.5rem] text-nord-polarLight">
              <span className="block text-[11px] font-medium uppercase tracking-[0.12em]">
                Time
              </span>
              <span className="mt-1 block text-base font-semibold text-nord-polar">
                {formatScheduleDate(matchDate)}
              </span>
              <span className="mt-0.5 block text-sm">
                {formatScheduleTime(matchDate)}
              </span>
              <span className="mt-1 block text-xs">{formatStage(m.stage)}</span>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2.5">
                {m.homeTeamLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external API logo URL
                  <img
                    src={m.homeTeamLogo}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full border border-nord-polarLighter/40 bg-white object-contain"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nord-snow text-xs font-medium text-nord-polarLighter">
                    ?
                  </span>
                )}
                <span className="truncate text-base font-semibold text-nord-polar">
                  {m.homeTeamName}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {m.awayTeamLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external API logo URL
                  <img
                    src={m.awayTeamLogo}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full border border-nord-polarLighter/40 bg-white object-contain"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nord-snow text-xs font-medium text-nord-polarLighter">
                    ?
                  </span>
                )}
                <span className="truncate text-[15px] font-medium text-nord-polar">
                  {m.awayTeamName}
                </span>
              </div>
              {powerPickBadge ? <div className="pt-0.5">{powerPickBadge}</div> : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_4.25rem_3.5rem] gap-3 border-t border-nord-polarLighter/20 pt-3">
            <div className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-nord-polarLight">
                Prediction
              </span>
              {powerPickNode}
              {canPredict && teamsDetermined && (
                <div className="space-y-1.5">
                  <span className="block text-[11px] uppercase tracking-wide text-nord-polarLight">
                    Lock {formatScheduleTime(m.lockAt)}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(["1", "X", "2"] as const).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleSubmitPrediction(m.id, val)}
                        className={`min-w-[2rem] rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          displaySelection === val
                            ? "border-nord-frostDark bg-nord-frostDark text-white"
                            : "border-nord-polarLighter bg-white text-nord-polar hover:bg-nord-snow"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      disabled={!displaySelection || isFinalizing}
                      onClick={() =>
                        setFinalizeModal({
                          matchId: m.id,
                          matchLabel: `${m.homeTeamName} vs ${m.awayTeamName}`,
                        })
                      }
                    >
                      Finalize
                    </Button>
                  </div>
                </div>
              )}
              {!canPredict && userPred && teamsDetermined && (
                <PredictionPickDisplay
                  lockAt={m.lockAt}
                  pick={userPred.selectedPrediction}
                  finalizedAt={userPred.finalizedAt}
                  createdAt={userPred.createdAt}
                  isFinal={userPred.isFinal}
                  compact
                  onUndo={
                    userPred.isFinal && m.officialResultType === null && isAdmin
                      ? () => onUndo(m.id)
                      : undefined
                  }
                  undoLoading={isUndoing}
                />
              )}
            {!canPredict && !userPred && teamsDetermined && (
                <span className="mt-0.5 block text-nord-polarLight">–</span>
              )}
            </div>

            <div className="text-right">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-nord-polarLight">
                Score
              </span>
              <span className="block text-sm font-semibold text-nord-polar">
                {m.homeScore != null && m.awayScore != null
                  ? `${m.homeScore} – ${m.awayScore}`
                  : "–"}
              </span>
            </div>

            <div className="text-right">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-nord-polarLight">
                Result
              </span>
              <span className="block text-sm font-semibold text-nord-polar">
                {m.officialResultType != null
                  ? formatResult(m.officialResultType)
                  : "–"}
              </span>
            </div>
          </div>
        </div>

        <div className={`${scheduleGrid} hidden min-h-[4rem] text-sm sm:grid`}>
          <div className="flex flex-col justify-center text-nord-polarLight">
            <span className="font-medium text-nord-polar">
              {formatScheduleDate(matchDate)}
            </span>
            <span className="mt-0.5">
              {formatScheduleTime(matchDate)}
            </span>
            <span className="mt-1 text-xs">{formatStage(m.stage)}</span>
          </div>

          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              {m.homeTeamLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- external API logo URL
                <img
                  src={m.homeTeamLogo}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full object-contain bg-white border border-nord-polarLighter/50"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nord-snow text-xs font-medium text-nord-polarLighter">
                  ?
                </span>
              )}
              <span className="truncate font-semibold text-nord-polar">
                {m.homeTeamName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {m.awayTeamLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- external API logo URL
                <img
                  src={m.awayTeamLogo}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full object-contain bg-white border border-nord-polarLighter/50"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nord-snow text-xs font-medium text-nord-polarLighter">
                  ?
                </span>
              )}
              <span className="truncate text-sm font-medium text-nord-polar">
                {m.awayTeamName}
              </span>
            </div>
            {powerPickBadge ? <div className="pt-0.5">{powerPickBadge}</div> : null}
          </div>

          <div className="flex flex-col justify-center">
            {powerPickNode}
            {canPredict && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-nord-polarLight uppercase tracking-wide">
                  Lock {formatScheduleTime(m.lockAt)}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["1", "X", "2"] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSubmitPrediction(m.id, val)}
                      className={`min-w-[2rem] rounded border px-2 py-1 text-xs font-medium transition-colors ${
                        displaySelection === val
                          ? "border-nord-frostDark bg-nord-frostDark text-white"
                          : "border-nord-polarLighter bg-white text-nord-polar hover:bg-nord-snow"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    disabled={!displaySelection || isFinalizing}
                    onClick={() =>
                      setFinalizeModal({
                        matchId: m.id,
                        matchLabel: `${m.homeTeamName} vs ${m.awayTeamName}`,
                      })
                    }
                  >
                    Finalize
                  </Button>
                </div>
              </div>
            )}
            {!canPredict && userPred && (
              <PredictionPickDisplay
                lockAt={m.lockAt}
                pick={userPred.selectedPrediction}
                finalizedAt={userPred.finalizedAt}
                createdAt={userPred.createdAt}
                isFinal={userPred.isFinal}
                compact
                onUndo={
                  userPred.isFinal && m.officialResultType === null && isAdmin
                    ? () => onUndo(m.id)
                    : undefined
                }
                undoLoading={isUndoing}
              />
            )}
            {!canPredict && !userPred && (
              <span className="text-nord-polarLight mt-0.5">–</span>
            )}
          </div>

          <div className="flex flex-col justify-center">
            {m.homeScore != null && m.awayScore != null ? (
              <span className="font-semibold text-nord-polar">
                {m.homeScore} – {m.awayScore}
              </span>
            ) : (
              <span className="text-nord-polarLight">–</span>
            )}
          </div>

          <div className="flex flex-col justify-center text-center">
            <span className="font-semibold text-nord-polar">
              {m.officialResultType != null
                ? formatResult(m.officialResultType)
                : "–"}
            </span>
          </div>
        </div>

        {m.highlightHref ? (
          <div className="border-t border-nord-polarLighter/15 bg-[linear-gradient(180deg,rgba(236,239,244,0.42),rgba(255,255,255,0.72))] px-4 py-3 sm:px-5">
            <Link
              href={m.highlightHref}
              className="inline-flex items-center gap-2 rounded-full border border-nord-frostDark/15 bg-white/82 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-nord-frostDark shadow-[0_8px_22px_rgba(46,52,64,0.05)] transition-colors hover:border-nord-frostDark/30 hover:text-nord-polar"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-nord-frostDark text-[10px] text-white">
                &gt;
              </span>
              Watch highlights
            </Link>
          </div>
        ) : null}

        {teamsDetermined && (
          <MatchCenter
            open={isStatsExpanded}
            onToggle={() => toggleStats(m.id, m.competitionId ?? null)}
            competitionId={m.competitionId ?? null}
            homeTeamName={m.homeTeamName}
            homeTeamLogo={m.homeTeamLogo ?? null}
            awayTeamName={m.awayTeamName}
            awayTeamLogo={m.awayTeamLogo ?? null}
            stats={stats}
            isRefreshing={!!pendingStatsRefreshMatchIds[m.id]}
            isAdmin={isAdmin}
            activeTab={matchCenterTabByMatchId[m.id] ?? "overview"}
            onActiveTabChange={(tab) => setMatchCenterTab(m.id, tab)}
          />
        )}

        {showOthers && (
          <div className="border-t border-nord-polarLighter/15 bg-[linear-gradient(180deg,rgba(236,239,244,0.4),rgba(255,255,255,0.62))] px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => toggleOthers(m.id)}
              aria-expanded={isExpanded}
              className="group inline-flex items-center gap-2 rounded-full border border-nord-frostDark/15 bg-white/82 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-nord-frostDark shadow-[0_6px_18px_rgba(46,52,64,0.05)] transition-colors hover:border-nord-frostDark/30 hover:text-nord-polar"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-nord-frostDark/12 text-[10px] font-bold tabular-nums">
                {others.length}
              </span>
              {isExpanded ? "Hide players' picks" : "Players' picks"}
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            {isExpanded && (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {others.map((o, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-nord-polarLighter/30 bg-white/88 px-3 py-2 shadow-[0_4px_14px_rgba(46,52,64,0.04)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(94,129,172,0.16),rgba(76,86,106,0.12))] text-[11px] font-bold text-nord-frostDark ring-1 ring-white/70">
                      {initialsOf(o.name, o.surname)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-nord-polar">
                          {o.name} {o.surname}
                        </span>
                        {o.isPowerPick ? (
                          <span
                            title="Armed Power Pick x3 on this match"
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/70 bg-[linear-gradient(135deg,#fde9b8,#f6c560)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#7a4a00] shadow-[0_1px_3px_rgba(224,138,30,0.25)]"
                          >
                            ★ x3
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[11px] text-nord-polarLight">
                        Finalized {formatScheduleDateTime(o.finalizedAt)}
                      </div>
                    </div>
                    <OtherPickPill value={o.selectedPrediction} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </li>
    );
  }

  function MatchList({ list }: { list: ScheduleMatch[] }) {
    return (
      <>
        <ScheduleTableHeader />
        <ul className="divide-y-0">
          {list.map((m, index) => {
          const lockAt = new Date(m.lockAt).getTime();
          const teamsDetermined =
            m.homeTeamName !== "TBD" && m.awayTeamName !== "TBD";
          const canPredict =
            teamsDetermined &&
            (now.getTime() < lockAt || isAdmin) &&
            !userPredictionByMatch[m.id]?.isFinal;
          const userPred = userPredictionByMatch[m.id];
          const others = localOthersByMatchId[m.id] ?? [];
          const stats =
            localStatsByMatchId[m.id] ??
            createUnavailableMatchStatisticsPayload({
              homeTeamName: m.homeTeamName,
              homeTeamLogo: m.homeTeamLogo ?? null,
              awayTeamName: m.awayTeamName,
              awayTeamLogo: m.awayTeamLogo ?? null,
            });
          const liveState = liveStateByMatchId[m.id] ?? null;
          const displaySelection = optimisticSelections[m.id] ?? userPred?.selectedPrediction;
          const isLast = index === list.length - 1;
          const nextMatch = list[index + 1];
          const sameDayAsNext = nextMatch ? isSameCalendarDay(m.matchDatetime, nextMatch.matchDatetime) : false;
          const separatorVariant = isLast ? "none" : sameDayAsNext ? "same-day" : "new-day";

          return (
            <MatchCard
              key={m.id}
              m={m}
              canPredict={canPredict}
              userPred={userPred}
              others={others}
              stats={stats}
              liveState={liveState}
              displaySelection={displaySelection}
              isUndoing={undoingMatchId === m.id}
              onUndo={handleUndo}
              onOpenLive={setLiveSheetMatchId}
              separatorVariant={separatorVariant}
            />
          );
        })}
        </ul>
      </>
    );
  }

  return (
    <div className="mt-6">
      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {actionError}
        </div>
      )}
      <CompetitionTabsClient
        currentCompetitionId={competitionId}
        onSelect={(nextCompetitionId) => {
          setCompetitionId(nextCompetitionId);
          setActiveTab("upcoming");
          resetFilters();
        }}
      />
      <div className="mt-3 mb-0 grid grid-cols-2 gap-1 rounded-xl border border-nord-polarLighter/30 bg-nord-snow/40 p-1 sm:mt-0 sm:flex sm:gap-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:border-b sm:border-nord-polarLighter/50">
        <button
          type="button"
          onClick={() => { setActiveTab("upcoming"); resetFilters(); }}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:rounded-none sm:px-4 sm:py-3 sm:border-b-2 sm:-mb-px ${
            activeTab === "upcoming"
              ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
              : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
          }`}
        >
          Upcoming matches
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("past"); resetFilters(); }}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:rounded-none sm:px-4 sm:py-3 sm:border-b-2 sm:-mb-px ${
            activeTab === "past"
              ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
              : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
          }`}
        >
          Past matches
        </button>
        {isWorldCupTab ? (
          <>
            <button
              type="button"
              onClick={() => {
                setActiveTab("standings");
                resetFilters();
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:rounded-none sm:px-4 sm:py-3 sm:border-b-2 sm:-mb-px ${
                activeTab === "standings"
                  ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
                  : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
              }`}
            >
              Standings
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("knockout");
                resetFilters();
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:rounded-none sm:px-4 sm:py-3 sm:border-b-2 sm:-mb-px ${
                activeTab === "knockout"
                  ? "bg-white text-nord-polar shadow-sm sm:bg-transparent sm:shadow-none sm:border-nord-frostDark"
                  : "text-nord-polarLight hover:text-nord-polar sm:border-transparent"
              }`}
            >
              Knockout
            </button>
          </>
        ) : null}
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-nord-polar/5 border border-nord-polarLighter/50 border-t-0 text-sm">
          <span className="font-medium text-nord-polar">Admin:</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={async () => {
              setActionError(null);
              setResetMessage(null);
              setPendingResetUpcoming(true);
              const res = await resetUpcomingPredictionsAction();
              setPendingResetUpcoming(false);
              if (res.ok) {
                applyLocalReset(res.matchIds);
                setResetMessage(`Upcoming: ${res.count} prediction(s) reset.`);
                void rebuildCompetitionLeaderboardsAction(res.competitionIds);
                startRefreshTransition(() => {
                  router.refresh();
                });
                setTimeout(() => setResetMessage(null), 4000);
              } else {
                setActionError(res.error);
              }
            }}
            disabled={pendingResetUpcoming || pendingResetPast}
          >
            {pendingResetUpcoming ? "Resetting…" : "Reset all my predictions (upcoming)"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={async () => {
              setActionError(null);
              setResetMessage(null);
              setPendingResetPast(true);
              const res = await resetPastPredictionsAction();
              setPendingResetPast(false);
              if (res.ok) {
                applyLocalReset(res.matchIds);
                setResetMessage(`Past: ${res.count} prediction(s) reset.`);
                void rebuildCompetitionLeaderboardsAction(res.competitionIds);
                startRefreshTransition(() => {
                  router.refresh();
                });
                setTimeout(() => setResetMessage(null), 4000);
              } else {
                setActionError(res.error);
              }
            }}
            disabled={pendingResetUpcoming || pendingResetPast}
          >
            {pendingResetPast ? "Resetting…" : "Reset all my predictions (past)"}
          </Button>
          {resetMessage && (
            <span className="text-nord-frostDark font-medium">{resetMessage}</span>
          )}
        </div>
      )}

      {isMatchTab && currentList.length > 0 && (
        <div className="flex flex-col gap-2 border border-nord-polarLighter/50 border-t-0 bg-nord-snow/50 px-3 py-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4 sm:gap-y-2 sm:px-4 sm:py-3">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-nord-polar sm:text-sm sm:normal-case sm:tracking-normal">
            Filters
          </span>
          <div className="grid w-full min-w-0 grid-cols-2 gap-x-2 gap-y-2 sm:flex sm:flex-1 sm:items-end sm:gap-4">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-nord-polarLight">
                Stage
              </span>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="min-w-0 w-full cursor-pointer rounded-xl border border-nord-polarLighter/80 bg-white px-2.5 py-2 text-xs text-nord-polar shadow-[0_1px_2px_rgba(46,52,64,0.04)] focus:border-nord-frostDark focus:outline-none focus:ring-2 focus:ring-nord-frostDark/25 sm:min-w-[10rem] sm:px-3 sm:text-sm"
              >
                <option value="">All stages</option>
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {formatStage(stage)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-nord-polarLight">
                Team
              </span>
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="min-w-0 w-full cursor-pointer rounded-xl border border-nord-polarLighter/80 bg-white px-2.5 py-2 text-xs text-nord-polar shadow-[0_1px_2px_rgba(46,52,64,0.04)] focus:border-nord-frostDark focus:outline-none focus:ring-2 focus:ring-nord-frostDark/25 sm:min-w-[12rem] sm:px-3 sm:text-sm"
              >
                <option value="">All teams</option>
                {teamOptions.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(filterStage || filterTeam) && (
            <button
              type="button"
              onClick={resetFilters}
              className="shrink-0 self-start text-xs font-medium text-nord-frostDark underline-offset-2 hover:underline sm:self-auto sm:text-sm"
            >
              Clear filters
            </button>
          )}
          {isWorldCupTab && powerPickBalanceState.totalGranted > 0 && (
            <div
              title="Correct Power Pick x3 predictions are worth 3 points."
              className="flex w-full items-center justify-between gap-2 rounded-full border border-amber-300/60 bg-[linear-gradient(135deg,rgba(253,233,184,0.55),rgba(255,255,255,0.92))] px-3 py-1.5 shadow-[0_2px_8px_rgba(224,138,30,0.12)] sm:ml-auto sm:w-auto sm:justify-start"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7a4a00]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f7c948,#e08a1e)] text-[9px] text-white shadow-sm">
                  ★
                </span>
                Power Pick x3 left
              </span>
              <span className="text-sm font-bold tabular-nums text-[#7a4a00]">
                {powerPickBalanceState.remainingAvailable}/{powerPickBalanceState.totalGranted}
              </span>
            </div>
          )}
        </div>
      )}

      {activeTab === "standings" && isWorldCupTab ? (
        <WorldCupStandingsPanel />
      ) : activeTab === "knockout" && isWorldCupTab ? (
        <WorldCupKnockoutPanel />
      ) : (
      <div className="border border-nord-polarLighter/50 border-t-0 rounded-b-lg overflow-hidden">
        {currentList.length === 0 ? (
          <div className="px-4 py-8 text-center text-nord-polarLight text-sm">
            {activeTab === "upcoming" ? "No upcoming matches." : "No past matches."}
          </div>
        ) : sortedList.length === 0 ? (
          <div className="px-4 py-8 text-center text-nord-polarLight text-sm">
            No matches match the selected filters.
          </div>
        ) : (
          <MatchList list={sortedList} />
        )}
      </div>
      )}

      <Modal
        open={!!finalizeModal}
        onClose={() => !modalIsFinalizing && setFinalizeModal(null)}
        title="Finalize prediction?"
        confirmLabel="Yes, finalize"
        cancelLabel="Cancel"
        onConfirm={handleFinalizeConfirm}
        loading={modalIsFinalizing}
      >
        {finalizeModal && (
          <p>
            Are you sure you want to finalize your prediction for{" "}
            <strong>{finalizeModal.matchLabel}</strong>? You cannot change it
            after finalizing.
          </p>
        )}
      </Modal>
      <LiveMatchSheet
        open={!!liveSheetMatchId}
        onClose={() => setLiveSheetMatchId(null)}
        match={matches.find((match) => match.id === liveSheetMatchId) ?? null}
        liveState={
          liveSheetMatchId ? liveStateByMatchId[liveSheetMatchId] ?? null : null
        }
      />
    </div>
  );
}
