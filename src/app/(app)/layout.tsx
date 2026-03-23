import { requireAuth } from "@/lib/auth/get-user";
import { logoutAction } from "@/app/logout/actions";
import Link from "next/link";
import { Button } from "@/components/ui";
import {
  IconSchedule,
  IconLeaderboard,
  IconHighlights,
  IconPredictions,
  IconRules,
  IconAdmin,
} from "@/components/icons/nav-icons";
import { AppHeaderOffset } from "@/components/app-header-offset";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const navLinkClass =
    "flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-[0.95rem] border border-nord-polarLighter/20 bg-white/78 px-3 py-1.5 text-[12px] font-medium text-nord-polar shadow-[0_5px_16px_rgba(46,52,64,0.035)] transition-colors hover:border-nord-frostDark/35 hover:text-nord-frostDark md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-sm md:shadow-none";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeaderOffset />
      <header
        id="app-header"
        className="sticky top-0 z-40 border-b border-nord-polarLighter/25 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85"
      >
        <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-4 md:flex md:h-14 md:items-center md:justify-between md:py-0">
          <div className="md:flex md:items-center md:gap-8">
            <div className="flex items-center justify-between gap-4 md:block">
              <Link
                href="/schedule"
                className="text-lg font-light tracking-[0.18em] text-nord-polar uppercase hover:text-nord-frostDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded sm:text-xl sm:tracking-[0.22em]"
              >
                TIE-BREAK
              </Link>
              <div className="flex min-w-0 items-center gap-2 text-xs md:hidden">
                <span className="truncate text-nord-polarLight">
                  {user.name} {user.surname}
                </span>
                <form action={logoutAction} className="inline">
                  <Button type="submit" variant="ghost" size="sm">
                    Log out
                  </Button>
                </form>
              </div>
            </div>
            <nav className="mt-2 flex gap-2 overflow-x-auto px-px pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mt-0 md:overflow-visible md:px-0 md:pb-0 md:snap-none md:items-center md:gap-6">
              <Link
                href="/schedule"
                className={navLinkClass}
              >
                <IconSchedule />
                Schedule
              </Link>
              <Link
                href="/leaderboard"
                className={`${navLinkClass} text-nord-polarLight hover:text-nord-polar`}
              >
                <IconLeaderboard />
                Leaderboard
              </Link>
              <Link
                href="/highlights"
                className={`${navLinkClass} text-nord-polarLight hover:text-nord-polar`}
              >
                <IconHighlights />
                Highlights
              </Link>
              <Link
                href="/predictions"
                className={`${navLinkClass} text-nord-polarLight hover:text-nord-polar`}
              >
                <IconPredictions />
                My predictions
              </Link>
              <Link
                href="/rules"
                className={`${navLinkClass} text-nord-polarLight hover:text-nord-polar`}
              >
                <IconRules />
                Rules & prizes
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className={`${navLinkClass} text-nord-frostDark`}
                >
                  <IconAdmin />
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="hidden items-center gap-3 text-sm md:flex">
            <span className="text-nord-polarLight">
              {user.name} {user.surname}
            </span>
            <form action={logoutAction} className="inline">
              <Button type="submit" variant="ghost" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-2.5 py-2 sm:px-4 sm:py-6">{children}</main>
    </div>
  );
}
