"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentPropsWithoutRef, useCallback, useRef } from "react";

type PrefetchLinkProps = ComponentPropsWithoutRef<typeof Link>;

export function PrefetchLink({
  href,
  onMouseEnter,
  onTouchStart,
  onFocus,
  prefetch = true,
  ...props
}: PrefetchLinkProps) {
  const router = useRouter();
  const prefetchedHrefRef = useRef<string | null>(null);

  const prefetchOnIntent = useCallback(() => {
    if (!prefetch || typeof href !== "string" || prefetchedHrefRef.current === href) {
      return;
    }

    prefetchedHrefRef.current = href;
    router.prefetch(href);
  }, [href, prefetch, router]);

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onMouseEnter={(event) => {
        prefetchOnIntent();
        onMouseEnter?.(event);
      }}
      onTouchStart={(event) => {
        prefetchOnIntent();
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        prefetchOnIntent();
        onFocus?.(event);
      }}
      {...props}
    />
  );
}
