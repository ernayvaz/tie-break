import Link from "next/link";
import { Button } from "@/components/ui";
import type { HighlightCardModel } from "./types";

export function FeaturedHighlightCard({
  highlight,
}: {
  highlight: HighlightCardModel;
}) {
  return (
    <article className="overflow-hidden rounded-[1.8rem] border border-white/70 bg-[linear-gradient(135deg,rgba(46,52,64,0.98),rgba(59,66,82,0.94),rgba(76,86,106,0.9))] text-white shadow-[0_32px_90px_rgba(46,52,64,0.18)]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.55fr)_minmax(14rem,0.42fr)]">
        <div className="relative min-h-[18rem] overflow-hidden">
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
          <div className="relative flex h-full flex-col justify-between px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/72">
              <span className="rounded-full border border-white/12 bg-white/8 px-2.5 py-1">
                Featured premiere
              </span>
              <span>{highlight.competitionLabel}</span>
              <span aria-hidden>•</span>
              <span>{highlight.stageLabel}</span>
              <span aria-hidden>•</span>
              <span>{highlight.seasonLabel}</span>
            </div>
            <div>
              <div className="flex items-center gap-3 text-sm text-white/85">
                <TeamBadge logo={highlight.homeTeamLogo} name={highlight.homeTeamName} />
                <span className="text-white/55">vs</span>
                <TeamBadge logo={highlight.awayTeamLogo} name={highlight.awayTeamName} />
              </div>
              <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                {highlight.title}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/78">
                {highlight.programNote ?? "A curated Champions League screening room."}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between bg-white/10 px-4 py-4 backdrop-blur-sm sm:px-5 sm:py-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/62">
              Match edition
            </div>
            <div className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {highlight.scoreline}
            </div>
            <p className="mt-2 text-sm text-white/72">
              Published {highlight.publishedLabel} • {highlight.clipCount} clip
              {highlight.clipCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 sm:mt-auto">
            <Button asChild>
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
    <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5">
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
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/12 text-[11px] text-white/70">
          ?
        </span>
      )}
      <span className="truncate text-sm font-medium text-white">{name}</span>
    </span>
  );
}
