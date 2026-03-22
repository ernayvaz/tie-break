import Link from "next/link";
import { ProviderAttribution } from "./provider-attribution";
import type { HighlightCardModel } from "./types";

export function MatchEditionCard({
  highlight,
}: {
  highlight: HighlightCardModel;
}) {
  return (
    <article className="group overflow-hidden rounded-[1.45rem] border border-white/65 bg-white/82 shadow-[0_22px_65px_rgba(46,52,64,0.07)] transition-transform hover:-translate-y-0.5">
      <Link href={highlight.href} className="block">
        <div className="relative h-44 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(136,192,208,0.18),transparent_28%),linear-gradient(135deg,rgba(236,239,244,0.96),rgba(229,233,240,0.9),rgba(216,222,233,0.92))]">
          {highlight.thumbnailUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- ScoreBat thumbnails are external */}
              <img
                src={highlight.thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(46,52,64,0.08),rgba(46,52,64,0.5))]" />
            </>
          ) : null}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-4">
            <span className="rounded-full border border-white/65 bg-white/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-nord-frostDark backdrop-blur-sm">
              {highlight.stageLabel}
            </span>
            <span className="rounded-full border border-white/15 bg-nord-polar/75 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white">
              {highlight.scoreline}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-white/12 bg-[linear-gradient(180deg,rgba(46,52,64,0),rgba(46,52,64,0.76))] px-4 py-3 text-white">
            <TeamLogoPill logo={highlight.homeTeamLogo} name={highlight.homeTeamName} />
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">vs</span>
            <TeamLogoPill logo={highlight.awayTeamLogo} name={highlight.awayTeamName} align="right" />
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-nord-polarLight">
              {highlight.seasonLabel} • {highlight.publishedLabel}
            </div>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-nord-polar">
              {highlight.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-nord-polarLight line-clamp-2">
              {highlight.programNote ?? "Champions League screening room replay."}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <ProviderAttribution status={highlight.status} compact />
            <span className="shrink-0 text-sm font-medium text-nord-frostDark">
              Open
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function TeamLogoPill({
  logo,
  name,
  align = "left",
}: {
  logo: string | null;
  name: string;
  align?: "left" | "right";
}) {
  return (
    <span
      className={`inline-flex min-w-0 max-w-[42%] items-center gap-2 rounded-full border border-white/12 bg-white/12 px-2.5 py-1.5 backdrop-blur-sm ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {logo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- team logos are external */}
          <img
            src={logo}
            alt=""
            className="h-6 w-6 shrink-0 rounded-full bg-white object-contain"
          />
        </>
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/14 text-[11px] text-white/70">
          ?
        </span>
      )}
      <span className="truncate text-xs font-medium text-white">{name}</span>
    </span>
  );
}
