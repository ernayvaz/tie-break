"use client";

import { useEffect, useState } from "react";

/**
 * Embeds an official ScoreBat World Cup widget. Variants:
 *  - league panel + embed.js (Match Center): fixture data, AI prediction, H2H, etc.
 *  - videopanel + embed.js (Highlights, desktop): highlight clips, player sizing.
 *  - videopanel + panelx.js (Highlights, mobile): responsive panel sizing.
 *
 * The embed is a cross-origin iframe, so we render it as-is with the full set of
 * player permissions. We intentionally do NOT overlay/clip the iframe: doing so
 * both crops the player and (because an overlay swallows pointer events) blocks
 * clicking a fixture, which stops videos from opening.
 *
 * Embed tokens are public (ScoreBat ships them in plain iframe embed codes).
 */

const FALLBACK_LEAGUE_URL =
  "https://www.scorebat.com/embed/league/fifa-world-cup/?token=MzA1MTA4XzE3ODE1MTY2MTRfYzY5ODhlMjdjMzMwNDUyODcxZmY4OGQ1NjRlZDE3YzJiMjk5OTRiZg==&pref=%7B%22nomaxwidth%22%3Atrue%7D";

const FALLBACK_VIDEO_URL =
  "https://www.scorebat.com/embed/videopanel/league/fifa-world-cup/?token=MzA1MTA4XzE3ODE1MTY2MTRfYzY5ODhlMjdjMzMwNDUyODcxZmY4OGQ1NjRlZDE3YzJiMjk5OTRiZg==&pref=%7B%22autoplay%22%3Atrue%7D";

// Full player permissions so highlights play with every feature enabled
// (autoplay, fullscreen, DRM/encrypted-media, PiP, sharing, etc.).
const PLAYER_ALLOW =
  "autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write; web-share; accelerometer; gyroscope";

const EMBED_SCRIPT_ID = "scorebat-jssdk";
const EMBED_SCRIPT_SRC = "https://www.scorebat.com/embed/embed.js?v=arrv";
const EMBED_RESCAN_SCRIPT_ID_PREFIX = "scorebat-jssdk-rescan";
const PANEL_SCRIPT_ID = "scorebat-paneljs";
const PANEL_SCRIPT_SRC = "https://www.scorebat.com/embed/panelx.js?v=f4fksn";

let lastEmbedRescanAt = 0;
let embedRescanSequence = 0;

declare global {
  interface Window {
    SCOREBAT_OPTIONS?: {
      panelClassName: string;
      panelSizing: string;
    };
  }
}

function useMobileViewport(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

function useScoreBatEmbedScript(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;

      const existing = document.getElementById(EMBED_SCRIPT_ID);
      if (!existing) {
        const script = document.createElement("script");
        script.id = EMBED_SCRIPT_ID;
        script.src = EMBED_SCRIPT_SRC;
        script.async = true;
        document.body.appendChild(script);
        lastEmbedRescanAt = Date.now();
        return;
      }

      // ScoreBat's embed.js scans ._scorebatEmbeddedPlayer_ iframes when it runs.
      // Match Center is mounted lazily, but removing the already-loaded script on
      // every mount makes mobile embeds flicker/reload as parent schedule state
      // changes. If the base script already exists, append a short-lived rescan
      // copy instead. Throttle rescans so repeated React remounts do not keep
      // tearing the iframe down and rebuilding it.
      const now = Date.now();
      if (now - lastEmbedRescanAt < 2_000) return;
      lastEmbedRescanAt = now;
      embedRescanSequence += 1;
      const script = document.createElement("script");
      script.id = `${EMBED_RESCAN_SCRIPT_ID_PREFIX}-${embedRescanSequence}`;
      script.src = EMBED_SCRIPT_SRC;
      script.async = true;
      script.onload = () => script.remove();
      script.onerror = () => script.remove();
      document.body.appendChild(script);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [enabled]);
}

function useScoreBatPanelScript(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (document.getElementById(PANEL_SCRIPT_ID)) return;
    window.SCOREBAT_OPTIONS = {
      panelClassName: "_scorebatEmbeddedPanel_",
      panelSizing: "responsive",
    };
    const script = document.createElement("script");
    script.id = PANEL_SCRIPT_ID;
    script.src = PANEL_SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, [enabled]);
}

function getLeagueEmbedUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SCOREBAT_WC_EMBED_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_LEAGUE_URL;
}

function getVideoEmbedUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SCOREBAT_WC_HIGHLIGHTS_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_VIDEO_URL;
}

