import { requireAdmin } from "@/lib/auth/get-user";
import { logoutAction } from "@/app/logout/actions";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-[var(--background)] flex">
      <aside className="w-56 shrink-0 border-r border-nord-polarLighter/30 bg-white/80 flex flex-col min-h-screen">
        <AdminNav />
        <div className="p-4 border-t border-nord-polarLighter/30">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left rounded-lg px-3 py-2 text-sm text-nord-polarLight hover:bg-nord-snow hover:text-nord-polar"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0 mx-auto max-w-4xl px-6 py-6">{children}</main>
    </div>
  );
}
