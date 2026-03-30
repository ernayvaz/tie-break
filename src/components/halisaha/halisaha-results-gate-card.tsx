"use client";

import Link from "next/link";

export function HalisahaResultsGateCard({
  title,
  description,
  href,
  buttonLabel,
  compact = false,
}: {
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-[1.18rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] shadow-[0_18px_44px_rgba(0,0,0,0.2)] ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-white/42">
        MVP vote required
      </div>
      <h3 className={`mt-2 font-semibold text-white ${compact ? "text-[1rem]" : "text-[1.12rem]"}`}>
        {title}
      </h3>
      <p className={`mt-2 leading-[1.65] text-white/66 ${compact ? "text-[0.78rem]" : "text-sm"}`}>
        {description}
      </p>
      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.08] px-4 py-[0.72rem] text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/[0.12]"
        >
          {buttonLabel}
        </Link>
      </div>
    </div>
  );
}
