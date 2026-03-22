import Link from "next/link";
import { describeHighlightStatus } from "@/lib/highlights/presentation";
import type { HighlightStatus } from "./types";

export function ProviderAttribution({
  status,
  href,
  compact = false,
}: {
  status: HighlightStatus;
  href: string | null;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-nord-polarLight ${
        compact ? "text-[10px]" : "text-xs"
      }`}
    >
      <span className="uppercase tracking-[0.16em]">Source: ScoreBat</span>
      <span aria-hidden>•</span>
      <span>{describeHighlightStatus(status)}</span>
      {href ? (
        <>
          <span aria-hidden>•</span>
          <Link
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-nord-frostDark transition-colors hover:text-nord-polar"
          >
            Provider page
          </Link>
        </>
      ) : null}
    </div>
  );
}
