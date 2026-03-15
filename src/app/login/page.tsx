import Link from "next/link";
import { loginAction } from "./actions";
import { LoginForm } from "./login-form";
import { LeagueLogosCircle } from "./league-logos";

type Props = {
  searchParams: Promise<{ from?: string; invite?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { invite } = await searchParams;
  const registerHref = invite ? `/register?invite=${encodeURIComponent(invite)}` : "/register";

  return (
    <main className="min-h-screen flex bg-[var(--background)]">
      {/* Left: Sign-in area */}
      <section className="flex-1 flex flex-col items-center justify-center px-8 py-12 sm:px-12 lg:px-16">
        <div className="w-full max-w-[360px]">
          <h1 className="text-[2rem] sm:text-[2.5rem] font-light tracking-[0.22em] text-nord-polar uppercase">
            Tie-Break
          </h1>
          <p className="mt-3 text-sm tracking-wide text-nord-polarLighter">
            Sign in to the prediction platform
          </p>

          <div className="mt-10">
            <LoginForm loginAction={loginAction} />
          </div>

          <p className="mt-8 text-center text-sm text-nord-polarLighter">
            Don&apos;t have an account?{" "}
            <Link
              href={registerHref}
              className="font-medium text-nord-frostDark hover:text-nord-frost transition-colors"
            >
              Register
            </Link>
            {!invite && (
              <span className="block mt-2 text-xs text-nord-polarLighter/80">
                An invite link is required to register.
              </span>
            )}
          </p>
        </div>
      </section>

      {/* Thin vertical divider */}
      <div
        className="hidden lg:block w-px min-h-full shrink-0 bg-nord-polarLighter/20"
        aria-hidden
      />

      {/* Right: League logos – Champions League centre, others inside the circle */}
      <section
        className="hidden lg:flex flex-1 flex-col items-center justify-center px-8 py-12 bg-nord-snow/30"
        aria-label="League logos"
      >
        <LeagueLogosCircle />
        <p className="mt-6 text-center text-xs font-medium tracking-wider text-nord-polarLighter uppercase">
          Predict • Score • Leaderboard
        </p>
      </section>
    </main>
  );
}
