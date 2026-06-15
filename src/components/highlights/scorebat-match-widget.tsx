"use client";

import { useEffect } from "react";

/**
 * Embeds an official ScoreBat World Cup widget. Two variants are used:
 *  - the league panel (Match Center): open any fixture to see AI prediction,
 *    live standings, recent form, previous meetings and full team data;
 *  - the video panel (Highlights, desktop): the official World Cup highlight clips;
 *  - the league panel (Highlights, mobile): the same league widget used for Match
 *    Center — better layout on narrow viewports.
 *
 * The token in the URL is a public embed token (ScoreBat's own embed code is a
 * plain client-side iframe), so it is safe to ship to the browser. We load
 * ScoreBat's embed.js once so the iframe auto-resizes via postMessage.
 */

const FALLBACK_LEAGUE_URL =
  "https://www.scorebat.com/embed/league/fifa-world-cup/?token=MzA1MTA4XzE3ODE1MTY2MTRfYzY5ODhlMjdjMzMwNDUyODcxZmY4OGQ1NjRlZDE3YzJiMjk5OTRiZg==&pref=%7B%22nomaxwidth%22%3Atrue%7D";

const FALLBACK_VIDEO_URL =
  "https://www.scorebat.com/embed/videopanel/league/fifa-world-cup/?token=MzA1MTA4XzE3ODE1MTY2MTRfYzY5ODhlMjdjMzMwNDUyODcxZmY4OGQ1NjRlZDE3YzJiMjk5OTRiZg==&pref=%7B%22autoplay%22%3Atrue%7D";

const EMBED_SCRIPT_ID = "scorebat-jssdk";
const EMBED_SCRIPT_SRC = "https://www.scorebat.com/embed/embed.js?v=arrv";

function useScoreBatEmbedScript() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(EMBED_SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = EMBED_SCRIPT_ID;
    script.src = EMBED_SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, []);
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
  mobileEmbedUrl,
  desktopEmbedUrl,
  title,
  eyebrow,
  badge,
  description,
}: {
  embedUrl?: string;
  /** When set with `desktopEmbedUrl`, mobile viewports use this iframe src. */
  mobileEmbedUrl?: string;
  /** When set with `mobileEmbedUrl`, sm+ viewports use this iframe src. */
  desktopEmbedUrl?: string;
  title: string;
  eyebrow: string;
  badge: string;
  description: string;
}) {
  useScoreBatEmbedScript();

  const desktopUrl = desktopEmbedUrl ?? embedUrl ?? mobileEmbedUrl ?? "";
  const mobileUrl = mobileEmbedUrl ?? embedUrl ?? desktopUrl;
  const isResponsive = Boolean(mobileEmbedUrl && desktopEmbedUrl);

  const iframeProps = {
    title,
    frameBorder: 0 as const,
    allowFullScreen: true,
    allow: "autoplay; fullscreen",
    loading: "lazy" as const,
    referrerPolicy: "strict-origin-when-cross-origin" as const,
    className: "_scorebatEmbeddedPlayer_ block w-full rounded-[1rem] bg-white",
    style: { width: "100%", height: 760, border: 0 },
  };

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
        {isResponsive ? (
          <>
            <iframe {...iframeProps} src={mobileUrl} className={`${iframeProps.className} sm:hidden`} />
            <iframe {...iframeProps} src={desktopUrl} className={`${iframeProps.className} hidden sm:block`} />
          </>
        ) : (
          <iframe {...iframeProps} src={desktopUrl} />
        )}
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
  return (
    <WidgetFrame
      mobileEmbedUrl={getLeagueEmbedUrl()}
      desktopEmbedUrl={getVideoEmbedUrl()}
      title={title ?? "World Cup highlights"}
      eyebrow="Official highlights"
      badge="ScoreBat · World Cup"
      description="Official World Cup highlight clips. Pick any match below to watch its recap right here."
    />
  );
}
