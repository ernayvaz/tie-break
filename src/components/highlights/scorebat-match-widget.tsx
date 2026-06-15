"use client";

import { useEffect, useRef } from "react";

/**
 * Embeds the official ScoreBat World Cup widget (league panel). Inside the widget a
 * user can open any fixture to see the full match view — AI prediction, live
 * standings, last matches, previous meetings and head-to-head — exactly as on
 * scorebat.com. The token in the URL is a public embed token (ScoreBat's own embed
 * code is a plain client-side iframe), so it is safe to ship to the browser.
 *
 * We load ScoreBat's embed.js once so the iframe auto-resizes via postMessage.
 */

const FALLBACK_EMBED_URL =
  "https://www.scorebat.com/embed/league/fifa-world-cup/?token=MzA1MTA4XzE3ODE1MTY2MTRfYzY5ODhlMjdjMzMwNDUyODcxZmY4OGQ1NjRlZDE3YzJiMjk5OTRiZg==&pref=%7B%22nomaxwidth%22%3Atrue%7D";

const EMBED_SCRIPT_ID = "scorebat-jssdk";
const EMBED_SCRIPT_SRC = "https://www.scorebat.com/embed/embed.js?v=arrv";

function getWorldCupEmbedUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SCOREBAT_WC_EMBED_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : FALLBACK_EMBED_URL;
}

export function ScoreBatMatchWidget({ title }: { title?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(EMBED_SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = EMBED_SCRIPT_ID;
    script.src = EMBED_SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const embedUrl = getWorldCupEmbedUrl();

  return (
    <section className="overflow-hidden rounded-[1.4rem] border border-nord-polarLighter/12 bg-white/90 shadow-[0_18px_50px_rgba(46,52,64,0.07)]">
      <div className="flex items-center justify-between gap-3 border-b border-nord-polarLighter/12 px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-nord-frostDark">
            Live match data
          </div>
          <h4 className="mt-1 text-sm font-semibold text-nord-polar">
            {title ?? "World Cup Match Center"}
          </h4>
        </div>
        <span className="hidden rounded-full border border-nord-frostDark/12 bg-white/72 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nord-frostDark sm:inline-flex">
          AI · Standings · H2H
        </span>
      </div>
      <p className="px-4 pt-3 text-xs leading-5 text-nord-polarLight">
        Open any fixture inside the panel below to see its AI prediction, live
        standings, recent form, previous meetings and full team data.
      </p>
      <div ref={containerRef} className="px-2 pb-3 pt-2 sm:px-3">
        <iframe
          src={embedUrl}
          title={title ?? "World Cup Match Center"}
          frameBorder={0}
          allowFullScreen
          allow="autoplay; fullscreen"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          className="_scorebatEmbeddedPlayer_ block w-full rounded-[1rem] bg-white"
          style={{ width: "100%", height: 760, border: 0 }}
        />
      </div>
    </section>
  );
}
