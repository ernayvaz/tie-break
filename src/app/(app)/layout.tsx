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

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-nord-polarLighter/30 bg-white/80">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-2 px-3 py-2 sm:px-4 sm:py-2 md:h-14 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 md:w-auto md:gap-8">
            <Link
              href="/schedule"
              className="text-lg font-light tracking-[0.18em] text-nord-polar uppercase hover:text-nord-frostDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded sm:text-xl sm:tracking-[0.22em]"
            >
              TIE-BREAK
            </Link>
            <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-sm sm:gap-x-5 md:flex-nowrap md:gap-x-6">
              <Link
                href="/schedule"
                className="flex items-center gap-2 font-medium text-nord-polar hover:text-nord-frostDark"
              >
                <IconSchedule />
                Schedule
              </Link>
              <Link
                href="/leaderboard"
                className="flex items-center gap-2 text-nord-polarLight hover:text-nord-polar"
              >
                <IconLeaderboard />
                Leaderboard
              </Link>
              <Link
                href="/predictions"
                className="flex items-center gap-2 text-nord-polarLight hover:text-nord-polar"
              >
                <IconPredictions />
                My predictions
              </Link>
              <Link
                href="/rules"
                className="flex items-center gap-2 text-nord-polarLight hover:text-nord-polar"
              >
                <IconRules />
                Rules & prizes
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 text-nord-frostDark font-medium hover:underline"
                >
                  <IconAdmin />
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex w-full items-center justify-end gap-3 text-xs sm:text-sm md:w-auto">
            <span className="hidden text-nord-polarLight sm:inline">
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
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
