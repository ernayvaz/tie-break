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
      className="relative isolate w-full max-w-4xl overflow-hidden rounded-[1.85rem] px-4 py-5 shadow-[0_32px_90px_rgba(46,52,64,0.14)] ring-1 ring-slate-400/20 sm:px-6 sm:py-6"
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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex items-center rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#5e81ac] shadow-sm">
              {eyebrow}
            </div>
            <h1 className="mt-2 text-[1.45rem] font-semibold tracking-tight text-nord-polar sm:text-[1.62rem]">
              {title}
            </h1>
            <p className="mt-1 max-w-xl text-[13px] leading-5 text-nord-polarLight">
              {description}
            </p>
          </div>

          {highlights.length > 0 ? (
            <div className="grid w-full gap-2 sm:grid-cols-2 xl:min-w-[24rem] xl:max-w-[33rem]">
              {highlights.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="rounded-[1rem] border border-white/80 bg-white/88 px-3.5 py-2.5 shadow-[0_12px_30px_rgba(46,52,64,0.06)]"
                >
                  <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-nord-polarLight">
                    {item.label}
                  </div>
                  <div className="mt-1 text-[12.5px] font-semibold leading-snug text-nord-polar">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className="mt-6 border-t border-slate-300/35 pt-6 sm:mt-7 sm:pt-7"
          style={{
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >
          <div className="max-w-3xl space-y-5 pb-1 text-[13px] leading-[1.68] text-nord-polar">
            {children}
          </div>
        </div>
      </div>
    </article>
  );
}
