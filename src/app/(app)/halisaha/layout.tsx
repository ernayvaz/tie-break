import type { ReactNode } from "react";

export default function HalisahaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="halisaha-page-shell relative -mb-2 max-w-none overflow-x-hidden overflow-y-visible bg-[#171717] sm:-mb-6 pt-[max(0.35rem,env(safe-area-inset-top))]"
      style={{
        animation: "halisaha-page-reveal 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        transformOrigin: "top center",
        minHeight:
          "calc(var(--halisaha-page-viewport-height, 100dvh) - var(--app-header-height, 4rem) - var(--halisaha-mobile-fit-offset, 0px))",
        width: "100dvw",
        marginLeft: "calc(50% - 50dvw)",
        marginRight: "calc(50% - 50dvw)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(35,35,35,0.985)_0%,rgba(24,24,24,0.992)_42%,rgba(17,17,17,1)_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, transparent 1px, transparent 19px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 23px)",
        }}
      />
      <div className="halisaha-page-inner relative mx-auto max-w-7xl px-2.5 pb-2 pt-1 sm:px-4 sm:pb-3 sm:pt-1.5">
        {children}
      </div>
    </div>
  );
}
