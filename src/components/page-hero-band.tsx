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
      className={`relative isolate overflow-hidden px-4 py-4 sm:px-5 sm:py-5 ${
        isDocument
          ? "rounded-[1.85rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(241,245,252,0.96)_22%,rgba(230,236,246,0.94)_55%,rgba(222,230,243,0.93)_100%)] shadow-[0_32px_90px_rgba(46,52,64,0.11)] ring-1 ring-nord-polar/[0.07]"
          : "rounded-[1.8rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(242,244,248,0.94),rgba(232,236,243,0.9))] shadow-[0_24px_60px_rgba(46,52,64,0.06)]"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(94,129,172,0.11),transparent_42%),radial-gradient(circle_at_88%_18%,rgba(136,192,208,0.1),transparent_38%),radial-gradient(circle_at_50%_100%,rgba(236,239,244,0.55),transparent_45%)]" />
      <div className="relative">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full border border-white/75 bg-white/84 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-nord-frostDark shadow-[0_6px_18px_rgba(46,52,64,0.04)]">
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
            <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[26rem] xl:max-w-[33rem]">
              {highlights.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="rounded-[1rem] border border-white/75 bg-white/82 px-3.5 py-2.5 shadow-[0_12px_30px_rgba(46,52,64,0.04)]"
                >
                  <div className="flex items-start gap-2">
                    {item.icon ? (
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-nord-frostDark/10 bg-nord-snow/85 text-nord-frostDark">
                        {item.icon}
                      </span>
                    ) : null}
                    <div className="min-w-0">
                      <div className="text-[9px] uppercase tracking-[0.2em] text-nord-polarLight">
                        {item.label}
                      </div>
                      <div className="mt-1 text-[12.5px] font-semibold leading-4.5 text-nord-polar">
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
            className={`mt-6 border-t pt-6 sm:mt-7 sm:pt-7 ${
              isDocument
                ? "border-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
                : "border-white/55"
            }`}
          >
            <div
              className={`space-y-5 pb-5 text-[13px] leading-[1.68] text-nord-polar sm:pb-6 ${
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
