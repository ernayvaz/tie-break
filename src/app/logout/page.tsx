import { logoutAction } from "./actions";

export default function LogoutPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4">
      <p className="text-nord-polarLight text-sm mb-4">Log out of your account?</p>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-lg bg-nord-frostDark text-white px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
