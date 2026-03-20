import type { ReactNode } from "react";

/**
 * Single full-page premium surface for Rules & prizes.
 * Background uses inline styles so it cannot be affected by Tailwind purge / stale bundles;
 * all body copy stays visually inside the same card as the header.
 */
export function RulesPremiumDocument({
  eyebrow,
  title,
  description,
  highlights,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  highlights: { label: string; value: string }[];
  children: ReactNode;
}) {
  return (
    <article
      data-rules-premium-document
      className="relative isolate w-full max-w-4xl overflow-hidden rounded-[1.1rem] px-2 py-1.5 shadow-[0_6px_22px_rgba(46,52,64,0.06)] ring-1 ring-slate-400/20 sm:rounded-[1.85rem] sm:px-6 sm:py-6 sm:shadow-[0_32px_90px_rgba(46,52,64,0.14)]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, #ffffff 0%, #f4f7fc 28%, #e8edf6 58%, #dde6f2 100%)",
        border: "1px solid rgba(255,255,255,0.95)",
      }}
    >
      {/* Decorative overlays (same family as PageHeroBand, non-essential for layout) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 8%, rgba(94,129,172,0.12) 0%, transparent 42%), radial-gradient(circle at 88% 12%, rgba(136,192,208,0.11) 0%, transparent 38%)",
        }}
        aria-hidden
      />

      <div className="relative">
        <div className="flex flex-col gap-1 sm:gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex max-w-full items-center rounded-full border border-white/80 bg-white/90 px-1.5 py-px text-[6.5px] font-semibold uppercase tracking-[0.14em] text-[#5e81ac] shadow-sm sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.22em]">
              {eyebrow}
            </div>
            <h1 className="mt-0.5 text-[0.97rem] font-semibold leading-[1.12] tracking-tight text-nord-polar sm:mt-2 sm:text-[1.45rem] sm:leading-snug md:text-[1.62rem]">
              {title}
            </h1>
            <p className="mt-0.5 max-w-xl text-[9.5px] leading-[1.25] text-nord-polarLight max-sm:line-clamp-2 sm:mt-1 sm:text-[13px] sm:leading-5 sm:line-clamp-none">
              {description}
            </p>
          </div>

          {highlights.length > 0 ? (
            <div className="grid w-full grid-cols-2 gap-1 sm:gap-2 xl:min-w-[24rem] xl:max-w-[33rem]">
              {highlights.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="rounded border border-white/80 bg-white/90 px-1.5 py-0.5 shadow-[0_3px_10px_rgba(46,52,64,0.035)] sm:rounded-[1rem] sm:px-3.5 sm:py-2.5 sm:shadow-[0_12px_30px_rgba(46,52,64,0.06)]"
                >
                  <div className="text-[6.5px] font-semibold uppercase leading-none tracking-[0.08em] text-nord-polarLight max-sm:line-clamp-1 sm:text-[9px] sm:leading-tight sm:tracking-[0.2em] sm:line-clamp-none">
                    {item.label}
                  </div>
                  <div className="mt-0.5 text-[8.5px] font-semibold leading-[1.18] text-nord-polar max-sm:line-clamp-2 sm:mt-1 sm:text-[12.5px] sm:leading-snug sm:line-clamp-none">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className="mt-2 border-t border-slate-300/35 pt-2 sm:mt-7 sm:pt-7"
          style={{
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >
          <div className="max-w-3xl space-y-3 pb-0 text-[12px] leading-[1.58] text-nord-polar sm:space-y-5 sm:pb-1 sm:text-[13px] sm:leading-[1.68]">
            {children}
          </div>
        </div>
      </div>
    </article>
  );
}
