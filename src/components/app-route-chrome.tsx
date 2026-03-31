"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useLayoutEffect } from "react";

function isHalisahaAppRoute(pathname: string | null) {
  return pathname === "/halisaha" || pathname?.startsWith("/halisaha/");
}

type Props = {
  header: ReactNode;
  children: ReactNode;
};

/**
 * Hides the global app chrome on Halisaha Mode and aligns the page shell background
 * with the Halisaha hero treatment. Keeps `--app-header-height` in sync when the header unmounts.
 */
export function AppRouteChrome({ header, children }: Props) {
  const pathname = usePathname();
  const halisaha = isHalisahaAppRoute(pathname);

  useLayoutEffect(() => {
    const { body, documentElement } = document;
    const visualViewport = window.visualViewport;
    let frameId = 0;
    let settleTimeoutIds: number[] = [];
    const syncHalisahaViewportHeight = () => {
      const viewportHeight = Math.round(visualViewport?.height ?? window.innerHeight);
      documentElement.style.setProperty("--halisaha-page-viewport-height", `${viewportHeight}px`);
    };
    const clearSettlingTimers = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
      settleTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      settleTimeoutIds = [];
    };
    const scheduleViewportSync = () => {
      clearSettlingTimers();
      syncHalisahaViewportHeight();
      frameId = window.requestAnimationFrame(() => {
        syncHalisahaViewportHeight();
      });
      settleTimeoutIds = [120, 320, 760].map((delay) =>
        window.setTimeout(() => {
          syncHalisahaViewportHeight();
        }, delay),
      );
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        scheduleViewportSync();
      }
    };

    if (halisaha) {
      documentElement.style.setProperty("--app-header-height", "0px");
      documentElement.classList.add("halisaha-app-route");
      body.classList.add("halisaha-app-route");
      scheduleViewportSync();
      window.addEventListener("resize", scheduleViewportSync);
      window.addEventListener("orientationchange", scheduleViewportSync);
      window.addEventListener("load", scheduleViewportSync);
      window.addEventListener("pageshow", scheduleViewportSync);
      visualViewport?.addEventListener("resize", scheduleViewportSync);
      visualViewport?.addEventListener("scroll", scheduleViewportSync);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    } else {
      documentElement.style.removeProperty("--app-header-height");
      documentElement.style.removeProperty("--halisaha-page-viewport-height");
      documentElement.classList.remove("halisaha-app-route");
      body.classList.remove("halisaha-app-route");
    }

    return () => {
      clearSettlingTimers();
      window.removeEventListener("resize", scheduleViewportSync);
      window.removeEventListener("orientationchange", scheduleViewportSync);
      window.removeEventListener("load", scheduleViewportSync);
      window.removeEventListener("pageshow", scheduleViewportSync);
      visualViewport?.removeEventListener("resize", scheduleViewportSync);
      visualViewport?.removeEventListener("scroll", scheduleViewportSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      documentElement.style.removeProperty("--halisaha-page-viewport-height");
      documentElement.classList.remove("halisaha-app-route");
      body.classList.remove("halisaha-app-route");
    };
  }, [halisaha]);

  return (
    <div
      className={
        halisaha
          ? "flex min-h-[var(--halisaha-page-viewport-height,100dvh)] flex-col bg-[#171717]"
          : "min-h-screen bg-[var(--background)]"
      }
    >
      {halisaha ? null : header}
      <main
        className={
          halisaha
            ? "app-shell-main flex min-h-0 flex-1 max-w-none bg-transparent px-0 py-0 sm:px-0 sm:py-0"
            : "app-shell-main mx-auto max-w-7xl px-2.5 py-2 sm:px-4 sm:py-6"
        }
      >
        {children}
      </main>
    </div>
  );
}
