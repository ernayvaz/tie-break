"use client";

import { useEffect } from "react";
import { ScoreAxisWidget } from "@/components/scoreaxis-widget";
import type { LiveMatchState } from "@/lib/live-match";
import {
  resolveScoreAxisLiveMatchWidget,
} from "@/lib/providers/scoreaxis-provider";
import { resolveScoreBatLiveScoresWidget } from "@/lib/providers/scorebat-provider";

type MatchPreview = {
  externalApiId?: string | null;
  matchDatetime: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  match: MatchPreview | null;
  liveState: LiveMatchState | null;
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-4 w-4">
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LiveSpark() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/70" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.65)]" />
    </span>
  );
}

function formatKickoff(iso: string) {
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} · ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatSyncLabel(iso: string | null) {
  if (!iso) return "Live status follows the UEFA competition feed.";
  const date = new Date(iso);
  return `Updated ${date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function buildLiveWidgetFallbackMessage() {
  return "The official live widget for this fixture is coming soon. The live score rail stays active while we finish the full provider connection.";
}

export function LiveMatchSheet({ open, onClose, match, liveState }: Props) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, open]);

  if (!open || !match) return null;

  const scoreAxisLiveWidget = resolveScoreAxisLiveMatchWidget(match.externalApiId);
  const scoreBatLiveWidget = resolveScoreBatLiveScoresWidget();
  const widgetSrc =
    scoreAxisLiveWidget.available && scoreAxisLiveWidget.src
      ? scoreAxisLiveWidget.src
      : null;
  const homeScore = liveState?.homeScore ?? match.homeScore ?? null;
  const awayScore = liveState?.awayScore ?? match.awayScore ?? null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--app-header-height,6rem)] z-30 bg-nord-polar/35 backdrop-blur-[3px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Live Match"
    >
      <div className="flex h-full items-end justify-end sm:items-stretch">
        <aside
          className="flex h-full max-h-[88vh] w-full flex-col rounded-t-[1.9rem] border border-white/35 bg-[linear-gradient(180deg,rgba(46,52,64,0.96),rgba(46,52,64,0.93))] text-white shadow-[0_40px_120px_rgba(46,52,64,0.5)] sm:max-h-none sm:max-w-[34rem] sm:rounded-none sm:rounded-l-[2rem]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-white/10 px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
                  <LiveSpark />
                  Live Match
                </div>
                <div className="mt-4 flex items-center gap-3">
                  {match.homeTeamLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external team logos
                    <img
                      src={match.homeTeamLogo}
                      alt=""
                      className="h-10 w-10 rounded-full bg-white/90 object-contain p-1"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold tracking-tight">
                      {match.homeTeamName} vs {match.awayTeamName}
                    </h2>
                    <p className="mt-1 text-sm text-white/65">
                      {liveState?.label ?? "Official live status"}
                      {" · "}
                      {formatKickoff(match.matchDatetime)}
                    </p>
                  </div>
                  {match.awayTeamLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external team logos
                    <img
                      src={match.awayTeamLogo}
                      alt=""
                      className="h-10 w-10 rounded-full bg-white/90 object-contain p-1"
                    />
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/80 transition hover:bg-white/12 hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-[1.3rem] border border-white/10 bg-white/7 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">
                  Status
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {liveState?.label ?? "Monitoring"}
                </div>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-white/7 px-4 py-3 text-center">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">
                  Score
                </div>
                <div className="mt-1 text-xl font-semibold text-white">
                  {homeScore != null && awayScore != null
                    ? `${homeScore} - ${awayScore}`
                    : "–"}
                </div>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-white/7 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">
                  Feed
                </div>
                <div className="mt-1 text-sm font-semibold text-white">Official</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {widgetSrc ? (
              <ScoreAxisWidget
                src={widgetSrc}
                title="Official Live Match Center"
                description="Real-time timeline, statistics and lineups from ScoreAxis."
                minHeight={720}
                fallbackMessage={buildLiveWidgetFallbackMessage()}
              />
            ) : scoreBatLiveWidget.available && scoreBatLiveWidget.src ? (
              <section className="rounded-[1.7rem] border border-white/12 bg-white/7 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
                  <LiveSpark />
                  ScoreBat Fallback
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  Full live widget is coming soon.
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/72">
                  The premium live rail is still active for this fixture. While the
                  official full widget is being finalized, the public ScoreBat live
                  scores view stays visible as the fallback.
                </p>
                <div className="mt-5 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white">
                  <iframe
                    src={scoreBatLiveWidget.src}
                    title="ScoreBat live scores"
                    className="h-[720px] w-full border-0"
                    loading="lazy"
                  />
                </div>
              </section>
            ) : (
              <section className="rounded-[1.7rem] border border-white/12 bg-white/7 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
                  <LiveSpark />
                  Live Hub
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  The full live widget is coming soon.
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/72">
                  This fixture is already highlighted as live. The premium live rail
                  remains active while we finish the last widget pairing for this exact
                  match.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-white/10 bg-black/10 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">
                      Match state
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {liveState?.label ?? "Live feed pending"}
                    </div>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-black/10 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">
                      Sync note
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {formatSyncLabel(liveState?.lastUpdated ?? null)}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <p className="mt-4 px-1 text-xs leading-5 text-white/45">
              {formatSyncLabel(liveState?.lastUpdated ?? null)}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
