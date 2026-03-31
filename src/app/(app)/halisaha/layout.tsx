import Script from "next/script";
import type { ReactNode } from "react";

export default function HalisahaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Script id="halisaha-viewport-bootstrap" strategy="beforeInteractive">{`(() => {
  if (window.__halisahaViewportBootstrap) return;
  window.__halisahaViewportBootstrap = true;
  const root = document.documentElement;
  const sync = () => {
    const viewport = window.visualViewport;
    const height = Math.round(viewport?.height ?? window.innerHeight ?? root.clientHeight ?? 0);
    if (height > 0) {
      root.style.setProperty("--halisaha-page-viewport-height", \`\${height}px\`);
    }
  };
  const schedule = () => {
    sync();
    window.requestAnimationFrame(sync);
    window.setTimeout(sync, 120);
    window.setTimeout(sync, 320);
    window.setTimeout(sync, 760);
  };
  schedule();
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, { passive: true });
  window.addEventListener("pageshow", schedule, { passive: true });
  window.addEventListener("load", schedule, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) schedule();
  });
  window.visualViewport?.addEventListener("resize", schedule, { passive: true });
  window.visualViewport?.addEventListener("scroll", schedule, { passive: true });
})();`}</Script>
      <div
        className="halisaha-page-shell relative flex min-h-0 flex-1 flex-col max-w-none overflow-x-hidden overflow-y-visible bg-[#171717]"
        style={{
          animation: "halisaha-page-reveal 180ms cubic-bezier(0.16, 1, 0.3, 1)",
          transformOrigin: "top center",
          minHeight: "var(--halisaha-page-viewport-height, 100dvh)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(23,23,23,1),rgba(23,23,23,1))]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 19px), repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 23px)",
          }}
        />
        <div className="halisaha-page-inner relative mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-2.5 py-0 sm:px-4 sm:py-0">
          {children}
        </div>
      </div>
    </>
  );
}
