"use client";

import { usePathname } from "next/navigation";

const LINKEDIN_URL = "https://www.linkedin.com/in/erenayvaz/";

/** Matches public Halisaha app route only (not /admin/halisaha). */
function isHalisahaPublicRoute(pathname: string | null) {
  return pathname === "/halisaha" || pathname?.startsWith("/halisaha/");
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  const halisaha = isHalisahaPublicRoute(pathname);

  if (halisaha) {
    return (
      <footer
        className="mt-auto border-t border-white/[0.08] bg-[linear-gradient(180deg,rgba(46,46,46,0.98)_0%,rgba(25,25,25,0.99)_100%)]"
        role="contentinfo"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-4 text-center">
          <span className="text-sm font-light tracking-wide text-white/[0.62]">
            Designed and built by Eren Ayvaz
          </span>
          <span className="text-white/35" aria-hidden>
            ·
          </span>
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-light tracking-wide text-[#a8c9bf] transition-colors hover:text-[#d4e4df] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#88c0d0]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
          >
            <LinkedInIcon className="shrink-0 text-[#8fbcbb]" />
            LinkedIn
          </a>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className="mt-auto border-t border-nord-polarLighter/20 bg-nord-snow/40"
      role="contentinfo"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-4 text-center">
        <span className="text-sm font-light tracking-wide text-nord-polarLighter">
          Designed and built by Eren Ayvaz
        </span>
        <span className="text-nord-polarLight/60" aria-hidden>
          ·
        </span>
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-light tracking-wide text-nord-polarLight transition-colors hover:text-nord-frostDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        >
          <LinkedInIcon className="shrink-0" />
          LinkedIn
        </a>
      </div>
    </footer>
  );
}
