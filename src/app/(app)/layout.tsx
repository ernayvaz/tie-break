import { requireAuth } from "@/lib/auth/get-user";
import { logoutAction } from "@/app/logout/actions";
import Link from "next/link";
import { Button } from "@/components/ui";
import {
  IconSchedule,
  IconLeaderboard,
  IconHighlights,
  IconHalisaha,
  IconPredictions,
  IconRules,
  IconAdmin,
} from "@/components/icons/nav-icons";
import { AppHeaderOffset } from "@/components/app-header-offset";
import { AppRouteChrome } from "@/components/app-route-chrome";
import { canAccessHalisahaMode } from "@/lib/halisaha/public-access";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const navLinkClass =
    "flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-[0.95rem] border border-nord-polarLighter/20 bg-white/78 px-3 py-1.5 text-[12px] font-medium text-nord-polar shadow-[0_5px_16px_rgba(46,52,64,0.035)] transition-colors hover:border-nord-frostDark/35 hover:text-nord-frostDark md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-sm md:shadow-none";
  const turfNavLinkClass =
    "flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-[0.95rem] border border-pitch-line/25 bg-[linear-gradient(135deg,rgba(74,124,89,0.98),rgba(60,101,72,0.96),rgba(107,155,122,0.92))] px-3 py-1.5 text-[12px] font-semibold text-pitch-white shadow-[0_8px_18px_rgba(45,74,62,0.18)] transition-all hover:brightness-[1.04] hover:shadow-[0_10px_22px_rgba(45,74,62,0.22)] md:rounded-[0.95rem] md:border md:border-pitch-line/25 md:bg-[linear-gradient(135deg,rgba(74,124,89,0.98),rgba(60,101,72,0.96),rgba(107,155,122,0.92))] md:px-3 md:py-1.5 md:text-sm md:text-pitch-white md:shadow-[0_8px_18px_rgba(45,74,62,0.18)]";

  return (
    <AppRouteChrome
      header={
        <>
          <AppHeaderOffset />
          <header
            id="app-header"
            className="app-shell-header sticky top-0 z-40 border-b border-nord-polarLighter/25 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85"
          >
            <div className="app-shell-header-inner mx-auto max-w-7xl px-3 py-2.5 sm:px-4 md:flex md:h-14 md:items-center md:justify-between md:py-0">
              <div className="app-shell-header-main md:flex md:items-center md:gap-8">
                <div className="app-shell-header-brand flex items-center justify-between gap-4 md:block">
                  <Link
                    href="/schedule"
                    className="text-lg font-light tracking-[0.18em] text-nord-polar uppercase hover:text-nord-frostDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded sm:text-xl sm:tracking-[0.22em]"
                  >
                    TIE-BREAK
                  </Link>
                  <div className="app-shell-mobile-user flex min-w-0 items-center gap-2 text-xs md:hidden">
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
                <nav className="app-shell-nav mt-2 flex gap-2 overflow-x-auto px-px pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mt-0 md:overflow-visible md:px-0 md:pb-0 md:snap-none md:items-center md:gap-6">
                  <Link href="/schedule" className={navLinkClass}>
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
                  {canAccessHalisahaMode(user.role) && (
                    <Link href="/halisaha" className={turfNavLinkClass}>
                      <IconHalisaha />
                      Halisaha Mode
                    </Link>
                  )}
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
                    <Link href="/admin" className={`${navLinkClass} text-nord-frostDark`}>
                      <IconAdmin />
                      Admin
                    </Link>
                  )}
                </nav>
              </div>
              <div className="app-shell-desktop-user hidden items-center gap-3 text-sm md:flex">
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
        </>
      }
    >
      {children}
    </AppRouteChrome>
  );
}
