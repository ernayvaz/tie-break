"use client";

import { useEffect } from "react";

type Props = {
  targetId?: string;
};

export function AppHeaderOffset({ targetId = "app-header" }: Props) {
  useEffect(() => {
    const header = document.getElementById(targetId);
    if (!header) return;

    const updateOffset = () => {
      const height = header.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--app-header-height", `${height}px`);
    };

    updateOffset();
    window.addEventListener("resize", updateOffset);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateOffset();
          })
        : null;

    observer?.observe(header);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateOffset);
    };
  }, [targetId]);

  return null;
}
