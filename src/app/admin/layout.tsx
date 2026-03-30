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
      <aside className="w-72 shrink-0 border-r border-nord-polarLighter/30 bg-white/80 flex flex-col min-h-screen">
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
      <main className="flex-1 min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 xl:px-10 2xl:px-12">
        <div className="mx-auto w-full max-w-[1560px]">{children}</div>
      </main>
    </div>
  );
}
