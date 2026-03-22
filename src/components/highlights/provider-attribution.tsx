import { describeHighlightStatus } from "@/lib/highlights/presentation";
import type { HighlightStatus } from "./types";

export function ProviderAttribution({
  status,
  compact = false,
}: {
  status: HighlightStatus;
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
    </div>
  );
}
