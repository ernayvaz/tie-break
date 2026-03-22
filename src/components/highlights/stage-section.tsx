import { MatchEditionCard } from "./match-edition-card";
import type { HighlightCardModel } from "./types";

export function StageSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: HighlightCardModel[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex rounded-full border border-nord-frostDark/12 bg-white/75 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-nord-frostDark">
            Stage room
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-nord-polar">
            {title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-nord-polarLight">
          {description}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <MatchEditionCard key={item.matchId} highlight={item} />
        ))}
      </div>
    </section>
  );
}
