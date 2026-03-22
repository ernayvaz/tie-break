import Link from "next/link";
import { ProviderAttribution } from "./provider-attribution";
import type { HighlightClipModel, HighlightStatus } from "./types";

export function HighlightMediaShell({
  title,
  scoreline,
  stageLabel,
  programNote,
  thumbnailUrl,
  status,
  clips,
}: {
  title: string;
  scoreline: string;
  stageLabel: string;
  programNote: string | null;
  thumbnailUrl: string | null;
  status: HighlightStatus;
  clips: HighlightClipModel[];
}) {
  const activeClip = clips.find((clip) => clip.isActive) ?? clips[0] ?? null;

  return (
    <section className="overflow-hidden rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(46,52,64,0.99),rgba(59,66,82,0.97),rgba(67,76,94,0.96))] text-white shadow-[0_34px_95px_rgba(46,52,64,0.2)]">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="border-b border-white/8 xl:border-b-0 xl:border-r xl:border-r-white/8">
          <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/56">
                {stageLabel}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {title}
              </h2>
            </div>
            <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/88">
              {scoreline}
            </div>
          </div>
          {activeClip?.embedUrl ? (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={activeClip.embedUrl}
                title={activeClip.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-full w-full border-0"
              />
            </div>
          ) : (
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black">
              {thumbnailUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- ScoreBat thumbnails are external */}
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-35"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(46,52,64,0.48),rgba(46,52,64,0.88))]" />
                </>
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(136,192,208,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(94,129,172,0.24),transparent_40%),linear-gradient(180deg,rgba(46,52,64,0.98),rgba(46,52,64,1))]" />
              )}
              <div className="relative mx-auto max-w-lg px-6 text-center">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/58">
                  Screening room fallback
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  Provider embed unavailable
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  {programNote ??
                    "The stored recap is not playable in the screening room right now, but the match edition remains archived."}
                </p>
              </div>
            </div>
          )}
          <div className="space-y-4 px-5 py-4 sm:px-6">
            <p className="text-sm leading-6 text-white/72">
              {programNote ?? "A premium Champions League screening room replay."}
            </p>
            <ProviderAttribution status={status} />
          </div>
        </div>
        <aside className="space-y-3 px-5 py-4 sm:px-6 xl:px-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/54">
            Clips
          </div>
          {clips.length > 0 ? (
            <div className="space-y-2">
              {clips.map((clip, index) => (
                <Link
                  key={clip.id}
                  href={clip.href}
                  className={`block rounded-[1.1rem] border px-4 py-3 transition-colors ${
                    clip.isActive
                      ? "border-white/18 bg-white/10"
                      : "border-white/8 bg-white/4 hover:bg-white/7"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/50">
                    Clip {index + 1}
                  </div>
                  <div className="mt-2 text-sm font-medium text-white">
                    {clip.title}
                  </div>
                  <div className="mt-2 text-xs text-white/58">
                    {clip.embedUrl
                      ? "Play inside European Nights"
                      : "Stored replay unavailable"}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.1rem] border border-white/8 bg-white/4 px-4 py-4 text-sm text-white/66">
              No playable clips were stored for this match yet.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
