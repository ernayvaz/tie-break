import Link from "next/link";
import { Button } from "@/components/ui";
import type { HighlightCardModel } from "./types";

export function FeaturedHighlightCard({
  highlight,
}: {
  highlight: HighlightCardModel;
}) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-[linear-gradient(135deg,rgba(46,52,64,0.98),rgba(59,66,82,0.94),rgba(76,86,106,0.9))] text-white shadow-[0_24px_72px_rgba(46,52,64,0.16)] sm:rounded-[1.8rem]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.68fr)_minmax(12.75rem,0.34fr)]">
        <div className="relative min-h-[12.75rem] overflow-hidden sm:min-h-[13.75rem] lg:min-h-[14.75rem]">
          {highlight.thumbnailUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- ScoreBat thumbnails are external */}
              <img
                src={highlight.thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full scale-[1.03] object-cover object-center lg:object-[58%_35%]"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(143,188,187,0.12),transparent_28%),linear-gradient(90deg,rgba(17,24,39,0.84)_0%,rgba(17,24,39,0.62)_30%,rgba(17,24,39,0.24)_62%,rgba(17,24,39,0.22)_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,24,39,0.2)_0%,rgba(17,24,39,0.06)_32%,rgba(17,24,39,0.52)_100%)]" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(136,192,208,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(94,129,172,0.34),transparent_42%),linear-gradient(135deg,rgba(46,52,64,0.98),rgba(67,76,94,0.92))]" />
          )}
          <div className="relative flex h-full flex-col justify-between px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-white/72 sm:gap-2 sm:text-[10px] sm:tracking-[0.18em]">
              <span className="rounded-full border border-white/12 bg-white/8 px-2 py-0.5 sm:px-2.5 sm:py-1">
                Featured premiere
              </span>
              <span>{highlight.competitionLabel}</span>
              <span aria-hidden>•</span>
              <span>{highlight.stageLabel}</span>
              <span aria-hidden>•</span>
              <span>{highlight.seasonLabel}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 text-[12px] text-white/85 sm:gap-3 sm:text-sm">
                <TeamBadge logo={highlight.homeTeamLogo} name={highlight.homeTeamName} />
                <span className="text-white/55">vs</span>
                <TeamBadge logo={highlight.awayTeamLogo} name={highlight.awayTeamName} />
              </div>
              <h2 className="mt-3 max-w-xl text-[1.18rem] font-semibold leading-[1.06] tracking-tight text-white sm:text-[1.6rem] lg:text-[1.82rem]">
                {highlight.title}
              </h2>
              <p className="mt-2 max-w-lg text-[12px] leading-[1.45] text-white/78 sm:text-sm sm:leading-5">
                {highlight.programNote ?? "A curated Champions League screening room."}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 bg-white/10 px-4 py-3.5 backdrop-blur-sm sm:px-5 sm:py-4 lg:flex-col lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 lg:flex-none">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/62 sm:text-[11px] sm:tracking-[0.18em]">
              Match edition
            </div>
            <div className="mt-2 text-[2rem] font-semibold leading-none tracking-tight text-white sm:text-[2.3rem] lg:text-[2.75rem]">
              {highlight.scoreline}
            </div>
            <p className="mt-1.5 text-[12px] leading-[1.35] text-white/72 sm:text-sm">
              Published {highlight.publishedLabel} • {highlight.clipCount} clip
              {highlight.clipCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 lg:mt-auto">
            <Button asChild size="sm" className="min-w-[9.75rem] justify-center">
              <Link href={highlight.href}>Enter screening room</Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function TeamBadge({
  logo,
  name,
}: {
  logo: string | null;
  name: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
      {logo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- team logos are external */}
          <img
            src={logo}
            alt=""
            className="h-5 w-5 shrink-0 rounded-full bg-white object-contain sm:h-6 sm:w-6"
          />
        </>
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 text-[10px] text-white/70 sm:h-6 sm:w-6 sm:text-[11px]">
          ?
        </span>
      )}
      <span className="truncate text-xs font-medium text-white sm:text-sm">{name}</span>
    </span>
  );
}
