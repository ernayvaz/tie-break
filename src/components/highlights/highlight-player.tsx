"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * On-site YouTube highlight player.
 *
 * Uses the YouTube IFrame Player API so we can react to the owner's embed block
 * (error 101/150 — e.g. FIFA Content-ID) which the Data API cannot reveal ahead of
 * time. When a video is blocked we transparently advance to the next stored
 * candidate; if every candidate is blocked we show a graceful "Watch on YouTube"
 * fallback instead of YouTube's raw grey error.
 */

type Candidate = {
  videoId: string;
  title: string;
  watchUrl: string;
};

type Props = {
  candidates: Candidate[];
  thumbnailUrl: string | null;
  title: string;
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise<void>((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });
  }
  return apiPromise;
}

export function HighlightPlayer({ candidates, thumbnailUrl, title }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [index, setIndex] = useState(0);
  const [blocked, setBlocked] = useState(false);

  const candidatesKey = useMemo(
    () => candidates.map((c) => c.videoId).join(","),
    [candidates]
  );

  // Reset the chain whenever the candidate set changes (e.g. navigating matches).
  useEffect(() => {
    setIndex(0);
    setBlocked(candidates.length === 0);
  }, [candidatesKey, candidates.length]);

  useEffect(() => {
    if (blocked) return;
    const current = candidates[index];
    if (!current) {
      setBlocked(true);
      return;
    }

    let cancelled = false;

    loadYouTubeIframeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT?.Player) return;
      hostRef.current.innerHTML = "";
      const mountEl = document.createElement("div");
      mountEl.className = "h-full w-full";
      hostRef.current.appendChild(mountEl);

      playerRef.current = new window.YT.Player(mountEl, {
        videoId: current.videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onError: () => {
            // 101/150 = embedding disabled by owner, 100 = removed/private, 2/5 = other.
            // Try the next stored candidate; fall back only when all are exhausted.
            if (index < candidates.length - 1) {
              setIndex((prev) => prev + 1);
            } else {
              setBlocked(true);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* no-op */
      }
      playerRef.current = null;
    };
  }, [index, blocked, candidatesKey, candidates]);

  if (blocked) {
    const watchUrl = candidates[0]?.watchUrl ?? null;
    return (
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black">
        {thumbnailUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnail */}
            <img
              src={thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(46,52,64,0.5),rgba(46,52,64,0.9))]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(136,192,208,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(94,129,172,0.24),transparent_40%),linear-gradient(180deg,rgba(46,52,64,0.98),rgba(46,52,64,1))]" />
        )}
        <div className="relative mx-auto max-w-lg px-6 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/58">
            Official highlights
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Playback is restricted on external sites
          </h3>
          <p className="mt-3 text-sm leading-6 text-white/72">
            The rights holder has disabled embedding for this recap, so it can only be
            watched on YouTube.
          </p>
          {watchUrl ? (
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#ff0000] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e60000]"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="currentColor">
                <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
              </svg>
              Watch on YouTube
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full bg-black">
      <div ref={hostRef} className="h-full w-full" aria-label={title} />
    </div>
  );
}
