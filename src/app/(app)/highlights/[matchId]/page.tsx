import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/get-user";
import { PageHeroBand } from "@/components/page-hero-band";
import { HighlightMediaShell } from "@/components/highlights/highlight-media-shell";
import { OTHER_COMPETITION_ID, UCL_COMPETITION_ID } from "@/lib/config";
import {
  formatHighlightSeason,
  formatHighlightStage,
} from "@/lib/highlights/presentation";

type Props = {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ clip?: string; competition?: string }>;
};

function buildScoreline(homeScore: number | null, awayScore: number | null) {
  if (homeScore != null && awayScore != null) {
    return `${homeScore} - ${awayScore}`;
  }

  return "Replay available";
}

function getCompetitionBucket(
  competitionId: string | null,
  competition?: string
) {
  if (competition === OTHER_COMPETITION_ID) {
    return OTHER_COMPETITION_ID;
  }

  return competitionId != null && competitionId !== UCL_COMPETITION_ID
    ? OTHER_COMPETITION_ID
    : UCL_COMPETITION_ID;
}

function normalizeCompetitionLabel(
  competitionLabel: string,
  competitionId: string | null
) {
  if (
    competitionId === UCL_COMPETITION_ID ||
    competitionLabel.toLowerCase().includes("champions league")
  ) {
    return "Champions League";
  }

  const beforeStage = competitionLabel.split(",")[0] ?? competitionLabel;
  const afterRegion = beforeStage.includes(":")
    ? beforeStage.split(":").slice(1).join(":").trim()
    : beforeStage.trim();

  return afterRegion || "Other competition";
}

function buildClipHref(
  matchId: string,
  clipId: string,
  competitionBucket: string
) {
  return `/highlights/${matchId}?competition=${competitionBucket}&clip=${clipId}`;
}

export default async function HighlightDetailPage({
  params,
  searchParams,
}: Props) {
  await requireAuth();

  const { matchId } = await params;
  const { clip: clipId, competition } = await searchParams;

  const highlight = await prisma.matchHighlight.findUnique({
    where: { matchId },
    include: {
      clips: {
        orderBy: { sortOrder: "asc" },
      },
      match: {
        select: {
          matchDatetime: true,
          homeScore: true,
          awayScore: true,
        },
      },
    },
  });

  if (!highlight) {
    notFound();
  }

  const homeScore = highlight.homeScore ?? highlight.match.homeScore ?? null;
  const awayScore = highlight.awayScore ?? highlight.match.awayScore ?? null;
  const scoreline = buildScoreline(homeScore, awayScore);
  const competitionBucket = getCompetitionBucket(highlight.competitionId, competition);
  const competitionLabel = normalizeCompetitionLabel(
    highlight.competitionLabel,
    highlight.competitionId
  );
  const experience =
    competitionBucket === UCL_COMPETITION_ID
      ? {
          eyebrow: "European Nights",
          backLabel: "Back to Champions League highlights",
          backHref: `/highlights?competition=${UCL_COMPETITION_ID}`,
          description:
            "A focused screening room for a single Champions League recap, with the player, fixture note and archive details kept on one premium surface.",
        }
      : {
          eyebrow: "Open Archive",
          backLabel: "Back to Other competitions",
          backHref: `/highlights?competition=${OTHER_COMPETITION_ID}`,
          description:
            "A focused screening room for a non-Champions-League replay, kept inside the wider archive lane so every future tournament can feel editorial rather than generic.",
        };
  const activeClipId =
    highlight.clips.find((clip) => clip.id === clipId)?.id ??
    highlight.clips.find((clip) => clip.embedUrl)?.id ??
    highlight.clips[0]?.id ??
    null;
  const clips = highlight.clips.map((clip) => ({
    id: clip.id,
    title: clip.title,
    href: buildClipHref(highlight.matchId, clip.id, competitionBucket),
    isActive: clip.id === activeClipId,
    embedUrl: clip.embedUrl,
    pageUrl: clip.pageUrl ?? highlight.matchviewUrl ?? null,
  }));
  const kickoffLabel = highlight.match.matchDatetime.toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const publishedLabel = highlight.publishedAt.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-3 sm:space-y-6">
      <div>
        <Link
          href={experience.backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-nord-frostDark hover:text-nord-polar"
        >
          <span aria-hidden>←</span>
          {experience.backLabel}
        </Link>
      </div>

      <PageHeroBand
        eyebrow={experience.eyebrow}
        title={highlight.title}
        description={experience.description}
        highlights={[
          {
            label: "Fixture",
            value: `${highlight.homeTeamName} vs ${highlight.awayTeamName}`,
          },
          {
            label: "Published",
            value: publishedLabel,
          },
          {
            label: "Clips",
            value: `${highlight.clips.length} stored option${highlight.clips.length === 1 ? "" : "s"}`,
          },
        ]}
        footerNote={
          <>
            <strong>{competitionLabel}</strong> edition.{" "}
            <strong>{formatHighlightStage(highlight.stage)}</strong> screening from the{" "}
            <strong>{formatHighlightSeason(highlight.season)}</strong> campaign. Kickoff:{" "}
            <strong>{kickoffLabel}</strong>.
          </>
        }
      />

      <HighlightMediaShell
        title={highlight.title}
        scoreline={scoreline}
        stageLabel={formatHighlightStage(highlight.stage)}
        programNote={highlight.programNote}
        thumbnailUrl={highlight.thumbnailUrl}
        status={highlight.syncStatus}
        clips={clips}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <section className="rounded-[1.5rem] border border-white/70 bg-white/80 px-5 py-5 shadow-[0_22px_65px_rgba(46,52,64,0.06)]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-nord-frostDark">
            Program note
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-nord-polar">
            Match edition overview
          </h2>
          <p className="mt-4 text-sm leading-7 text-nord-polarLight">
            {highlight.programNote ??
              `${highlight.homeTeamName} and ${highlight.awayTeamName} are presented here as a stored ${competitionLabel} screening. Use the clip rail above to switch between stored replay options.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-nord-polarLight">
            <span className="rounded-full border border-nord-polarLighter/30 bg-nord-snow/70 px-3 py-1.5">
              Competition: {competitionLabel}
            </span>
            <span className="rounded-full border border-nord-polarLighter/30 bg-nord-snow/70 px-3 py-1.5">
              Stage: {formatHighlightStage(highlight.stage)}
            </span>
            <span className="rounded-full border border-nord-polarLighter/30 bg-nord-snow/70 px-3 py-1.5">
              Season: {formatHighlightSeason(highlight.season)}
            </span>
            <span className="rounded-full border border-nord-polarLighter/30 bg-nord-snow/70 px-3 py-1.5">
              Score: {scoreline}
            </span>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-white/70 bg-white/80 px-5 py-5 shadow-[0_22px_65px_rgba(46,52,64,0.06)]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-nord-frostDark">
            Fixture sheet
          </div>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-nord-polarLight">Home</dt>
              <dd className="mt-1 font-medium text-nord-polar">
                {highlight.homeTeamName}
              </dd>
            </div>
            <div>
              <dt className="text-nord-polarLight">Away</dt>
              <dd className="mt-1 font-medium text-nord-polar">
                {highlight.awayTeamName}
              </dd>
            </div>
            <div>
              <dt className="text-nord-polarLight">Kickoff</dt>
              <dd className="mt-1 font-medium text-nord-polar">{kickoffLabel}</dd>
            </div>
            <div>
              <dt className="text-nord-polarLight">Stored recap</dt>
              <dd className="mt-1 font-medium text-nord-polar">
                {publishedLabel}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