function WidgetFrame({
  embedUrl,
  title,
  eyebrow,
  badge,
  description,
}: {
  embedUrl: string;
  title: string;
  eyebrow: string;
  badge: string;
  description: string;
}) {
  useScoreBatEmbedScript();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const timeoutId = window.setTimeout(() => setLoaded(true), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [embedUrl]);

  return (
    <section className="overflow-hidden rounded-[1.4rem] border border-nord-polarLighter/12 bg-white/90 shadow-[0_18px_50px_rgba(46,52,64,0.07)]">
      <div className="flex items-center justify-between gap-3 border-b border-nord-polarLighter/12 px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-nord-frostDark">
            {eyebrow}
          </div>
          <h4 className="mt-1 text-sm font-semibold text-nord-polar">{title}</h4>
        </div>
        <span className="hidden rounded-full border border-nord-frostDark/12 bg-white/72 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nord-frostDark sm:inline-flex">
          {badge}
        </span>
      </div>
      <p className="px-4 pt-3 text-xs leading-5 text-nord-polarLight">{description}</p>
      <div className="px-2 pb-3 pt-2 sm:px-3">
        <div className="relative w-full overflow-hidden rounded-[1rem] bg-white" style={{ minHeight: 420 }}>
          {!loaded ? (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,rgba(248,250,252,0.86),rgba(236,239,244,0.72))]"
              aria-hidden
            >
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-nord-polarLighter/40 border-t-nord-frostDark" />
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-nord-polarLight">
                Loading match data…
              </span>
            </div>
          ) : null}
          <iframe
            src={embedUrl}
            title={title}
            frameBorder={0}
            allowFullScreen
            allow={PLAYER_ALLOW}
            onLoad={() => setLoaded(true)}
            className="_scorebatEmbeddedPlayer_ relative block w-full bg-white"
            style={{ width: "100%", height: 760, border: 0 }}
          />
        </div>
      </div>
    </section>
  );
}

export function ScoreBatMatchWidget({ title }: { title?: string }) {
  return (
    <WidgetFrame
      embedUrl={getLeagueEmbedUrl()}
      title={title ?? "World Cup Match Center"}
      eyebrow="Live match data"
      badge="AI · Standings · H2H"
      description="Open any fixture inside the panel below to see its AI prediction, live standings, recent form, previous meetings and full team data."
    />
  );
}

export function ScoreBatHighlightsWidget({ title }: { title?: string }) {
  const isMobile = useMobileViewport();
  const showMobile = isMobile === true;
  const showDesktop = isMobile === false;

  useScoreBatPanelScript(showMobile);
  useScoreBatEmbedScript(showDesktop);

  const videoUrl = getVideoEmbedUrl();
  const widgetTitle = title ?? "World Cup highlights";

  return (
    <section className="overflow-hidden rounded-[1.4rem] border border-nord-polarLighter/12 bg-white/90 shadow-[0_18px_50px_rgba(46,52,64,0.07)]">
      <div className="flex items-center justify-between gap-3 border-b border-nord-polarLighter/12 px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-nord-frostDark">
            Official highlights
          </div>
          <h4 className="mt-1 text-sm font-semibold text-nord-polar">{widgetTitle}</h4>
        </div>
        <span className="hidden rounded-full border border-nord-frostDark/12 bg-white/72 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nord-frostDark sm:inline-flex">
          World Cup 2026
        </span>
      </div>
      <p className="px-4 pt-3 text-xs leading-5 text-nord-polarLight">
        Official World Cup highlight clips. Pick any match below to watch its recap right here.
      </p>
      <div className="px-2 pb-3 pt-2 sm:px-3">
        {showMobile ? (
          <iframe
            key="scorebat-highlights-mobile"
            src={videoUrl}
            title={widgetTitle}
            frameBorder={0}
            allowFullScreen
            allow={PLAYER_ALLOW}
            className="_scorebatEmbeddedPanel_ block w-full rounded-[1rem]"
            style={{
              display: "block",
              width: "100%",
              height: 800,
              backgroundColor: "rgb(17,17,17)",
              border: 0,
            }}
          />
        ) : showDesktop ? (
          <iframe
            key="scorebat-highlights-desktop"
            src={videoUrl}
            title={widgetTitle}
            frameBorder={0}
            allowFullScreen
            allow={PLAYER_ALLOW}
            className="_scorebatEmbeddedPlayer_ block w-full rounded-[1rem] bg-white"
            style={{ width: "100%", height: 760, border: 0 }}
          />
        ) : (
          <div
            className="w-full rounded-[1rem] bg-nord-snow/60"
            style={{ height: 760 }}
            aria-hidden
          />
        )}
      </div>
    </section>
  );
}
