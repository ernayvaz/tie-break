import Link from "next/link";
import { requireAuth } from "@/lib/auth/get-user";
import { logoutAction } from "@/app/logout/actions";
import { Button } from "@/components/ui";
import { IconSchedule, IconLeaderboard, IconPredictions, IconRules, IconAdmin } from "@/components/icons/nav-icons";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const navLinkClass =
    "flex items-center gap-2 rounded-lg border border-nord-polarLighter/20 bg-white/70 px-3 py-2 text-xs font-medium text-nord-polar transition-colors hover:border-nord-frostDark/35 hover:text-nord-frostDark md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-sm";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-nord-polarLighter/25 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
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
            <nav className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:mt-0 md:flex md:items-center md:gap-6">
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
                  className={`${navLinkClass} col-span-2 text-nord-frostDark sm:col-span-4 md:col-auto`}
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
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
    </div>
  );
}
