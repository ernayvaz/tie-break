"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect } from "react";

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

  useEffect(() => {
    const { body, documentElement } = document;
    const visualViewport = window.visualViewport;
    const syncHalisahaViewportHeight = () => {
      const viewportHeight = Math.round(visualViewport?.height ?? window.innerHeight);
      documentElement.style.setProperty("--halisaha-page-viewport-height", `${viewportHeight}px`);
    };

    if (halisaha) {
      documentElement.style.setProperty("--app-header-height", "0px");
      documentElement.classList.add("halisaha-app-route");
      body.classList.add("halisaha-app-route");
      syncHalisahaViewportHeight();
      window.addEventListener("resize", syncHalisahaViewportHeight);
      visualViewport?.addEventListener("resize", syncHalisahaViewportHeight);
      visualViewport?.addEventListener("scroll", syncHalisahaViewportHeight);
    } else {
      documentElement.style.removeProperty("--app-header-height");
      documentElement.style.removeProperty("--halisaha-page-viewport-height");
      documentElement.classList.remove("halisaha-app-route");
      body.classList.remove("halisaha-app-route");
    }

    return () => {
      window.removeEventListener("resize", syncHalisahaViewportHeight);
      visualViewport?.removeEventListener("resize", syncHalisahaViewportHeight);
      visualViewport?.removeEventListener("scroll", syncHalisahaViewportHeight);
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
