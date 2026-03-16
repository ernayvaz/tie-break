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
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link
              href="/schedule"
              className="text-xl font-light tracking-[0.22em] text-nord-polar uppercase hover:text-nord-frostDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded"
            >
              TIE-BREAK
            </Link>
            <nav className="flex items-center gap-6 text-sm">
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
          <div className="flex items-center gap-3 text-sm">
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
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
