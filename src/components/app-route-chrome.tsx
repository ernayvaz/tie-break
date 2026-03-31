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
    const { body } = document;
    if (halisaha) {
      document.documentElement.style.setProperty("--app-header-height", "0px");
      body.classList.add("halisaha-app-route");
    } else {
      document.documentElement.style.removeProperty("--app-header-height");
      body.classList.remove("halisaha-app-route");
    }

    return () => {
      body.classList.remove("halisaha-app-route");
    };
  }, [halisaha]);

  return (
    <div
      className={
        halisaha
          ? "min-h-[100dvh] bg-[#171717]"
          : "min-h-screen bg-[var(--background)]"
      }
    >
      {halisaha ? null : header}
      <main
        className={
          halisaha
            ? "app-shell-main mx-auto max-w-7xl bg-transparent px-0 py-0 sm:px-0 sm:py-0"
            : "app-shell-main mx-auto max-w-7xl px-2.5 py-2 sm:px-4 sm:py-6"
        }
      >
        {children}
      </main>
    </div>
  );
}
