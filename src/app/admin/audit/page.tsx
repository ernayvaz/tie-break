import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui";
import { AuditLogFilters } from "./audit-log-filters";

const AUDIT_LOG_TAKE = 200;

const ACTION_LABELS: Record<string, string> = {
  user_approved: "User approved",
  user_rejected: "User rejected",
  user_blocked: "User blocked",
  user_unblocked: "User unblocked",
  username_updated: "Username updated",
  pin_reset: "PIN reset",
  user_deleted: "User deleted",
  match_created: "Match created",
  match_updated: "Match updated",
  match_deleted: "Match deleted",
  match_result_manual: "Match result (manual)",
  prediction_points_override: "Prediction points override",
};

function formatAction(actionType: string): string {
  return ACTION_LABELS[actionType] ?? actionType;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actionType?: string; targetType?: string }>;
}) {
  const params = await searchParams;
  const actionType = params.actionType?.trim() || undefined;
  const targetType = params.targetType?.trim() || undefined;

  const where: { actionType?: string; targetType?: string } = {};
  if (actionType) where.actionType = actionType;
  if (targetType) where.targetType = targetType;

  const logs = await prisma.adminLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: AUDIT_LOG_TAKE,
    include: {
      adminUser: { select: { name: true, surname: true } },
    },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-nord-polar">Audit Log</h1>
      <p className="mt-2 text-sm text-nord-polarLight">
        Admin actions: user approval/reject/block, username and PIN changes, match create/edit/delete, manual results, and prediction point overrides.
      </p>
      <div className="mt-6 space-y-4">
        <AuditLogFilters actionType={actionType} targetType={targetType} />
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-nord-polarLight mb-4">
              Last {AUDIT_LOG_TAKE} entries (newest first).
            </p>
            {logs.length === 0 ? (
              <p className="text-sm text-nord-polarLight">
                No audit entries match the selected filters.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-nord-polarLighter text-left text-nord-polarLight">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Admin</th>
                      <th className="pb-2 pr-4">Action</th>
                      <th className="pb-2 pr-4">Target</th>
                      <th className="pb-2 pr-4">Old value</th>
                      <th className="pb-2">New value</th>
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
                        <td className="py-2 pr-4 text-nord-polar">
                          {log.adminUser.name} {log.adminUser.surname}
                        </td>
                        <td className="py-2 pr-4 text-nord-polar">
                          {formatAction(log.actionType)}
                        </td>
                        <td className="py-2 pr-4 text-nord-polar">
                          {log.targetType} ({log.targetId})
                        </td>
                        <td className="py-2 pr-4 text-nord-polarLight text-xs max-w-[12rem] truncate" title={log.oldValue ?? undefined}>
                          {log.oldValue ?? "–"}
                        </td>
                        <td className="py-2 text-nord-polarLight text-xs max-w-[12rem] truncate" title={log.newValue ?? undefined}>
                          {log.newValue ?? "–"}
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
