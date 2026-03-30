import Link from "next/link";
import { requireAdmin } from "@/lib/auth/get-user";
import { prisma } from "@/lib/db";
import { getHalisahaAdminSnapshot } from "@/lib/halisaha/server";
import { Button } from "@/components/ui";
import { HalisahaAdminClient } from "./halisaha-admin-client";

export default async function AdminHalisahaPage() {
  await requireAdmin();

  const [snapshot, approvedUsers] = await Promise.all([
    getHalisahaAdminSnapshot(),
    prisma.user.findMany({
      where: { status: "approved" },
      orderBy: [{ role: "asc" }, { name: "asc" }, { surname: "asc" }],
      select: {
        id: true,
        name: true,
        surname: true,
        username: true,
        role: true,
      },
    }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">
        Halisaha Management
      </h1>
      <p className="mt-2 text-sm text-nord-polarLight">
        Configure the active Halisaha match, assign registered players or guests,
        manage question sets, and score results after the match.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)]/80 bg-gradient-to-r from-white to-nord-snow/40 px-4 py-3">
        <p className="text-sm text-nord-polarLight">
          Review active and archived user answers, timestamps, outcomes, MVP votes, and legacy
          snapshots from one premium history surface.
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/halisaha/predictions">Prediction history & overrides</Link>
        </Button>
      </div>
      <HalisahaAdminClient snapshot={snapshot} approvedUsers={approvedUsers} />
    </div>
  );
}
