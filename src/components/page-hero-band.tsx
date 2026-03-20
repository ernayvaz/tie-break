import type { ReactNode } from "react";

type PageHeroBandHighlight = {
  label: string;
  value: string;
  icon?: ReactNode;
};

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  highlights?: PageHeroBandHighlight[];
  /** When set, renders below the hero row inside the same premium surface (e.g. long-form page body). */
  children?: ReactNode;
  /**
   * `document` — one tall premium card (rules-style): stronger shadow and vertical gradient so body text
   * is clearly on the same surface as the header, not the page background.
   */
  variant?: "default" | "document";
};

export function PageHeroBand({
  eyebrow,
  title,
  description,
  highlights = [],
  children,
  variant = "default",
}: Props) {
  const isDocument = variant === "document";

  return (
    <section
      className={`relative isolate overflow-hidden px-2 py-1.5 shadow-[0_6px_22px_rgba(46,52,64,0.035)] sm:px-5 sm:py-5 sm:shadow-[0_12px_40px_rgba(46,52,64,0.05)] ${
        isDocument
          ? "rounded-[1.15rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(241,245,252,0.96)_22%,rgba(230,236,246,0.94)_55%,rgba(222,230,243,0.93)_100%)] ring-1 ring-nord-polar/[0.07] sm:rounded-[1.85rem] sm:shadow-[0_32px_90px_rgba(46,52,64,0.11)]"
          : "rounded-[1.15rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(242,244,248,0.94),rgba(232,236,243,0.9))] sm:rounded-[1.8rem] sm:shadow-[0_24px_60px_rgba(46,52,64,0.06)]"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(94,129,172,0.07),transparent_50%),radial-gradient(circle_at_88%_18%,rgba(136,192,208,0.06),transparent_48%),radial-gradient(circle_at_50%_100%,rgba(236,239,244,0.35),transparent_52%)] sm:bg-[radial-gradient(circle_at_12%_8%,rgba(94,129,172,0.11),transparent_42%),radial-gradient(circle_at_88%_18%,rgba(136,192,208,0.1),transparent_38%),radial-gradient(circle_at_50%_100%,rgba(236,239,244,0.55),transparent_45%)]" />
      <div className="relative">
        <div className="flex flex-col gap-1 sm:gap-3 xl:flex-row xl:items-end xl:justify-between xl:gap-6">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex max-w-full items-center rounded-full border border-white/75 bg-white/88 px-1.5 py-px text-[6.5px] font-semibold uppercase tracking-[0.14em] text-nord-frostDark shadow-[0_2px_8px_rgba(46,52,64,0.03)] sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.22em] sm:shadow-[0_6px_18px_rgba(46,52,64,0.04)]">
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
            <div className="grid grid-cols-2 gap-1 sm:gap-2 xl:min-w-[26rem] xl:max-w-[33rem]">
              {highlights.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="rounded border border-white/75 bg-white/88 px-1.5 py-0.5 shadow-[0_3px_10px_rgba(46,52,64,0.025)] sm:rounded-[1rem] sm:bg-white/82 sm:px-3.5 sm:py-2.5 sm:shadow-[0_12px_30px_rgba(46,52,64,0.04)]"
                >
                  <div className="flex items-start gap-1 sm:gap-2">
                    {item.icon ? (
                      <span className="mt-px hidden h-4 w-4 shrink-0 items-center justify-center rounded-full border border-nord-frostDark/10 bg-nord-snow/85 text-[8px] text-nord-frostDark sm:mt-0.5 sm:flex sm:h-6 sm:w-6 sm:text-inherit">
                        {item.icon}
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="text-[6.5px] font-medium uppercase leading-none tracking-[0.08em] text-nord-polarLight max-sm:line-clamp-1 sm:text-[9px] sm:leading-tight sm:tracking-[0.2em] sm:line-clamp-none">
                        {item.label}
                      </div>
                      <div className="mt-0.5 text-[8.5px] font-semibold leading-[1.18] text-nord-polar max-sm:line-clamp-2 sm:mt-1 sm:text-[12.5px] sm:leading-snug sm:line-clamp-none">
                        {item.value}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {children ? (
          <div
            className={`mt-3 border-t pt-3 sm:mt-7 sm:pt-7 ${
              isDocument
                ? "border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
                : "border-white/55"
            }`}
          >
            <div
              className={`space-y-3 pb-3 text-[12px] leading-[1.58] text-nord-polar sm:space-y-5 sm:pb-6 sm:text-[13px] sm:leading-[1.68] ${
                isDocument ? "max-w-3xl" : "max-w-2xl"
              }`}
            >
              {children}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
