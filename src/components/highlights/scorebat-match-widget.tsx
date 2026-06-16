"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Embeds an official ScoreBat World Cup widget. Variants:
 *  - league panel + embed.js (Match Center): fixture data, AI prediction, H2H, etc.
 *  - videopanel + embed.js (Highlights, desktop): highlight clips, player sizing.
 *  - videopanel + panelx.js (Highlights, mobile): responsive panel sizing.
 *
 * Embed tokens are public (ScoreBat ships them in plain iframe embed codes).
 */

const FALLBACK_LEAGUE_URL =
  "https://www.scorebat.com/embed/league/fifa-world-cup/?token=MzA1MTA4XzE3ODE1MTY2MTRfYzY5ODhlMjdjMzMwNDUyODcxZmY4OGQ1NjRlZDE3YzJiMjk5OTRiZg==&pref=%7B%22nomaxwidth%22%3Atrue%7D";

const FALLBACK_VIDEO_URL =
  "https://www.scorebat.com/embed/videopanel/league/fifa-world-cup/?token=MzA1MTA4XzE3ODE1MTY2MTRfYzY5ODhlMjdjMzMwNDUyODcxZmY4OGQ1NjRlZDE3YzJiMjk5OTRiZg==&pref=%7B%22autoplay%22%3Atrue%7D";

const EMBED_SCRIPT_ID = "scorebat-jssdk";
const EMBED_SCRIPT_SRC = "https://www.scorebat.com/embed/embed.js?v=arrv";
const PANEL_SCRIPT_ID = "scorebat-paneljs";
const PANEL_SCRIPT_SRC = "https://www.scorebat.com/embed/panelx.js?v=f4fksn";

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
    if (document.getElementById(EMBED_SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = EMBED_SCRIPT_ID;
    script.src = EMBED_SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
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

// The embed renders third-party branding chrome we must not show: a header band
// ("FOOTBALL GAMES" + "Embed this widget") pinned to the very top and a promo
// card ("Add the World Cup to your website / Build your widget") pinned to the
// very bottom. The iframe is cross-origin so we cannot edit its DOM; instead we
// clip the top band (negative offset inside an overflow-hidden wrapper) and cover
// the bottom promo with an opaque mask matching the embed background.
const EMBED_HEADER_CLIP = 48;
const EMBED_PROMO_MASK = 132;
const EMBED_BG = "rgb(251,249,249)";

function MaskedEmbed({
  children,
  background = EMBED_BG,
  headerClip = EMBED_HEADER_CLIP,
  promoMask = EMBED_PROMO_MASK,
}: {
  children: ReactNode;
  background?: string;
  headerClip?: number;
  promoMask?: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1rem]" style={{ background }}>
      <div style={{ marginTop: -headerClip }}>{children}</div>
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: promoMask, background }}
        aria-hidden
      />
    </div>
  );
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
        <MaskedEmbed>
          <iframe
            src={embedUrl}
            title={title}
            frameBorder={0}
            allowFullScreen
            allow="autoplay; fullscreen"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className="_scorebatEmbeddedPlayer_ block w-full bg-white"
            style={{ width: "100%", height: 760, border: 0 }}
          />
        </MaskedEmbed>
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
          <MaskedEmbed background="rgb(17,17,17)">
            <iframe
              key="scorebat-highlights-mobile"
              src={videoUrl}
              title={widgetTitle}
              frameBorder={0}
              allowFullScreen
              allow="autoplay; fullscreen"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              className="_scorebatEmbeddedPanel_ block w-full"
              style={{
                display: "block",
                width: "100%",
                height: 800,
                backgroundColor: "rgb(17,17,17)",
                border: 0,
              }}
            />
          </MaskedEmbed>
        ) : showDesktop ? (
          <MaskedEmbed>
            <iframe
              key="scorebat-highlights-desktop"
              src={videoUrl}
              title={widgetTitle}
              frameBorder={0}
              allowFullScreen
              allow="autoplay; fullscreen"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              className="_scorebatEmbeddedPlayer_ block w-full bg-white"
              style={{ width: "100%", height: 760, border: 0 }}
            />
          </MaskedEmbed>
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
