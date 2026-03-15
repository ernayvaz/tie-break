import { prisma } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui";
import { SyncMatchesButton } from "../sync-matches-button";

const API_LOG_TAKE = 50;

export default async function AdminApiPage() {
  const logs = await prisma.apiSyncLog.findMany({
    orderBy: { createdAt: "desc" },
    take: API_LOG_TAKE,
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">API & Sync</h1>
      <p className="mt-2 text-sm text-nord-polarLight">
        Resync matches and results from football-data.org (UEFA Champions League). After sync, scores and leaderboard are recalculated automatically. Manual result entry is in{" "}
        <Link href="/admin/matches" className="text-nord-frostDark hover:underline">
          Match Management
        </Link>
        .
      </p>
      <div className="mt-6 space-y-6">
        <Card>
          <CardContent className="py-6">
            <h2 className="text-sm font-semibold text-nord-polar mb-2">Resync from API</h2>
            <p className="text-sm text-nord-polarLight mb-4">
              Fetch the latest matches and results from football-data.org. Existing matches are updated; new matches are added. Leaderboard is rebuilt after sync.
            </p>
            <SyncMatchesButton />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <h2 className="text-sm font-semibold text-nord-polar mb-4">API sync log</h2>
            <p className="text-sm text-nord-polarLight mb-4">
              Last {API_LOG_TAKE} sync operations. Admin actions (user approve, match edit, etc.) are in{" "}
              <Link href="/admin/audit" className="text-nord-frostDark hover:underline">
                Audit Log
              </Link>
              .
            </p>
            {logs.length === 0 ? (
              <p className="text-sm text-nord-polarLight">No sync operations recorded yet. Run &quot;Sync matches from API&quot; above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-nord-polarLighter text-left text-nord-polarLight">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Provider</th>
                      <th className="pb-2 pr-4">Action</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-nord-polarLighter/50">
                        <td className="py-2 pr-4 text-nord-polar whitespace-nowrap">
                          {log.createdAt.toLocaleString("tr-TR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="py-2 pr-4 text-nord-polar">{log.provider}</td>
                        <td className="py-2 pr-4 text-nord-polar">{log.action}</td>
                        <td className="py-2 pr-4">
                          <span className={log.status === "success" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2 text-nord-polarLight text-xs max-w-xs truncate" title={log.errorMessage ?? undefined}>
                          {log.errorMessage ?? "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
