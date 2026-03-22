export function HighlightsEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[1.5rem] border border-dashed border-nord-polarLighter/40 bg-white/70 px-5 py-10 text-center shadow-[0_18px_55px_rgba(46,52,64,0.05)]">
      <div className="mx-auto max-w-xl">
        <span className="inline-flex rounded-full border border-nord-frostDark/15 bg-nord-snow/75 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-nord-frostDark">
          European Nights
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-nord-polar">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-nord-polarLight">
          {description}
        </p>
      </div>
    </section>
  );
}
